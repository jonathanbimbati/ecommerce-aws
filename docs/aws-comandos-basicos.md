# AWS – Comandos Básicos (Build, Deploy e Consultas)

Data: 2025-10-29

Este guia reúne comandos essenciais para:
- Construir e publicar imagens Docker (ECR)
- Implantar a pilha Serverless (SAM/CloudFormation)
- Implantar no Kubernetes (EKS)
- Fazer consultas simples nos serviços usados (DynamoDB, S3, SNS, ECR, Lambda, API Gateway)

Observações gerais:
- Use PowerShell no Windows (os blocos abaixo já estão no formato adequado).
- Defina `AWS_PROFILE` e `AWS_REGION` conforme seu ambiente.

---

## 1) ECR – Build e Push de Imagens Docker

```powershell
# Variáveis
$Env:AWS_REGION = "us-east-1"            # ajuste
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$ECR_URI_BACKEND = "$ACCOUNT_ID.dkr.ecr.$($Env:AWS_REGION).amazonaws.com/ecommerce-ecr-backend"
$ECR_URI_FRONTEND = "$ACCOUNT_ID.dkr.ecr.$($Env:AWS_REGION).amazonaws.com/ecommerce-ecr-frontend"
$TAG = (git rev-parse --short HEAD)       # ou use uma versão fixa

# Login no ECR
aws ecr get-login-password --region $Env:AWS_REGION | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$($Env:AWS_REGION).amazonaws.com"

# Backend (Dockerfile em backend/)
docker build -t "$ECR_URI_BACKEND:$TAG" backend/
# Frontend (Dockerfile em frontend/)
docker build -t "$ECR_URI_FRONTEND:$TAG" frontend/

# Push
docker push "$ECR_URI_BACKEND:$TAG"
docker push "$ECR_URI_FRONTEND:$TAG"

# Verificar imagens
aws ecr describe-images --repository-name ecommerce-ecr-backend | Select-String imageDigest
aws ecr describe-images --repository-name ecommerce-ecr-frontend | Select-String imageDigest
```

Dica: há workflows em `.github/workflows/*` automatizando esse processo.

---

## 2) SAM/CloudFormation – Deploy do template.yaml

```powershell
# Validar template
sam validate -t template.yaml

# (opcional) Inicializar parâmetros pelo modo guiado
sam deploy --guided `
  --stack-name ecommerce-aws `
  --region $Env:AWS_REGION `
  --capabilities CAPABILITY_IAM `
  --parameter-overrides JwtSecretParam="<seu-segredo-ou-SSM-ARN>"

# Deploy usando samconfig.toml (se já inicializado)
sam deploy

# Obter saídas do stack
aws cloudformation describe-stacks `
  --stack-name ecommerce-aws `
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' `
  --output table
```

Principais Outputs:
- `ApiBaseEndpoint` – base da API (anexar `/Prod/api/...`).
- `UploadsBucketName` – bucket S3 para uploads.

---

## 3) EKS/Kubernetes – Deploy e Operações básicas

```powershell
# Configurar kubeconfig via AWS (requer credenciais)
aws eks update-kubeconfig --name <EKS_CLUSTER_NAME> --region $Env:AWS_REGION

# Aplicar manifests (usa kustomize)
kubectl apply -k k8s/

# Atualizar imagem do backend com um novo tag
$IMAGE = "$ECR_URI_BACKEND:$TAG"
kubectl set image deployment/ecommerce-backend backend=$IMAGE
kubectl rollout status deployment/ecommerce-backend --timeout=180s

# Observar recursos
kubectl get pods -A
kubectl get svc -A
kubectl logs deploy/ecommerce-backend -f
```

---

## 4) Consultas rápidas – DynamoDB, S3, SNS, API, Lambda, ECR

### DynamoDB
```powershell
# Descobrir nomes a partir das saídas do stack ou do padrão <STACK>-Products/Users
$ProductsTable = "ecommerce-aws-Products"
$UsersTable = "ecommerce-aws-Users"

# Listar itens (scan)
aws dynamodb scan --table-name $ProductsTable | ConvertFrom-Json | Select-Object -ExpandProperty Items | Select-Object -First 5

# Obter item por id (exemplo)
aws dynamodb get-item `
  --table-name $ProductsTable `
  --key '{"id": {"S": "<product-id>"}}'
```

### S3
```powershell
$Bucket = (aws cloudformation describe-stacks --stack-name ecommerce-aws --query "Stacks[0].Outputs[?OutputKey=='UploadsBucketName'].OutputValue" --output text)

# Listar objetos do prefixo público
aws s3 ls "s3://$Bucket/public/"

# Baixar um objeto
aws s3 cp "s3://$Bucket/public/<arquivo>" .
```

### SNS
```powershell
$TopicArn = (aws cloudformation describe-stacks --stack-name ecommerce-aws --query "Stacks[0].Outputs[?OutputKey=='NotificationTopicArn'].OutputValue" --output text)

# Listar assinaturas
aws sns list-subscriptions-by-topic --topic-arn $TopicArn

# Publicar mensagem de teste
aws sns publish --topic-arn $TopicArn --message '{"msg":"teste"}'
```

### API Gateway (testes rápidos)
```powershell
$ApiBase = (aws cloudformation describe-stacks --stack-name ecommerce-aws --query "Stacks[0].Outputs[?OutputKey=='ApiBaseEndpoint'].OutputValue" --output text)

# Pingar rota pública (ajuste conforme suas rotas)
curl "$ApiBase/Prod/api/products" -sS | Out-Host
```

### Lambda e Logs
```powershell
# Listar funções
aws lambda list-functions | Select-String FunctionName

# Ver logs (CloudWatch) – exemplo com o nome base da função
$fn = "ecommerce-aws-Api"
$logGroup = "/aws/lambda/$fn"
aws logs tail $logGroup --follow
```

### ECR (consultas)
```powershell
aws ecr describe-repositories | Select-String repositoryName
aws ecr describe-images --repository-name ecommerce-ecr-backend | Select-String imageTag
```

---

## 5) Dicas e Troubleshooting

- `npm ci` falhando em CI: garanta que `package-lock.json` está sincronizado com `package.json` e committado.
- Erros CORS no upload: revise `CorsConfiguration` do bucket e cabeçalho `Content-Type` do PUT.
- 403 no PUT do S3: valide permissões da Lambda (S3 PutObject) e o prefixo `public/`.
- Rollout no EKS travado: reduza réplicas temporariamente e verifique `kubectl describe pod` para eventos e erros de imagem.
- Segurança do JWT: passe `JwtSecretParam` via SSM (SecureString) ou segredos de repositório/CI, evitando plaintext.
