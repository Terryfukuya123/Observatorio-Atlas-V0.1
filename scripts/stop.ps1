$entry = Join-Path (Split-Path $PSScriptRoot) 'observatorio.py'
$listeners = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8842 -State Listen -ErrorAction SilentlyContinue)
if (-not $listeners) { Write-Output 'Observatório já encerrado.'; return }
$owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0].OwningProcess)"
if ($owner.Name -ne 'python.exe' -or $owner.CommandLine -notmatch ([regex]::Escape($entry) + '"?(?:\s+--perfil\s+(?:local|profissional))?\s*$')) { throw 'O processo não corresponde a este Observatório.' }
Stop-Process -Id $owner.ProcessId -ErrorAction Stop
Write-Output 'Observatório encerrado.'
