Write-Output 'Running PowerShell CSV analysis (filters, dedupe, won rules)'
$files = @(
  'C:\Users\Eduardo Augusto\Downloads\Comercial_- Relatório Vencemos - 2026-08-17T085924.357.csv',
  'C:\Users\Eduardo Augusto\Downloads\Relatorio_Consolidado - 2026-08-17T085941.738.csv',
  'C:\Users\Eduardo Augusto\Downloads\Comercial_- Status Prospects - Geral - 2026-08-17T085933.107.csv'
)

function Find-Col {
  param($cols,$candidates)
  foreach($cand in $candidates){
    foreach($c in $cols){
      if (($c -replace '\\s','').ToLower() -eq ($cand -replace '\\s','').ToLower()){
        return $c
      }
    }
  }
  return $null
}

function Parse-Number([string]$v){
  if([string]::IsNullOrWhiteSpace($v)){ return 0.0 }
  $s = $v -replace '[R$\\s]',''
  $s = $s -replace '\\.',''
  $s = $s -replace ',','.'
  $num = 0.0
  if([double]::TryParse($s,[System.Globalization.NumberStyles]::Any,[System.Globalization.CultureInfo]::InvariantCulture,[ref]$num)){
    return $num
  } else { return 0.0 }
}

foreach($path in $files){
  if(-not (Test-Path $path)){
    Write-Output "MISSING: $path"
    continue
  }
  Write-Output "`nFILE: $([System.IO.Path]::GetFileName($path))"
  $rows = Import-Csv -Delimiter ';' -Path $path -Encoding UTF8 | Where-Object { $_ -ne $null }
  $raw = $rows | Where-Object { ($_.psobject.properties.Value | ForEach-Object { $_ }) -ne $null }
  $rawCount = ($raw | Measure-Object).Count
  if($rawCount -eq 0){ Write-Output ' rawCount: 0'; continue }
  $cols = ($raw | Select-Object -First 1).psobject.properties.name
  $col_id = Find-Col $cols @('ID','Id','id')
  $col_status = Find-Col $cols @('Status','status')
  $col_plano = Find-Col $cols @('Plano de venda','Plano','Plano de Venda')
  $col_campanha = Find-Col $cols @('Campanha de venda','Campanha','Campanha de venda')
  $col_canal = Find-Col $cols @('Canal de venda','Canal','Canal de venda')
  $col_contrato = Find-Col $cols @('Contrato Gerado','Contrato','contrato')
  $col_valor = Find-Col $cols @('Valor do plano','Valor do plano','Valor')
  $col_tel = Find-Col $cols @('Telefone celular','Telefone','Telefone celular')

  function Is-NewProspect($r){
    $pl = '' ; $cp = '' ; $cn = ''
    if($col_plano){ $pl = ($r.$col_plano) }
    if($col_campanha){ $cp = ($r.$col_campanha) }
    if($col_canal){ $cn = ($r.$col_canal) }
    $pl = ($pl -as [string]).ToLower(); $cp = ($cp -as [string]).ToLower(); $cn = ($cn -as [string]).ToLower();
    foreach($t in @('adicional')){ if($pl.Contains($t) -or $cp.Contains($t) -or $cn.Contains($t)){ return $false } }
    return $true
  }

  $filtered = $raw | Where-Object { Is-NewProspect $_ }
  $filteredCount = ($filtered | Measure-Object).Count

  $seen = @{}
  $deduped = @()
  foreach($r in $filtered){
    $idv = '' ; $contr = '' ; $phone = ''
    if($col_id){ $idv = ($r.$col_id) -as [string] }
    if($col_contrato){ $contr = ($r.$col_contrato) -as [string] }
    if($col_tel){ $phone = ($r.$col_tel) -as [string] }
    $phone_digits = $phone -replace '\\D',''
    $key = $idv.Trim()
    if([string]::IsNullOrWhiteSpace($key)){ $key = $contr.Trim() }
    if([string]::IsNullOrWhiteSpace($key)){ $key = $phone_digits }
    if([string]::IsNullOrWhiteSpace($key)){
      $key = ($r.psobject.properties | ForEach-Object { $_.Name + '=' + ($_.Value) }) -join '|' }
    if(-not $seen.ContainsKey($key)){ $seen[$key]=1 ; $deduped += $r }
  }
  $dedupCount = $deduped.Count

  $strictWon=0; $ruleWon=0
  foreach($r in $filtered){
    $status = '' ; if($col_status){ $status = ($r.$col_status) -as [string] }
    $s = ($status).ToLower().Trim()
    if($s -eq 'vencemos'){ $strictWon++ }
    $hasWonStatus = ($s -eq 'vencemos')
    $contractVal = '' ; if($col_contrato){ $contractVal = ($r.$col_contrato) -as [string] }
    $contractClean = ($contractVal -as [string]).ToLower().Trim()
    $hasContract = ($contractClean -ne '' -and $contractClean -ne '-' -and $contractClean -ne 'nao' -and $contractClean -ne 'não' -and $contractClean -ne 'null' -and $contractClean -ne 'undefined')
    $price = 0.0 ; if($col_valor){ $price = Parse-Number ($r.$col_valor) }
    $hasPrice = ($price -gt 0)
    $hasFinancialProof = $hasContract -and $hasPrice
    if($hasWonStatus -or $hasFinancialProof){ $ruleWon++ }
  }

  $removed = $raw | Where-Object { -not (Is-NewProspect $_) }
  Write-Output " rawCount: $rawCount"
  Write-Output " filtered (isNewProspect): $filteredCount"
  Write-Output " deduped: $dedupCount"
  Write-Output " strictWon (status==vencemos): $strictWon"
  Write-Output " ruleWon (status OR contract+price>0): $ruleWon"
  Write-Output " removedAsAdditional: $($removed.Count)"
  if($removed.Count -gt 0){
    $samp = $removed | Select-Object -First 5 | ForEach-Object { @{ ID = if($col_id){ $_.$col_id } else { '' }; Plano = if($col_plano){ $_.$col_plano } else { '' }; Campanha = if($col_campanha){ $_.$col_campanha } else { '' }; Canal = if($col_canal){ $_.$col_canal } else { '' } } 
    $samp | ConvertTo-Json -Depth 2 | Write-Output
  }
}
