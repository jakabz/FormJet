# FormJet – útmutató Claude számára

SPFx Form Customizer, amely a SharePoint lista gyári New / Edit / Display formját cseréli le.
Az elrendezést a `FormConfigurations` listában tárolt JSON határozza meg. A site adminok a formon
belüli tervezővel szerkesztik, a többi felhasználó a mentett elrendezéssel tölti ki a formot.

A felhasználóval magyarul kommunikálj. A kódkommentek és a felhasználói szövegek magyarok;
az azonosítók (változók, függvények, típusok) angolok.

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
    LayoutResolver.ts        séma + konfig + mód + értékek → IResolvedForm; alapértelmezett konfig; parseConfig
  services/                  PnPjs v4 hívások, csak itt van SharePoint kommunikáció
    sp.ts                    getSP() – a PnPjs példány; getSP(context) az onInit-ben
    PermissionService.ts     admin-e (site admin vagy Manage Web)
    SchemaService.ts         tartalomtípus mezői, tartalomtípus feloldása New módban
    ConfigService.ts         konfiguráció olvasása / mentése ETag-gel (412 → ConfigConflictError)
    ItemService.ts           elem olvasása (FieldValuesForEdit / FieldValuesAsText), mentése (validateUpdateListItem)
  components/                React + Fluent UI v8
    FormHost.tsx             állapot, betöltés, mentés, ütközéskezelés, tervező mód kapcsoló
    FormRenderer.tsx         szekciók és rács; a tervező előnézete is ezt használja
    FieldRenderer.tsx        mezőtípus → vezérlő
    DesignerPanel.tsx        admin tervező (Elrendezés / Mező / JSON fülek)
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

## Konfigurációs séma

A típusok forrása: `models/IFormConfig.ts`. Példa: `samples/config-example.json`.

- Séma módosításakor emeld a `schemaVersion`-t, és bővítsd a `parseConfig`-ot migrációval a régi verzióról. A mentett konfigurációk éles listákban vannak, nem törhetnek el.
- Új feltétel-operátor: `ConditionOperator` típus + `ConditionEngine.evalField` + a `DesignerPanel` súgószövege.

## SharePoint sajátosságok

- A `FieldValuesForEdit` / `FieldValuesAsText` kulcsaiban az `_` karakter `_x005f_`-ként jön; a `decodeKeys` alakítja vissza.
- MultiChoice form-string: `;#A;#B;#`. Boolean: `"1"` / `"0"`.
- Dátum: a `validateUpdateListItem` a **web területi beállításai** szerinti formátumot várja (magyar site-on pl. `2026. 10. 10.`), nem ISO-t.
- A `Choices` mező REST verziótól függően tömb vagy `{ results: [] }`; a `SchemaService.normalizeChoices` kezeli.
- A customizer a tartalomtípusra van kötve (`New/Edit/DisplayFormClientSideComponentId`). Grid nézetben és quick edit esetén a gyári felület fut.

## Kódstílus

- TypeScript `strict`. Ne használj `any`-t; ha a könyvtár típusa hiányos, szűk `as { ... }` cast a megoldás.
- React függvénykomponensek és hookok, osztálykomponenst ne írj. Fluent UI v8 (`@fluentui/react`), ne keverd v9-cel.
- PnPjs v4: a lekérdezés hívható (`list.items.getById(id).select(...)()`), az `items.add` közvetlenül az adatot adja vissza.
- React 17 (`ReactDOM.render`). React 18-ra váltás csak az SPFx verzióval együtt.
- Felhasználónak szóló szöveg magyarul. A lokalizáció (`loc/`) még nincs bekötve; új szöveget egyelőre a komponensben helyezz el, de legyen könnyen kiemelhető.

## Ellenőrzés munka után

1. `npx tsc --noEmit -p .` hiba nélkül fusson.
2. Ha az `engine/` változott: ellenőrizd a `samples/config-example.json`-nal. New módban a Jóváhagyás szekció nem látszik; Edit módban 500 000 feletti összegnél a Justification látható és kötelező.
3. Mentési útvonal változásánál nézd át, hogy rejtett mező nem kerülhet a `changed` objektumba (`FormHost.save`).

## Nyitott feladatok

- People / Lookup / Managed metadata / URL / Location / Image mezők bekötése (`@pnp/spfx-controls-react`) a `FieldRenderer`-ben.
- DatePicker és dátumformázás a web területi beállításai szerint.
- Mellékletek feltöltése mentés után (`FormHost.save` TODO).
- Drag & drop a tervezőben (`@dnd-kit/core`, `@dnd-kit/sortable`), vizuális feltételszerkesztő.
- Jest egységtesztek az `engine/` modulokra; lokalizáció a `loc/` mappába.
