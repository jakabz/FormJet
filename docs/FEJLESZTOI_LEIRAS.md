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
5. Minden értékváltozáskor a `resolveForm` újraszámolja a feltételeket. Ez olcsó művelet; ne tegyél bele aszinkron hívást.

### Mentés (`FormHost.save`)

1. Kliens oldali ellenőrzés: a látható, kötelező mezők nem lehetnek üresek.
2. A `changed` objektumba csak a **látható, szerkeszthető és módosult** mezők kerülnek.
3. Edit módban ütközésvizsgálat: ha a `Modified` megváltozott, a felhasználó felülírhat vagy újratölthet.
4. `ItemService.save`: Edit módban `validateUpdateListItem`, New módban `addValidateUpdateItemUsingPath` a tartalomtípussal.
5. Mezőnkénti hibák a mezők alá kerülnek; a nem látható mezők hibái a felső üzenetsávba.
6. Siker esetén `formSaved()`. A mellékletek feltöltése ide fog kerülni (TODO).

### Tervező

- A `startDesign` a konfiguráció mély másolatán dolgozik (`draft`). A mégse gomb egyszerűen eldobja.
- Az előnézet `previewMode`-ban (New/Edit/Display) a `draft`-ot rendereli, rejtett elemekkel halványan.
- A `ConfigService.save` ETag-gel ír. 412 → `ConfigConflictError`, 403 → jogosultsági üzenet.

## 6. Konfigurációs séma referencia

Forrás: `models/IFormConfig.ts`. Példa: `samples/config-example.json`.

### IFormConfig

| Tulajdonság | Típus | Kötelező | Jelentés |
| --- | --- | --- | --- |
| `schemaVersion` | `1` | igen | Sémaverzió, a migráció alapja. |
| `listId` | string | igen | A cél lista GUID-ja. |
| `contentTypeId` | string | igen | A lista tartalomtípusának azonosítója. |
| `title` | string | nem | A form fejléce. |
| `labelPosition` | `'top'` \| `'left'` | nem | Címkék helye. Alapértelmezés: `top`. A `left` még nincs megvalósítva a renderelőben. |
| `sections` | `ISectionConfig[]` | igen | Szekciók megjelenési sorrendben. |
| `fields` | `Record<InternalName, IFieldConfig>` | igen | Mezőnkénti beállítások. |

### ISectionConfig

| Tulajdonság | Típus | Alapértelmezés | Jelentés |
| --- | --- | --- | --- |
| `id` | string | – | Egyedi azonosító a konfiguráción belül. |
| `title`, `description` | string | – | Fejléc és leírás. |
| `columns` | 1–4 | – | Rácsoszlopok száma. |
| `collapsible`, `collapsed` | boolean | false | Becsukható-e, és alapból csukva van-e. |
| `visibleIn` | `FormMode[]` | mindhárom | Mely módokban látszik. |
| `visibleWhen` | `Condition` | – | Feltételes láthatóság. |
| `fields` | `IFieldPlacement[]` | – | `{ field, colSpan? }`, a sorrend a megjelenési sorrend. |

### IFieldConfig

| Tulajdonság | Típus | Alapértelmezés | Jelentés |
| --- | --- | --- | --- |
| `label`, `description`, `placeholder` | string | séma szerint | Megjelenítési szövegek. |
| `visibleIn` | `FormMode[]` | mindhárom | Láthatóság módonként. |
| `readOnlyIn` | `FormMode[]` | egyik sem | Csak olvasható módonként. Display módban minden csak olvasható. |
| `requiredIn` | `FormMode[]` | egyik sem | Kötelezőség módonként. **Csak szigorít.** |
| `visibleWhen`, `readOnlyWhen`, `requiredWhen` | `Condition` | – | Feltételes változatok. |
| `defaultValue` | string | – | Kezdőérték New módban, form-string formátumban. |

Egy mező akkor látszik, ha a szekciója látszik, **és** a mező `visibleIn`, **és** `visibleWhen` feltétele is teljesül. Ami nincs egyetlen szekcióban sem, az nem jelenik meg.

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

## 7. Form-string formátumok

A `validateUpdateListItem` minden mezőtípusra szöveges értéket vár. Új mezőtípus bekötésekor mindig nézd meg, mit ad vissza a `FieldValuesForEdit` egy kitöltött elemre, és ugyanazt a formátumot írd vissza.

