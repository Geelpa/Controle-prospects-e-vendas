Write-Output 'Running simplified PowerShell CSV analysis'
$files = @(
  'C:\Users\Eduardo Augusto\Downloads\Comercial_- Relatório Vencemos - 2026-08-17T085924.357.csv',
  'C:\Users\Eduardo Augusto\Downloads\Relatorio_Consolidado - 2026-08-17T085941.738.csv',
  'C:\Users\Eduardo Augusto\Downloads\Comercial_- Status Prospects - Geral - 2026-08-17T085933.107.csv'
)

function norm([string]$s){ if($s -eq $null){ return '' } ; return ($s -replace '\\s','').ToLower() }
function findCol($cols, $cand){ foreach($c in $cols){ if(norm($c) -eq norm($cand)){ return $c } } return $null }
function parseNum([string]$v){ if([string]::IsNullOrWhiteSpace($v)){ return 0.0 } ; $s = $v -replace '[R$\\s]','' ; $s = $s -replace '\\.','' ; $s = $s -replace ',','.' ; $n=0.0 ; [double]::TryParse($s,[System.Globalization.NumberStyles]::Any,[System.Globalization.CultureInfo]::InvariantCulture,[ref]$n) | Out-Null ; return $n }

foreach($path in $files){ if(-not (Test-Path $path)){ Write-Output "MISSING: $path"; continue } ; Write-Output "`nFILE: $([System.IO.Path]::GetFileName($path))" ;
  $rows = Import-Csv -Delimiter ';' -Path $path -Encoding UTF8
  $raw = @()
  foreach($r in $rows){ $hasAny = $false ; foreach($p in $r.psobject.properties){ if(-not [string]::IsNullOrWhiteSpace([string]$p.Value)){ $hasAny=$true; break } } ; if($hasAny){ $raw += $r } }
  $rawCount = $raw.Count
  if($rawCount -eq 0){ Write-Output ' rawCount: 0'; continue }
  $cols = $raw[0].psobject.properties.name
  $col_id = findCol $cols 'ID'
  $col_status = findCol $cols 'Status'
  $col_plano = findCol $cols 'Plano de venda'
  $col_campanha = findCol $cols 'Campanha'
  $col_canal = findCol $cols 'Canal de venda'
  $col_contrato = findCol $cols 'Contrato'
  $col_valor = findCol $cols 'Valor do plano'
  $col_tel = findCol $cols 'Telefone'

  $filtered = @()
  foreach($r in $raw){ $pl = '' ; $cp = '' ; $cn = '' ; if($col_plano){ $pl = ($r.$col_plano) } ; if($col_campanha){ $cp = ($r.$col_campanha) } ; if($col_canal){ $cn = ($r.$col_canal) } ; $pl = ($pl -as [string]).ToLower(); $cp = ($cp -as [string]).ToLower(); $cn = ($cn -as [string]).ToLower(); if($pl.Contains('adicional') -or $cp.Contains('adicional') -or $cn.Contains('adicional')){ } else { $filtered += $r } }
  $filteredCount = $filtered.Count

  $seen = @{}
  $deduped = @()
  foreach($r in $filtered){ $idv = '' ; if($col_id){ $idv = ($r.$col_id) -as [string] } ; $contr = '' ; if($col_contrato){ $contr = ($r.$col_contrato) -as [string] } ; $phone = '' ; if($col_tel){ $phone = ($r.$col_tel) -as [string] } ; $phone_digits = $phone -replace '\\D','' ; $key = $idv.Trim(); if([string]::IsNullOrWhiteSpace($key)){ $key = $contr.Trim() } ; if([string]::IsNullOrWhiteSpace($key)){ $key = $phone_digits } ; if([string]::IsNullOrWhiteSpace($key)){ $key = ($r.psobject.properties | ForEach-Object { $_.Name + '=' + ($_.Value) }) -join '|' } ; if(-not $seen.ContainsKey($key)){ $seen[$key]=1 ; $deduped += $r } }
  $dedupCount = $deduped.Count

  $strictWon = 0; $ruleWon = 0
  foreach($r in $filtered){ $status = '' ; if($col_status){ $status = ($r.$col_status) -as [string] } ; $s = ($status).ToLower().Trim(); if($s -eq 'vencemos'){ $strictWon++ } ; $hasWonStatus = ($s -eq 'vencemos') ; $contractVal = '' ; if($col_contrato){ $contractVal = ($r.$col_contrato) -as [string] } ; $contractClean = ($contractVal -as [string]).ToLower().Trim() ; $hasContract = ($contractClean -ne '' -and $contractClean -ne '-' -and $contractClean -ne 'nao' -and $contractClean -ne 'não' -and $contractClean -ne 'null' -and $contractClean -ne 'undefined') ; $price = 0.0 ; if($col_valor){ $price = parseNum ($r.$col_valor) } ; $hasPrice = ($price -gt 0) ; $hasFinancialProof = $hasContract -and $hasPrice ; if($hasWonStatus -or $hasFinancialProof){ $ruleWon++ } }

  $removed = @()
  foreach($r in $raw){ $pl = ''; $cp = ''; $cn = '' ; if($col_plano){ $pl = ($r.$col_plano) } ; if($col_campanha){ $cp = ($r.$col_campanha) } ; if($col_canal){ $cn = ($r.$col_canal) } ; $pl = ($pl -as [string]).ToLower(); $cp = ($cp -as [string]).ToLower(); $cn = ($cn -as [string]).ToLower(); if($pl.Contains('adicional') -or $cp.Contains('adicional') -or $cn.Contains('adicional')){ $removed += $r } }

  Write-Output " rawCount: $rawCount"
  Write-Output " filtered (isNewProspect): $filteredCount"
  Write-Output " deduped: $dedupCount"
  Write-Output " strictWon (status==vencemos): $strictWon"
  Write-Output " ruleWon (status OR contract+price>0): $ruleWon"
  Write-Output " removedAsAdditional: $($removed.Count)"
  if($removed.Count -gt 0){ $samp = $removed | Select-Object -First 5 | ForEach-Object { @{ ID = if($col_id){ $_.$col_id } else { '' }; Plano = if($col_plano){ $_.$col_plano } else { '' }; Campanha = if($col_campanha){ $_.$col_campanha } else { '' }; Canal = if($col_canal){ $_.$col_canal } else { '' } } ; $samp | ConvertTo-Json -Depth 2 | Write-Output }
}
