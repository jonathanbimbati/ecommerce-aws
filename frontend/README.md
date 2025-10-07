# Frontend

Angular app (standalone components). Dev server:

PowerShell:

```powershell
cd frontend
npm install
npm run start
# abrir http://localhost:4200
```

Build de produção:

```powershell
npm run build
# saída: dist/frontend
```
Frontend Angular minimal

This is a minimal Angular application scaffold for the e-commerce demo.

Notes:
- It's a basic manual scaffold (not generated with `ng new`). To run locally you need Angular CLI installed globally or install dev deps.

Quick start:

1. Install deps (from project root frontend):

```powershell
cd frontend
npm install
```

2. Run the dev server:

```powershell
npm start
```

3. The frontend expects the backend API at `/api/products`. For local development you can run the backend at `http://localhost:3000` and use a proxy or CORS. The frontend uses relative path `/api/products` which works if:
   - You run a reverse proxy, or
   - You configure Angular dev server proxy to forward `/api` to `http://localhost:3000`.

Example `proxy.conf.json`:

```json
{ 
  "/api": { "target": "http://localhost:3000", "secure": false }
}
```

And start with:

```powershell
ng serve --proxy-config proxy.conf.json
```

