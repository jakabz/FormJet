# FormJet

SPFx Form Customizer, amely a SharePoint lista gyári New / Edit / Display formját cseréli le. Az elrendezést a
`FormConfigurations` listában tárolt JSON határozza meg; a site adminok a formon belüli tervezővel szerkesztik.

- SPFx 1.23.2 (Heft), React 17, Fluent UI v8, PnPjs v4
- Node.js 22 (`nvm use`)

Felhasználói leírás (kitöltés és az űrlap megtervezése): [docs/FELHASZNALOI_LEIRAS.md](docs/FELHASZNALOI_LEIRAS.md).

Részletes fejlesztői leírás: [docs/FEJLESZTOI_LEIRAS.md](docs/FEJLESZTOI_LEIRAS.md).

## Fejlesztés

```
nvm use
npm install
npx tsc --noEmit -p .   # típusellenőrzés
npm start               # helyi futtatás (config/serve.json)
npm run build           # production build + sharepoint/solution/formjet.sppkg
```

Helyi futtatás előtt a `config/serve.json`-ban állítsd be a tesztlistát (`pageUrl`, `RootFolder`, Edit/Display
esetén `ID`). A `{tenantDomain}` helyére a `SPFX_SERVE_TENANT_DOMAIN` környezeti változó értéke kerül.
A nem alapértelmezett konfiguráció indítása: `npm start -- --serve-config edit`.

## Telepítés

1. `npm run build`, majd a `sharepoint/solution/formjet.sppkg` feltöltése az app catalogba.
2. A webhelyen tedd ki egy oldalra a **FormJet beállítása** webpartot (a csomag része), és kapcsold be a FormJet űrlapot a kívánt
   listákon. A webpart a `FormConfigurations` listát is létrehozza, és egy gombbal a tagok számára csak olvashatóvá teszi.
   Webhelytulajdonosi jog kell hozzá.
3. Az űrlap nem jogosultsági határ; az elrendezéseket a `FormConfigurations` lista jogosultsága védi.

Sok webhely automatizált beállításához a PowerShell szkript is használható (PnP.PowerShell 2.x, saját Entra ID
alkalmazásregisztrációval):

```powershell
./scripts/Provision-FormJet.ps1 -SiteUrl <site> -TargetList <lista> -ComponentId 89262798-3b9c-4299-9d5b-754a7e8ac6d8 -ClientId <app id>
```

Visszaállítás a gyári űrlapra: a webparton a kapcsoló kikapcsolása, vagy a szkript `-Unbind` kapcsolóval.

Példa konfiguráció: [samples/config-example.json](samples/config-example.json).
