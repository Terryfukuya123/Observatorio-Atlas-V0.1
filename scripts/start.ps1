param([ValidateSet('local','profissional')][string]$Perfil = 'local')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot
$entry = Join-Path $project 'observatorio.py'
$runDir = Join-Path $project 'data/run'
$pythonPath = (Get-Command python -CommandType Application | Select-Object -First 1).Source
[IO.Directory]::CreateDirectory($runDir) | Out-Null
$existing = Get-NetTCPConnection -LocalPort 8842 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($existing[0].OwningProcess)"
    if ($owner.CommandLine -like "*$entry*") {
        $activeProfile = if ($owner.CommandLine -match '--perfil\s+profissional') { 'profissional' } else { 'local' }
        if ($activeProfile -ne $Perfil) { throw "O perfil $activeProfile está ativo. Encerre com scripts/stop.ps1 antes de trocar." }
        Write-Output "Observatório já ativo em http://127.0.0.1:8842 (perfil $Perfil)"
        return
    }
    throw 'Porta 8842 ocupada por outro processo.'
}
$p = Start-Process -FilePath $pythonPath -ArgumentList @('-B', ('"' + $entry + '"'), '--perfil', $Perfil) -WorkingDirectory $project -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDir 'server.out') -RedirectStandardError (Join-Path $runDir 'server.err')
for ($i=0; $i -lt 40; $i++) {
    if ($p.HasExited) { throw 'Falha ao iniciar. Consulte data/run/server.err.' }
    try {
        $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8842/' -TimeoutSec 1
        if ($page.StatusCode -eq 200) { Write-Output 'Observatório ativo em http://127.0.0.1:8842'; return }
    } catch {}
    Start-Sleep -Milliseconds 150
}
throw 'Servidor não respondeu no prazo.'
