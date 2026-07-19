# Mostra que campos a API do Idealista (via RapidAPI) devolve para cada anúncio.
#
# Serve para descobrir se a resposta traz alguma data de publicação — o
# interface tipado em src/services/idealistaService.ts não tem nenhuma, mas a
# resposta bruta pode trazer campos que nunca chegámos a usar.
#
# Uso:
#   .\scripts\inspect-idealista-fields.ps1
#   .\scripts\inspect-idealista-fields.ps1 -Zona "Matosinhos"
#
# Requisitos: psql no PATH e scripts/db-targets.local.txt preenchido
# (usa a PRIMEIRA base da lista, só para ler as credenciais).

param(
  [string]$Zona = "Lisboa"
)

$ErrorActionPreference = "Stop"

# --- 1. Credenciais, a partir da base de dados -------------------------------

$targetsFile = Join-Path $PSScriptRoot "db-targets.local.txt"
if (-not (Test-Path $targetsFile)) {
  Write-Host "Falta $targetsFile." -ForegroundColor Red
  exit 1
}

$conn = Get-Content $targetsFile |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -ne "" -and -not $_.StartsWith("#") } |
  Select-Object -First 1

Write-Host "A ler credenciais do Idealista..." -ForegroundColor Cyan

# value é jsonb — #>> '{}' extrai o texto.
$query = @"
select key || '=' || (value #>> '{}')
from system_settings
where key in ('idealista_rapidapi_key','idealista_rapidapi_host','idealista_rapidapi_list_endpoint');
"@

$rows = psql $conn -A -t -c $query

$apiKey = $null; $apiHost = "idealista2.p.rapidapi.com"; $listEndpoint = "/properties/list"
foreach ($row in $rows) {
  if ($row -match '^idealista_rapidapi_key=(.+)$')           { $apiKey = $Matches[1] }
  if ($row -match '^idealista_rapidapi_host=(.+)$')          { $apiHost = $Matches[1] }
  if ($row -match '^idealista_rapidapi_list_endpoint=(.+)$') { $listEndpoint = $Matches[1] }
}

if (-not $apiKey) {
  Write-Host "Chave do Idealista nao configurada em system_settings." -ForegroundColor Red
  exit 1
}

Write-Host "Host: $apiHost | Endpoint: $listEndpoint" -ForegroundColor DarkGray

$headers = @{
  "X-RapidAPI-Key"  = $apiKey
  "X-RapidAPI-Host" = $apiHost
}

# --- 2. Resolver a zona para um locationId -----------------------------------

Write-Host "A resolver a zona '$Zona'..." -ForegroundColor Cyan

$encoded = [System.Uri]::EscapeDataString($Zona)
$autoUrl = "https://$apiHost/auto-complete?prefix=$encoded&country=pt"

try {
  $auto = Invoke-RestMethod -Uri $autoUrl -Headers $headers -Method Get
} catch {
  Write-Host "Falha no auto-complete: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$locationId = $null
foreach ($prop in @("locations","data","results")) {
  if ($auto.$prop -and $auto.$prop.Count -gt 0) {
    $first = $auto.$prop[0]
    foreach ($idProp in @("locationId","id","value")) {
      if ($first.$idProp) { $locationId = $first.$idProp; break }
    }
  }
  if ($locationId) { break }
}

if (-not $locationId) {
  Write-Host "Nao consegui obter locationId. Resposta bruta:" -ForegroundColor Yellow
  $auto | ConvertTo-Json -Depth 4
  exit 1
}

Write-Host "locationId: $locationId" -ForegroundColor DarkGray

# --- 3. Pesquisa e inspeção dos campos ---------------------------------------

$listUrl = "https://$apiHost$listEndpoint" +
  "?country=pt&locale=pt&operation=sale&propertyType=homes&locationId=$locationId&maxItems=1&numPage=1"

Write-Host "A pesquisar..." -ForegroundColor Cyan

try {
  $result = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
} catch {
  Write-Host "Falha na pesquisa: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$listing = $null
foreach ($prop in @("elementList","data","results","items")) {
  if ($result.$prop -and $result.$prop.Count -gt 0) { $listing = $result.$prop[0]; break }
}

if (-not $listing) {
  Write-Host "Sem resultados. Resposta bruta:" -ForegroundColor Yellow
  $result | ConvertTo-Json -Depth 3
  exit 1
}

$fields = $listing.PSObject.Properties.Name | Sort-Object

Write-Host ""
Write-Host "=== CAMPOS DEVOLVIDOS ($($fields.Count)) ===" -ForegroundColor Green
$fields -join ", "

Write-Host ""
Write-Host "=== POSSIVEIS DATAS ===" -ForegroundColor Green
$dateFields = $fields | Where-Object {
  $_ -match "(?i)date|time|created|updated|modif|publish|antiquity|age|days"
}
if ($dateFields) {
  foreach ($f in $dateFields) {
    Write-Host ("  {0} = {1}" -f $f, $listing.$f) -ForegroundColor Yellow
  }
} else {
  Write-Host "  Nenhum campo com aspeto de data." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== ANUNCIANTE (para afinar a detecao de particular) ===" -ForegroundColor Green
foreach ($f in @("professionalName","clientName","clientAlias","logoUrl","contactInfo","userType")) {
  if ($fields -contains $f) {
    Write-Host ("  {0} = {1}" -f $f, ($listing.$f | ConvertTo-Json -Compress -Depth 3)) -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== ANUNCIO COMPLETO ===" -ForegroundColor Green
$listing | ConvertTo-Json -Depth 5
