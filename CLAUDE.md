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
- A helyi futtatás a `config/serve.json` Form Customizer konfigurációját használja (`pageUrl`, `RootFolder`, `PageType`: 8 = New, 6 = Edit, 4 = Display, Edit/Display esetén `ID`).
- Telepítés egy site-ra: `scripts/Provision-FormJet.ps1` (PnP.PowerShell). Ezt **ne futtasd** a felhasználó kifejezett kérése nélkül, mert éles SharePoint site-ot módosít.

## Architektúra

```
src/extensions/formJet/
  FormJetFormCustomizer.ts   SPFx belépési pont: mód, lista, elem → FormHost; formSaved()/formClosed()
  models/                    IFormConfig (konfigurációs séma), IFieldSchema (mezőséma, FormValues, FieldErrors)
  engine/                    TISZTA LOGIKA, SharePoint és React nélkül
    ConditionEngine.ts       visibleWhen / readOnlyWhen / requiredWhen kiértékelése
    DateFormat.ts            DateTime form-string ↔ Date a web kultúrája szerint
    FormStyle.ts             stílus: ellenőrzés (hex szín, színátmenet, számtartomány, felsorolt értékek), módonkénti feloldás, háttér CSS
    RelatedList.ts           kapcsolódó elemek: beállítás ellenőrzése, párosító érték, CAML lekérdezés
    EngineStrings.ts         a motor üzenetei (alapból angol; az onInit a loc `Engine` részét adja át) + format()
    LayoutResolver.ts        séma + konfig + mód + értékek → IResolvedForm; alapértelmezett konfig; parseConfig
  services/                  PnPjs v4 hívások, csak itt van SharePoint kommunikáció
    sp.ts                    getSP() – a PnPjs példány; getSP(context) az onInit-ben
    PermissionService.ts     admin-e (site admin vagy Manage Web)
    SchemaService.ts         tartalomtípus mezői, tartalomtípus feloldása New módban
    ConfigService.ts         konfiguráció olvasása / mentése ETag-gel (412 → ConfigConflictError)
    RelatedListService.ts    a webhely listái, egy lista mezői, kapcsolódó elemek lekérdezése (renderListDataAsStream)
    ItemService.ts           elem olvasása (FieldValuesForEdit / FieldValuesAsText), mentése (validateUpdateListItem)
  loc/                       en-us.js, hu-hu.js, myStrings.d.ts – minden felhasználói szöveg
  components/                React + Fluent UI v8
    FormHost.tsx             állapot, betöltés, mentés, ütközéskezelés, tervező mód kapcsoló
    FormRenderer.tsx         szekciók és rács; a tervező előnézete is ezt használja
    FieldRenderer.tsx        mezőtípus → vezérlő
    DateTimeField.tsx        DateTime mező: Fluent DatePicker (+ TimePicker, ha a mező időt is tárol)
    RichTextField.tsx        rich text Note mező: TipTap szerkesztő Fluent eszköztárral (lazy chunk)
    RelatedItems.tsx         kapcsolódó elemek szekció: csak olvasható táblázat egy másik listából
    RelatedListEditor.tsx    a tervező szekciókártyájának „Kapcsolódó elemek” beállításai
    FormContext.ts           React context: a web kultúrája, a felület nyelve, az elem azonosítója és mentett értékei
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

## Konfigurációs séma

A típusok forrása: `models/IFormConfig.ts`. Példa: `samples/config-example.json`.

- Séma módosításakor emeld a `schemaVersion`-t, és bővítsd a `parseConfig`-ot migrációval a régi verzióról. A mentett konfigurációk éles listákban vannak, nem törhetnek el.
- Új stílustulajdonság: típus az `IFormStyle` / `ISectionStyle` / `IFieldStyle`-ban + a `FormStyle.ts` megfelelő `*_STYLE_SPEC`-je + alkalmazás a `FormRenderer`-ben + vezérlő a `StylePanel`-ben + a fejlesztői leírás 6. fejezete. Opcionális mezőként nem kell sémaverziót emelni.
- Új feltétel-operátor: `ConditionOperator` típus + `ConditionEngine.evalField` + a `DesignerPanel` súgószövege.

## SharePoint sajátosságok

- A `FieldValuesForEdit` / `FieldValuesAsText` kulcsaiban az `_` karakter `_x005f_`-ként jön; a `decodeKeys` alakítja vissza.
- MultiChoice form-string: `;#A;#B;#`. Boolean: `"1"` / `"0"`.
- Dátum: a `validateUpdateListItem` a **web területi beállításai** szerinti formátumot várja (magyar site-on pl. `2026. 10. 10.`), nem ISO-t. A formátumot az `engine/DateFormat.ts` állítja elő a `pageContext.cultureInfo.currentCultureName` alapján; az időt mindig 24 órás `HH:mm` alakban írjuk. A dátumok a web időzónája szerinti "falióra" értékek, időzóna-átváltás nincs.
- A `Choices` mező REST verziótól függően tömb vagy `{ results: [] }`; a `SchemaService.normalizeChoices` kezeli.
- A customizer a tartalomtípusra van kötve (`New/Edit/DisplayFormClientSideComponentId`). Grid nézetben és quick edit esetén a gyári felület fut.

