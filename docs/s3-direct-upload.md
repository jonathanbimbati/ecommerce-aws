# Upload direto para S3 (frontend -> S3 via URL pré-assinada)

Este guia habilita upload de imagens diretamente do navegador para o S3 usando URLs pré‑assinadas geradas pelo backend (API Gateway + Lambda).

## Visão geral

- Backend expõe `POST /api/uploads/presign` (autenticado) que retorna uma URL pré‑assinada (PUT) e o `objectUrl` público.
- Frontend seleciona o arquivo, solicita a URL, faz `PUT` direto no S3 e salva o `objectUrl` no campo `imageUrl` do produto.
- Bucket S3 possui CORS e política para leitura pública apenas no prefixo `public/`.

## Recursos de infraestrutura

O arquivo `template.yaml` (SAM) foi atualizado para criar:
- `UploadsBucket` (`<STACK>-uploads`) com CORS permitindo `PUT,POST,GET,HEAD` de qualquer origem.
- `UploadsBucketPolicy` permitindo `s3:GetObject` público para `public/*`.
- Permissões na função `ApiFunction` para `s3:PutObject` e `s3:PutObjectAcl` no bucket.
- Variáveis de ambiente:
  - `S3_BUCKET` (nome do bucket)
  - `S3_PREFIX=public/`
  - `S3_PUBLIC_URL_BASE=https://<bucket>.s3.<region>.amazonaws.com`

Para aplicar:

```bash
# Requer AWS SAM/CloudFormation
sam deploy --guided
# ou use o mesmo processo que você já usa para publicar o template.yaml
```

Após o deploy, confirme no Console S3 que o bucket existe e que o CORS/política foram aplicados.

## Backend

- Novo endpoint: `POST /api/uploads/presign` (arquivo: `backend/routes/uploads.js`).
- Requer header de Autorização (JWT). Payload:

```json
{
  "fileName": "foto.png",
  "contentType": "image/png"
}
```

Resposta:

```json
{
  "uploadUrl": "https://...",
  "method": "PUT",
  "headers": { "Content-Type": "image/png" },
  "key": "public/<uuid>.png",
  "objectUrl": "https://<bucket>.s3.<region>.amazonaws.com/public/<uuid>.png",
  "expiresIn": 60
}
```

Dependências adicionadas ao backend:
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

## Frontend

- Modal de produto agora tem input de arquivo. Ao selecionar, o app:
  1) chama `POST /api/uploads/presign` com `fileName` e `contentType`
  2) executa `PUT` do arquivo no `uploadUrl`
  3) preenche `imageUrl` com o `objectUrl` retornado

Arquivos:
- `frontend/src/app/services/product.service.ts`: novos métodos `presignUpload` e `putToS3`
- `frontend/src/app/products/products.component.*`: `onFileSelected(...)` e UI de upload

## Limites, progresso e UX

- Tipos permitidos: PNG e JPEG (validados no frontend e backend).
- Tamanho máximo: 5 MB (validado no frontend e aceito no presign; a URL pode incluir Content-Length esperado).
- Barra de progresso: o upload usa XMLHttpRequest com `upload.onprogress`, exibindo progresso no modal.
- As imagens nos cards têm altura fixa (180px) com `object-fit: cover` para não expandir o card.

Caso queira alterar limites, ajuste:
- Frontend: `MAX_MB` e `ALLOWED_TYPES` em `products.component.ts`.
- Backend: `process.env.MAX_UPLOAD_BYTES` (ou altere o valor default no `uploads.js`).

## Observações de segurança

- O prefixo público `public/` é exposto somente para leitura (`GetObject`).
- Para ambientes restritos, prefira servir imagens via CloudFront em vez de GetObject público, ou eliminar política pública e usar URLs pré‑assinadas também para `GET`.
- Ajuste o CORS do bucket para restringir `AllowedOrigins` ao seu domínio de frontend.

## Troubleshooting

- Erro CORS ao enviar: verifique `CorsConfiguration` do bucket e `Content-Type` no `PUT`.
- Upload 403: confirme que a função Lambda (ApiFunction) tem permissão no bucket e que o objeto está no prefixo correto.
- Imagem não carrega: valide `objectUrl` retornado e se a política pública cobre `public/*`.
