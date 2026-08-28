<#
.SYNOPSIS
  Bootstrap or update the AgentOS API on AWS App Runner.

.DESCRIPTION
  1. Deploy ECR + IAM + Secrets Manager (ImageReady=false)
  2. Write secrets.json into Secrets Manager
  3. Build linux/amd64 image and push to ECR
  4. Create/update the App Runner service (ImageReady=true)
  5. Print the public URL and cutover checklist

.EXAMPLE
  cd server
  Copy-Item infra/aws/secrets.example.json infra/aws/secrets.json
  # fill secrets.json from the Render dashboard
  .\infra\aws\deploy.ps1 -Region us-east-1
#>
[CmdletBinding()]
param(
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }),
  [string]$StackName = "agentos-api",
  [string]$FrontendUrl = "https://agentox.io",
  [string]$CorsOrigin = "https://agentox.io,https://www.agentox.io,https://agentos-blue.vercel.app",
  [string]$PublicApiUrl = "",
  [string]$Cpu = "1 vCPU",
  [string]$Memory = "2 GB",
  [switch]$SkipBuild,
  [switch]$SecretsOnly
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = (Resolve-Path (Join-Path $here "..\..")).Path
$template = Join-Path $here "cloudformation.yaml"
$secretsFile = Join-Path $here "secrets.json"

function Assert-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name is not on PATH. Install it before deploying."
  }
}

function Invoke-Aws {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$AwsArgs)
  & aws @AwsArgs
  if ($LASTEXITCODE -ne 0) {
    throw "aws $($AwsArgs -join ' ') failed with exit $LASTEXITCODE"
  }
}

Assert-Command aws
if (-not $SecretsOnly) { Assert-Command docker }

$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
if (-not $identity.Account) { throw "AWS credentials are not configured (aws sts get-caller-identity failed)." }
$account = $identity.Account
Write-Host "Account $account  region $Region  stack $StackName"

if (-not (Test-Path $secretsFile)) {
  throw "Missing $secretsFile — copy secrets.example.json and fill values from Render."
}

$commonParams = @(
  "cloudformation", "deploy",
  "--stack-name", $StackName,
  "--template-file", $template,
  "--region", $Region,
  "--capabilities", "CAPABILITY_IAM", "CAPABILITY_NAMED_IAM",
  "--parameter-overrides",
  "FrontendUrl=$FrontendUrl",
  "CorsOrigin=$CorsOrigin",
  "Cpu=$Cpu",
  "Memory=$Memory"
)

Write-Host "`n==> Creating ECR / IAM / secret (no App Runner yet)"
Invoke-Aws @commonParams "ImageReady=false"

$secretArn = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='SecretArn'].OutputValue" --output text
$ecrUri = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='EcrUri'].OutputValue" --output text
if (-not $secretArn -or $secretArn -eq "None") { throw "Could not read SecretArn from stack outputs." }

Write-Host "==> Writing $secretsFile to Secrets Manager"
Invoke-Aws secretsmanager put-secret-value --region $Region --secret-id $secretArn --secret-string (Get-Content -Raw $secretsFile)

if ($SecretsOnly) {
  Write-Host "Secrets updated. Restart the App Runner service to pick them up."
  exit 0
}

if (-not $SkipBuild) {
  Write-Host "==> Logging in to ECR"
  aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$account.dkr.ecr.$Region.amazonaws.com"
  if ($LASTEXITCODE -ne 0) { throw "docker login to ECR failed." }

  $image = "${ecrUri}:latest"
  Write-Host "==> Building $image (linux/amd64)"
  Push-Location $serverRoot
  try {
    docker build --platform linux/amd64 -t $image .
    if ($LASTEXITCODE -ne 0) { throw "docker build failed." }
    docker push $image
    if ($LASTEXITCODE -ne 0) { throw "docker push failed." }
  } finally {
    Pop-Location
  }
}

Write-Host "==> Creating / updating App Runner service"
$serviceParams = $commonParams + @("ImageReady=true")
if ($PublicApiUrl) {
  $serviceParams += "PublicApiUrl=$PublicApiUrl"
}
Invoke-Aws @serviceParams

$serviceUrl = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" --output text
Write-Host "`nService URL: $serviceUrl"

if (-not $PublicApiUrl -and $serviceUrl -and $serviceUrl -ne "None") {
  Write-Host "==> Setting PUBLIC_API_URL to $serviceUrl"
  Invoke-Aws @commonParams "ImageReady=true" "PublicApiUrl=$serviceUrl"
  $serviceUrl = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" --output text
}

Write-Host @"

Deploy requested. Wait until App Runner is RUNNING, then:

  aws apprunner list-services --region $Region
  curl $serviceUrl/healthz
  curl $serviceUrl/readyz

Cutover:
  1. Google / Atlassian / GitHub / Bitbucket OAuth callbacks → $serviceUrl/api/.../callback
  2. Vercel VITE_API_URL = $serviceUrl
  3. Reconnect Jira so webhooks register against the new PUBLIC_API_URL
  4. Suspend the Render web service after smoke tests pass

See docs/AWS_MIGRATION.md
"@
