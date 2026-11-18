<#
.SYNOPSIS
  FormJet demó: négy összekapcsolt minta lista létrehozása mintaadatokkal.

.DESCRIPTION
  A szkript a megadott webhelyen létrehozza az alábbi listákat, sokféle oszloptípussal és 10–20 mintaelemmel:

    FJ Partnerek       (Lists/FJPartners)  szöveg, választás (lenyíló és választógomb), többes választás, igen / nem,
                                           hivatkozás, kép hivatkozás, személy, dátum, pénznem, szám, hely, többsoros szöveg
    FJ Termékek        (Lists/FJProducts)  keresőmező a Partnerekre (Szállító), pénznem, szám, százalék, dátum, igen / nem,
                                           kép (Thumbnail), rich text, hivatkozás, többes választás
    FJ Megrendelések   (Lists/FJOrders)    keresőmező a Partnerekre (Vevő), többértékű keresőmező a Termékekre,
                                           személy és több személy, dátum + idő, hely, számított oszlop, mellékletek
    FJ Feladatok       (Lists/FJTasks)     a Megrendelésekhez kapcsolódó feladatok (Megrendelés keresőmező, indexelve):
                                           felelős (személy vagy SharePoint csoport), állapot, döntés, delegálás,
                                           JSON alapú feladat (RequestJSON / ResponseJSON)

  A FormJet bekötése a listákra ezután a FormJet beállítása webparttal (vagy a scripts/Provision-FormJet.ps1-gyel) történik.

  Kapcsolódó feladatok a Megrendelések űrlapján (tervező → mező nélküli elem → Kapcsolódó elemek):
    Lista: FJ Feladatok, párosító mező: Megrendelés (Order), ennek a listának a mezője: ID
    Hozzárendelés: Felelős (TaskAssignee), állapot mező: Állapot (TaskStatus)
    Megnyitható, ha: TaskStatus nem egyenlő Elvégezve
    JSON alapú feladat: kérés = RequestJSON, válasz = ResponseJSON
    Delegálás: delegált személy = DelegatedTo, állapot = TaskStatus / Delegálva, indoklás = DelegationReason

  Nem töltődik mintaértékkel: a hely (Location) és a kép (Thumbnail) oszlop, mert ezeket a CSOM nem tudja egyszerűen
  írni – az űrlapon kipróbálhatók.

  A szkript a webhelyet módosítja: csak demó vagy fejlesztői webhelyen futtasd.
  Előfeltétel: PnP.PowerShell (kipróbálva: Windows PowerShell 5.1 + PnP.PowerShell 1.12) és Entra ID
  alkalmazásregisztráció (ClientId). Az elemeket a szkript közvetlenül CSOM-mal veszi fel, az oszlop típusa szerinti
  értékekkel, mert az Add-PnPListItem értékátalakítása PnP verziónként eltér.

.PARAMETER SiteUrl
  A cél webhely címe.

.PARAMETER ClientId
  Az Entra ID alkalmazásregisztráció azonosítója (PnP.PowerShell interaktív bejelentkezéshez).

.PARAMETER UserEmails
  További felhasználók e-mail-címe a személy oszlopok mintaértékeihez. Hiányában minden személy a bejelentkezett felhasználó.

.PARAMETER Recreate
  Ha a demó listák már léteznek, törli (lomtárba helyezi) és újra létrehozza őket. Enélkül meglévő listánál a szkript leáll.

.EXAMPLE
  ./demo/New-FormJetDemo.ps1 -SiteUrl https://contoso.sharepoint.com/sites/formjet-demo -ClientId <app id>

.EXAMPLE
  ./demo/New-FormJetDemo.ps1 -SiteUrl <site> -ClientId <app id> -UserEmails anna@contoso.com, bela@contoso.com -Recreate
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)] [string] $SiteUrl,
  [Parameter(Mandatory = $true)] [string] $ClientId,
  [string[]] $UserEmails = @(),
  [switch] $Recreate
)

$ErrorActionPreference = 'Stop'

$Lists = [ordered]@{
  Partners = @{ Title = 'FJ Partnerek'; Url = 'Lists/FJPartners' }
  Products = @{ Title = 'FJ Termékek'; Url = 'Lists/FJProducts' }
  Orders   = @{ Title = 'FJ Megrendelések'; Url = 'Lists/FJOrders' }
  Tasks    = @{ Title = 'FJ Feladatok'; Url = 'Lists/FJTasks' }
}

# ---------------------------------------------------------------------------------------------------------------------
# Segédfüggvények
# ---------------------------------------------------------------------------------------------------------------------

function New-DemoList([hashtable] $Def) {
  Write-Host "Lista létrehozása: $($Def.Title)" -ForegroundColor Cyan
  New-PnPList -Title $Def.Title -Template GenericList -Url $Def.Url -OnQuickLaunch | Out-Null
  # A listát a webcíme alapján töltjük be: a New-PnPList kimenete PnP verziótól függ (van, ahol nem adja vissza a listát),
  # és üres azonosítóval a Get-PnPList az összes listát adná vissza.
  $list = @(Get-PnPList -Identity $Def.Url)
  if ($list.Count -ne 1) {
    throw "A(z) $($Def.Title) lista létrehozás után nem tölthető be ($($Def.Url))."
  }
  return $list[0]
}

