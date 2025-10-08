<#
apply-ssm-policy.ps1

Script interativo para:
  1) criar um arquivo local `ssm-policy.json` com permissões SSM apenas para o prefixo /ecommerce/*
  2) aplicar essa policy inline ao usuário IAM `aluno08` (put-user-policy)
  3) opcionalmente criar/atualizar o parâmetro SSM SecureString /ecommerce/jwt-secret

Uso: execute no PowerShell onde o AWS CLI esteja configurado.
#>

param(
    [string]$UserName = 'aluno08',
    [string]$PolicyName = 'AllowSSMPutParamEcommerce',
    [string]$PolicyFile = 'ssm-policy.json',
    [string]$SsmParamName = '/ecommerce/jwt-secret'
)

Set-StrictMode -Version Latest

$cwd = Get-Location
$policyPath = Join-Path $cwd.Path $PolicyFile

# Policy JSON (ajuste region/account se necessário). Substitua 199299155478 e us-east-1 se seu account/region forem diferentes.
$policy = @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPutGetDescribeEcommerceParameters",
      "Effect": "Allow",
      "Action": [
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "ssm:DeleteParameter",
        "ssm:DescribeParameters"
      ],
      "Resource": "arn:aws:ssm:us-east-1:199299155478:parameter/ecommerce/*"
    }
  ]
}
'@

# Write policy file
Write-Host "Criando Policy JSON em: $policyPath"
Set-Content -Path $policyPath -Value $policy -Encoding UTF8
Write-Host "Arquivo criado. Verifique o conteúdo se necessário: $policyPath`n"

# Show the policy preview and confirm
Write-Host "--- Preview da policy ---"
Get-Content $policyPath | ForEach-Object { Write-Host $_ }
Write-Host "-------------------------`n"

$apply = Read-Host "Deseja aplicar esta policy inline ao usuário '$UserName'? (y/N)"
if ($apply -ne 'y' -and $apply -ne 'Y') {
    Write-Host "Ação cancelada pelo usuário. Nenhuma policy aplicada." -ForegroundColor Yellow
    exit 0
}

# Apply policy
try {
    Write-Host "Aplicando policy '$PolicyName' ao usuário '$UserName'..."
    $cmd = "aws iam put-user-policy --user-name $UserName --policy-name $PolicyName --policy-document file://$policyPath"
    Write-Host "Executando: $cmd"
    & aws iam put-user-policy --user-name $UserName --policy-name $PolicyName --policy-document "file://$policyPath"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Policy aplicada com sucesso." -ForegroundColor Green
    } else {
        Write-Host "Falha ao aplicar policy. Exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "Erro ao executar put-user-policy:`n$_" -ForegroundColor Red
}

# Optional: create SSM parameter
$createSsm = Read-Host "Deseja criar/atualizar o parâmetro SSM '$SsmParamName' agora? (y/N)"
if ($createSsm -eq 'y' -or $createSsm -eq 'Y') {
    # Ask for secret value (warning: this will be echoed if not using Read-Host -AsSecureString)
    Write-Host "Informe o valor do secret. ATENÇÃO: será passado em texto claro para o AWS CLI." -ForegroundColor Yellow
    $secret = Read-Host "Valor do secret (ex: SuperSegredoMuitoForte123!)"

    if ([string]::IsNullOrWhiteSpace($secret)) {
        Write-Host "Valor vazio. Pulando criação do parâmetro." -ForegroundColor Yellow
    } else {
        try {
            Write-Host "Criando/atualizando parâmetro SSM '$SsmParamName' (SecureString)..."
            & aws ssm put-parameter --name $SsmParamName --value $secret --type SecureString --overwrite
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Parâmetro SSM criado/atualizado com sucesso." -ForegroundColor Green
            } else {
                Write-Host "Falha ao criar parâmetro SSM. Exit code: $LASTEXITCODE" -ForegroundColor Red
            }
        } catch {
            Write-Host "Erro ao executar put-parameter:`n$_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Pulando criação do parâmetro SSM." -ForegroundColor Yellow
}

Write-Host "Operação finalizada." -ForegroundColor Cyan
Write-Host "Lembrete: se você usar um KMS key customizado para SecureString, garanta permissões KMS apropriadas." -ForegroundColor Yellow

# End of script
