<#!
.SYNOPSIS
  Run local E2E against the deployed frontend LoadBalancer, simulating the workflow steps.

.PARAMETER Namespace
  Kubernetes namespace where the frontend Service lives (default: staging)

.PARAMETER AlbHostname
  Optional ALB/NLB hostname to use directly (overrides Kubernetes discovery)

.PARAMETER FrontendService
  Frontend Service name (default: ecommerce-frontend)

.PARAMETER SkipPuppeteer
  If set, runs only the quick smoke test (no browser UI steps)

.EXAMPLE
  .\scripts\e2e-local.ps1 -Namespace staging

.EXAMPLE
  .\scripts\e2e-local.ps1 -AlbHostname my-alb-123.elb.us-east-1.amazonaws.com
#>
param(
  [string]$Namespace = 'staging',
  [string]$AlbHostname,
  [string]$FrontendService = 'ecommerce-frontend',
  [switch]$SkipPuppeteer
)

$ErrorActionPreference = 'Stop'

function Resolve-FrontendUrl {
  param([string]$Ns, [string]$Svc, [string]$HostOverride)
  if ($HostOverride) { return "http://$HostOverride" }
  Write-Host "Discovering frontend LoadBalancer in namespace '$Ns' service '$Svc'..."
  $jsonPath = '{.status.loadBalancer.ingress[0].hostname}{.status.loadBalancer.ingress[0].ip}'
  $addr = (& kubectl get svc $Svc -n $Ns -o jsonpath=$jsonPath 2>$null).Trim()
  if (-not $addr) { throw "Could not resolve LoadBalancer address for service $Svc in ns $Ns" }
  # Prefer hostname if present, otherwise IP
  if ($addr -match '^[a-zA-Z]') { return "http://$addr" } else { return "http://$addr" }
}

function Install-NodeModules {
  param([string]$Path)
  if (-not (Test-Path (Join-Path $Path 'node_modules'))) {
    Push-Location $Path
    try {
      Write-Host "Installing dependencies in $Path..."
      npm ci | Write-Host
    } finally { Pop-Location }
  }
}

function Find-EdgeOrChrome {
  $candidates = @(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  )
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  return $null
}

try {
  $root = Split-Path -Parent $PSCommandPath
  $repoRoot = Resolve-Path (Join-Path $root '..')
  Set-Location $repoRoot

  $FRONTEND_URL = Resolve-FrontendUrl -Ns $Namespace -Svc $FrontendService -HostOverride $AlbHostname
  Write-Host "FRONTEND_URL = $FRONTEND_URL"

  # 1) Quick smoke via proxy
  Write-Host "Running quick smoke test via proxy..."
  $env:FRONTEND_URL = $FRONTEND_URL
  node .\backend\tests\smoke-proxy.js

  if ($SkipPuppeteer) { Write-Host "SkipPuppeteer set, stopping after smoke test."; exit 0 }

  # 2) Full E2E UI
  $e2eDir = Join-Path $repoRoot 'backend\tests\e2e-ui'
  Install-NodeModules -Path $e2eDir

  # Prefer system Edge/Chrome to avoid Puppeteer downloading Chromium
  $exe = Find-EdgeOrChrome
  if ($exe) {
    $env:PUPPETEER_EXECUTABLE_PATH = $exe
    Write-Host "Using local browser: $exe"
  } else {
    Write-Host "No local Edge/Chrome found; Puppeteer may download Chromium (can take a while)."
  }

  Write-Host "Running Puppeteer E2E..."
  Push-Location $e2eDir
  try {
    $env:FRONTEND_URL = $FRONTEND_URL
    node .\run-e2e.js
  } finally { Pop-Location }

  Write-Host "E2E completed. Artifacts (screens, logs) under backend/tests/e2e-ui/artifacts"

} catch {
  Write-Error $_
  exit 1
}