# Oszlop létrehozása XML-ből. A létrehozáskor a megjelenő név a belső név (így biztosan ASCII belső név keletkezik),
# utána kapja meg a magyar címét.
function Add-DemoField {
  param(
    [Parameter(Mandatory = $true)] $List,
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [string] $Title,
    [Parameter(Mandatory = $true)] [string] $Type,
    [string] $Attributes = '',
    [string] $Inner = '',
    [string] $Description = '',
    # Ha a létrehozás nem sikerül (pl. a hely vagy a kép oszlopot a webhely nem engedi), csak figyelmeztet.
    [switch] $Optional
  )
  $xml = "<Field Type=`"$Type`" Name=`"$Name`" StaticName=`"$Name`" DisplayName=`"$Name`" $Attributes>$Inner</Field>"
  try {
    Add-PnPFieldFromXml -List $List -FieldXml $xml | Out-Null
  }
  catch {
    if (-not $Optional) { throw }
    Write-Warning "A(z) $Name ($Type) oszlop nem hozható létre, kimarad: $($_.Exception.Message)"
    return
  }
  $values = @{ Title = $Title }
  if ($Description) { $values.Description = $Description }
  Set-PnPField -List $List -Identity $Name -Values $values | Out-Null
}

function Get-ChoicesXml([string[]] $Choices, [string] $Default = '') {
  $inner = '<CHOICES>' + (($Choices | ForEach-Object { "<CHOICE>$([System.Security.SecurityElement]::Escape($_))</CHOICE>" }) -join '') + '</CHOICES>'
  if ($Default) { $inner += "<Default>$([System.Security.SecurityElement]::Escape($Default))</Default>" }
  return $inner
}

function Set-DemoView($List, [string[]] $Fields) {
  $view = Get-PnPView -List $List | Where-Object { $_.DefaultView } | Select-Object -First 1
  Set-PnPView -List $List -Identity $view.Id -Fields $Fields | Out-Null
}

# A lista oszlopainak típusa belső név szerint (listánként egyszer lekérdezve).
$script:FieldTypeCache = @{}
function Get-DemoFieldTypes($List) {
  $key = "$($List.Id)"
  if (-not $script:FieldTypeCache.ContainsKey($key)) {
    $map = @{}
    foreach ($field in @(Get-PnPField -List $List)) { $map[$field.InternalName] = $field.TypeAsString }
    $script:FieldTypeCache[$key] = $map
  }
  return $script:FieldTypeCache[$key]
}

# Azonosítók (int vagy int tömb) → egyedi azonosítók listája.
function Get-DemoIds($Value) {
  $ids = New-Object 'System.Collections.Generic.List[int]'
  foreach ($id in @($Value)) {
    if ($null -ne $id -and -not $ids.Contains([int] $id)) { $ids.Add([int] $id) }
  }
  return , $ids
}

# Elem felvétele közvetlenül CSOM-mal. Az értékeket az oszlop valódi típusa szerint alakítjuk típusos CSOM értékké
# (a PnP -Values átalakítása verziónként eltér: a PnP 1.x pl. a személyt és a számot sem mindig kezeli jól).
#   szám / pénznem: szám · igen / nem: bool · dátum: DateTime · többes választás: szövegtömb
#   keresőmező, személy: azonosító (többértékűnél azonosítók tömbje) · hivatkozás: "cím, leírás" · minden más: szöveg
# A $Users ugyanilyen (mezőnév → felhasználó- vagy csoportazonosító), csak az olvashatóság miatt külön.
# A null érték kimarad, a mező üres lesz. Az értékadásnál mindig kifejezés eredménye (cast, ::new()) szerepel, mert a
# PowerShell a cmdletek kimenetét PSObject-be csomagolja, és a CSOM indexere a csomagolót kapná meg.
function Add-DemoItem($List, [hashtable] $Values, [hashtable] $Users = @{}) {
  $types = Get-DemoFieldTypes $List
  $all = @{}
  foreach ($key in $Values.Keys) { $all[$key] = $Values[$key] }
  foreach ($key in $Users.Keys) { $all[$key] = $Users[$key] }

  $item = $List.AddItem([Microsoft.SharePoint.Client.ListItemCreationInformation]::new())
  foreach ($name in $all.Keys) {
    $value = $all[$name]
    if ($null -eq $value) { continue }
    $type = $types[$name]
    if (-not $type) { throw "A(z) $name oszlop nem található a(z) $($List.Title) listán." }
    switch ($type) {
      { $_ -in @('Number', 'Currency') } { $item[$name] = [double] $value; break }
      'Integer' { $item[$name] = [int] $value; break }
      'Boolean' { $item[$name] = [bool] $value; break }
      'DateTime' { $item[$name] = [datetime] $value; break }
      'MultiChoice' { $item[$name] = [string[]] @($value); break }
      'URL' {
        $parts = ([string] $value) -split ', ', 2
        $url = [Microsoft.SharePoint.Client.FieldUrlValue]::new()
        $url.Url = $parts[0]
        $url.Description = if ($parts.Count -gt 1) { $parts[1] } else { $parts[0] }
        $item[$name] = $url
        break
      }
      { $_ -in @('Lookup', 'LookupMulti') } {
        $lookups = New-Object 'System.Collections.Generic.List[Microsoft.SharePoint.Client.FieldLookupValue]'
        foreach ($id in (Get-DemoIds $value)) {
          $lookup = [Microsoft.SharePoint.Client.FieldLookupValue]::new()
          $lookup.LookupId = $id
          $lookups.Add($lookup)
        }
        if ($lookups.Count -eq 0) { break }
        if ($type -eq 'LookupMulti') { $item[$name] = $lookups.ToArray() } else { $item[$name] = $lookups[0] }
        break
      }
      { $_ -in @('User', 'UserMulti') } {
        $userValues = New-Object 'System.Collections.Generic.List[Microsoft.SharePoint.Client.FieldUserValue]'
        foreach ($id in (Get-DemoIds $value)) {
          $userValue = [Microsoft.SharePoint.Client.FieldUserValue]::new()
          $userValue.LookupId = $id
          $userValues.Add($userValue)
        }
        if ($userValues.Count -eq 0) { break }
        if ($type -eq 'UserMulti') { $item[$name] = $userValues.ToArray() } else { $item[$name] = $userValues[0] }
        break
      }
      default { $item[$name] = [string] $value }
    }
  }
  $item.Update()
  $List.Context.Load($item)
  try {
    $List.Context.ExecuteQuery()
  }
  catch {
    throw "$($List.Title): a(z) '$($all['Title'])' elem nem menthető: $($_.Exception.Message)"
  }
  return $item
}

# ---------------------------------------------------------------------------------------------------------------------
# Kapcsolódás, meglévő listák
# ---------------------------------------------------------------------------------------------------------------------

Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive

$existing = @($Lists.Values | Where-Object { Get-PnPList -Identity $_.Url -ErrorAction SilentlyContinue })
if ($existing.Count -gt 0) {
  if (-not $Recreate) {
    throw ("Már léteznek demó listák: $(($existing | ForEach-Object { $_.Title }) -join ', '). " +
      'Futtasd a -Recreate kapcsolóval az újralétrehozáshoz.')
  }
  # Fordított sorrendben, hogy a keresőmezők céllistái utoljára törlődjenek.
  foreach ($def in @($Lists.Values)[($Lists.Count - 1)..0]) {
    $list = Get-PnPList -Identity $def.Url -ErrorAction SilentlyContinue
    if ($list -and $PSCmdlet.ShouldProcess($def.Title, 'Lista törlése (lomtárba)')) {
      Write-Host "Lista törlése (lomtárba): $($def.Title)" -ForegroundColor Yellow
      Remove-PnPList -Identity $list -Recycle -Force | Out-Null
    }
  }
}

if (-not $PSCmdlet.ShouldProcess($SiteUrl, 'Demó listák létrehozása mintaadatokkal')) {
  return
}

# Személyek a mintaadatokhoz: a bejelentkezett felhasználó + a megadott e-mail-címek.
# A bejelentkezett felhasználót CSOM-mal kérjük le: a Get-PnPWeb -Includes CurrentUser PnP verziótól függően
# nem tölti be a LoginName-et.
$ctx = Get-PnPContext
$currentUser = $ctx.Web.CurrentUser
$ctx.Load($currentUser)
$ctx.ExecuteQuery()
# A személy mezőkbe a webhely felhasználóinak azonosítója kerül (EnsureUser: ha még nem tagja a webhelynek, felveszi).
$people = @($currentUser.Id)
$names = @($currentUser.Title)
foreach ($email in @($UserEmails | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
  try {
    $user = $ctx.Web.EnsureUser($email)
    $ctx.Load($user)
    $ctx.ExecuteQuery()
    $people += $user.Id
    $names += $user.Title
  }
  catch {
    Write-Warning "A(z) $email felhasználó nem található, kimarad: $($_.Exception.Message)"
  }
}
Write-Host "Személyek a mintaadatokhoz: $($names -join ', ')"
function Get-Person([int] $Index) { return $people[$Index % $people.Count] }

# A webhely tagjainak csoportja (a csoportnak kiosztott feladatokhoz). Ha nincs, a feladatok személyhez kerülnek.
$membersGroupId = $null
try {
  $membersGroup = Get-PnPGroup -AssociatedMemberGroup
  if ($membersGroup) { $membersGroupId = $membersGroup.Id }
}
catch {
  Write-Warning 'A webhely tagjainak csoportja nem érhető el; a csoportos feladatok a bejelentkezett felhasználóhoz kerülnek.'
}

$today = (Get-Date).Date
$HUF = 'LCID="1038" Decimals="0"'
$userAttr = 'List="UserInfo" ShowField="ImnName" UserSelectionScope="0"'

# ---------------------------------------------------------------------------------------------------------------------
# 1. FJ Partnerek
# ---------------------------------------------------------------------------------------------------------------------

$partners = New-DemoList $Lists.Partners
Set-PnPField -List $partners -Identity 'Title' -Values @{ Title = 'Partner neve' } | Out-Null

Add-DemoField $partners 'PartnerCode' 'Partnerkód' 'Text' 'MaxLength="20" EnforceUniqueValues="FALSE"' -Description 'Belső azonosító, pl. P-001'
Add-DemoField $partners 'PartnerType' 'Partner típusa' 'Choice' 'Format="Dropdown" Required="TRUE"' (Get-ChoicesXml @('Vevő', 'Szállító', 'Vevő és szállító') 'Vevő')
Add-DemoField $partners 'Country' 'Ország' 'Choice' 'Format="RadioButtons"' (Get-ChoicesXml @('Magyarország', 'Ausztria', 'Németország', 'Szlovákia', 'Románia') 'Magyarország')
Add-DemoField $partners 'Industries' 'Iparágak' 'MultiChoice' '' (Get-ChoicesXml @('Építőipar', 'Energetika', 'Gyártás', 'Kereskedelem', 'Egészségügy', 'Informatika'))
Add-DemoField $partners 'IsActive' 'Aktív' 'Boolean' '' '<Default>1</Default>'
Add-DemoField $partners 'Website' 'Weboldal' 'URL' 'Format="Hyperlink"'
Add-DemoField $partners 'Logo' 'Logó' 'URL' 'Format="Image"'
Add-DemoField $partners 'AccountManager' 'Kapcsolattartó' 'User' "$userAttr UserSelectionMode=`"PeopleOnly`""
Add-DemoField $partners 'FoundedDate' 'Alapítás dátuma' 'DateTime' 'Format="DateOnly"'
Add-DemoField $partners 'AnnualRevenue' 'Éves árbevétel' 'Currency' "$HUF Min=`"0`""
Add-DemoField $partners 'EmployeeCount' 'Létszám' 'Number' 'Decimals="0" Min="0"'
Add-DemoField $partners 'Headquarters' 'Székhely' 'Location' -Optional
Add-DemoField $partners 'PartnerNotes' 'Megjegyzés' 'Note' 'NumLines="6" RichText="FALSE"'

Set-DemoView $partners @('LinkTitle', 'PartnerCode', 'PartnerType', 'Country', 'Industries', 'IsActive', 'AccountManager', 'AnnualRevenue')

$partnerData = @(
  ,@('Duna Villamossági Kft.', 'Vevő', 'Magyarország', @('Építőipar', 'Kereskedelem'), 'dunavill.example.com', 1998, 2450000000, 85)
  ,@('Tisza Energetika Zrt.', 'Vevő', 'Magyarország', @('Energetika'), 'tiszaenergia.example.com', 2004, 12800000000, 420)
  ,@('Alpen Elektro GmbH', 'Szállító', 'Ausztria', @('Gyártás'), 'alpen-elektro.example.com', 1979, 9600000000, 310)
  ,@('Rheinkabel AG', 'Szállító', 'Németország', @('Gyártás', 'Energetika'), 'rheinkabel.example.com', 1965, 41000000000, 1250)
  ,@('Pannon Építő Kft.', 'Vevő', 'Magyarország', @('Építőipar'), 'pannonepito.example.com', 2011, 1830000000, 64)
  ,@('Tatra Svetlo s.r.o.', 'Vevő és szállító', 'Szlovákia', @('Gyártás', 'Kereskedelem'), 'tatrasvetlo.example.com', 1993, 3150000000, 140)
  ,@('Carpați Instal SRL', 'Vevő', 'Románia', @('Építőipar'), 'carpati-instal.example.com', 2007, 920000000, 38)
  ,@('Mátra Kórházellátó Kft.', 'Vevő', 'Magyarország', @('Egészségügy'), 'matrakorhaz.example.com', 2015, 640000000, 22)
  ,@('Balaton Okosotthon Bt.', 'Vevő', 'Magyarország', @('Informatika', 'Kereskedelem'), 'balatonokos.example.com', 2019, 180000000, 9)
  ,@('Bayern Schalttechnik GmbH', 'Szállító', 'Németország', @('Gyártás'), 'bayern-schalt.example.com', 1988, 15700000000, 560)
  ,@('Hegyvidék Kereskedőház Kft.', 'Vevő és szállító', 'Magyarország', @('Kereskedelem'), 'hegyvidekker.example.com', 2001, 2700000000, 97)
  ,@('Wien Licht KG', 'Szállító', 'Ausztria', @('Gyártás', 'Informatika'), 'wienlicht.example.com', 1996, 5200000000, 205)
)

$partnerIds = @()
for ($i = 0; $i -lt $partnerData.Count; $i++) {
  $p = $partnerData[$i]
  $item = Add-DemoItem $partners @{
    Title          = $p[0]
    PartnerCode    = 'P-{0:000}' -f ($i + 1)
    PartnerType    = $p[1]
    Country        = $p[2]
    Industries     = $p[3]
    IsActive       = ($i % 5 -ne 4)
    Website        = "https://$($p[4]), $($p[0])"
    Logo           = if ($i % 3 -eq 0) { "https://picsum.photos/seed/fjpartner$i/200/120, $($p[0]) logó" } else { $null }
    FoundedDate    = Get-Date -Year $p[5] -Month (($i % 12) + 1) -Day 15
    AnnualRevenue  = $p[6]
    EmployeeCount  = $p[7]
    PartnerNotes   = if ($i % 2 -eq 0) { "Éves keretszerződés.`nKedvezményes fizetési határidő: 45 nap." } else { $null }
  } @{ AccountManager = Get-Person $i }
  $partnerIds += $item.Id
}
$supplierIds = @(for ($i = 0; $i -lt $partnerData.Count; $i++) { if ($partnerData[$i][1] -ne 'Vevő') { $partnerIds[$i] } })
$customerIds = @(for ($i = 0; $i -lt $partnerData.Count; $i++) { if ($partnerData[$i][1] -ne 'Szállító') { $partnerIds[$i] } })

