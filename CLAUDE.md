# FormJet – útmutató Claude számára

SPFx Form Customizer, amely a SharePoint lista gyári New / Edit / Display formját cseréli le.
Az elrendezést a `FormConfigurations` listában tárolt JSON határozza meg. A site adminok a formon
belüli tervezővel szerkesztik, a többi felhasználó a mentett elrendezéssel tölti ki a formot.

A felhasználóval magyarul kommunikálj. A kódkommentek magyarok, az azonosítók (változók, függvények,
típusok) angolok. A felhasználói szövegek a `loc/` fájlokból jönnek (angol és magyar).

Részletes fejlesztői leírás: `docs/FEJLESZTOI_LEIRAS.md` (séma referencia, form-string formátumok,
receptek új mezőtípushoz és operátorhoz, tesztmátrix). Ha a sémát, egy operátort vagy egy mezőtípus
kezelését módosítod, azt a leírást is frissítsd.

## Parancsok

Az SPFx verziótól függ, hogy gulp (≤ 1.21) vagy Heft (1.22+) a build eszközlánc.
**Mielőtt parancsot futtatsz, nézd meg a `package.json` `scripts` részét**, és azt használd.

| Feladat | Heft (1.22+) | gulp (≤ 1.21) |
| --- | --- | --- |
| Build | `npm run build` | `gulp build` |
| Helyi futtatás | `npm start` | `gulp serve` |
| Csomagolás (.sppkg) | a `package.json` megfelelő scriptje (Heft `package-solution --production`) | `gulp bundle --ship && gulp package-solution --ship` |
| Típusellenőrzés | `npx tsc --noEmit -p .` | `npx tsc --noEmit -p .` |

- A Node.js verziónak egyeznie kell az SPFx verzió által előírttal (`.nvmrc` vagy a `package.json` `engines` mezője).
- A futó `npm start` a `loc/` fájlok változását nem veszi át: új vagy módosított szöveg után le kell állítani és újra kell indítani, különben az új szövegek üresek. Emiatt felhasználói szöveget ne használj modul betöltésekor lefutó kódban (modulszintű `format(strings.…)`), csak függvényben vagy komponensben.
- A helyi futtatás a `config/serve.json` Form Customizer konfigurációját használja (`pageUrl`, `RootFolder`, `PageType`: 8 = New, 6 = Edit, 4 = Display, Edit/Display esetén `ID`).
- Telepítés egy site-ra: `scripts/Provision-FormJet.ps1` (PnP.PowerShell). Ezt **ne futtasd** a felhasználó kifejezett kérése nélkül, mert éles SharePoint site-ot módosít.

## Architektúra