| Mezőtípus | Formátum | Példa |
| --- | --- | --- |
| Text, Note (sima szöveg) | Egyszerű szöveg | `Irodaszer` |
| Note (rich text) | HTML | `<p>Sürgős <strong>rendelés</strong></p>` |
| Number, Currency | A web területi beállításai szerinti szám | `1234,5` |
| Choice | A választás szövege | `Informatika` |
| MultiChoice | `;#` elválasztás | `;#A;#B;#` |
| Boolean | `1` vagy `0` | `1` |
| DateTime | A web területi beállításai szerinti dátum; idővel együtt 24 órás `HH:mm` | magyar site-on pl. `2026. 10. 10.`, illetve `2026. 10. 10. 14:30` |
| User, UserMulti | JSON tömb claims kulccsal | `[{"Key":"i:0#.f\|membership\|anna@contoso.com"}]` |
| Lookup | Az elem azonosítója | `5` |
| TaxonomyFieldType | `Címke\|TermGuid` | `Budapest\|3f2a…` |
| URL | `url, leírás` | `https://contoso.com, Weboldal` |

A DateTime értéket a `DateTimeField` (Fluent `DatePicker`, dátum + idő mezőnél `TimePicker`-rel) szerkeszti. A formátumot az `engine/DateFormat.ts` a web kultúrájából (`pageContext.cultureInfo.currentCultureName`) vezeti le a böngésző `Intl` API-jával, és ugyanezzel olvassa vissza a `FieldValuesForEdit` értékét. Időzóna-átváltás nincs: a kapott "falióra" értéket írjuk vissza. Ha egy tárolt érték nem értelmezhető dátumként, a mező szövegmezőként jelenik meg, hogy az érték ne vesszen el. Új nyelvű (kultúrájú) site-on érdemes egy mentést kipróbálni, mert a szerver .NET-formátuma ritkán eltérhet a böngészőétől.

A rich text Note mezőt a `RichTextField` (TipTap v3) szerkeszti, és csak olvasható módban is ez jeleníti meg. A sima szöveges Note marad többsoros `TextField`, mert abba HTML nem kerülhet. Tudnivalók:

- A HTML-t a TipTap sémája értelmezi, ezért csak az ismert elemek maradnak meg: bekezdés, címsor, listák, idézet, félkövér / dőlt / aláhúzott / áthúzott, hivatkozás, táblázat, kép. **Szerkesztéskor a többi formázás elvész** (betűszín, kiemelés, betűméret, igazítás, a SharePoint burkoló `div`-je). Amíg a felhasználó nem ír a mezőbe, az érték nem változik, és nem is kerül a mentésbe.
- Üres tartalom (csak sortörés vagy szóköz) üres form-stringként megy ki, így a kötelezőség ellenőrzése működik.
- Táblázathoz és képhez nincs eszköztár, csak a meglévő tartalom megőrzését szolgálják.
- A szerkesztő külön csomagrész (`formjet-richtext`), csak akkor töltődik le, ha a formon van rich text mező.
- Új formázás támogatása: a megfelelő TipTap kiterjesztés felvétele a `RichTextField` `extensions` listájába (a többi `@tiptap/*` csomaggal azonos verzióban), és gomb az eszköztárba.

A LookupMulti és TaxonomyFieldTypeMulti pontos formátumát a bekötéskor a `FieldValuesForEdit` kimenetével kell ellenőrizni; tenant- és verziófüggő eltérések előfordulnak.

## 8. Receptek

### Új mezőtípus bekötése

Példa: People mező a PnP `PeoplePicker`-rel.

1. Függőség: `npm install @pnp/spfx-controls-react`.
2. A `PeoplePicker`-nek SPFx kontextus kell. Add át egy React contexttel a `FormHost`-ból, ne prop-drillinggel minden komponensen át:
   ```tsx
   // components/SpContext.ts
   export const SpContext = React.createContext<FormCustomizerContext | undefined>(undefined);
   ```
   A `FormHost` csomagolja be a kimenetét `<SpContext.Provider value={context}>`-be.