# ---------------------------------------------------------------------------------------------------------------------
# 2. FJ Termékek
# ---------------------------------------------------------------------------------------------------------------------

$products = New-DemoList $Lists.Products
Set-PnPField -List $products -Identity 'Title' -Values @{ Title = 'Termék neve' } | Out-Null

Add-DemoField $products 'ProductCode' 'Cikkszám' 'Text' 'MaxLength="30" Required="TRUE"'
Add-DemoField $products 'Category' 'Kategória' 'Choice' 'Format="Dropdown"' (Get-ChoicesXml @('Kapcsolók és aljzatok', 'Világítás', 'Kábelrendezés', 'Energiaelosztás', 'Épületautomatizálás'))
Add-DemoField $products 'Tags' 'Címkék' 'MultiChoice' '' (Get-ChoicesXml @('Új', 'Akciós', 'Kifutó', 'Okosotthon', 'Kültéri'))
Add-DemoField $products 'Supplier' 'Szállító' 'Lookup' "List=`"{$($partners.Id)}`" ShowField=`"Title`""
Add-DemoField $products 'UnitPrice' 'Egységár' 'Currency' "$HUF Min=`"0`""
Add-DemoField $products 'StockQuantity' 'Készlet (db)' 'Number' 'Decimals="0" Min="0"'
Add-DemoField $products 'DiscountRate' 'Kedvezmény' 'Number' 'Percentage="TRUE" Decimals="0" Min="0" Max="1"'
Add-DemoField $products 'LaunchDate' 'Bevezetés dátuma' 'DateTime' 'Format="DateOnly"'
Add-DemoField $products 'IsAvailable' 'Rendelhető' 'Boolean' '' '<Default>1</Default>'
Add-DemoField $products 'ProductImage' 'Termékkép' 'Thumbnail' -Optional
Add-DemoField $products 'ProductDescription' 'Leírás' 'Note' 'NumLines="8" RichText="TRUE" RichTextMode="FullHtml"'
Add-DemoField $products 'Datasheet' 'Adatlap' 'URL' 'Format="Hyperlink"'

Set-DemoView $products @('LinkTitle', 'ProductCode', 'Category', 'Tags', 'Supplier', 'UnitPrice', 'StockQuantity', 'DiscountRate', 'IsAvailable')

$productData = @(
  ,@('Egypólusú kapcsoló, fehér', 'Kapcsolók és aljzatok', @('Új'), 1890)
  ,@('Csillárkapcsoló, antracit', 'Kapcsolók és aljzatok', @(), 2450)
  ,@('Földelt dugalj gyermekvédelemmel', 'Kapcsolók és aljzatok', @('Akciós'), 2190)
  ,@('USB-A + USB-C töltőaljzat', 'Kapcsolók és aljzatok', @('Új', 'Okosotthon'), 8990)
  ,@('LED panel 60×60, 40 W', 'Világítás', @(), 14900)
  ,@('Kültéri mozgásérzékelős lámpa', 'Világítás', @('Kültéri'), 12500)
  ,@('Vészvilágító lámpatest, 1 óra', 'Világítás', @('Kifutó'), 18700)
  ,@('Kábelcsatorna 40×25, 2 m', 'Kábelrendezés', @(), 1450)
  ,@('Parapetcsatorna 130×50, 2 m', 'Kábelrendezés', @('Akciós'), 9800)
  ,@('Kábelkötegelő, 100 db', 'Kábelrendezés', @(), 990)
  ,@('Kiselosztó, 2×12 modul', 'Energiaelosztás', @(), 24500)
  ,@('Kismegszakító C16, 1P', 'Energiaelosztás', @(), 2390)
  ,@('Áram-védőkapcsoló 40 A, 30 mA', 'Energiaelosztás', @('Új'), 16800)
  ,@('Okos termosztát, Wi-Fi', 'Épületautomatizálás', @('Okosotthon', 'Új'), 39900)
  ,@('Okos redőnyvezérlő', 'Épületautomatizálás', @('Okosotthon'), 21900)
)

$productIds = @()
for ($i = 0; $i -lt $productData.Count; $i++) {
  $p = $productData[$i]
  $item = Add-DemoItem $products @{
    Title              = $p[0]
    ProductCode        = 'FJ-{0}-{1:0000}' -f $p[1].Substring(0, 3).ToUpper(), (1000 + $i * 37)
    Category           = $p[1]
    Tags               = if ($p[2].Count -gt 0) { $p[2] } else { $null }
    Supplier           = $supplierIds[$i % $supplierIds.Count]
    UnitPrice          = $p[3]
    StockQuantity      = (($i * 53) % 400) + 5
    DiscountRate       = if ($p[2] -contains 'Akciós') { 0.15 } elseif ($i % 4 -eq 0) { 0.05 } else { 0 }
    LaunchDate         = $today.AddDays(-30 * ($i + 2))
    IsAvailable        = -not ($p[2] -contains 'Kifutó')
    ProductDescription = "<p><strong>$($p[0])</strong></p><p>Kategória: $($p[1]). Szerelési útmutató és tanúsítványok az adatlapon.</p><ul><li>Gyártói garancia: 2 év</li><li>Csomagolási egység: $((($i % 3) + 1) * 5) db</li></ul>"
    Datasheet          = "https://example.com/adatlap/fj-$($i + 1).pdf, Adatlap (PDF)"
  }
  $productIds += $item.Id
}

# ---------------------------------------------------------------------------------------------------------------------
# 3. FJ Megrendelések
# ---------------------------------------------------------------------------------------------------------------------

$orders = New-DemoList $Lists.Orders
Set-PnPField -List $orders -Identity 'Title' -Values @{ Title = 'Megrendelés tárgya' } | Out-Null

$orderStatuses = @('Piszkozat', 'Beküldve', 'Jóváhagyásra vár', 'Jóváhagyva', 'Elutasítva', 'Teljesítve')
Add-DemoField $orders 'OrderNumber' 'Rendelésszám' 'Text' 'MaxLength="20"'
Add-DemoField $orders 'Customer' 'Vevő' 'Lookup' "List=`"{$($partners.Id)}`" ShowField=`"Title`" Required=`"TRUE`""
Add-DemoField $orders 'OrderedProducts' 'Termékek' 'LookupMulti' "List=`"{$($products.Id)}`" ShowField=`"Title`" Mult=`"TRUE`""
Add-DemoField $orders 'Quantity' 'Mennyiség (db)' 'Number' 'Decimals="0" Min="1"'
Add-DemoField $orders 'Amount' 'Nettó összeg' 'Currency' "$HUF Min=`"0`""
# A képlet a megjelenő nevet használja (az Amount oszlop ekkor már átnevezve: Nettó összeg).
Add-DemoField $orders 'GrossAmount' 'Bruttó összeg' 'Calculated' "ResultType=`"Currency`" $HUF ReadOnly=`"TRUE`"" '<Formula>=[Nettó összeg]*1.27</Formula><FieldRefs><FieldRef Name="Amount" /></FieldRefs>'
Add-DemoField $orders 'OrderDate' 'Rendelés időpontja' 'DateTime' 'Format="DateTime"'
Add-DemoField $orders 'DueDate' 'Szállítási határidő' 'DateTime' 'Format="DateOnly"'
Add-DemoField $orders 'Status' 'Állapot' 'Choice' 'Format="Dropdown"' (Get-ChoicesXml $orderStatuses 'Piszkozat')
Add-DemoField $orders 'Priority' 'Prioritás' 'Choice' 'Format="RadioButtons"' (Get-ChoicesXml @('Alacsony', 'Normál', 'Magas') 'Normál')
Add-DemoField $orders 'IsUrgent' 'Sürgős' 'Boolean' '' '<Default>0</Default>'
Add-DemoField $orders 'Requester' 'Igénylő' 'User' "$userAttr UserSelectionMode=`"PeopleOnly`""
Add-DemoField $orders 'Approvers' 'Jóváhagyók' 'UserMulti' "$userAttr UserSelectionMode=`"PeopleAndGroups`" Mult=`"TRUE`""
Add-DemoField $orders 'DeliveryAddress' 'Szállítási cím' 'Location' -Optional
Add-DemoField $orders 'Justification' 'Indoklás' 'Note' 'NumLines="4" RichText="FALSE"' -Description '500 000 Ft feletti összegnél töltendő ki.'
Add-DemoField $orders 'OrderComments' 'Megjegyzések' 'Note' 'NumLines="6" RichText="TRUE" RichTextMode="FullHtml"'
Add-DemoField $orders 'ContractLink' 'Szerződés' 'URL' 'Format="Hyperlink"'