## Kódstílus

- TypeScript `strict`. Ne használj `any`-t; ha a könyvtár típusa hiányos, szűk `as { ... }` cast a megoldás.
- React függvénykomponensek és hookok, osztálykomponenst ne írj. Fluent UI v8 (`@fluentui/react`), ne keverd v9-cel.
- PnPjs v4: a lekérdezés hívható (`list.items.getById(id).select(...)()`), az `items.add` közvetlenül az adatot adja vissza.
- Dátumválasztó: Fluent UI v8 `DatePicker` és `TimePicker` (`components/DateTimeField.tsx`); ne vezess be külön dátumkönyvtárat. A naptár nevei a felület nyelvét követik (`engine/DateFormat.ts`, `Intl`), új nyelvhez nem kell külön import.
- Rich text szerkesztő: TipTap v3 (`components/RichTextField.tsx`), csak a rich text Note mezőknél; a sima szöveges Note `TextField` marad. A `FieldRenderer` `React.lazy`-vel tölti be, a TipTap ne kerüljön a fő csomagba. A HTML-t mindig a TipTap sémája értelmezze, `dangerouslySetInnerHTML`-t ne használj. A `@tiptap/*` csomagok verziója legyen azonos.
- React 17 (`ReactDOM.render`). React 18-ra váltás csak az SPFx verzióval együtt.
- Felhasználónak szóló szöveget ne írj a kódba. Új szöveg: kulcs a `loc/myStrings.d.ts`-be, és **mindkét** nyelvi fájlba (`en-us.js`, `hu-hu.js`); használat: `import * as strings from 'FormJetFormCustomizerStrings'`. Paraméterezés `{0}` helyőrzővel és a `format()` függvénnyel.
- Az `engine/` nem importálhatja a lokalizációs modult; a motor üzenetei az `IEngineStrings`-be és a loc fájlok `Engine` részébe kerülnek.

## Ellenőrzés munka után

1. `npx tsc --noEmit -p .` hiba nélkül fusson.
2. Ha az `engine/` változott: ellenőrizd a `samples/config-example.json`-nal. New módban a Jóváhagyás szekció nem látszik; Edit módban 500 000 feletti összegnél a Justification látható és kötelező.
3. Mentési útvonal változásánál nézd át, hogy rejtett mező nem kerülhet a `changed` objektumba (`FormHost.save`).

## Nyitott feladatok

- People / Lookup / Managed metadata / URL / Location / Image mezők bekötése (`@pnp/spfx-controls-react`) a `FieldRenderer`-ben.
- Mellékletek feltöltése mentés után (`FormHost.save` TODO).
- Drag & drop a tervezőben (`@dnd-kit/core`, `@dnd-kit/sortable`), vizuális feltételszerkesztő.
- Jest egységtesztek az `engine/` modulokra.
