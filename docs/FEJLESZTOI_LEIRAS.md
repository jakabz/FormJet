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

A tartalomtípus mezői közül a rejtett és a számított megjelenítő (`Computed`, pl. `LinkTitle`) mezők nem kerülnek a sémába, így a tervezőben sem választhatók. Ha egy korábbi konfiguráció ilyen mezőre hivatkozik, az admin a „nem létező mezők” figyelmeztetést látja.

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
| `lookupDisplay` | `'auto'` \| `'checklist'` \| `'dropdown'` | `auto` | Többértékű keresőmező megjelenítése: mindig nyitott jelölőnégyzetes lista vagy lenyíló lista. `auto`: legfeljebb 8 választható elemnél jelölőnégyzetes lista, efelett lenyíló. |

Egy mező akkor látszik, ha a szekciója látszik, **és** a mező `visibleIn`, **és** `visibleWhen` feltétele is teljesül. Ami nincs egyetlen szekcióban sem, az nem jelenik meg.

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

A logika az `engine/RelatedList.ts`-ben (ellenőrzés, `buildRelatedViewXml`), a lekérdezés a `services/RelatedListService.ts`-ben, a megjelenítés a `components/RelatedItems.tsx`-ben van. A tervezőben a szekció kártyáján, a „Kapcsolódó elemek megjelenítése egy másik listából” jelölővel állítható be.

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
| User, UserMulti | JSON tömb; a `Key` a claims bejelentkezési név, SharePoint csoportnál a csoport neve | `[{"Key":"i:0#.f\|membership\|anna@contoso.com"}]` |
| Lookup | A hivatkozott elem azonosítója | `5` |
| LookupMulti | Azonosító;#cím párok, a cím üresen hagyható | `5;#;#6;#` |
| TaxonomyFieldType | `Címke\|TermGuid` | `Budapest\|3f2a…` |
| URL | `url, leírás` | `https://contoso.com, Weboldal` |

A DateTime értéket a `DateTimeField` (Fluent `DatePicker`, dátum + idő mezőnél `TimePicker`-rel) szerkeszti. A formátumot az `engine/DateFormat.ts` a web kultúrájából (`pageContext.cultureInfo.currentCultureName`) vezeti le a böngésző `Intl` API-jával, és ugyanezzel olvassa vissza a `FieldValuesForEdit` értékét. Időzóna-átváltás nincs: a kapott "falióra" értéket írjuk vissza. Ha egy tárolt érték nem értelmezhető dátumként, a mező szövegmezőként jelenik meg, hogy az érték ne vesszen el. Új nyelvű (kultúrájú) site-on érdemes egy mentést kipróbálni, mert a szerver .NET-formátuma ritkán eltérhet a böngészőétől.

A rich text Note mezőt a `RichTextField` (TipTap v3) szerkeszti, és csak olvasható módban is ez jeleníti meg. A sima szöveges Note marad többsoros `TextField`, mert abba HTML nem kerülhet. Tudnivalók:

- A HTML-t a TipTap sémája értelmezi, ezért csak az ismert elemek maradnak meg: bekezdés, címsor, listák, idézet, félkövér / dőlt / aláhúzott / áthúzott, hivatkozás, táblázat, kép. **Szerkesztéskor a többi formázás elvész** (betűszín, kiemelés, betűméret, igazítás, a SharePoint burkoló `div`-je). Amíg a felhasználó nem ír a mezőbe, az érték nem változik, és nem is kerül a mentésbe.
- Üres tartalom (csak sortörés vagy szóköz) üres form-stringként megy ki, így a kötelezőség ellenőrzése működik.
- Táblázathoz és képhez nincs eszköztár, csak a meglévő tartalom megőrzését szolgálják.
- A szerkesztő külön csomagrész (`formjet-richtext`), csak akkor töltődik le, ha a formon van rich text mező.
- Új formázás támogatása: a megfelelő TipTap kiterjesztés felvétele a `RichTextField` `extensions` listájába (a többi `@tiptap/*` csomaggal azonos verzióban), és gomb az eszköztárba.

A keresőmezőt a `LookupField` szerkeszti: az egyértékű (`Lookup`) Fluent `Dropdown`-t kap, a többértékű (`LookupMulti`) a mező `lookupDisplay` beállítása szerint mindig nyitott jelölőnégyzetes listát (görgetés nélkül minden választható elem látszik) vagy többválasztós lenyíló listát; alapértelmezésben az elemszám dönt:

- A választható elemeket a `LookupService` tölti be a hivatkozott listából, a mező megjelenített mezője szerint rendezve; az eredményt a munkamenet idejére megjegyzi. Legfeljebb 2000 elem tölthető be, efelett a vezérlő alatt jelzés látszik.
- Meglévő elemnél az értéket az `ItemService.loadLookupValues` adja a `<mező>Id` tulajdonságból, mert a `FieldValuesForEdit` formátuma itt sem megbízható. Az `engine/LookupValue.ts` értelmezője ettől függetlenül több alakot elfogad (`5`, `5;#Cím`, `5;#Cím;#6;#Cím2`).
- Csak a listára mutató keresőmező szerkeszthető. A függő (további oszlopként megjelenő) keresőmezők és a nem listára mutatók (`LookupList` nem GUID) csak olvashatók maradnak.
- A mező szűrése, a kapcsolat viselkedése (törlés korlátozása) és a kaszkádolt választás nincs megvalósítva.
- Ha egy kiválasztott elem nincs a betöltött listában (törölték, vagy a korláton túl van), `#azonosító` alakban látszik, és megmarad.

A TaxonomyFieldTypeMulti pontos formátumát a bekötéskor a `FieldValuesForEdit` kimenetével kell ellenőrizni; tenant- és verziófüggő eltérések előfordulnak.

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