Set-DemoView $orders @('LinkTitle', 'OrderNumber', 'Customer', 'OrderedProducts', 'Amount', 'GrossAmount', 'DueDate', 'Status', 'Priority', 'IsUrgent', 'Requester')

$orderSubjects = @(
  'Irodaház villamos felújítása', 'Raktárvilágítás korszerűsítése', 'Kórházi folyosó vészvilágítás', 'Lakópark kapcsolók és aljzatok',
  'Okosotthon bemutatóterem', 'Iskola tantermi panelek', 'Gyártócsarnok elosztószekrények', 'Szálloda redőnyvezérlés',
  'Tárgyalók töltőaljzatai', 'Parkolóház kültéri lámpák', 'Logisztikai központ kábelcsatornák', 'Rendelőintézet áram-védőkapcsolók',
  'Társasház lépcsőházi világítás', 'Bevásárlóközpont parapetcsatorna', 'Irodai termosztátcsere', 'Tetőtér-beépítés villamos anyagai',
  'Laboratórium energiaelosztás', 'Sportcsarnok LED panelek'
)

$orderIds = @()
for ($i = 0; $i -lt $orderSubjects.Count; $i++) {
  $productCount = ($i % 3) + 1
  $selected = @(@(for ($k = 0; $k -lt $productCount; $k++) { $productIds[($i * 2 + $k * 5) % $productIds.Count] }) | Select-Object -Unique)
  $quantity = (($i * 17) % 90) + 10
  $amount = [math]::Round(($quantity * (($i * 7919) % 18000 + 2000)) / 1000) * 1000
  $status = $orderStatuses[$i % $orderStatuses.Count]
  $approvers = @((Get-Person ($i + 1)))
  if ($people.Count -gt 1) { $approvers += Get-Person ($i + 2) }
  $item = Add-DemoItem $orders @{
    Title           = $orderSubjects[$i]
    OrderNumber     = 'R-{0}-{1:0000}' -f $today.Year, ($i + 1)
    Customer        = $customerIds[$i % $customerIds.Count]
    OrderedProducts = $selected
    Quantity        = $quantity
    Amount          = $amount
    OrderDate       = $today.AddDays(-2 * ($orderSubjects.Count - $i)).AddHours(8 + ($i % 9)).AddMinutes(15 * ($i % 4))
    DueDate         = $today.AddDays(7 + 3 * $i)
    Status          = $status
    Priority        = @('Alacsony', 'Normál', 'Normál', 'Magas')[$i % 4]
    IsUrgent        = ($i % 4 -eq 3)
    Justification   = if ($amount -gt 500000) { 'A projekt ütemezése miatt a teljes mennyiség egy tételben szükséges.' } else { $null }
    OrderComments   = if ($i % 3 -eq 0) { '<p>Szállítás <strong>munkanapokon 8–16 óra</strong> között.</p>' } else { $null }
    ContractLink    = if ($i % 2 -eq 0) { "https://example.com/szerzodes/R-$($i + 1), Keretszerződés" } else { $null }
  } @{
    Requester = Get-Person $i
    # Tömb: többszemélyes mező.
    Approvers = @($approvers | Select-Object -Unique)
  }
  $orderIds += $item.Id
}

