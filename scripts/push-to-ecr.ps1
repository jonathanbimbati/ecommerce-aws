<#
Push images to ECR helper script
Usage examples:
.
# Simple (defaults to us-east-1):
.
.
# With region and profile:
.
# .\scripts\push-to-ecr.ps1 -Region us-east-1 -Profile aluno08

Parameters:
- Region (default: us-east-1)
- Profile (optional. If provided, uses AWS CLI --profile)
- Tag (optional, default: latest)

What the script does:
1. Detect AWS Account ID via sts:get-caller-identity
2. Create ECR repositories `ecommerce-ecr-backend` and `ecommerce-ecr-frontend` if they don't exist
3. Build local Docker images for backend and frontend
4. Tag images with ECR repo URI and push

Notes:
- Requires Docker and AWS CLI configured locally.
- For frontend the Dockerfile at ./frontend builds the Angular app and produces an nginx image; script builds that image.
#>

param(
  [string]$Region = 'us-east-1',
  [string]$Profile = '',
  [string]$Tag = 'latest'
)

function Run-Aws {
  param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
  )
  if ($Profile -ne '') { $Args += @('--profile', $Profile) }
  if ($Region -ne '') { $Args += @('--region', $Region) }
  return & aws @Args
}

Write-Host "Using Region: $Region" -ForegroundColor Cyan
if ($Profile -ne '') { Write-Host "Using AWS Profile: $Profile" -ForegroundColor Cyan }

# 1) Get account id
try {
  $accountId = (Run-Aws sts get-caller-identity --query Account --output text).Trim()
} catch {
  Write-Error "Failed to get caller identity. Ensure AWS CLI is configured and credentials are valid. $_"
  exit 1
}
Write-Host "Account: $accountId"

$backendRepo = "$accountId.dkr.ecr.$Region.amazonaws.com/ecommerce-ecr-backend"
$frontendRepo = "$accountId.dkr.ecr.$Region.amazonaws.com/ecommerce-ecr-frontend"

# 2) Create repos if missing
function Ensure-EcrRepo($name) {
  try {
    $out = Run-Aws ecr describe-repositories --repository-names $name 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "ECR repository '$name' exists." -ForegroundColor Green
    } else {
      Write-Host "ECR repository '$name' not found (will create)." -ForegroundColor Yellow
      Write-Host $out
      Run-Aws ecr create-repository --repository-name $name | Out-Null
      if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create repository $name"; exit 1 }
      Write-Host "Created repository $name" -ForegroundColor Green
    }
  } catch {
    Write-Error "Error checking/creating ECR repository $($name): $_"
    exit 1
  }
}
Ensure-EcrRepo 'ecommerce-ecr-backend'
Ensure-EcrRepo 'ecommerce-ecr-frontend'

# 3) Login to ECR
  try {
    Write-Host "Logging into ECR..." -ForegroundColor Cyan
  # Use Run-Aws to get the login password (handles profile/region)
  $pw = Run-Aws ecr get-login-password
    $loginTarget = "$accountId.dkr.ecr.$Region.amazonaws.com"
    # Pipe the password into docker login (PowerShell compatible)
    $pw | docker login --username AWS --password-stdin $loginTarget
    Write-Host "Docker login successful" -ForegroundColor Green
  } catch {
    Write-Error "ECR login failed: $_"
    exit 1
  }

# 4) Build and push backend
  try {
    Write-Host "Building backend image..." -ForegroundColor Cyan
    docker build -t ecommerce-ecr-backend:local ./backend
  $backendImage = "$($backendRepo):$Tag"
  docker tag ecommerce-ecr-backend:local "$backendImage"
  Write-Host "Pushing backend -> $backendImage" -ForegroundColor Cyan
    docker push "$backendImage"
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to push backend image"; exit 1 }
    Write-Host "Backend image pushed" -ForegroundColor Green
  } catch {
    Write-Error "Backend build/push failed: $_"
    exit 1
  }

# 5) Build and push frontend
  try {
    Write-Host "Building frontend image..." -ForegroundColor Cyan
    docker build -t ecommerce-ecr-frontend:local ./frontend
  $frontendImage = "$($frontendRepo):$Tag"
  docker tag ecommerce-ecr-frontend:local "$frontendImage"
  Write-Host "Pushing frontend -> $frontendImage" -ForegroundColor Cyan
    docker push "$frontendImage"
    if ($LASTEXITCODE -ne 0) { Write-Error "Failed to push frontend image"; exit 1 }
    Write-Host "Frontend image pushed" -ForegroundColor Green
  } catch {
    Write-Error "Frontend build/push failed: $_"
    exit 1
  }

Write-Host "All done. Backend image: $($backendRepo):$Tag  Frontend image: $($frontendRepo):$Tag" -ForegroundColor Magenta