```
src/extensions/formJet/
  FormJetFormCustomizer.ts   SPFx belépési pont: mód, lista, elem → FormHost; formSaved()/formClosed()
  models/                    IFormConfig (konfigurációs séma), IFieldSchema (mezőséma, FormValues, FieldErrors)
  engine/                    TISZTA LOGIKA, SharePoint és React nélkül
    Attachments.ts           mellékletek: a pszeudo-mező neve, fájlnevek ellenőrzése
    ConditionEngine.ts       visibleWhen / readOnlyWhen / requiredWhen kiértékelése
    DateFormat.ts            DateTime form-string ↔ Date a web kultúrája szerint
    FormStyle.ts             stílus: ellenőrzés (hex szín, színátmenet, számtartomány, felsorolt értékek), módonkénti feloldás, háttér CSS
    NumberFormat.ts          szám alapérték form-stringgé alakítása (tizedesjel a web kultúrája szerint, százalék); pénznem jele az LCID-ből
    RelatedList.ts           kapcsolódó elemek: beállítás ellenőrzése, párosító érték, CAML lekérdezés
    ImageValue.ts            kép (Thumbnail) form-string (képobjektum JSON) értelmezése, előállítása, megjeleníthető cím
    LocationValue.ts         Location form-string (helyobjektum JSON) értelmezése, előállítása, cím formázása
    LookupValue.ts           Lookup / LookupMulti form-string (azonosítók) értelmezése és előállítása
    UrlValue.ts              URL mező form-string (`cím, leírás`) értelmezése és előállítása; biztonságos cím ellenőrzése
    UserValue.ts             User / UserMulti form-string (JSON tömb `Key`-jel) értelmezése és előállítása
    EngineStrings.ts         a motor üzenetei (alapból angol; az onInit a loc `Engine` részét adja át) + format()
    LayoutResolver.ts        séma + konfig + mód + értékek → IResolvedForm; alapértelmezett konfig; parseConfig
  services/                  PnPjs v4 hívások, csak itt van SharePoint és egyéb hálózati kommunikáció
    sp.ts                    getSP() – a PnPjs példány; getSP(context) az onInit-ben; getAadToken() nem SharePoint hívásokhoz
    PermissionService.ts     admin-e (site admin vagy Manage Web)
    SchemaService.ts         tartalomtípus mezői (rejtett és Computed mezők nélkül, + `Attachments` pszeudo-mező), tartalomtípus feloldása New módban
    AttachmentService.ts     mellékletek listázása, feltöltése és törlése (lomtárba), egymás után futtatva
    ConfigService.ts         konfiguráció olvasása / mentése ETag-gel (412 → ConfigConflictError)
    LocationService.ts       helykeresés a Microsoft 365 helykeresőjével (Outlook végpont, AAD tokennel – nem PnPjs)
    LookupService.ts         a keresőmező választható elemei a hivatkozott listából (gyorsítótárazva)
    PeopleService.ts         személyek és csoportok keresése (clientPeoplePickerSearchUser)
    RelatedListService.ts    a webhely listái, egy lista mezői, kapcsolódó elemek lekérdezése (renderListDataAsStream)
    ImageService.ts          a kép mező fájljának feltöltése (`UploadImage`, a webhely eszköztárába)
    ItemService.ts           elem olvasása (FieldValuesForEdit / FieldValuesAsText), mentése (validateUpdateListItem)
  loc/                       en-us.js, hu-hu.js, myStrings.d.ts – minden felhasználói szöveg
  components/                React + Fluent UI v8
    FormHost.tsx             állapot, betöltés, mentés, ütközéskezelés, tervező mód kapcsoló
    FormRenderer.tsx         szekciók és rács; a tervező előnézete is ezt használja
    FieldRenderer.tsx        mezőtípus → vezérlő
    AttachmentsField.tsx     mellékletek: fájlok listája, hozzáadás, törlés; a változások mentéskor hajtódnak végre
    DateTimeField.tsx        DateTime mező: Fluent DatePicker (+ TimePicker, ha a mező időt is tárol)
    ImageField.tsx           kép (Thumbnail) mező: előnézet, kiválasztás, csere, törlés; a feltöltés mentéskor történik
    LocationField.tsx        Location mező: Fluent TagPicker helykereséssel; a beírt szöveg egyéni helyként is menthető
    LookupField.tsx          Lookup mező: Fluent Dropdown; LookupMulti: jelölőnégyzetes lista vagy lenyíló lista (`lookupDisplay`)
    PeopleField.tsx          User / UserMulti mező: Fluent NormalPeoplePicker a SharePoint névkeresőjével
    UrlField.tsx             URL mező: webcím + megjelenő szöveg; csak olvashatóként hivatkozás vagy kép
    RichTextField.tsx        rich text Note mező: TipTap szerkesztő Fluent eszköztárral (lazy chunk)
    RelatedItems.tsx         kapcsolódó elemek szekció: csak olvasható táblázat egy másik listából
    RelatedListEditor.tsx    a tervező szekciókártyájának „Kapcsolódó elemek” beállításai
    FormContext.ts           React context: a web kultúrája, a felület nyelve, az elem azonosítója, mentett értékei és a mellékletek állapota
    DesignerPanel.tsx        admin tervező (Elrendezés / Mező / Stílus / JSON fülek)
    StylePanel.tsx           a tervező Stílus füle: form, szekció és mező stílusa módonként
scripts/Provision-FormJet.ps1  konfigurációs lista + tartalomtípus bekötés
samples/config-example.json    példa konfiguráció
```

Rétegszabályok:

- Az `engine/` nem importálhat `services/`-ből, `components/`-ből, `@pnp/*`-ból vagy `@microsoft/*`-ból.
- A `components/` közvetlenül nem hív PnPjs-t, csak `services/`-en keresztül.
- A tervező és a felhasználói form **ugyanazt** a `FormRenderer`-t használja. Ne készíts külön előnézeti renderelőt.

## Kulcsdöntések – ezeket ne írd felül egyeztetés nélkül

1. **Mentés `validateUpdateListItem`-mel** (új elemnél `addValidateUpdateItemUsingPath`). Minden érték **form-string** formátumú, ugyanaz, amit a `FieldValuesForEdit` visszaad. Ne válts típusonkénti REST payloadra (`items.add` / `item.update` objektumokkal) a cél listán.
2. **Csak a látható, szerkeszthető és módosult mezők** kerülnek a mentésbe. Rejtett mező értékét soha ne küldd el, mert az felülírná a szerveroldali értéket.
3. **A kötelezőség csak szigorítható.** Ha a SharePoint mezőt kötelezőnek jelöli, kliens oldalon nem tehető opcionálissá.
4. **A form nem jogosultsági határ.** Az admin ellenőrzés (`PermissionService`) csak a tervező gombot rejti; a valódi védelem a `FormConfigurations` lista jogosultsága. Ne állíts be biztonsági funkcióként kliens oldali rejtést.
5. **A konfiguráció kulcsa a mező `InternalName`-je**, nem a címe.
6. **Konfiguráció nélkül vagy hibás JSON esetén** alapértelmezett elrendezés jelenik meg (`createDefaultConfig`), a form sosem lehet üres.

