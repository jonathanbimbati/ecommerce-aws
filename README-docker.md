# Rodando em containers (dev)

Este projeto agora inclui Dockerfiles e um `docker-compose.yml` para executar o backend (Node) e o frontend (Angular servido pelo nginx) localmente.

Pré-requisitos
- Docker e Docker Compose instalados
- Credenciais AWS configuradas localmente (se quiser que o backend se conecte ao DynamoDB real)

Como rodar
1) No Windows PowerShell (na raiz do repo):

```powershell
# exporte as variáveis de ambiente que o backend precisa para usar DynamoDB
$env:DYNAMODB_TABLE = 'ecommerce-aws-Products'
$env:USERS_TABLE = 'ecommerce-aws-Users'
$env:AWS_REGION = 'us-east-1'

# build e up
docker compose up --build
```

2) Acesse o frontend em: http://localhost:4200
3) O backend estará disponível em: http://localhost:3000 (o nginx do frontend já proxya /api para o backend)

Observações
- O Docker Compose mapeia o diretório do backend como volume para facilitar desenvolvimento.
- Se preferir não utilizar o DynamoDB real, deixe as variáveis de ambiente vazias e o backend cairá no fallback in-memory.
