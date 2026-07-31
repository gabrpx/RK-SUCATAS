# RK Sucatas

Sistema interno de controle de estoque, vendas, caixa e frete para a loja de
peças de moto. Frontend em React + Vite + TypeScript + Tailwind, backend
Express fino (autenticação de staff + proxy do Melhor Envio + CRUD Supabase).

## Configuração local

1. Rode `supabase/schema.sql` no editor SQL do seu projeto Supabase (cria as
   tabelas `categorias`, `modelos_moto`, `estoque`, `vendas`, `caixa`).
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` e `MELHOR_ENVIO_TOKEN`.
3. `npm install` e `npm run dev`.
4. Login inicial: usuário `rksucatas` (senha definida em `server.ts`,
   `seedAdminPadrao` — troque depois do primeiro acesso).

## 🌐 Deploy no Google Cloud Run

Este projeto está configurado para deploy automático no Google Cloud Run:

1. O servidor escuta na porta definida por `process.env.PORT`
2. O comando de start é `npm start`
3. As variáveis de ambiente devem ser configuradas no Cloud Run