# ---------------------------------------------------------------------------------------------------------------------
# 4. FJ Feladatok (a Megrendelésekhez kapcsolódó feladatok)
# ---------------------------------------------------------------------------------------------------------------------

$tasks = New-DemoList $Lists.Tasks
Set-PnPField -List $tasks -Identity 'Title' -Values @{ Title = 'Feladat' } | Out-Null

$taskStatuses = @('Nem kezdődött el', 'Folyamatban', 'Elvégezve', 'Delegálva')
Add-DemoField $tasks 'Order' 'Megrendelés' 'Lookup' "List=`"{$($orders.Id)}`" ShowField=`"Title`" Required=`"TRUE`""
Set-PnPField -List $tasks -Identity 'Order' -Values @{ Indexed = $true } | Out-Null
Add-DemoField $tasks 'TaskType' 'Feladat típusa' 'Choice' 'Format="Dropdown"' (Get-ChoicesXml @('Jóváhagyás', 'Adatbekérés', 'Ellenőrzés') 'Jóváhagyás')
Add-DemoField $tasks 'TaskAssignee' 'Felelős' 'User' "$userAttr UserSelectionMode=`"PeopleAndGroups`""
Add-DemoField $tasks 'TaskStatus' 'Állapot' 'Choice' 'Format="Dropdown"' (Get-ChoicesXml $taskStatuses 'Nem kezdődött el')
Add-DemoField $tasks 'TaskDueDate' 'Határidő' 'DateTime' 'Format="DateOnly"'
Add-DemoField $tasks 'TaskDescription' 'Leírás' 'Note' 'NumLines="4" RichText="FALSE"'
Add-DemoField $tasks 'Decision' 'Döntés' 'Choice' 'Format="RadioButtons"' (Get-ChoicesXml @('Jóváhagyva', 'Elutasítva'))
Add-DemoField $tasks 'TaskComment' 'Megjegyzés' 'Note' 'NumLines="4" RichText="FALSE"'
Add-DemoField $tasks 'CompletedOn' 'Elvégzés időpontja' 'DateTime' 'Format="DateTime"'
Add-DemoField $tasks 'DelegatedTo' 'Delegálva neki' 'User' "$userAttr UserSelectionMode=`"PeopleOnly`""
Add-DemoField $tasks 'DelegationReason' 'Delegálás indoklása' 'Note' 'NumLines="3" RichText="FALSE"'
Add-DemoField $tasks 'RequestJSON' 'Kérés (JSON)' 'Note' 'NumLines="6" RichText="FALSE"' -Description 'JSON alapú feladat: a kitöltendő mezők leírása.'
Add-DemoField $tasks 'ResponseJSON' 'Válasz (JSON)' 'Note' 'NumLines="6" RichText="FALSE"' -Description 'JSON alapú feladat: a kitöltött válasz.'

