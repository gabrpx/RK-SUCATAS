# RK Sucatas

> **Este é o NOVO SISTEMA.** O checkout canônico é `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE` e o preview local deve usar `http://127.0.0.1:3001`. O caminho `D:\SISTEMA CLAUDE` e a porta `4173` pertencem ao projeto legado. Consulte [PROJECT_IDENTITY.md](PROJECT_IDENTITY.md) antes de executar ou validar qualquer alteração.

Sistema interno de controle de estoque, vendas, caixa e frete para a loja de
peças de moto. Frontend em React + Vite + TypeScript + Tailwind, backend
Express fino (autenticação de staff + proxy do Melhor Envio + CRUD Supabase).

## Configuração local

1. Rode `supabase/schema.sql` no editor SQL do seu projeto Supabase (cria as
   tabelas `categorias`, `modelos_moto`, `estoque`, `vendas`, `caixa`).
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_PASSWORD` e
   `MELHOR_ENVIO_TOKEN`.
3. `npm install` e `npm run dev`.
4. Login: só a senha definida em `ADMIN_PASSWORD` (sem usuário/cadastro).

## 🌐 Deploy no Google Cloud Run

Este projeto está configurado para deploy automático no Google Cloud Run:

1. O servidor local inicia com `npm run dev` em `http://127.0.0.1:3001`.
   O inicializador usa um bundle temporário e cache isolado por processo para
   evitar falhas `ENOMEM` do `tsx`, colisões de cache `EPERM` e conflitos de HMR
   no Windows. Para uma prévia somente leitura, use `npm run dev:preview`.
2. O comando de start é `npm start`
3. As variáveis de ambiente devem ser configuradas no Cloud Run