7. **A stílus strukturált, nem szabad CSS.** A konfiguráció `style` részeibe csak a `FormStyle.ts` specifikációjában szereplő tulajdonság kerülhet; a szín kizárólag hex érték, a színátmenet ellenőrzött részekből (típus, szög, két hex szín) áll össze a `backgroundCss`-ben. Szabad CSS mezőt, `url()`-t vagy tetszőleges CSS értéket ne engedj be egyeztetés nélkül.
8. **A kapcsolódó elemek csak olvashatók.** A `related` szekció egy másik lista elemeit listázza, de nem ír bele; a kapcsolódó elemek formon belüli szerkesztése vagy mentése egyeztetést igényel. A CAML lekérdezésbe kerülő mezőnevek csak belső névnek megfelelő értékek lehetnek (`RelatedList.ts`).
9. **A mellékletek pszeudo-mezőként működnek, és az elem mentése után kerülnek fel.** Az `Attachments` a sémában mezőként szerepel (ha a listán engedélyezve van), így bármelyik szekcióba elhelyezhető, de értéke nem form-string, és soha nem kerül a `changed` objektumba. Ha az elem mentése sikerült, de egy melléklet művelete nem, a form nyitva marad, és a Mentés már csak a mellékleteket próbálja újra (`attachmentRetryId`) – új elemnél így nem jön létre másolat. Ezt a sorrendet ne változtasd meg egyeztetés nélkül.

## Konfigurációs séma

A típusok forrása: `models/IFormConfig.ts`. Példa: `samples/config-example.json`.

- Séma módosításakor emeld a `schemaVersion`-t, és bővítsd a `parseConfig`-ot migrációval a régi verzióról. A mentett konfigurációk éles listákban vannak, nem törhetnek el.
- Új stílustulajdonság: típus az `IFormStyle` / `ISectionStyle` / `IFieldStyle`-ban + a `FormStyle.ts` megfelelő `*_STYLE_SPEC`-je + alkalmazás a `FormRenderer`-ben + vezérlő a `StylePanel`-ben + a fejlesztői leírás 6. fejezete. Opcionális mezőként nem kell sémaverziót emelni.
- Új feltétel-operátor: `ConditionOperator` típus + `ConditionEngine.evalField` + a `DesignerPanel` súgószövege.

## SharePoint sajátosságok

- A `FieldValuesForEdit` / `FieldValuesAsText` kulcsaiban az `_` karakter `_x005f_`-ként jön; a `decodeKeys` alakítja vissza.
- MultiChoice form-string: `;#A;#B;#`. Boolean: `"1"` / `"0"`.
- User / UserMulti form-string: JSON tömb, elemenként `Key` (claims bejelentkezési név, SharePoint csoportnál a csoport neve). Üres kiválasztás: üres szöveg. Meglévő elemnél az értéket nem a `FieldValuesForEdit`-ből vesszük, hanem külön lekérdezésből (`ItemService.loadUserValues`: a mező kibontva, `Name` / `Title` / `EMail`).
- Dátum: a `validateUpdateListItem` a **web területi beállításai** szerinti formátumot várja (magyar site-on pl. `2026. 10. 10.`), nem ISO-t. A formátumot az `engine/DateFormat.ts` állítja elő a `pageContext.cultureInfo.currentCultureName` alapján; az időt mindig 24 órás `HH:mm` alakban írjuk. A dátumok a web időzónája szerinti "falióra" értékek, időzóna-átváltás nincs.
- Szám form-string: a web kultúrája szerinti tizedesjellel (magyar site-on `0,5`); százalékos mezőnél (`ShowAsPercentage`) a százalékérték (`25`), nem a tárolt tört. A séma `DefaultValue`-ja kultúrafüggetlen és tört (`0.25`), ezt a `NumberFormat.resolveNumberDefault` alakítja át.
- Lookup form-string: egyértékűnél a hivatkozott elem azonosítója (`5`), többértékűnél `5;#;#6;#`. Meglévő elemnél az értéket a `<mező>Id` tulajdonságból vesszük (`ItemService.loadLookupValues`), nem a `FieldValuesForEdit`-ből. Csak a listára mutató keresőmező szerkeszthető (`LookupListId`).
- URL form-string: `cím, leírás` (a címben lévő vessző duplázva). Meglévő elemnél az értéket a mező `Url` / `Description` részéből vesszük (`ItemService.loadUrlValues`). Hivatkozásként vagy képként csak `http(s)://`, `mailto:` vagy webhelyen belüli cím jelenik meg (`isSafeUrl`).
- Location form-string: a helyobjektum JSON-ja (`DisplayName`, `Address`, `Coordinates`, …); az ismeretlen tulajdonságokat is változatlanul visszaírjuk. A „Hely: város” típusú kísérő oszlopokat a SharePoint tölti ki, azok csak olvashatók. A keresés nem dokumentált Outlook végpontot használ (`LocationService`); ha nem érhető el, a mező egyéni (csak névvel rendelkező) helyet ment.
- Kép (Thumbnail) form-string: a képobjektum JSON-ja (`type: thumbnail`, `fileName`, `serverRelativeUrl`, `id`, `fieldName`, `fieldId`, `serverUrl`). A kiválasztott kép a mentéskor, **az elem mentése előtt** töltődik fel (`ImageService.uploadImage`); hiba esetén az elem nem íródik. Feltöltésig a mező értéke egy `pending` jelző, a fájlt a `FormContext` tartja. Megjelenítéshez csak webhelyen belüli cím használható (`ImageValue.getImageUrl`).
- A `Choices` mező REST verziótól függően tömb vagy `{ results: [] }`; a `SchemaService.normalizeChoices` kezeli.
- A customizer a tartalomtípusra van kötve (`New/Edit/DisplayFormClientSideComponentId`). Grid nézetben és quick edit esetén a gyári felület fut.

