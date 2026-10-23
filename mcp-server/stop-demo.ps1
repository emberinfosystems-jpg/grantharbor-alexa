# Stop the GrantHarbor demo services started by run-demo.ps1.
$f = Join-Path $PSScriptRoot "demo-pids.txt"
if (Test-Path $f) {
  (Get-Content $f -Raw).Trim() -split '\s+' | ForEach-Object {
    if ($_) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $f -ErrorAction SilentlyContinue
  Write-Host "demo services stopped." -ForegroundColor Green
} else {
  # fallback: free the known ports
  foreach ($port in 8090, 3700) {
    try { (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop).OwningProcess |
          Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } catch {}
  }
  Write-Host "no pid file; freed ports 8090/3700." -ForegroundColor Yellow
}
