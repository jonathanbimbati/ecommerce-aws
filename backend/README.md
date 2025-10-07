# Backend

Node.js + Express API para produtos.

Executar:

```powershell
cd backend
npm install
node index.js
# API em http://localhost:3000/api/products
```
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