## Kódstílus

- TypeScript `strict`. Ne használj `any`-t; ha a könyvtár típusa hiányos, szűk `as { ... }` cast a megoldás.
- React függvénykomponensek és hookok, osztálykomponenst ne írj. Fluent UI v8 (`@fluentui/react`), ne keverd v9-cel.
- PnPjs v4: a lekérdezés hívható (`list.items.getById(id).select(...)()`), az `items.add` közvetlenül az adatot adja vissza.
- Dátumválasztó: Fluent UI v8 `DatePicker` és `TimePicker` (`components/DateTimeField.tsx`); ne vezess be külön dátumkönyvtárat. A naptár nevei a felület nyelvét követik (`engine/DateFormat.ts`, `Intl`), új nyelvhez nem kell külön import.
- Személyválasztó: Fluent UI v8 `NormalPeoplePicker` + `PeopleService` (`components/PeopleField.tsx`). A `@pnp/spfx-controls-react` csomagot ne vezesd be egyeztetés nélkül: nagy, és saját Fluent verziót hoz.
- Rich text szerkesztő: TipTap v3 (`components/RichTextField.tsx`), csak a rich text Note mezőknél; a sima szöveges Note `TextField` marad. A `FieldRenderer` `React.lazy`-vel tölti be, a TipTap ne kerüljön a fő csomagba. A HTML-t mindig a TipTap sémája értelmezze, `dangerouslySetInnerHTML`-t ne használj. A `@tiptap/*` csomagok verziója legyen azonos.
- React 17 (`ReactDOM.render`). React 18-ra váltás csak az SPFx verzióval együtt.
- Felhasználónak szóló szöveget ne írj a kódba. Új szöveg: kulcs a `loc/myStrings.d.ts`-be, és **mindkét** nyelvi fájlba (`en-us.js`, `hu-hu.js`); használat: `import * as strings from 'FormJetFormCustomizerStrings'`. Paraméterezés `{0}` helyőrzővel és a `format()` függvénnyel.
- Az `engine/` nem importálhatja a lokalizációs modult; a motor üzenetei az `IEngineStrings`-be és a loc fájlok `Engine` részébe kerülnek.

## Ellenőrzés munka után

1. `npx tsc --noEmit -p .` hiba nélkül fusson.
2. Ha az `engine/` változott: ellenőrizd a `samples/config-example.json`-nal. New módban a Jóváhagyás szekció nem látszik; Edit módban 500 000 feletti összegnél a Justification látható és kötelező.
3. Mentési útvonal változásánál nézd át, hogy rejtett mező nem kerülhet a `changed` objektumba (`FormHost.save`).

## Nyitott feladatok

- Managed metadata mező bekötése a `FieldRenderer`-ben.
- Drag & drop a tervezőben (`@dnd-kit/core`, `@dnd-kit/sortable`), vizuális feltételszerkesztő.
- Jest egységtesztek az `engine/` modulokra.
