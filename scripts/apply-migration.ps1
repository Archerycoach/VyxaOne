# Aplica um ficheiro SQL (migração) a TODAS as bases de dados definidas em
# scripts/db-targets.local.txt (uma connection string por linha).
#
# Uso:
#   .\scripts\apply-migration.ps1 supabase\migrations\XXXXXXXX_nome.sql
#
# Requisitos: psql no PATH (scoop install postgresql) e o ficheiro
# scripts/db-targets.local.txt preenchido (ver .example).
#
# Comportamento: usa ON_ERROR_STOP, por isso se a migração falhar numa base de
# dados o processo dessa BD para e é reportado no resumo (as outras continuam).

param(
  [Parameter(Mandatory = $true)]
  [string]$File
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $File)) {
  Write-Host "Ficheiro não encontrado: $File" -ForegroundColor Red
  exit 1
}

$targetsFile = Join-Path $PSScriptRoot "db-targets.local.txt"
if (-not (Test-Path $targetsFile)) {
  Write-Host "Falta $targetsFile. Copia o .example e preenche as connection strings." -ForegroundColor Red
  exit 1
}

$targets = Get-Content $targetsFile |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -ne "" -and -not $_.StartsWith("#") }

if ($targets.Count -eq 0) {
  Write-Host "Nenhuma base de dados em $targetsFile." -ForegroundColor Red
  exit 1
}

Write-Host "A aplicar '$File' a $($targets.Count) base(s) de dados..." -ForegroundColor Cyan

$failed = @()
foreach ($url in $targets) {
  # Mascara a password no output (nunca a mostrar em texto simples).
  $masked = [regex]::Replace($url, '(//[^:]+:)[^@]+@', '${1}***@')
  Write-Host "`n=== $masked ===" -ForegroundColor Cyan

  & psql $url -v ON_ERROR_STOP=1 -f $File
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FALHOU." -ForegroundColor Red
    $failed += $masked
  }
  else {
    Write-Host "OK." -ForegroundColor Green
  }
}

Write-Host "`n================ RESUMO ================"
if ($failed.Count -eq 0) {
  Write-Host "Aplicado com sucesso em todas as $($targets.Count) base(s) de dados." -ForegroundColor Green
}
else {
  Write-Host "Falhou em $($failed.Count) de $($targets.Count):" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
