# Compara o ESQUEMA (schema "public") de todas as bases de dados definidas em
# scripts/db-targets.local.txt com a primeira da lista (a referência).
#
# Uso:
#   .\scripts\compare-db-schemas.ps1
#
# O que compara: tabelas, colunas (tipo/nullable/default), índices, políticas
# RLS (pg_policies), funções, triggers e extensões — tudo no schema public.
# NÃO compara dados, nem os schemas geridos pelo Supabase (auth, storage).
#
# Output: para cada base, "IGUAL À REFERÊNCIA" ou a lista de diferenças
# (o que FALTA nessa base e o que ela tem A MAIS). Os inventários completos
# ficam guardados em scripts/schema-dumps/ para inspeção manual.
#
# Requisitos: psql no PATH e scripts/db-targets.local.txt preenchido
# (o mesmo ficheiro usado pelo apply-migration.ps1).

$ErrorActionPreference = "Stop"

$targetsFile = Join-Path $PSScriptRoot "db-targets.local.txt"
if (-not (Test-Path $targetsFile)) {
  Write-Host "Falta $targetsFile. Copia o .example e preenche as connection strings." -ForegroundColor Red
  exit 1
}

$targets = Get-Content $targetsFile |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -ne "" -and -not $_.StartsWith("#") }

if ($targets.Count -lt 2) {
  Write-Host "São precisas pelo menos 2 bases em $targetsFile para comparar." -ForegroundColor Red
  exit 1
}

# Inventário canónico do schema public, uma linha por objeto, ordenado —
# para que a comparação linha-a-linha seja determinística.
$inventoryQuery = @'
select line from (
  select 'TABLE|' || tablename as line
  from pg_tables where schemaname = 'public'
  union all
  select 'COLUMN|' || table_name || '|' || column_name || '|' || data_type
         || '|' || is_nullable || '|' || coalesce(column_default, '-')
  from information_schema.columns where table_schema = 'public'
  union all
  select 'INDEX|' || indexname || '|' || regexp_replace(indexdef, '\s+', ' ', 'g')
  from pg_indexes where schemaname = 'public'
  union all
  select 'POLICY|' || tablename || '|' || policyname || '|' || cmd
         || '|' || coalesce(qual, '-') || '|' || coalesce(with_check, '-')
  from pg_policies where schemaname = 'public'
  union all
  select 'FUNCTION|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  union all
  select 'TRIGGER|' || event_object_table || '|' || trigger_name
  from information_schema.triggers where trigger_schema = 'public'
  union all
  select 'EXTENSION|' || extname from pg_extension
  union all
  select 'EVENT_TRIGGER|' || evtname || '|' || evtevent from pg_event_trigger
) t
order by line;
'@

# Pasta para guardar os inventários (útil para inspeção manual).
$dumpsDir = Join-Path $PSScriptRoot "schema-dumps"
if (-not (Test-Path $dumpsDir)) {
  New-Item -ItemType Directory -Path $dumpsDir | Out-Null
}

function Get-MaskedLabel([string]$url) {
  return [regex]::Replace($url, '(//[^:]+:)[^@]+@', '${1}***@')
}

# Extrai um identificador curto (ref do projeto Supabase) para nomear ficheiros.
function Get-ShortName([string]$url, [int]$index) {
  if ($url -match 'postgres\.([a-z0-9]+):') { return $Matches[1] }
  return "base$index"
}

Write-Host "A inventariar o schema de $($targets.Count) base(s) de dados..." -ForegroundColor Cyan

$inventories = @()
$failed = $false
for ($i = 0; $i -lt $targets.Count; $i++) {
  $url = $targets[$i]
  $masked = Get-MaskedLabel $url
  $short = Get-ShortName $url $i
  Write-Host "  [$($i + 1)/$($targets.Count)] $masked" -ForegroundColor Gray

  $lines = & psql $url -At -v ON_ERROR_STOP=1 -c $inventoryQuery
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  FALHOU a ligação/consulta a esta base." -ForegroundColor Red
    $failed = $true
    continue
  }

  $dumpFile = Join-Path $dumpsDir "$short.txt"
  $lines | Out-File -Encoding utf8 $dumpFile

  $inventories += [pscustomobject]@{
    Url    = $url
    Masked = $masked
    Short  = $short
    Lines  = @($lines)
  }
}

if ($failed -or $inventories.Count -lt 2) {
  Write-Host "`nComparação abortada: nem todas as bases responderam." -ForegroundColor Red
  exit 1
}

$reference = $inventories[0]
Write-Host "`nReferência: $($reference.Masked)" -ForegroundColor Cyan
Write-Host "($($reference.Lines.Count) objetos no schema public; inventários em scripts\schema-dumps\)" -ForegroundColor Gray

$anyDiff = $false
for ($i = 1; $i -lt $inventories.Count; $i++) {
  $current = $inventories[$i]
  Write-Host "`n=== $($current.Masked) ===" -ForegroundColor Cyan

  $diff = Compare-Object -ReferenceObject $reference.Lines -DifferenceObject $current.Lines

  if (-not $diff) {
    Write-Host "IGUAL À REFERÊNCIA ✅" -ForegroundColor Green
    continue
  }

  $anyDiff = $true
  $missing = @($diff | Where-Object { $_.SideIndicator -eq "<=" } | ForEach-Object { $_.InputObject })
  $extra   = @($diff | Where-Object { $_.SideIndicator -eq "=>" } | ForEach-Object { $_.InputObject })

  if ($missing.Count -gt 0) {
    Write-Host "FALTA nesta base (existe na referência): $($missing.Count) objeto(s)" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  }
  if ($extra.Count -gt 0) {
    Write-Host "A MAIS nesta base (não existe na referência): $($extra.Count) objeto(s)" -ForegroundColor Yellow
    $extra | ForEach-Object { Write-Host "  + $_" -ForegroundColor Yellow }
  }
}

Write-Host "`n================ RESUMO ================"
if (-not $anyDiff) {
  Write-Host "Todas as $($inventories.Count) bases têm o schema public IGUAL. Sem drift. ✅" -ForegroundColor Green
}
else {
  Write-Host "Há diferenças de schema entre as bases (detalhe acima)." -ForegroundColor Yellow
  Write-Host "Copia o output e pede ao Claude o SQL idempotente para as igualar." -ForegroundColor Yellow
  exit 1
}
