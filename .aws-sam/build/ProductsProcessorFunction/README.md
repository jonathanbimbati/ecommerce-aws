# Backend

Node.js + Express API para produtos.

Executar:

```powershell
cd backend
npm install
node index.js
# API em http://localhost:3000/api/products
```

DynamoDB (opcional)
-------------------

Este backend pode usar o DynamoDB em vez do armazenamento em memória. Configure:

- variável `DYNAMODB_TABLE` para o nome da tabela DynamoDB (ou deixe em branco para fallback in-memory)
- `AWS_REGION` (ou use o profile/region do AWS CLI)

Exemplo de criação da tabela com AWS CLI:

```powershell
aws dynamodb create-table `
	--table-name Products `
	--attribute-definitions AttributeName=id,AttributeType=S `
	--key-schema AttributeName=id,KeyType=HASH `
	--billing-mode PAY_PER_REQUEST `
	--region us-east-1
```

Ou use o template SAM (na raiz `template.yaml`) que cria a tabela, habilita Stream e adiciona uma Lambda (handler em `backend/lambda/streamHandler.js`):

```powershell
cd ..
sam build
sam deploy --guided
```

Depois do deploy, passe o nome da tabela (output `ProductsTableName`) como `DYNAMODB_TABLE` para o backend se quiser que ele use a mesma tabela.

# E-commerce Backend (simple)

This is a minimal Node.js Express backend for a simple e-commerce demo. It's designed to be easy to containerize and deploy to AWS later (ECS, API Gateway, etc.).

Features:
- REST endpoints for products (in-memory store)
- Jest + Supertest tests

How to run locally

1. Install dependencies:

```powershell
cd backend; npm install
```

2. Run in development (requires nodemon):

```powershell
npm run dev
```

3. Run tests:

```powershell
npm test
```

Endpoints

- GET /api/products
- GET /api/products/:id
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id

Notes

- The store is in-memory to keep the demo simple. For AWS integration, we'll add a database or use DynamoDB later.
