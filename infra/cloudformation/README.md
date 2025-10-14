# CloudFormation Stacks (ecommerce-aws)

Este diretório contém templates para cobrir requisitos do desafio via CloudFormation:

- `ecr.yaml`: Repositórios ECR com tags imutáveis e scan on push.
- `cloudtrail-ecr.yaml`: CloudTrail multi-região com data events para ECR (auditar push/delete).
- `sns-scale-events.yaml`: Tópico SNS + regras EventBridge para notificações de scale in/out.
- `ecs-fargate.yaml`: Cluster ECS Fargate com ALB, serviços (frontend/backend) e autoscaling.
- `apigw-http.yaml`: API Gateway HTTP proxy para publicar a API do backend.
- `backup-plan.yaml`: Plano de Backup (EC2/RDS) com seleção por tag.

## Implantação rápida

Parâmetros como VPC/Subnets devem ser passados conforme seu ambiente:

1. ECR:
   - Deploy `ecr.yaml` para criar repositórios.
2. CloudTrail ECR:
   - Deploy `cloudtrail-ecr.yaml` (ajuste `LogBucketName` para um bucket único na sua conta/região).
3. ECS Fargate:
   - Deploy `ecs-fargate.yaml` informando `VpcId`, `PublicSubnets`, `PrivateSubnets`, `BackendImage`, `FrontendImage`.
4. API Gateway:
   - Após obter o DNS do ALB (saída `ALBDNS`), defina `BackendUrl` como `http://<ALB-DNS>` (o template cria rota `ANY /{proxy+}`).
5. SNS Scale Events:
   - (Opcional) Deploy `sns-scale-events.yaml` e informe `TopicEmail` para receber e-mails.
6. Backup Plan:
   - Deploy `backup-plan.yaml`. Tagueie recursos (EC2/RDS) com `Backup=true`.

## Observações

- Para SSO/Cognito: use AWS Cognito (User Pool + App Client) e configure JWT validation no backend (JWKS). Alternativamente, habilite IAM Identity Center para SSO de operadores/admins.
- Para SQL (RDS): migrar de DynamoDB para RDS (PostgreSQL) exigirá criar schema `products(id uuid pk, name text, price numeric, description text)` e implementar um data-access `db/rds.js` com `pg`. Uma flag `DB_ENGINE=rds` pode alternar a implementação.
- ECS vs EKS: O projeto atual roda em EKS; este template oferece alternativa ECS Fargate para cumprir o requisito de ECS/ELB.