3. A `FieldRenderer` elején (a `readOnly` ág és a `switch` előtt, a hook szabályok miatt) kérd le a kontextust, majd adj új esetet a `switch`-hez:
   ```tsx
   const spContext = React.useContext(SpContext);
   // ...
   case 'User':
   case 'UserMulti':
     return (
       <PeoplePicker
         context={/* a PnP controls verziója szerinti kontextus objektum, spContext-ből */}
         titleText={label}
         personSelectionLimit={schema.TypeAsString === 'User' ? 1 : 20}
         required={required}
         errorMessage={error}
         onChange={(items) => set(JSON.stringify(items.map((i) => ({ Key: i.id }))))}
       />
     );
   ```
   A `PeoplePicker` által visszaadott elem `id` mezőjének claims formátumát a használt PnP controls verzióval ellenőrizd.
4. A meglévő érték megjelenítéséhez parse-old a `FieldValuesForEdit` értékét (`defaultSelectedUsers`).
5. Teszteld: új elem, meglévő elem módosítása, ürítés, kötelező mező üresen.

### Új feltétel-operátor

1. `ConditionOperator` típus bővítése a `models/IFormConfig.ts`-ben.
2. Új `case` a `ConditionEngine.evalField`-ben.
3. A tervező `ConditionEditor` súgószövegének frissítése.
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

### Tervező funkció hozzáadása

A `DesignerPanel` csak a `draft` konfigurációt módosítja az `onChange`-en keresztül, immutábilisan. Ne írjon közvetlenül SharePointba; a mentés a `FormHost.saveDesign` dolga.

## 9. Tesztelés

### Egységtesztek

Az `engine/` modulok tiszta függvények, Jesttel közvetlenül tesztelhetők. Javasolt esetek:

- minden operátor, a `all`/`any`/`not` kombinációkkal,
- `resolveForm` mindhárom módban a `samples/config-example.json`-nal,
- hibás JSON, ismeretlen `schemaVersion`, nem létező mezőre hivatkozó konfiguráció,
- `unplacedFields` és `createDefaultConfig`.

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
4. Első telepítéskor egy site-on:
   ```powershell
   ./scripts/Provision-FormJet.ps1 -SiteUrl <site> -TargetList <lista> -ComponentId <manifest id> -ClientId <app id>
   ```
5. Visszaállítás a gyári formokra: ugyanez `-Unbind` kapcsolóval. A `FormConfigurations` lista ilyenkor megmarad.

Kódfrissítéshez elég az új `.sppkg` feltöltése; a bekötést és a konfigurációs listát nem kell újra futtatni.

## 11. Gyakori problémák

| Tünet | Valószínű ok | Teendő |
| --- | --- | --- |
| A gyári form nyílik meg | A tartalomtípus nincs bekötve, vagy a lista Power Apps formra van állítva | Futtasd a szkriptet; form beállítás: "SharePoint default" |
| Grid nézetben a rejtett mező szerkeszthető | A customizer csak a formot cseréli | Elvárt viselkedés; védelem jogosultsággal |
| "A FormConfigurations lista nem érhető el" | A lista nem jött létre, vagy a felhasználónak nincs olvasási joga | Szkript futtatása; jogosultság ellenőrzése |
| Dátum mentésekor hiba | ISO formátumot küldünk | A web területi beállításai szerinti formátum kell |
| Mező nem jelenik meg | Nincs szekcióban, vagy a feltétel hamis | Tervezőben: "Nem elhelyezett mezők", illetve a feltétel ellenőrzése |
| Konfiguráció mentésekor ütközés | Más admin közben mentett | Újratöltés, majd a módosítások újbóli elvégzése |
| `_x005f_` a mezőnevekben | REST kódolás | A `decodeKeys` kezeli; új lekérdezésnél is használd |

## 12. Biztonsági megfontolások

- **A form nem jogosultsági határ.** Bármely mező, amelyre a felhasználónak írási joga van, más úton (grid nézet, REST, Power Automate) szerkeszthető. Ha egy mezőt védeni kell, azt elem- vagy listaszintű jogosultsággal, illetve külön listába szervezéssel kell megoldani.
- A tervező kapcsoló elrejtése csak kényelmi funkció. A konfiguráció módosítását a `FormConfigurations` lista jogosultsága dönti el.
- A konfiguráció JSON-ja nem tartalmazhat végrehajtható kódot, és a renderelő sem értelmez belőle HTML-t. Ezt a szabályt új funkcióknál is tartsd meg.
