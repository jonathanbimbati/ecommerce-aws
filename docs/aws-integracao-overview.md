# Integração AWS – Visão Geral do Projeto

Data: 2025-10-29

Este documento resume, de forma objetiva, todos os serviços AWS utilizados por esta aplicação, como eles se integram entre si, onde estão definidos no repositório e os principais fluxos de dados. Use-o junto com `docs/challenge-coverage.md` (inventário amplo) e os templates em `template.yaml` e `infra/cloudformation/*`.

## Arquitetura em alto nível

- Frontend: Angular executando em EKS (Kubernetes) atrás de um Load Balancer, servindo a UI.
- Backend (duplo modo):
  - Serverless: API Gateway → Lambda (Node.js/Express via @vendia/serverless-express) para autenticação, produtos e emissão de URLs pré‑assinadas para upload direto ao S3.
  - Contêiner: Deploy do backend em EKS (Deployment/Service), alimentado por imagens no ECR. Útil para ambientes em Kubernetes e testes.
- Dados:
  - DynamoDB: Tabelas `Products` e `Users`. Stream da tabela de produtos aciona Lambda para publicar eventos em SNS.
  - S3: Bucket para uploads públicos (prefixo `public/`) com CORS habilitado para upload direto do navegador.
- Mensageria/Notificações: SNS para notificar novas inserções de produtos (assinatura via e‑mail e função Lambda consumidora).
- Imagens: ECR armazena imagens Docker do frontend e backend; GitHub Actions constroem e publicam.
- Infraestrutura como código: SAM/CloudFormation para pilha serverless e recursos de dados; manifests K8s para EKS.

Fluxo principal (UI → API):
1) UI chama `/api/...` (Nginx/Ingress proxy) → API Gateway (Serverless) → Lambda (Express) → DynamoDB.
2) Uploads: UI solicita presign (`POST /api/uploads/presign`) → Lambda gera URL PUT do S3 → navegador faz PUT direto → produto recebe `imageUrl` público.
3) Inserções em Produtos: DynamoDB Stream aciona Lambda que publica em SNS; assinantes recebem notificação.

## Inventário de serviços e onde ficam

- API Gateway (REST, via SAM implícito)
  - Propósito: Expor a API HTTP pública encaminhando para `ApiFunction`.
  - Definição: `template.yaml` (Events do tipo `Api`).
  - Outputs: `ApiBaseEndpoint` (base `.../Prod`).

- AWS Lambda
  - `ApiFunction`: Handler HTTP Express (`backend/lambda/apiHandler.js`). Rotas de auth, produtos e presign de upload.
  - `ProductsProcessorFunction`: Processa eventos da Stream de DynamoDB (novos/alterados produtos) e publica em SNS.
  - `NotificationConsumerFunction`: Exemplo de consumidor de notificações (inscrito no SNS).
  - Definição: `template.yaml` (Runtime Node 20, envs e policies). Código em `backend/`.

- Amazon DynamoDB
  - Tabelas: `ProductsTable` (com Stream habilitado) e `UsersTable`.
  - Uso: CRUD de produtos/usuários; stream de produtos para fan‑out SNS.
  - Definição: `template.yaml`. Acesso no código: `backend/db/*.js`.

- Amazon S3 (Uploads)
  - Bucket: `UploadsBucket` com CORS e política pública para leitura em `public/*`.
  - Uso: Upload direto do navegador via URL pré‑assinada; frontend grava `imageUrl` do objeto.
  - Definição: `template.yaml`. Backend: `backend/routes/uploads.js` (gera presign com AWS SDK v3).

- Amazon SNS
  - Tópico: `NotificationTopic` para eventos de produtos.
  - Assinaturas: e‑mail e Lambda (`NotificationConsumerFunction`).
  - Definição: `template.yaml`. Publicação feita por `ProductsProcessorFunction`.

- Amazon ECR
  - Repositórios: `ecommerce-ecr-frontend` e `ecommerce-ecr-backend` (imutáveis).
  - Uso: Armazenar imagens Docker que são implantadas no EKS.
  - Criação: via CloudFormation (templates em `infra/cloudformation/ecr.yaml`) ou manual. Publicação automatizada nos workflows GitHub.

- Amazon EKS (Kubernetes)
  - Uso: Hospedar o frontend Angular e (opcionalmente) o backend em contêiner.
  - Definição: manifests em `k8s/` (deployments, services, HPA, secrets). Deploy via kubectl nos workflows.

- IAM
  - Policies para Lambda (DynamoDB CRUD, SNS Publish, S3 PutObject) e Bucket Policy pública controlada por prefixo.
  - Definição: embutidas no `template.yaml` (Policies/Statements) e nos templates de infra.

- CloudWatch Logs/Alarms (implícito)
  - Todas as Lambdas escrevem em CloudWatch Logs; alarmes opcionais podem ser adicionados.

- CloudFormation/SAM
  - Pilha serverless orquestrando API, Lambdas, DynamoDB, SNS e S3.
  - Arquivo: `template.yaml`; pipeline manual em `.github/workflows/sam-deploy.yml`.

## Repositório – onde cada peça está

- Serverless (API/Lambdas/Tabelas/SNS/S3): `template.yaml`
- Backend (Express + rotas + presign S3): `backend/`
- Frontend (Angular): `frontend/`
- Kubernetes (EKS): `k8s/`
- Infra CloudFormation adicional: `infra/cloudformation/`
- Workflows CI/CD: `.github/workflows/`
- Documentação específica: `docs/s3-direct-upload.md`, `docs/eks-scaling.md`, `docs/challenge-coverage.md`

## Parâmetros e variáveis relevantes

- `JwtSecretParam` (Parameter do SAM): valor do segredo JWT usado pelo backend.
- Variáveis de ambiente (Lambdas): `USERS_TABLE`, `TABLE_NAME`, `JWT_SECRET`, `S3_BUCKET`, `S3_PREFIX`, `S3_PUBLIC_URL_BASE`, `NOTIFICATION_TOPIC_ARN`.

## Observações e boas práticas

- S3 público somente no prefixo `public/`. Para produção, considere CloudFront e restringir CORS a domínios específicos.
- ECR imutável evita sobrescritas acidentais de imagens; use tags por SHA/versão.
- Em EKS, use HPA e configure Cluster Autoscaler (ver `docs/eks-scaling.md`) para escalar sob demanda.
- Prefira passar `JwtSecretParam` via SSM Parameter Store (SecureString) e referenciá‑lo na implantação do SAM.

## Recursos opcionais no repositório

- CloudTrail para ECR (`infra/cloudformation/cloudtrail-ecr.yaml`)
- Plano de Backup (`infra/cloudformation/backup-plan.yaml`)
- Synthetic Probe e eventos de escala de EKS (`infra/cloudformation/synthetic-probe.yaml`, `eks-scale-events.yaml`, `sns-scale-events.yaml`)

Esses itens são úteis, mas não são obrigatórios para a operação básica do app.
