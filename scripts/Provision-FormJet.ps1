<#
.SYNOPSIS
  FormJet telepítése egy site-ra: konfigurációs lista létrehozása és a Form Customizer bekötése
  a cél lista tartalomtípusaira.

.DESCRIPTION
  Éles SharePoint site-ot módosít. Előfeltétel: PnP.PowerShell 2.x, saját Entra ID alkalmazásregisztráció
  (ClientId), és a formjet.sppkg telepítve az app catalogban.

.EXAMPLE
  ./Provision-FormJet.ps1 -SiteUrl https://contoso.sharepoint.com/sites/formjet-dev -TargetList Teszt `
    -ComponentId 89262798-3b9c-4299-9d5b-754a7e8ac6d8 -ClientId <app id>

.EXAMPLE
  # Visszaállítás a gyári formokra. A FormConfigurations lista megmarad.
  ./Provision-FormJet.ps1 -SiteUrl <site> -TargetList Teszt -ClientId <app id> -Unbind
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)] [string] $SiteUrl,
  [Parameter(Mandatory = $true)] [string] $TargetList,
  [Parameter(Mandatory = $true)] [string] $ClientId,
  # A manifest "id" értéke (src/extensions/formJet/FormJetFormCustomizer.manifest.json).
  [string] $ComponentId,
  # Csak ezt a tartalomtípust köti be (név szerint). Hiányában a lista minden nem mappa tartalomtípusát.
  [string] $ContentType,
  [switch] $Unbind
)

$ErrorActionPreference = 'Stop'
$ConfigListTitle = 'FormConfigurations'

if (-not $Unbind -and -not $ComponentId) {
  throw 'Bekötéshez add meg a -ComponentId paramétert (a manifest id-ja).'
}

Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive

# 1. Konfigurációs lista
if (-not $Unbind) {
  $configList = Get-PnPList -Identity $ConfigListTitle -ErrorAction SilentlyContinue
  if (-not $configList) {
    if ($PSCmdlet.ShouldProcess($ConfigListTitle, 'Lista létrehozása')) {
      Write-Host "A(z) $ConfigListTitle lista létrehozása..."
      New-PnPList -Title $ConfigListTitle -Template GenericList -Url "Lists/$ConfigListTitle" -OnQuickLaunch:$false | Out-Null
      Add-PnPField -List $ConfigListTitle -InternalName 'FormJetListId' -DisplayName 'FormJetListId' -Type Text -AddToDefaultView | Out-Null
      Add-PnPField -List $ConfigListTitle -InternalName 'FormJetContentTypeId' -DisplayName 'FormJetContentTypeId' -Type Text -AddToDefaultView | Out-Null
      Add-PnPFieldFromXml -List $ConfigListTitle -FieldXml @'
<Field Type="Note" Name="FormJetConfig" StaticName="FormJetConfig" DisplayName="FormJetConfig"
       ID="{6f3d1a52-8c0b-4e57-9a41-2d5b7c9e1f30}" NumLines="20" RichText="FALSE" UnlimitedLengthInDocumentLibrary="TRUE" />
'@ | Out-Null
      Set-PnPField -List $ConfigListTitle -Identity 'FormJetListId' -Values @{ Indexed = $true }
      Write-Warning ("A(z) $ConfigListTitle lista örökli a site jogosultságait. A konfigurációt az módosíthatja, " +
        'akinek ezen a listán írási joga van: állítsd be úgy, hogy a felhasználók csak olvashassák.')
    }
  }
  else {
    Write-Host "A(z) $ConfigListTitle lista már létezik."
  }
}

# 2. Bekötés a tartalomtípusokra (vagy leválasztás)
$contentTypes = Get-PnPContentType -List $TargetList | Where-Object { -not $_.StringId.StartsWith('0x0120') }
if ($ContentType) {
  $contentTypes = $contentTypes | Where-Object { $_.Name -eq $ContentType }
}
if (-not $contentTypes) {
  throw "Nem található bekötendő tartalomtípus a(z) $TargetList listán."
}

$value = if ($Unbind) { '' } else { $ComponentId }
$action = if ($Unbind) { 'Leválasztás' } else { 'Bekötés' }

foreach ($ct in $contentTypes) {
  if ($PSCmdlet.ShouldProcess("$TargetList / $($ct.Name)", $action)) {
    Write-Host "${action}: $($ct.Name) ($($ct.StringId))"
    $ct.NewFormClientSideComponentId = $value
    $ct.EditFormClientSideComponentId = $value
    $ct.DisplayFormClientSideComponentId = $value
    $ct.Update($false)
    Invoke-PnPQuery
  }
}

Write-Host 'Kész.'