Set-DemoView $tasks @('LinkTitle', 'Order', 'TaskType', 'TaskAssignee', 'TaskStatus', 'TaskDueDate', 'Decision', 'DelegatedTo')

# JSON alapú feladat kérése (engine/TaskJson.ts formátum).
$deliveryRequest = [ordered]@{
  taskType = 'Szállítási adatok'
  fields   = @(
    [ordered]@{ name = 'deadlineOk'; label = 'A szállítási határidő tartható?'; type = 'yes/no'; required = $true }
    [ordered]@{ name = 'plannedDate'; label = 'Tervezett szállítási nap'; type = 'date'; required = $true }
    [ordered]@{ name = 'carrier'; label = 'Fuvarozó'; type = 'choice'; options = @('GLS', 'DPD', 'Saját szállítás') }
    [ordered]@{ name = 'pallets'; label = 'Raklapok száma'; type = 'number' }
    [ordered]@{ name = 'note'; label = 'Megjegyzés a raktárnak'; type = 'multiline' }
  )
}
$checkRequest = [ordered]@{
  taskType = 'Műszaki ellenőrzés'
  fields   = @(
    [ordered]@{ name = 'compatible'; label = 'A termékek kompatibilisek a meglévő rendszerrel?'; type = 'yes/no'; required = $true }
    [ordered]@{ name = 'risk'; label = 'Kockázat'; type = 'choice'; required = $true; options = @(
        [ordered]@{ value = 'low'; label = 'Alacsony' }, [ordered]@{ value = 'medium'; label = 'Közepes' }, [ordered]@{ value = 'high'; label = 'Magas' }) }
    [ordered]@{ name = 'remarks'; label = 'Észrevételek'; type = 'text' }
  )
}
$deliveryJson = $deliveryRequest | ConvertTo-Json -Depth 6 -Compress
$checkJson = $checkRequest | ConvertTo-Json -Depth 6 -Compress

