# FormJet – fejlesztői leírás

Ez a leírás azoknak szól, akik a FormJet kódján dolgoznak: új mezőtípust kötnek be, bővítik a konfigurációs sémát vagy a tervezőt, illetve hibát keresnek. A telepítés rövid változata a `README.md`-ben, a Claude Code számára készült szabályok a `CLAUDE.md`-ben vannak.

## Tartalom

1. [Áttekintés](#1-áttekintés)
2. [Fejlesztői környezet](#2-fejlesztői-környezet)
3. [Projekt felállítása](#3-projekt-felállítása)
4. [Helyi futtatás és hibakeresés](#4-helyi-futtatás-és-hibakeresés)
5. [Kódstruktúra és adatfolyam](#5-kódstruktúra-és-adatfolyam)
6. [Konfigurációs séma referencia](#6-konfigurációs-séma-referencia)
7. [Form-string formátumok](#7-form-string-formátumok)
8. [Receptek](#8-receptek)
9. [Tesztelés](#9-tesztelés)
10. [Kiadás és telepítés](#10-kiadás-és-telepítés)
11. [Gyakori problémák](#11-gyakori-problémák)
12. [Biztonsági megfontolások](#12-biztonsági-megfontolások)

---

## 1. Áttekintés

A FormJet egy SPFx **Form Customizer** kiterjesztés. A lista tartalomtípusára kötve a gyári New, Edit és Display formok helyett fut. Három réteget különítünk el:

| Réteg | Mappa | Szabály |
| --- | --- | --- |
| Logika | `engine/` | Tiszta függvények. Nem hív SharePointot, nem importál Reactot. Egységtesztelhető. |
| Szolgáltatások | `services/` | Minden SharePoint-kommunikáció itt van, PnPjs v4-gyel. |
| Felület | `components/` | React függvénykomponensek, Fluent UI v8. Csak a szolgáltatásokon keresztül ér el adatot. |

A tervező (admin mód) és a felhasználói form **ugyanazt** a `FormRenderer`-t használja, így az előnézet pontosan azt mutatja, amit a felhasználó látni fog.

## 2. Fejlesztői környezet

| Eszköz | Megjegyzés |
| --- | --- |
| Node.js | Az SPFx verzió által előírt főverzió. Érdemes `nvm`-mel kezelni. |
| SPFx generátor vagy SPFx CLI | A projekt létrehozásához. Az SPFx 1.25 után a CLI veszi át a generálást. |
| VS Code | Ajánlott bővítmények: ESLint, Prettier, Claude Code. |
| PnP.PowerShell 2.x | A `scripts/Provision-FormJet.ps1` futtatásához. Saját Entra ID alkalmazásregisztráció kell hozzá. |
| Fejlesztői tenant | Saját site, app catalog és legalább egy tesztlista. Éles tenanton ne fejlessz. |

A tesztlistán érdemes minden támogatott és tervezett mezőtípusból egy oszlopot létrehozni. Így egyetlen formon látszik, mi működik és mi nem.

## 3. Projekt felállítása

A repó csak a `src`, `scripts`, `samples` és `docs` mappát tartalmazza. A build eszközláncot a generátor hozza létre, mert az SPFx verziótól függ (gulp ≤ 1.21, Heft 1.22+).

1. Generálj projektet:
   - Solution name: `formjet`
   - Component type: Extension → **Form Customizer**
   - Name: `FormJet`
   - Template: **React**
2. Másold a repó `src/extensions/formJet/` tartalmát a generált mappába. A `FormJetFormCustomizer.ts`-t írd felül, a **generált manifestet tartsd meg**.
3. Töröld a generált, már nem használt fájlokat (régi `components/`, `.module.scss`), különben a lint hibát jelezhet.
4. Függőségek:
   ```
   npm install @pnp/sp@4 @fluentui/react@8
   ```
5. Másold a `CLAUDE.md`-t, a `scripts/`, `samples/` és `docs/` mappát a projekt gyökerébe.
6. Ellenőrzés: `npx tsc --noEmit -p .` hiba nélkül fusson.

## 4. Helyi futtatás és hibakeresés

### serve.json

A generált `config/serve.json` Form Customizer konfigurációját állítsd a tesztlistára. Minden módhoz érdemes külön bejegyzést tartani:

```json
{
  "serveConfigurations": {
    "default": {
      "pageUrl": "https://contoso.sharepoint.com/sites/formjet-dev/_layouts/15/SPListForm.aspx",
      "formCustomizer": {
        "componentId": "<manifest id>",
        "PageType": 8,
        "RootFolder": "/sites/formjet-dev/Lists/Teszt"
      }
    },
    "edit": {
      "pageUrl": "https://contoso.sharepoint.com/sites/formjet-dev/_layouts/15/SPListForm.aspx",
      "formCustomizer": {
        "componentId": "<manifest id>",
        "PageType": 6,
        "RootFolder": "/sites/formjet-dev/Lists/Teszt",
        "ID": 1
      }
    },
    "display": {
      "pageUrl": "https://contoso.sharepoint.com/sites/formjet-dev/_layouts/15/SPListForm.aspx",
      "formCustomizer": {
        "componentId": "<manifest id>",
        "PageType": 4,
        "RootFolder": "/sites/formjet-dev/Lists/Teszt",
        "ID": 1
      }
    }
  }
}
```

`PageType`: 8 = New, 6 = Edit, 4 = Display. Egy adott konfiguráció indítása gulp esetén `gulp serve --config edit`; Heft esetén `npm start -- --serve-config edit`. A `pageUrl` `{tenantDomain}` helyére a `SPFX_SERVE_TENANT_DOMAIN` környezeti változó értéke kerül.

### Hibakeresés

- A böngésző fejlesztői eszközeiben a forráskód a `webpack://` alatt, TypeScriptként jelenik meg (source map).
- A betöltés lépései a `FormHost` `useEffect`-jében vannak; mentésnél a `FormHost.save` a belépési pont.
- A SharePoint válaszait a Network fülön a `_api/` kérések között érdemes nézni. A `validateUpdateListItem` válaszában mezőnként szerepel a `HasException` és az `ErrorMessage`.
- Admin és nem admin viselkedést két böngészőprofillal (két felhasználóval) érdemes párhuzamosan tesztelni.

## 5. Kódstruktúra és adatfolyam

### Betöltés

1. `FormJetFormCustomizer.render()` átadja a `FormHost`-nak: mód, lista azonosító és cím, elem azonosító, tartalomtípus.
2. `SchemaService.resolveContentTypeId`: ha New módban nincs tartalomtípus, a lista első nem mappa típusú tartalomtípusát veszi.
3. Párhuzamosan:
   - `SchemaService.getFields` – mezőséma,
   - `ConfigService.load` – konfiguráció (hiba esetén alapértelmezett elrendezés és admin figyelmeztetés),
   - `ItemService.load` – Edit/Display módban az elem értékei (`FieldValuesForEdit`, `FieldValuesAsText`, `Modified`).
4. New módban a kezdőértékek: a konfig `defaultValue`-ja, ennek hiányában egyszerű típusoknál a séma `DefaultValue`-ja.
   Dátum mezőnél a `[today]` a mai napot jelenti (dátum + idő mezőnél a mostani időpontot, az időválasztó 5 perces lépésközére kerekítve), a SharePoint által ISO alakban tárolt rögzített dátum pedig a web kultúrája szerinti form-stringgé alakul (`resolveDateDefault`); a számított alapérték (pl. `=Today+7`) nincs kezelve.
   Személy mezőnél (`User`, `UserMulti`) a konfig `defaultValue`-ját a `UserValue.resolveUserDefault` alakítja form-stringgé: kész JSON tömb, vagy pontosvesszővel elválasztott lista, amelynek elemei `[me]` (a bejelentkezett felhasználó, a `pageContext.user`-ből, `i:0#.f|membership|<loginName>` kulccsal), e-mail-cím, bejelentkezési név vagy csoportnév. Az e-mail-cím és a név változatlanul kerül a `Key`-be, a SharePoint mentéskor oldja fel. Egyértékű mezőnél csak az első elem számít.
5. Minden értékváltozáskor a `resolveForm` újraszámolja a feltételeket. Ez olcsó művelet; ne tegyél bele aszinkron hívást.

### Mentés (`FormHost.save`)

1. Kliens oldali ellenőrzés: a látható, kötelező mezők nem lehetnek üresek.
2. A `changed` objektumba csak a **látható, szerkeszthető és módosult** mezők kerülnek.
3. Edit módban ütközésvizsgálat: ha a `Modified` megváltozott, a felhasználó felülírhat vagy újratölthet.
4. `ItemService.save`: Edit módban `validateUpdateListItem`, New módban `addValidateUpdateItemUsingPath` a tartalomtípussal.
5. Mezőnkénti hibák a mezők alá kerülnek; a nem látható mezők hibái a felső üzenetsávba.
6. A mellékletek törlése és feltöltése a mentett elemhez (`AttachmentService.sync`); részleges hibánál a form nyitva marad.
7. Siker esetén `formSaved()`.

### Tervező

**Kijelölés alapú panel.** A `DesignerPanel` mindig a kijelölt elem (`DesignerSelection`: `{ kind: 'form' }` | `{ kind: 'section', id }` | `{ kind: 'field', name }`) beállításait mutatja. A kijelölést a `FormHost` tartja (`selection`, `selectDesignElement`); a panel a nem létező elemre mutató kijelölést (törlés, JSON-csere után) az űrlapra ejti vissza.
- Kijelölés: az űrlapé az előnézet fölötti „Űrlap beállításai” gombbal; a szakaszé és a mezőé a `DesignCanvas` fogantyúja melletti fogaskerékkel (`SettingsButton`, a `FormRenderer` `onSectionSelect` / `onFieldSelect` propján át); a mezőé a cellára kattintva is. A kijelölt szakasz és mező kiemelést kap (`selectedSection`, `selectedField`).
- A panel: morzsamenü (Űrlap › szakasz › mező), mindig látható, összecsukható „Nem elhelyezett mezők” sáv (a behúzható paletta), majd fülek: Tulajdonságok és Stílus; az űrlapnál ezen felül Változók és JSON. Az űrlap tulajdonságai között van a fa nézet (szakaszok és mezők, kattintással kijelölhetők), a „Feltétel több mezőre” és az „Új szakasz”.
- A `StylePanel` csak a kijelölt elem stílusát mutatja (`target`).

- A `startDesign` a konfiguráció mély másolatán dolgozik (`draft`). A mégse gomb egyszerűen eldobja.
- **Húzd-és-ejtsd:** tervező módban az előnézetet a `DesignCanvas` rajzolja (dnd-kit). A szekciók és a mezők jobb felső sarkában fogantyú jelenik meg; a mező szekción belül és szekciók között, a szekció a többi szekció között helyezhető át. Üres szekció ejtési célként látszik. Billentyűzettel is működik (a fogantyún szóköz, nyilak, szóköz; Esc megszakítja és visszaállítja az elrendezést).
  - A `DesignCanvas` ugyanazt a `FormRenderer`-t használja, csak a `slots` propon keresztül becsomagolja a szekciókat, a rácsot és a cellákat. A kapott `className`-et a saját gyökerére teszi, így a rács és a stílus változatlan.
  - Az áthelyezést az `engine/LayoutMoves.ts` tiszta függvényei végzik (`moveSection`, `reorderField`, `moveFieldToSection`); másik szekcióba kerülő mező szélessége a célszekció oszlopszámához igazodik.
  - Külön csomagrész (`formjet-designer`), amelyet a `FormHost` csak tervező módban tölt be; amíg töltődik, a sima előnézet látszik.
  - **Új mező behúzása:** a még el nem helyezett mezők a tervező panel tetején, a mindig látható „Nem elhelyezett mezők” sávban behúzható címkékként jelennek meg. Az előnézet egy mezőjére ejtve a mező elé, a szekció üres területére ejtve a szekció végére kerülnek (`addFieldToSection`); húzás közben kék jelölés mutatja a célt. A szakasz tulajdonságai között lévő „Mező hozzáadása” lista is megmaradt.
  - Az előnézet és a mezőlista egy közös húzási környezetben van: a `DesignCanvas` a két részt (`preview`, `palette`) a gyerekfüggvényének adja át, a `FormHost` illeszti az elrendezésbe. A `DesignerPanel` a listát kész elemként kapja (`unplacedPalette`), így nem függ a dnd-kittől.
  - A becsukott szekcióba nem lehet mezőt ejteni.
- Az előnézet `previewMode`-ban (New/Edit/Display) a `draft`-ot rendereli, rejtett elemekkel halványan.
- A `ConfigService.save` ETag-gel ír. 412 → `ConfigConflictError`, 403 → jogosultsági üzenet.

## 6. Konfigurációs séma referencia

Forrás: `models/IFormConfig.ts`. Példa: `samples/config-example.json`.

A tartalomtípus mezői közül a rejtett és a számított megjelenítő (`Computed`, pl. `LinkTitle`) mezők nem kerülnek a sémába, így a tervezőben sem választhatók. Ha egy korábbi konfiguráció ilyen mezőre hivatkozik, az admin a „nem létező mezők” figyelmeztetést látja.

### IFormConfig

| Tulajdonság | Típus | Kötelező | Jelentés |
| --- | --- | --- | --- |
| `schemaVersion` | `3` | igen | Sémaverzió, a migráció alapja. Az `1`-es és `2`-es konfigurációt a `parseConfig` átalakítás nélkül elfogadja (a 2-es a `texts`, a 3-as a `variables` résszel bővült), és a tervező mentésekor 3-asként íródik vissza. |
| `listId` | string | igen | A cél lista GUID-ja. |
| `contentTypeId` | string | igen | A lista tartalomtípusának azonosítója. |
| `title` | string | nem | A form fejléce. |
| `labelPosition` | `'top'` \| `'left'` | nem | Címkék helye. Alapértelmezés: `top`. A `left` még nincs megvalósítva a renderelőben. |
| `sections` | `ISectionConfig[]` | igen | Szekciók megjelenési sorrendben. |
| `fields` | `Record<InternalName, IFieldConfig>` | igen | Mezőnkénti beállítások. |
| `texts` | `Record<azonosító, ITextElement>` | nem | Szövegelemek (lásd lent). |
| `variables` | `Record<név, IFormVariable>` | nem | A form változói (lásd lent). |

### ISectionConfig

| Tulajdonság | Típus | Alapértelmezés | Jelentés |
| --- | --- | --- | --- |
| `id` | string | – | Egyedi azonosító a konfiguráción belül. |
| `title`, `description` | string | – | Fejléc és leírás. |
| `conditional` | `{ title?, description? }`, mindegyik `IConditionalValue[]` | – | A cím és a leírás feltételes értékei (lásd „Feltételes értékek”). |
| `columns` | 1–4 | – | Rácsoszlopok száma. |
| `collapsible`, `collapsed` | boolean | false | Becsukható-e, és alapból csukva van-e. |
| `visibleIn` | `FormMode[]` | mindhárom | Mely módokban látszik. |
| `visibleWhen` | `Condition` | – | Feltételes láthatóság. |
| `readOnlyWhen` | `Condition` | – | Ha teljesül, a szakasz minden mezője csak olvasható (gombnál: letiltott), a mezők saját `readOnlyIn` / `readOnlyWhen` beállítása mellett (VAGY kapcsolat). A kötelezőséget nem érinti: a csak olvasható mező a mentés ellenőrzéséből amúgy is kimarad. |
| `fields` | `IFieldPlacement[]` | – | `{ field, colSpan? }`, a sorrend a megjelenési sorrend. |

### IFieldConfig

| Tulajdonság | Típus | Alapértelmezés | Jelentés |
| --- | --- | --- | --- |
| `label`, `description`, `placeholder` | string | séma szerint | Megjelenítési szövegek. |
| `visibleIn` | `FormMode[]` | mindhárom | Láthatóság módonként. |
| `readOnlyIn` | `FormMode[]` | egyik sem | Csak olvasható módonként. Display módban minden csak olvasható. |
| `requiredIn` | `FormMode[]` | egyik sem | Kötelezőség módonként. **Csak szigorít.** |
| `visibleWhen`, `readOnlyWhen`, `requiredWhen` | `Condition` | – | Feltételes változatok. |
| `defaultValue` | string | – | Kezdőérték New módban, form-string formátumban. Dátum mezőnél `[today]`, ISO dátum vagy a web formátuma szerinti dátum is megadható. Személy mezőnél `[me]`, e-mail-cím vagy ezek pontosvesszővel elválasztott listája is. |
| `conditional` | `{ label?, description?, placeholder?, defaultValue? }`, mindegyik `IConditionalValue[]` | – | Feltételes értékek (lásd lent). |
| `attachmentsDisplay` | `'list'` \| `'compact'` | `list` | A mellékletek megjelenítése: soronként egy fájl, vagy tömören, egymás mellett. Csak az `Attachments` mezőnél. |
| `lookupDisplay` | `'auto'` \| `'checklist'` \| `'dropdown'` | `auto` | Többértékű keresőmező megjelenítése: mindig nyitott jelölőnégyzetes lista vagy lenyíló lista. `auto`: legfeljebb 8 választható elemnél jelölőnégyzetes lista, efelett lenyíló. |

Egy mező akkor látszik, ha a szekciója látszik, **és** a mező `visibleIn`, **és** `visibleWhen` feltétele is teljesül. Ami nincs egyetlen szekcióban sem, az nem jelenik meg.

### Feltételes értékek (`IFieldConfig.conditional`)

A mező címkéje, leírása, helykitöltő szövege és kezdőértéke feltételtől függően más lehet. Beállításonként szabályok sorrendezett listája adható meg:

```json
"fields": {
  "Title": {
    "label": "Megnevezés",
    "conditional": {
      "label": [
        { "when": { "field": "Category", "op": "eq", "value": "Informatika" }, "value": "Eszköz neve" },
        { "when": { "field": "[IsDisplayMode]", "op": "eq", "value": true }, "value": "Megnevezés (lezárva)" }
      ]
    }
  }
}
```

- **Az első teljesülő szabály értéke érvényes** (`ConditionalValue.pickConditionalValue`); ha egyik sem teljesül, a beállítás alapértéke (`label`, `description`, …, illetve a séma szerinti érték). A `when` nélküli szabály félkész, nem érvényesül (a tervezőben szerkesztés közben fordul elő).
- A `when` ugyanaz a `Condition`, mint a láthatóságnál: mezőértékre, a form módjára és csoporttagságra is épülhet.
- A címke, a leírás és a helykitöltő a `resolveForm`-ban oldódik fel, tehát kitöltés közben azonnal követi az értékeket. Az üres érték a leírásnál és a helykitöltőnél „nincs szöveg”-et jelent (a séma leírását is eltünteti); üres címke helyett a beállított címke, illetve a mező címe látszik.
- A **kezdőérték** szabályai New módban, a megnyitáskor értékelődnek ki egyszer (`getInitialValues`): az alap kezdőértékeken, a form módján és a csoporttagságon. A kiválasztott érték ugyanazon az átalakításon megy át, mint a `defaultValue` (`[today]`, `[me]`, …); az üres érték a kezdőértéket törli.
- Opcionális bővítés, sémaverzió-emelés nem kellett. A `parseConfig` ellenőrzi a szerkezetet és a feltételeket (`parseConditional`); az ismeretlen kulcsok kimaradnak.
- A tervezőben a mező tulajdonságai közül a négy szövegmező melletti gomb (`ConditionalValueEditor.tsx`) felugró ablakban szerkeszti a szabályokat; a gombon jelvény mutatja az érvényes szabályok számát. Szövegelemnél nincs ilyen beállítás.
- **Szekció:** ugyanez a szerkezet az `ISectionConfig.conditional`-ban a `title` és a `description` tulajdonságra (`SECTION_CONDITIONAL_PROPERTIES`), a szakasz tulajdonságai között ugyanazzal a gombbal. Itt az üres érték a címet is eltünteti (a szekciónak nem kötelező címe lenni). A `ConditionalValue.ts` függvényei a mezőre és a szekcióra közösek (`IConditionalHolder`).

### Változók (`IFormConfig.variables`)

Egyszer definiált, név szerint újrahasznosítható értékek a feltételekhez (`engine/FormVariables.ts`, szerkesztő: a tervező Változók füle, `VariablesPanel.tsx`). A feltételekben `[Var:<név>]` mezőként hivatkozhatók, a feltételszerkesztő mezőlistájában „Változó: …” néven.

| Tulajdonság | Típus | Jelentés |
| --- | --- | --- |
| `kind` | `'condition'` \| `'value'` | Feltétel: igen / nem (`1` / `0`); érték: egy mező (átalakított) értéke. |
| `when` | `Condition` | Feltétel fajtánál: mikor igaz. Hiányában a változó nem. |
| `field` | InternalName | Érték fajtánál: a forrásmező. |
| `saved` | boolean | Érték fajtánál: a mező mentett (betöltéskori, `loaded.original`) értéke az élő helyett; új elemnél üres. |
| `transforms` | `VariableTransform[]` | Érték fajtánál: sorban alkalmazott átalakítások: `substring` (`start`, `length?`), `number`, `trim`, `lower`, `upper`. |

```json
"variables": {
  "StatusNumber": { "kind": "value", "field": "Status", "saved": true,
                    "transforms": [{ "type": "substring", "start": 0, "length": 2 }, { "type": "number" }] },
  "HideLogistics": { "kind": "condition",
                     "when": { "any": [{ "field": "[IsNewMode]", "op": "eq", "value": true },
                                       { "field": "[Var:StatusNumber]", "op": "eq", "value": 1 }] } }
}
```

- A név betűvel kezdődik, utána betű, szám vagy aláhúzás (`isVariableName`). Átnevezéskor (`renameVariable`) a konfiguráció minden rá hivatkozó feltétele követi (`mapConfigConditions`: szekciók, mezők, feltételes értékek, változók). Törléskor a hivatkozások megmaradnak, értékük üres / nem.
- A kiértékelést a `ConditionContext.contextValues` végzi (`evaluateVariables`) a mezőértékek és a többi környezeti változó után, így a változó ezekre és más változókra is épülhet. A sorrendet a függőségek adják (`variableOrder`); a körkörös hivatkozásban érintett változó értéke nem / üres, a tervező figyelmeztet.
- A mentett értéket a `resolveForm` `savedValues` paramétere adja (a `FormHost` a `loaded.original`-t adja át). A kezdőértékek feltételeinél (`getInitialValues`) a mentett érték üres.
- A változó feltételében hivatkozott csoportot a `collectGroupIds` is felveszi, így a csoporttagság előre lekérdeződik.
- Kódot nem futtatunk: csak a `VARIABLE_TRANSFORMS` előre megírt átalakításai alkalmazhatók. Új átalakítás: `VariableTransform` típus + `VARIABLE_TRANSFORMS` + `FormVariables.applyTransform` és `parseTransform` + felirat a `VariablesPanel` `transformLabels` függvényében (és a loc fájlokban) + teszt.

**Feltétel több mezőre** (`engine/BulkConditions.ts`, `BulkConditionDialog.tsx`, az űrlap tulajdonságai között): ugyanaz a `visibleWhen` / `readOnlyWhen` / `requiredWhen` feltétel egyszerre több elhelyezett mezőre. Módok: felülírás, hozzáfűzés ÉS / VAGY kapcsolattal (`combineConditions`: az azonos fajta csoportot kiteríti, hogy a vizuális szerkesztő is kezelje), törlés. A felirat nem kaphat csak olvasható feltételt, a felirat és a gomb nem lehet kötelező; ezek a listában nem jelennek meg.

### Szövegelemek: felirat és gomb (ITextElement)

A `texts` mező nélküli elemeket tárol: a **felirat** a formon megjelenő, formázás nélküli szöveg, a **gomb** kattintásra egy címet nyit meg. Egyik mögött sincs SharePoint mező. (A felhasználói szövegekben a szövegelem neve „felirat”.)

| Tulajdonság | Típus | Kötelező | Jelentés |
| --- | --- | --- | --- |
| `kind` | `'text'` \| `'button'` | nem | Az elem fajtája; hiányában felirat. Gombnál kötelező, és az azonosító `button:` előtagú. |
| `name` | string | igen | Feliratnál megnevezés, csak a tervezőben látszik; gombnál a gomb felirata. |
| `content` | string | nem | Csak felirat: a formon megjelenő szöveg; a sortörések megmaradnak. |
| `url` | string | nem | Csak gomb: a megnyitandó cím. Csak `http(s)://`, `mailto:` vagy webhelyen belüli cím nyílik meg (`UrlValue.isSafeUrl`), más címmel a gomb nem navigál. |
| `newTab` | boolean | nem | Csak gomb: a cím új lapon nyílik meg (`rel="noopener noreferrer"`). |
| `icon` | string | nem | Csak gomb: Fluent UI ikonnév (`ButtonAction.isIconName`: csak betűk és számok); a hibás nevet a `parseConfig` elhagyja, az elrendezés érvényes marad. |
| `actions` | `ButtonAction[]` | nem | Csak gomb: kattintásra sorban lefutó lépések. Ha van lépés, az `url` nem számít. |

```json
"texts": { "text:1": { "name": "Kitöltési útmutató", "content": "Az összeget forintban add meg." } },
"sections": [{ "id": "s", "columns": 1, "fields": [{ "field": "text:1" }] }],
"fields": { "text:1": { "visibleIn": ["new", "edit"], "style": { "base": { "background": "#fff4ce", "textColor": "#323130" } } } }
```

- Az azonosító feliratnál `text:`, gombnál `button:` előtagú (`<előtag><betűk, számok, _ , ->`); a kettőspont miatt nem ütközhet mező belső nevével. A tervező fajtánként sorszámozva adja ki (`TextElement.addTextElement`). A `parseConfig` elutasítja, ha a fajta és az előtag nem egyezik.
- **Gomb:** a sémában `FormJetButton` típusú pszeudo-mező (`isButtonElement`; a felirat és a gomb közös neve `isLayoutElement`). A `readOnlyIn` / `readOnlyWhen` a gomb **letiltását** jelenti (a tervezőben „Letiltva…” felirattal), és csak ez dönt róla: megtekintéskor is működhet, és nem számít, hogy a pszeudo-mező csak olvasható. Kötelező soha nem lehet. A cím az `IResolvedField.button`-ba kerül; a `FieldRenderer` Fluent `DefaultButton`-t rajzol `href`-fel, a tervezőben (`designing`) `href` nélkül. A gomb stílusa (háttér, keret, betűszín) magára a gombra vonatkozik, a cella keret és háttér nélkül marad.
- A gomb a `FormHost.save`-ben akkor sem kerül az ellenőrzésbe vagy a `changed` objektumba, ha nincs letiltva (`isLayoutElement` kizárás).
- **A gomb műveletei** (`engine/ButtonAction.ts`, szerkesztő: `ButtonActionsEditor.tsx`):

  ```json
  "actions": [
    { "type": "setValue", "field": "Status", "value": "Jóváhagyva" },
    { "type": "setValue", "field": "ApprovedOn", "value": "[today]" },
    { "type": "save" }
  ]
  ```

  - `setValue`: a mező értéke a kezdőérték formátumában, a `LayoutResolver.resolveFieldValue` alakítja form-stringgé (`[today]`, `[me]`, …). A mező nélküli (félkész) lépés megmarad, futáskor kimarad. `save`: a `FormHost.save`, sikeres mentés után `formSaved()`. `close`: `formClosed()` mentés nélkül.
  - **Végrehajtás:** a `FormHost.runButtonActions` (a `FormContext.runButtonActions`-on át) a lépéseket sorban, `await`-tel futtatja. A beállított értékeket egy munkapéldányon gyűjti, és a mentést ezzel hívja (`save(false, working)`), mert a React állapot ekkor még nem frissült; a mentés a láthatóságot és a szerkeszthetőséget is erre számolja. A `save` és a `close` lezárja a sort (`effectiveActions`): új elemnél egy második mentés másolatot hozna létre, és a `formSaved()` a formot amúgy is bezárja. Sikertelen mentésnél a form nyitva marad.
  - **A beállított mező rejtetten és csak olvashatóként is mentődik** (a 2. kulcsdöntés egyeztetett kivétele): a `runButtonActions` a mezőt felveszi a `buttonSetFields` halmazba, és a `save` ezeket a látható, szerkeszthető mezőkön felül is a `changed` objektumba teszi, ha az értékük eltér a betöltéskoritól. A halmaz az űrlap élettartamáig megmarad (ütközés utáni felülírásnál, javítás utáni újramentésnél is érvényes). Csak a SharePoint szerint írható, form-string értékű mező állítható be (`ButtonAction.isButtonSettableField`: nem csak olvasható, a form kezeli a típusát, nem melléklet és nem kép); más mezőnél a lépés kimarad.
  - A lépésszerkesztő értékmezője a mező típusához igazodik (`ActionValueEditor`): választásnál a mező értékei közül (saját értéket engedő oszlopnál beírható is, üres választással törölhető), több választásnál több is (`;#A;#B;#`), igen/nem mezőnél Igen / Nem (`1` / `0`); egyébként szövegmező a kezdőérték formátumában. Másik mező választásakor az érték törlődik.
  - Megtekintéskor a `setValue` és a `save` kimarad, csak a `close` fut le. Futás közben a gomb le van tiltva.
  - Tetszőleges kód futtatása (`onClick` szkript) szándékosan nincs: a konfiguráció nem tartalmazhat végrehajtható kódot (12. fejezet). Új lépéstípus: `ButtonAction` típus + `BUTTON_ACTION_TYPES` + `parseButtonActions` + végrehajtás a `runButtonActions`-ban + választó a `ButtonActionsEditor`-ban + teszt.
- A szövegelem **pszeudo-mező**, mint a mellékletek: a `TextElement.withTextElements` `FormJetText` típusú, csak olvasható mezőként teszi a sémába, ezért a szekciókban ugyanúgy helyezhető el és húzható, mint egy mező, és ugyanúgy csak egyszer szerepelhet. A `resolveForm` és az `unplacedFields` maga is elvégzi ezt a kiegészítést; a `FormHost` a tervező paneljének és a húzd-és-ejtsd felületnek adja át a kiegészített sémát.
- A láthatóság (`visibleIn`, `visibleWhen`) és a stílus a `fields` azonos kulcsú bejegyzésében van; a többi `IFieldConfig` beállításnak szövegelemnél nincs hatása. A megjelenő szöveg az `IResolvedField.text`-be kerül, a `FieldRenderer` címke nélkül, `pre-wrap` szövegként írja ki (HTML-ként soha).
- Mivel csak olvasható és nincs értéke, a mentésbe nem kerülhet be, feltétel nem hivatkozhat rá (a `DesignerPanel` a feltételszerkesztőnek a szövegelemek nélküli sémát adja), és kezdőértéke sincs.
- Törlés: `TextElement.removeTextElement` (az elhelyezést, a `fields` bejegyzést és magát az elemet is eltávolítja). Ha egy elhelyezés nem létező szövegelemre mutat, az a „nem létező mezők” figyelmeztetésben jelenik meg.

### Stílus

A form (`IFormConfig.style`), a szekció (`ISectionConfig.style`) és a mező (`IFieldConfig.style`) is kaphat stílust. Mindhárom szerkezete azonos:

```json
"style": {
  "base":    { "accentColor": "#0f6cbd" },
  "new":     { "accentColor": "#107c10" },
  "display": { "background": "#faf9f8", "density": "compact" }
}
```

A `base` minden módban érvényes; a `new` / `edit` / `display` kulcs csak az eltérést tartalmazza, és tulajdonságonként felülírja az alapot. A feloldást az `engine/FormStyle.ts` `resolveModeStyle` függvénye végzi, az eredmény az `IResolvedForm` / `IResolvedSection` / `IResolvedField` `style` mezője.

| Szint | Tulajdonság | Érték | Hatás |
| --- | --- | --- | --- |
| Form | `accentColor` | hex szín | A form címének és a szekciófejléceknek a színe. |
| Form | `maxWidth` | 320–2400 | A form maximális szélessége képpontban. Alapértelmezés: 960. |
| Form | `density` | `comfortable` \| `compact` | Térköz a mezők és a szekciók között. |
| Form | `sectionHeader` | `underline` \| `bar` \| `plain` | Szekciófejléc: aláhúzott, színes sáv vagy egyszerű. |
| Szekció | `headerColor` | hex szín | A szekció fejlécének színe; hiányában a form `accentColor` értéke. |
| Mező | `labelColor` | hex szín | A mező címkéjének színe. |
| Mező | `textColor` | hex szín | A cella szövegének színe. A tervező csak szövegelemnél kínálja fel (ott a címke színe helyett); a vezérlők saját szövegszínét nem írja át. |

Háttér és keret – a formon, a szekción és a mezőn egyaránt megadható (`IBoxStyle`):

| Tulajdonság | Érték | Hatás |
| --- | --- | --- |
| `background` | hex szín | Egyszínű háttér. |
| `backgroundGradient` | `{ type, angle?, colors }` | Kétszínű színátmenet; ha meg van adva, ez látszik az egyszínű háttér helyett. |
| `borderColor` | hex szín | Keretszín. |
| `borderWidth` | 0–8 | Keretvastagság képpontban. Alapértelmezés: 1, ha van keretszín. |
| `borderRadius` | 0–24 | Lekerekítés képpontban. Alapértelmezés: 4. |

Ha az elemnek látható háttere vagy kerete van, belső margót is kap (form és szekció: 16, mező: 8 képpont).

A színátmenet szerkezete:

```json
"backgroundGradient": { "type": "linear", "angle": 135, "colors": ["#fff9f5", "#ffe8dc"] }
```

- `type`: `linear` vagy `radial`. A sugaras átmenet középről indul kifelé.
- `angle`: csak lineárisnál, 0–360 fok; alapértelmezés 180 (fentről lefelé).
- `colors`: pontosan két hex szín, kezdő és záró.
- A CSS értéket a `FormStyle.backgroundCss` rakja össze ezekből az ellenőrzött részekből; kész CSS szöveg nem adható meg.
- Módonkénti felülírásnál, ha a mód egyszínű hátteret ad meg színátmenet nélkül, az alap színátmenete nem öröklődik.
- Színátmenetes vagy sötét háttéren a szöveg olvashatóságáról a szerkesztőnek kell gondoskodnia (például a mező `labelColor` értékével).

Szabályok:

- A szín csak `#rgb` vagy `#rrggbb` lehet. Minden más értéket (név, `rgb()`, `url()`) a `parseConfig` hibaként elutasít, így a konfigurációból nem kerülhet tetszőleges CSS a lapra. Az ismeretlen kulcsok kimaradnak.
- A `style` opcionális; a korábbi, stílus nélküli konfigurációk változatlanul működnek, sémaverzió-emelés nem kellett.
- A stílus csak megjelenés: láthatóságot, kötelezőséget vagy mentést nem befolyásol.
- A Fluent vezérlők saját színeit (fókuszkeret, gombok) a stílus nem írja át.
- A renderelt elemeken stabil kapaszkodók vannak: `data-formjet-mode` a form törzsén, `data-section` a szekciókon, `data-field` a mezőkön.

A tervezőben a **Stílus** fülön szerkeszthető: felül az érvényesség (alap vagy egy mód), alatta a form, a kiválasztott szekció és a kiválasztott mező beállításai. Módonkénti szerkesztésnél az alapból örökölt érték helykitöltőként látszik.

### Kapcsolódó elemek (`ISectionConfig.related`)

Egy szekció a mezői alatt egy másik, **azonos webhelyen lévő** lista elemeit is felsorolhatja, csak olvasható táblázatban. Azok az elemek jelennek meg, amelyek `matchField` mezője megegyezik a megnyitott elem `sourceField` értékével.

```json
"related": {
  "listId": "11111111-1111-1111-1111-111111111111",
  "matchField": "RequestNumber",
  "sourceField": "Title",
  "columns": ["Title", "InvoiceDate", "Amount"],
  "sortField": "InvoiceDate",
  "sortAscending": false,
  "rowLimit": 20,
  "showNewButton": true
}
```

| Tulajdonság | Típus | Alapértelmezés | Jelentés |
| --- | --- | --- | --- |
| `listId` | GUID | – | A kapcsolódó lista azonosítója. |
| `matchField` | InternalName | – | A kapcsolódó lista párosító mezője. |
| `sourceField` | InternalName vagy `ID` | `ID` | Ennek a listának a mezője, amelynek értékével párosítunk. |
| `columns` | InternalName[] | – | A megjelenített oszlopok, sorrendben. Az első oszlop a kapcsolódó elem megtekintő formjára mutat (új lapon). |
| `sortField`, `sortAscending` | InternalName, boolean | `ID`, növekvő | Rendezés. |
| `rowLimit` | 1–500 | 30 | Sorok maximális száma; ha több elem van, a táblázat alatt jelzés látszik. |
| `showNewButton` | boolean | false | „Új elem” gomb, amely a kapcsolódó lista új elem formját nyitja meg új lapon. |

Tudnivalók:

- **Párosítható típusok** (mindkét oldalon): Text, Choice, Number, Currency, Integer, Counter (`ID`), Lookup. A lekérdezés módját a kapcsolódó lista párosító mezőjének típusa dönti el: szövegnél pontos egyezés, számnál a form-string számmá alakítva, keresőmezőnél a hivatkozott elem azonosítója szerint.
- **A párosítás a mentett értékkel történik**, nem a formon éppen szerkesztett értékkel. Ezért **New módban a felsorolás nem jelenik meg**; ha a szekcióban nincs mező, az egész szekció rejtve marad.
- A lekérdezés a felhasználó nevében fut (`renderListDataAsStream`), így csak azok az elemek látszanak, amelyekhez joga van. Az értékek a SharePoint megjelenítési formátumában érkeznek.
- **Nagy listánál** (5000 elem felett) a párosító mezőt indexelni kell, különben a lekérdezés hibát ad, és a szekcióban figyelmeztetés jelenik meg.
- Az „Új elem” gomb nem tölti ki előre a párosító mezőt, és a táblázat nem frissül magától; erre a szekció Frissítés gombja szolgál.
- A tervezőben félkész beállítás is menthető (például még nincs oszlop kiválasztva); ilyenkor a felsorolás nem jelenik meg.
- A mezőnevek a CAML lekérdezésbe kerülnek, ezért a `parseConfig` csak belső névnek megfelelő értéket fogad el, a `listId` pedig csak GUID lehet.

A logika az `engine/RelatedList.ts`-ben (ellenőrzés, `buildRelatedViewXml`), a lekérdezés a `services/RelatedListService.ts`-ben, a megjelenítés a `components/RelatedItems.tsx`-ben van. A tervezőben a szakasz tulajdonságai között, a „Kapcsolódó elemek megjelenítése egy másik listából” jelölővel állítható be.

### Mellékletek

Ha a listán engedélyezve vannak a mellékletek, a séma végére egy `Attachments` nevű és típusú pszeudo-mező kerül (`SchemaService.getFields`). Mezőként viselkedik: a tervezőben bármelyik szekcióba elhelyezhető, kaphat címkét, leírást, szélességet, stílust, módonkénti láthatóságot, csak olvasható és kötelező beállítást, feltételeket.

- **Megjelenítés:** a mező `attachmentsDisplay` beállítása szerint lista vagy tömör (egymás melletti) elrendezés. A meglévő fájlok hivatkozásként új lapon nyílnak. A képfájlokról (kiterjesztés alapján: `isImageFileName`) miniatűr látszik, a név mellett a fájl mérete (`formatFileSize`, a web tizedesjelével).
- **Fájlméret:** a mellékletek méretét az `AttachmentService.list` a mellékletmappa fájljainak lekérdezéséből veszi (a mellékletek saját végpontja nem adja vissza); ha ez nem sikerül, a fájlok méret nélkül jelennek meg.
- **Hozzáadás ráhúzással:** a teljes mező ejtési cél; fájlok ráhúzásakor szaggatott keret jelzi. Ez a böngésző saját fájlhúzása (nem a tervező dnd-kitje), a kettő nem zavarja egymást. A ráhúzott mappa nulla méretű fájlként érkezik, ezért üresként elutasítjuk.
- **Állapot:** a hozzáadott és törlésre jelölt fájlokat a `FormHost` tartja (`IAttachmentsState`), a vezérlő a `FormContext`-en keresztül éri el. A SharePointba csak a form mentésekor kerülnek.
- **Mentés sorrendje:** előbb az elem (`ItemService.save`), utána a mellékletek (`AttachmentService.sync`): törlések, majd feltöltések, egymás után. Szerkesztésnél, ha csak a mellékletek változtak, az elem nem íródik, és ütközésvizsgálat sincs.
- **Részleges hiba:** ha az elem mentése sikerült, de egy melléklet művelete nem, a form nyitva marad a hibás fájlok nevével. A Mentés ilyenkor csak a sikertelen mellékleteket próbálja újra (új elemnél nem hoz létre másolatot), a Mégse a formot mentettként zárja be.
- **Törlés:** a fájl a webhely lomtárába kerül.
- **Kötelezőség:** kötelezőnek állítva legalább egy mellékletnek lennie kell (a törlésre jelöltek nem számítanak).
- **Ellenőrzés hozzáadáskor** (`engine/Attachments.ts`): nem megengedett karakter a névben, már létező név, üres fájl.
- **A korábban mentett elrendezésekben** a mellékletek nem jelennek meg maguktól: a tervező „nem elhelyezett mezők” között találhatók, és onnan kell szekcióba tenni. Az alapértelmezett (mentetlen) elrendezés végén automatikusan szerepelnek.

### Feltételek

```
Condition = { all: Condition[] } | { any: Condition[] } | { not: Condition }
          | { field: InternalName, op: Operator, value?: ... }
```

| Operátor | Jelentés | Megjegyzés |
| --- | --- | --- |
| `eq`, `ne` | Egyenlő / nem egyenlő | Kis- és nagybetű nem számít. `true`/`false` a Boolean `1`/`0` értékével egyezik. |
| `gt`, `lt` | Nagyobb / kisebb | Szám összehasonlítás. A szóközt és a tizedesvesszőt kezeli (`1 234,5`). |
| `contains` | Tartalmazza | MultiChoice esetén elemre, egyébként szövegrészre vizsgál. |
| `in` | Benne van a listában | `value` tömb; MultiChoice esetén bármely elem egyezése elég. |
| `empty`, `notEmpty` | Üres / nem üres | `value` nem kell. |

A feltételek a form **aktuális** értékeire futnak, nem a mentett értékekre.

**Környezeti változók.** A `field` helyén a mezők mellett igaz / hamis értékű változók is állhatnak (`engine/ConditionContext.ts`); értékük a Boolean form-stringje (`1` / `0`), ezért az `eq` / `ne` operátorral és `true` / `false` értékkel vizsgálhatók, és a mezőfeltételekkel szabadon keverhetők. A szögletes zárójel miatt a nevük nem ütközhet mező belső nevével.

| Változó | Igaz, ha |
| --- | --- |
| `[IsNewMode]`, `[IsEditMode]`, `[IsDisplayMode]` | A form új elem, szerkesztés, illetve megtekintés módban van. Mindig pontosan egy igaz. A tervező előnézetében az előnézet módját követik. |
| `[IsAuthor]` | A bejelentkezett felhasználó hozta létre a megnyitott elemet. New módban mindig igaz (a kitöltő lesz a létrehozó). Az elem `AuthorId`-ját az `ItemService.load` adja, a felhasználó azonosítóját a `pageContext.legacyPageContext.userId`; ha valamelyik nem ismert, az érték hamis. A `resolveForm` `isAuthor` paraméterében érkezik. |
| `[Group:<azonosító>]` | A bejelentkezett felhasználó tagja az adott azonosítójú SharePoint csoportnak. |
| `[Var:<név>]` | A form egy változójának értéke (lásd „Változók”); feltétel fajtánál igen / nem, érték fajtánál a kiszámolt érték. |

```json
{ "all": [ { "field": "[IsEditMode]", "op": "eq", "value": true }, { "field": "[Group:5]", "op": "eq", "value": false } ] }
```

- A változók értékét a `resolveForm` teszi a feltételek elé (`contextValues`): a mezőértékeket kiegészíti velük, és azonos név esetén a változó az erősebb. A csoporttagságot a hívó adja át (`memberGroupIds`), a `resolveForm` szinkron marad.
- A tagságot a `GroupService.getMembership` kérdezi le, csak a konfiguráció feltételeiben hivatkozott csoportokra (`collectGroupIds`): a `FormHost` a betöltéskor megvárja, tervezés közben pedig az újonnan hivatkozott csoportokra pótolja.
- **Közvetlen tagság:** a felhasználó saját csoportlistája (`web.currentUser.groups`). **Közvetett tagság:** a többi csoportnál a csoport tagjai között keresünk címtárbeli tagot (`parseDirectoryClaim`): „Mindenki”, „Mindenki, kivéve a külső felhasználókat”, illetve Entra biztonsági vagy Microsoft 365 csoport. Az utóbbiaknál a felhasználó címtárbeli csoportjait a Microsoft Graph adja (`/me/transitiveMemberOf`, a felhasználó AAD tokenjével, `sp.getAadToken`).
- Ha a Graph hívás nem sikerül (például a bérlőben nincs hozzá engedély), a közvetett tagság nem dönthető el: az érintett felhasználó nem tagnak számít, az admin pedig figyelmeztetést lát a formon (`GroupCheckIncomplete`). Nem kezelt esetek: a Microsoft 365 csoport *tulajdonosai* tagként felvéve (`_o` végű claim), és az a csoport, amelynek a tagjait a felhasználó nem láthatja.
- A tervezőben a változók a feltételszerkesztő mezőlistájában szerepelnek (a `DesignerPanel` Boolean pszeudo-mezőként adja át őket), a csoportok a webhely csoportjaiból (`GroupService.getSiteGroups`).
- **Ez nem jogosultsági ellenőrzés** (lásd 12. fejezet): a csoport alapján elrejtett vagy csak olvasható mező más úton ugyanúgy elérhető.

**Szerkesztés a tervezőben.** A feltételeket a `ConditionEditor` szerkeszti, alapból vizuálisan: soronként egy mező, egy összehasonlítás és egy érték; több sornál választható, hogy minden vagy bármelyik feltételnek kell teljesülnie.

- Vizuálisan a lapos feltételek szerkeszthetők: egyetlen mezőfeltétel, vagy mezőfeltételek `all` / `any` csoportja. A beágyazott csoportot vagy `not`-ot tartalmazó feltétel automatikusan JSON-ként jelenik meg; a „Szerkesztés JSON-ként” hivatkozással bármelyik feltétel átváltható.
- Az érték vezérlője a mezőhöz igazodik: választás mezőnél a választható értékek listája (`ezek egyike` operátornál több is), igen/nem mezőnél Igen / Nem, egyébként szövegmező.
- Az érték típusa: szám és pénznem mezőnél, illetve a `nagyobb` / `kisebb` operátornál a tiszta szám számként kerül a feltételbe, igen/nem mezőnél logikai értékként, egyébként szövegként. A nem szerkesztett sor értéke és típusa változatlan marad.
- A félkész sor (nincs mező, vagy hiányzik az érték) a szerkesztőben megmarad, de a konfigurációba nem kerül be.
- A modell átalakítása az `engine/ConditionModel.ts`-ben van (`toConditionRows`, `fromConditionRows`), tesztekkel.

## 7. Form-string formátumok

A `validateUpdateListItem` minden mezőtípusra szöveges értéket vár. Új mezőtípus bekötésekor mindig nézd meg, mit ad vissza a `FieldValuesForEdit` egy kitöltött elemre, és ugyanazt a formátumot írd vissza.

| Mezőtípus | Formátum | Példa |
| --- | --- | --- |
| Text, Note (sima szöveg) | Egyszerű szöveg | `Irodaszer` |
| Note (rich text) | HTML | `<p>Sürgős <strong>rendelés</strong></p>` |
| Number, Currency | A web területi beállításai szerinti szám | `1234,5` |
| Currency | Szám, pénznemjel nélkül; a jel a mező elő- vagy utótagjaként látszik (`CurrencyLocaleId` szerint) | `1500` (megjelenítve: `1500 Ft`) |
| Number, százalékként | A százalékérték, nem a tárolt tört; a mező `%` utótagot kap | `25` (tárolva: `0.25`) |
| Choice | A választás szövege | `Informatika` |
| MultiChoice | `;#` elválasztás | `;#A;#B;#` |
| Boolean | `1` vagy `0` | `1` |
| DateTime | A web területi beállításai szerinti dátum; idővel együtt 24 órás `HH:mm` | magyar site-on pl. `2026. 10. 10.`, illetve `2026. 10. 10. 14:30` |
| User, UserMulti | JSON tömb; a `Key` a claims bejelentkezési név, SharePoint csoportnál a csoport neve | `[{"Key":"i:0#.f\|membership\|anna@contoso.com"}]` |
| Lookup | A hivatkozott elem azonosítója | `5` |
| LookupMulti | Azonosító;#cím párok, a cím üresen hagyható | `5;#;#6;#` |
| TaxonomyFieldType | `Címke\|TermGuid;` | `Budapest\|3f2a…;` |
| TaxonomyFieldTypeMulti | Ugyanez egymás után | `Budapest\|3f2a…;Győr\|7c1b…;` |
| Location | A helyobjektum JSON-ja | `{"DisplayName":"Budapest","Address":{"City":"Budapest","CountryOrRegion":"Magyarország"},"Coordinates":{"Latitude":47.49,"Longitude":19.04}}` |
| Thumbnail (kép) | A képobjektum JSON-ja | `{"type":"thumbnail","fileName":"logo.png","serverRelativeUrl":"/sites/x/SiteAssets/Lists/<listaId>/logo.png","id":"<fájl GUID>",…}` |
| URL | `cím, leírás`; a címben lévő vessző duplázva, leírás nélkül a cím ismétlődik | `https://contoso.com, Weboldal` |

A választás mezők vezérlője az oszlop megjelenítési beállítását követi (`FieldRenderer`): a `Choice` alapból Fluent `Dropdown`, ha az oszlop `EditFormat` értéke 1 (választógombok), akkor `ChoiceGroup` (a séma `ChoiceRadio` jelzője, `SchemaService.getFields`). A `MultiChoice` mindig jelölőnégyzetes lista (`Checkbox`), mert a SharePointban a „Jelölőnégyzetek” megjelenítés maga a többértékű típus, külön beállítása nincs. Ha a `Choice` oszlopnál saját érték is beírható (`FillInChoice`), a vezérlő a választógombos beállítás mellett is `ComboBox` marad; a `MultiChoice` saját érték beírását nem támogatja. A választógomb kiválasztása nem törölhető (a gyári űrlapon sem).

A DateTime értéket a `DateTimeField` (Fluent `DatePicker`, dátum + idő mezőnél `TimePicker`-rel) szerkeszti. A formátumot az `engine/DateFormat.ts` a web kultúrájából (`pageContext.cultureInfo.currentCultureName`) vezeti le a böngésző `Intl` API-jával, és ugyanezzel olvassa vissza a `FieldValuesForEdit` értékét. Időzóna-átváltás nincs: a kapott "falióra" értéket írjuk vissza. Ha egy tárolt érték nem értelmezhető dátumként, a mező szövegmezőként jelenik meg, hogy az érték ne vesszen el. Új nyelvű (kultúrájú) site-on érdemes egy mentést kipróbálni, mert a szerver .NET-formátuma ritkán eltérhet a böngészőétől.

A rich text Note mezőt a `RichTextField` (TipTap v3) szerkeszti, és csak olvasható módban is ez jeleníti meg. A sima szöveges Note marad többsoros `TextField`, mert abba HTML nem kerülhet. Tudnivalók:

- A HTML-t a TipTap sémája értelmezi, ezért csak az ismert elemek maradnak meg: bekezdés, címsor, listák, idézet, félkövér / dőlt / aláhúzott / áthúzott, hivatkozás, táblázat, kép. **Szerkesztéskor a többi formázás elvész** (betűszín, kiemelés, betűméret, igazítás, a SharePoint burkoló `div`-je). Amíg a felhasználó nem ír a mezőbe, az érték nem változik, és nem is kerül a mentésbe.
- Üres tartalom (csak sortörés vagy szóköz) üres form-stringként megy ki, így a kötelezőség ellenőrzése működik.
- Táblázathoz és képhez nincs eszköztár, csak a meglévő tartalom megőrzését szolgálják.
- A szerkesztő külön csomagrész (`formjet-richtext`), csak akkor töltődik le, ha a formon van rich text mező.
- Új formázás támogatása: a megfelelő TipTap kiterjesztés felvétele a `RichTextField` `extensions` listájába (a többi `@tiptap/*` csomaggal azonos verzióban), és gomb az eszköztárba.

A pénznem mező jelét és helyét (a szám előtt vagy után) a `NumberFormat.getCurrencyAffix` adja a mező `CurrencyLocaleId` (LCID) értékéből. A böngésző az LCID-ből nem tudja kiolvasni a pénznemet, ezért a gyakori értékek egy táblázatban (`CURRENCY_LOCALES`) szerepelnek; ismeretlen LCID-nél a mező jel nélkül jelenik meg, új pénznemhez a táblázatot kell bővíteni. A jel csak megjelenítés: a mentett form-stringbe nem kerül bele.

A hivatkozás mezőt (`URL`) az `UrlField` szerkeszti két beviteli mezővel (webcím, megjelenő szöveg). Csak olvashatóként hivatkozás jelenik meg (új lapon nyílik), a képként formázott mezőnél (`DisplayFormat = 1`) maga a kép. Hivatkozást és képet csak biztonságos címből készítünk (`UrlValue.isSafeUrl`: `http(s)://`, `mailto:`, webhelyen belüli útvonal); más címnél a szöveg látszik. A leírás cím nélkül nem menthető, ezért a vezérlő addig helyben tartja. Meglévő elemnél az értéket az `ItemService.loadUrlValues` tölti be.

A hely mezőt (`Location`) a `LocationField` szerkeszti egy keresővel (Fluent `TagPicker`, egy elem választható):

- A találatokat a `LocationService.searchLocations` adja a Microsoft 365 helykeresőjéből (Bing), ugyanabból, amit a gyári hely mező használ. Ez **nem dokumentált** Outlook végpont (`findmeetinglocations`), a felhasználó AAD tokenjével hívjuk (`sp.getAadToken`); a Microsoft előzetes értesítés nélkül megváltoztathatja.
- A találatok alatt mindig választható a beírt szöveg egyéni helyként (`createCustomLocation`: csak név, cím és koordináták nélkül). Ha a kereső nem érhető el, a mező alatt figyelmeztetés látszik, és csak ez a lehetőség marad.
- A kiválasztott hely teljes objektumát mentjük, a nem ismert tulajdonságokkal együtt. A „Hely: város”, „Hely: irányítószám” és hasonló kísérő oszlopokat a SharePoint tölti ki mentéskor; ezek a formon csak olvashatók.
- Meglévő elemnél az értéket az `ItemService.loadLocationValues` tölti be. Csak olvashatóként a név és zárójelben a cím látszik.
- A címke melletti térkép ikon a kiválasztott helyet egy 600 × 500 képpontos felugró térképen mutatja (Fluent `Callout`, benne a Bing Térképek beágyazható térképe a hely koordinátáira középre állítva; `getLocationEmbedUrl`). A térkép alatti hivatkozás a helyet új lapon, a Bing Térképeken nyitja meg (`getLocationMapUrl`). Koordináták nélküli (egyéni) helynél nincs mit beágyazni, ilyenkor az ikon közvetlenül a térképes keresést nyitja meg új lapon. Csak olvasható módban is megjelenik.
- A beágyazott térkép külső szolgáltatás (bing.com); a kéréssel a hely koordinátái kerülnek át, a neve nem. A Bing beágyazott térképe jelölőt nem mutat, a hely a térkép közepén van. Ha a szervezet tiltja a külső keretek betöltését, a térkép üres marad.
- A cím részeinek kézi szerkesztése nincs.

A kép mezőt (`Thumbnail`) az `ImageField` szerkeszti: előnézet, kép kiválasztása, cseréje, törlése.

- A kiválasztott kép nem töltődik fel azonnal. A mező értéke addig egy `pending` jelző (`createPendingImageValue`), a fájlt a `FormHost` tartja (`pendingImages`), az előnézet helyi címről jelenik meg.
- Mentéskor, **az elem mentése előtt** az `ImageService.uploadImage` feltölti a képet a SharePoint `UploadImage` hívásával (a webhely eszköztárába, a lista mappájába), és a mező értéke a feltöltött fájlra hivatkozó JSON lesz (`createImageValue`). Ha a feltöltés nem sikerül, a mentés megszakad, az elem nem íródik. Rejtett vagy csak olvasható mező képe nem töltődik fel.
- A Mégse a kiválasztott képet eldobja, feltöltés nélkül. Ha a feltöltés sikerült, de az elem mentése utána elbukik, a kép az eszköztárban marad; ismételt mentésnél nem töltődik fel újra.
- Megjelenítéshez csak webhelyen belüli (perjellel kezdődő) cím használható (`getImageUrl`). A SharePoint által az elem mellékleteként tárolt képeknél (`Reserved_ImageAttachment_…` fájlnév) a cím a lista és az elem azonosítójából áll össze.
- A törlés csak a mező értékét üríti, a feltöltött fájlt nem törli az eszköztárból.
- Meglévő elemnél az értéket az `ItemService.loadImageValues` tölti be.

A felügyelt metaadat mezőt (`TaxonomyFieldType`, `TaxonomyFieldTypeMulti`) a `TaxonomyField` szerkeszti (Fluent `TagPicker`):

- A választható kifejezéseket a `TaxonomyService.getTerms` tölti be a mező kifejezéskészletéből a SharePoint `_api/v2.1/termStore` végpontjáról, szintenként (`children`), a munkamenet idejére megjegyezve. A PnPjs v4-ben nincs taxonomy modul, ezért ez közvetlen `fetch` hívás. Legfeljebb 2000 kifejezés tölthető be.
- Ha a mező a készlet egy ágára van szűkítve (`AnchorId`), csak az alatta lévő kifejezések választhatók. Az elavult (deprecated) kifejezések kimaradnak.
- A javaslatok a teljes útvonalat mutatják (`Európa > Magyarország > Budapest`), a szűrés az útvonalban keres; egyszerre 30 javaslat látszik. Üres mezőbe kattintva a készlet eleje jelenik meg.
- A címkék a felület nyelvén jelennek meg, ha a kifejezésnek van ilyen nyelvű címkéje; különben az alapértelmezett címkével.
- Meglévő elemnél az értéket az `ItemService.loadTaxonomyValues` adja a `TermGuid` alapján; a REST egyértékű mezőnél a címke helyén belső sorszámot adhat, ezért a megjelenítendő címkét a vezérlő a betöltött készletből oldja fel.
- Új elemnél a mező SharePointban beállított alapértéke (`1;#Címke|guid` alakban tárolva) kezdőértékként megjelenik (`getInitialValues`).
- Új kifejezés felvétele a formról (nyitott készlet), faszerkezetű böngésző és a webhelycsoportok közötti kifejezéstár-választás nincs megvalósítva.

A keresőmezőt a `LookupField` szerkeszti: az egyértékű (`Lookup`) Fluent `Dropdown`-t kap, a többértékű (`LookupMulti`) a mező `lookupDisplay` beállítása szerint mindig nyitott jelölőnégyzetes listát (görgetés nélkül minden választható elem látszik) vagy többválasztós lenyíló listát; alapértelmezésben az elemszám dönt:

- A választható elemeket a `LookupService` tölti be a hivatkozott listából, a mező megjelenített mezője szerint rendezve; az eredményt a munkamenet idejére megjegyzi. Legfeljebb 2000 elem tölthető be, efelett a vezérlő alatt jelzés látszik.
- Meglévő elemnél az értéket az `ItemService.loadLookupValues` adja a `<mező>Id` tulajdonságból, mert a `FieldValuesForEdit` formátuma itt sem megbízható. Az `engine/LookupValue.ts` értelmezője ettől függetlenül több alakot elfogad (`5`, `5;#Cím`, `5;#Cím;#6;#Cím2`).
- Csak a listára mutató keresőmező szerkeszthető. A függő (további oszlopként megjelenő) keresőmezők és a nem listára mutatók (`LookupList` nem GUID) csak olvashatók maradnak.
- A mező szűrése, a kapcsolat viselkedése (törlés korlátozása) és a kaszkádolt választás nincs megvalósítva.
- Ha egy kiválasztott elem nincs a betöltött listában (törölték, vagy a korláton túl van), `#azonosító` alakban látszik, és megmarad.

A további, itt fel nem sorolt mezőtípusok pontos formátumát a bekötéskor a `FieldValuesForEdit` kimenetével kell ellenőrizni; tenant- és verziófüggő eltérések előfordulnak.

## 8. Receptek

### Új mezőtípus bekötése

Minta: a személy mező (`User`, `UserMulti`). Ugyanezeket a lépéseket kell követni a többi típusnál is.

1. **Form-string:** nézd meg, mit ad vissza a `FieldValuesForEdit` egy kitöltött elemre, és írj hozzá tiszta értelmező / előállító függvényeket az `engine/`-be (`engine/UserValue.ts`: `parseUserValue`, `serializeUserValue`, `formatUserValue`). Üres értékre üres szöveget adj vissza, különben a kötelezőség ellenőrzése nem működik.
2. **Séma:** ha a vezérlőnek kell a mező beállítása, vedd fel az `IFieldSchema`-ba és a `SchemaService.getFields` leképezésébe (`UserAllowGroups`, `UserSelectionGroup`).
3. **Szolgáltatás:** a SharePoint-hívás a `services/`-be kerül (`PeopleService.searchPeople`), a komponens csak ezen keresztül éri el.
4. **Vezérlő:** külön komponens a `components/`-ben (`PeopleField.tsx`), Fluent UI v8 elemekből. A vezérlő betöltéskor ne hívjon `onChange`-et, csak a felhasználó módosítására; különben a mező módosultnak számít, és feleslegesen kerül a mentésbe.
5. **Bekötés:** új eset a `FieldRenderer` `switch`-ében és a `formatReadOnly`-ban (csak olvasható megjelenítés), valamint a típus felvétele a `LayoutResolver` `EDITABLE_TYPES` listájába.
6. **Szövegek** a `loc/` mindkét nyelvi fájljába.
7. **Teszt:** új elem, meglévő elem módosítása, ürítés, kötelező mező üresen, csak olvasható mód.

A személy mező sajátosságai:

- A keresés a SharePoint névkeresőjét használja (`clientPeoplePickerSearchUser`), ugyanazt, mint a gyári személyválasztó, így a találatok kulcsa közvetlenül visszaírható.
- A mező beállításai érvényesülnek: csak személyek vagy személyek és csoportok, illetve szűkítés egy SharePoint csoport tagjaira.
- A mentett érték elemenként `Key` + `DisplayText`; a SharePoint a `Key` alapján azonosít, a név csak a mentetlen érték megjelenítéséhez kell.
- Meglévő elemnél a kiválasztottakat az `ItemService.loadUserValues` tölti be (a mező kibontásával: `Name`, `Title`, `EMail`), mert a `FieldValuesForEdit` személy mezőnél nem ad megbízhatóan visszaírható értéket. A `FormHost` ezt a séma betöltése után kéri le, és a betöltéskori (`original`) értékek közé teszi.
- Profilkép nincs, a kiválasztottak monogrammal jelennek meg.

### Új feltétel-operátor

1. `ConditionOperator` típus bővítése a `models/IFormConfig.ts`-ben.
2. Új `case` a `ConditionEngine.evalField`-ben.
3. Felirat az operátorhoz a `ConditionEditor` `operatorLabels` függvényében és a loc fájlokban; a JSON mód súgószövegének (`ConditionHelp`) frissítése.
4. Ennek a leírásnak a 6. fejezete.

### Új felhasználói szöveg (lokalizáció)

A felület angolul és magyarul érhető el; a nyelvet az SPFx a felhasználó SharePoint megjelenítési nyelve alapján választja, ismeretlen nyelvnél az angol (`en-us`) az alapértelmezés.

1. Új kulcs a `loc/myStrings.d.ts`-ben.
2. A szöveg **mindkét** fájlban: `loc/en-us.js` és `loc/hu-hu.js`. Paraméter: `{0}`, `{1}`.
3. Használat: `import * as strings from 'FormJetFormCustomizerStrings'`, paraméterezve `format(strings.Kulcs, érték)` (`engine/EngineStrings.ts`).
4. A motor (`engine/`) nem importálhatja a lokalizációs modult. A motor üzeneteit az `IEngineStrings` interfészbe, annak angol alapértelmezésébe és a loc fájlok `Engine` részébe kell felvenni; a `FormJetFormCustomizer.onInit` adja át őket a `setEngineStrings`-szel.
5. Új nyelv: új `loc/<locale>.js` fájl ugyanazokkal a kulcsokkal; a `config/config.json` `{locale}` mintája automatikusan felveszi.

### A konfigurációs séma bővítése

- **Visszafelé kompatibilis bővítés** (új opcionális mező): nem kell verzióemelés. A `LayoutResolver`-ben legyen alapértelmezés a hiányzó értékre.
- **Törő változás** (átnevezés, szerkezetváltás): `schemaVersion` emelés, és a `parseConfig`-ban migráció a régi verzióról. A régi konfigurációk éles listákban vannak, mentés nélkül is működniük kell.
- Verziók: **1** – kiinduló szerkezet; **2** – szövegelemek (`texts`); **3** – változók (`variables`). A 2-es új konfigurációrészt hozott, ezért kapott új verziót; az 1-es szerkezet változatlanul érvényes, átalakítás nincs. A 2-esként mentett konfigurációt a korábbi csomag (például a böngészőben még gyorsítótárazott régi változat) ismeretlen verzióként elutasítja, és az alapértelmezett elrendezést mutatja.

### Tervező funkció hozzáadása

A `DesignerPanel` csak a `draft` konfigurációt módosítja az `onChange`-en keresztül, immutábilisan. Ne írjon közvetlenül SharePointba; a mentés a `FormHost.saveDesign` dolga.

## 9. Tesztelés

### Egységtesztek

Az `engine/` modulok tiszta függvények, ezekre Jest egységtesztek vannak az `src/extensions/formJet/engine/tests/` mappában. Futtatás:

```
npm test
```

A parancs a Heft `test` lépése: lefordítja a projektet, lefuttatja a lintet, majd a `lib-commonjs` mappába fordított `*.test.js` fájlokat futtatja. Az `npm run build` is lefuttatja őket, így hibás teszttel csomag sem készül. **Futó `npm start` mellett ne indítsd el**, mert ugyanabba a kimeneti mappába fordít.

| Fájl | Mit fed le |
| --- | --- |
| `ConditionModel.test.ts` | a vizuális feltételszerkesztő modellje: sorok ↔ feltétel, típusok megőrzése, félkész sorok |
| `ConditionEngine.test.ts` | minden operátor, `all` / `any` / `not`, a feltételek ellenőrzése |
| `LayoutMoves.test.ts` | szekció és mező áthelyezése, új mező felvétele, a szélesség igazítása, az eredeti konfiguráció változatlansága |
| `LayoutResolver.test.ts` | a példa konfiguráció mindhárom módban, láthatóság, kötelezőség, szerkeszthetőség, `parseConfig` hibái, kezdőértékek (dátum, szám, százalék, felügyelt metaadat), mellékletek |
| `FormStyle.test.ts` | módonkénti feloldás, színátmenet, a szabad CSS-re alkalmas értékek elutasítása |
| `RelatedList.test.ts` | a CAML lekérdezés összeállítása, a mezőnevek és az érték biztonságos kezelése |
| `DateFormat.test.ts` | dátumminta, formázás és értelmezés több kultúrán, kerekítés |
| `NumberFormat.test.ts` | tizedesjel, százalék, pénznem jele |
| `FieldValues.test.ts` | a keresőmező, személy, hivatkozás, hely, kép, felügyelt metaadat és a mellékletek form-stringjei |

Szabályok új teszthez:

- A fájl neve `*.test.ts`, a helye az `engine/tests/` mappa. A közös segédfüggvények (`field`, `sampleSchema`, `loadSampleConfig`, `configJson`, `getField`) a `helpers.ts`-ben vannak.
- A tesztek ne függjenek a gép időzónájától és az aktuális időtől: a `getInitialValues` és a `resolveDateDefault` paraméterként kapja a „most” időpontot.
- A `samples/config-example.json`-t a tesztek a projekt gyökeréből olvassák be; ha a példát módosítod, a `LayoutResolver.test.ts` elvárásait is igazítsd hozzá.
- A `services/` és a `components/` rétegre nincs egységteszt; ezeket a kézi tesztmátrix fedi le.

### Kézi tesztmátrix

| Eset | New | Edit | Display |
| --- | --- | --- | --- |
| Konfiguráció nélkül | minden mező, egy szekció | ugyanígy, értékekkel | csak olvasható |
| Példa konfiguráció | Jóváhagyás szekció rejtve | Approver csak olvasható | minden csak olvasható |
| Feltétel (összeg > 500 000) | – | Justification megjelenik, kötelező | Justification látszik |
| Admin felhasználó | tervező kapcsoló látszik | tervező kapcsoló látszik | tervező kapcsoló látszik |
| Nem admin felhasználó | nincs tervező kapcsoló | nincs tervező kapcsoló | nincs tervező kapcsoló |
| Ütközés | – | másik böngészőben mentés után figyelmeztetés | – |
| Hibás konfiguráció JSON | alapértelmezett elrendezés, admin figyelmeztetés | ugyanígy | ugyanígy |

## 10. Kiadás és telepítés

1. Verzióemelés a `config/package-solution.json`-ban (`solution.version`, és ha használjátok, a feature verziók).
2. Production build és csomagolás a `package.json` scriptjei szerint.
3. A `.sppkg` feltöltése a tenant vagy site collection app catalogba.
4. Bekapcsolás egy webhelyen: a **FormJet beállítása** webparttal (lásd alább), vagy a PowerShell szkripttel.

Kódfrissítéshez elég az új `.sppkg` feltöltése; a bekötést és a konfigurációs listát nem kell újra beállítani.

### A beállító webpart

A csomag a Form Customizer mellett egy webpartot is tartalmaz (`src/webparts/formJetSetup/`, külön bundle a `config/config.json`-ban). Egy oldalra kitéve azt a webhelyet kezeli, ahol van:

- **Listák:** a webhely listái (dokumentumtárak és rejtett listák nélkül) tartalomtípusonként, az aktuális űrlappal: FormJet, beépített SharePoint űrlap, vagy másik egyéni űrlap. A kapcsoló a tartalomtípus mindhárom űrlapját (új, szerkesztő, megtekintő) a FormJet összetevőre állítja, illetve üríti (`SetupService.setBinding`).
- **Konfigurációs lista:** ha a `FormConfigurations` lista hiányzik, létrehozható (`ConfigService.ensureList`); a lista az első elrendezés mentésekor magától is létrejön (`ConfigService.save`).
- **Jogosultság:** a „Csak olvasás a tagoknak” gomb a listának saját jogosultságot ad, és a webhely tagjainak csoportját olvasásra állítja (`ConfigService.restrictListToReadOnly`). A szerepkört típus szerint keresi, így nem függ a webhely nyelvétől. Más, egyedileg jogosított csoportokat nem módosít.
- A módosításokhoz webhelytulajdonosi jog kell; e nélkül a vezérlők le vannak tiltva.

Tudnivalók a kódhoz:

- A webpart a Form Customizer `services/` és `components/` rétegét használja (`SetupPanel`, `SetupService`), és ugyanazt a lokalizációs modult. A `services/sp.ts` `getSP(context)` mindkét kontextust elfogadja.
- A FormJet összetevő azonosítója a `SetupService.FORMJET_COMPONENT_ID` állandóban van; egyeznie kell a `FormJetFormCustomizer.manifest.json` `id` értékével.
- A megtekintő űrlap tulajdonságának neve a REST felületen kétféle lehet (`DisplayFormClientSideComponentId` / `DispFormClientSideComponentId`); a `SetupService` azt használja, amelyik a lekérdezés válaszában szerepel.
- Helyi kipróbálás: `npm start -- --serve-config setup` a hosted workbench-et nyitja meg, ahol a webpart felvehető.

### PowerShell szkript

Sok webhely automatizált beállításához megmaradt a szkript (PnP.PowerShell 2.x, saját Entra ID alkalmazásregisztrációval):

```powershell
./scripts/Provision-FormJet.ps1 -SiteUrl <site> -TargetList <lista> -ComponentId <manifest id> -ClientId <app id>
```

Visszaállítás a gyári űrlapokra: ugyanez `-Unbind` kapcsolóval. A `FormConfigurations` lista ilyenkor megmarad.

## 11. Gyakori problémák

| Tünet | Valószínű ok | Teendő |
| --- | --- | --- |
| A gyári form nyílik meg | A tartalomtípus nincs bekötve, vagy a lista Power Apps formra van állítva | Kapcsold be a beállító webparton (vagy futtasd a szkriptet); form beállítás: "SharePoint default" |
| Grid nézetben a rejtett mező szerkeszthető | A customizer csak a formot cseréli | Elvárt viselkedés; védelem jogosultsággal |
| "A FormConfigurations lista nem érhető el" | A lista nem jött létre, vagy a felhasználónak nincs olvasási joga | Szkript futtatása; jogosultság ellenőrzése |
| Dátum mentésekor hiba | ISO formátumot küldünk | A web területi beállításai szerinti formátum kell |
| Mező nem jelenik meg | Nincs szekcióban, vagy a feltétel hamis | Tervezőben: "Nem elhelyezett mezők", illetve a feltétel ellenőrzése |
| Konfiguráció mentésekor ütközés | Más admin közben mentett | Újratöltés, majd a módosítások újbóli elvégzése |
| `_x005f_` a mezőnevekben | REST kódolás | A `decodeKeys` kezeli; új lekérdezésnél is használd |

## 12. Biztonsági megfontolások

- **A form nem jogosultsági határ.** Bármely mező, amelyre a felhasználónak írási joga van, más úton (grid nézet, REST, Power Automate) szerkeszthető. Ha egy mezőt védeni kell, azt elem- vagy listaszintű jogosultsággal, illetve külön listába szervezéssel kell megoldani.
- A csoporttagságra épülő feltétel (`[Group:…]`) is csak a formot szabja testre: kliens oldalon értékelődik ki, a mezőt nem védi. Érzékeny adatot ne csak így rejts el.
- A tervező kapcsoló elrejtése csak kényelmi funkció. A konfiguráció módosítását a `FormConfigurations` lista jogosultsága dönti el.
- A konfiguráció JSON-ja nem tartalmazhat végrehajtható kódot, és a renderelő sem értelmez belőle HTML-t. Ezt a szabályt új funkcióknál is tartsd meg.
