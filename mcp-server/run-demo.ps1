# GrantHarbor × Alexa+ — one-command demo runner.
# Brings up PocketBase, seeds Nexus Humanity Foundation + the real USDA grant, starts the MCP server,
# runs the full apply loop, and LEAVES the services up so you can show the app UI on camera.
# Stop afterwards with:  .\stop-demo.ps1
$ErrorActionPreference = "Stop"
$mcpDir = $PSScriptRoot
$root   = Split-Path $mcpDir -Parent
$pbExe  = Join-Path $root "pocketbase\pocketbase.exe"
$pbDir  = Join-Path $root "pocketbase"

# Wait for a port to actually accept connections instead of guessing a fixed sleep (cold starts vary).
function Wait-Port([int]$Port, [int]$TimeoutSec = 25) {
  for ($i = 0; $i -lt $TimeoutSec; $i++) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

Write-Host "`n[1/4] PocketBase..." -ForegroundColor Cyan
& $pbExe superuser upsert dev@grantguard.local devpass123456 | Out-Null
$pb = Start-Process -FilePath $pbExe -ArgumentList "serve","--http=127.0.0.1:8090" -WorkingDirectory $pbDir -PassThru -WindowStyle Hidden
if (-not (Wait-Port 8090)) { Write-Host "PocketBase failed to bind :8090" -ForegroundColor Red; exit 1 }

Write-Host "[2/4] Seeding Nexus Humanity Foundation + USDA Community Food Projects grant..." -ForegroundColor Cyan
Push-Location $mcpDir
node seed-demo.mjs
$demo = Get-Content demo.json -Raw | ConvertFrom-Json

Write-Host "[3/4] MCP server (Streamable HTTP :3700)..." -ForegroundColor Cyan
$env:GRANTHARBOR_PB_TOKEN = $demo.token      # child process inherits these
$env:GRANTHARBOR_USER_ID  = $demo.userId
$env:GRANTHARBOR_MCP_PORT = "3700"
$mcp = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory $mcpDir -PassThru -WindowStyle Hidden
if (-not (Wait-Port 3700)) { Write-Host "MCP server failed to bind :3700" -ForegroundColor Red; exit 1 }

Write-Host "[4/4] THE APPLY LOOP:`n" -ForegroundColor Green
node call-draft.mjs
Pop-Location

"$($pb.Id) $($mcp.Id)" | Set-Content (Join-Path $mcpDir "demo-pids.txt")
Write-Host "`n--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Services are UP for the UI portion of the demo:" -ForegroundColor Green
Write-Host "  App UI     : in the project root run  npm run dev:web -- --mode mobile   (http://127.0.0.1:5290)"
Write-Host "  PocketBase : http://127.0.0.1:8090/_/   (dev@grantguard.local / devpass123456)"
Write-Host "  MCP server : http://127.0.0.1:3700/mcp"
Write-Host "Stop everything when done:  .\stop-demo.ps1" -ForegroundColor Yellow