# Megrendelésenként 1–2 feladat (az első 12 megrendelésre), összesen 18 feladat.
$taskCount = 0
for ($i = 0; $i -lt [math]::Min(12, $orderIds.Count); $i++) {
  $perOrder = if ($i % 2 -eq 0) { 2 } else { 1 }
  for ($k = 0; $k -lt $perOrder; $k++) {
    $n = $taskCount
    $type = @('Jóváhagyás', 'Adatbekérés', 'Ellenőrzés')[($i + $k) % 3]
    $status = $taskStatuses[$n % $taskStatuses.Count]
    # Minden negyedik feladat a webhely tagjainak csoportjáé (csoporttagság szerinti hozzárendelés).
    # A csoport azonosítója ugyanúgy kerül a Felelős mezőbe, mint a személyeké.
    $toGroup = $membersGroupId -and $n % 4 -eq 1
    $request = switch ($type) { 'Adatbekérés' { $deliveryJson } 'Ellenőrzés' { $checkJson } default { $null } }
    $done = $status -eq 'Elvégezve'
    $response = $null
    if ($done -and $type -eq 'Adatbekérés') {
      $answer = $deliveryJson | ConvertFrom-Json
      $answer.fields[0] | Add-Member -NotePropertyName value -NotePropertyValue 'yes'
      $answer.fields[1] | Add-Member -NotePropertyName value -NotePropertyValue $today.AddDays(10).ToString('yyyy-MM-dd')
      $answer.fields[2] | Add-Member -NotePropertyName value -NotePropertyValue 'GLS'
      $answer.fields[3] | Add-Member -NotePropertyName value -NotePropertyValue '4'
      $answer.fields[4] | Add-Member -NotePropertyName value -NotePropertyValue 'Rámpás kiszállítás.'
      $response = $answer | ConvertTo-Json -Depth 6 -Compress
    }
    Add-DemoItem $tasks @{
      Title            = "$type – $($orderSubjects[$i])"
      Order            = $orderIds[$i]
      TaskType         = $type
      TaskStatus       = $status
      TaskDueDate      = $today.AddDays(3 + $n)
      TaskDescription  = switch ($type) {
        'Jóváhagyás' { 'Hagyd jóvá vagy utasítsd el a megrendelést. Elutasításnál írj megjegyzést.' }
        'Adatbekérés' { 'Add meg a szállítás részleteit.' }
        default { 'Ellenőrizd a megrendelt termékek műszaki megfelelőségét.' }
      }
      Decision         = if ($done -and $type -eq 'Jóváhagyás') { @('Jóváhagyva', 'Elutasítva')[$n % 2] } else { $null }
      TaskComment      = if ($done -and $type -eq 'Jóváhagyás' -and $n % 2 -eq 1) { 'A keretösszeg túllépése miatt elutasítva.' } else { $null }
      CompletedOn      = if ($done) { $today.AddDays(-1).AddHours(14) } else { $null }
      DelegationReason = if ($status -eq 'Delegálva') { 'Szabadság miatt átadva.' } else { $null }
      RequestJSON      = $request
      ResponseJSON     = $response
    } @{
      TaskAssignee = if ($toGroup) { $membersGroupId } else { Get-Person $n }
      DelegatedTo  = if ($status -eq 'Delegálva') { Get-Person ($n + 1) } else { $null }
    } | Out-Null
    $taskCount++
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# Összegzés
# ---------------------------------------------------------------------------------------------------------------------

Write-Host ''
Write-Host 'Kész. Létrehozott listák:' -ForegroundColor Green
Write-Host ("  {0,-18} {1,3} elem   {2}" -f $Lists.Partners.Title, $partnerIds.Count, $partners.Id)
Write-Host ("  {0,-18} {1,3} elem   {2}" -f $Lists.Products.Title, $productIds.Count, $products.Id)
Write-Host ("  {0,-18} {1,3} elem   {2}" -f $Lists.Orders.Title, $orderIds.Count, $orders.Id)
Write-Host ("  {0,-18} {1,3} elem   {2}" -f $Lists.Tasks.Title, $taskCount, $tasks.Id)
Write-Host ''
Write-Host 'Következő lépés: kapcsold be a FormJetet a listákon a FormJet beállítása webparttal, majd a'
Write-Host "$($Lists.Orders.Title) űrlapjának tervezőjében vegyél fel egy Kapcsolódó elemek elemet a $($Lists.Tasks.Title) listára"
Write-Host '(párosító mező: Megrendelés, felelős: Felelős, állapot: Állapot, JSON: RequestJSON / ResponseJSON).'
