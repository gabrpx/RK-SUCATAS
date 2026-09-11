# Contexto técnico de IA — RK Sucatas

## Objetivo

Sistema interno de operação de uma loja de peças de moto: dashboard, estoque, vendas, orçamentos, caixa, frete, configurações e catálogos. Não há evidência de multiusuário; a autenticação atual é uma senha administrativa única que emite JWT.

## Modelo de desenvolvimento com múltiplos agentes

Claude Code é o executor principal; Codex é o segundo desenvolvedor e auditor. Ambos podem trabalhar em turnos diferentes e uma feature pode ser iniciada, continuada, finalizada ou revisada por qualquer um, dentro das regras de `AGENTS.md`.

Nenhum agente deve presumir que a tarefa começou ou terminou na sua própria sessão. Investigue o estado atual do código antes de implementar; relatórios anteriores ajudam, mas não substituem inspeção do repositório.

## Stack e execução

- Frontend: React 19, TypeScript, Vite, Tailwind CSS e Motion.
- Backend: Express, executado pelo mesmo processo de desenvolvimento/produção.
- Persistência: Supabase/Postgres e Supabase Storage; `@supabase/supabase-js` somente no backend.
- Integrações: Melhor Envio; mobile: Capacitor/Android.
- Node: `>=22`.

| Objetivo | Comando |
| --- | --- |
| Desenvolvimento | `npm run dev` |
| Type-check | `npm run lint` |
| Build web + servidor | `npm run build` |
| Servir build | `npm start` |
| Sincronizar Android | `npm run cap-sync` |

Não existe runner ou suíte de testes configurada nesta data.

## Estrutura e fluxo

```text
Browser / aplicativo Capacitor
  ↓ React (`src/`)
  ↓ fetch autenticado (`src/utils/api.ts`)
  ↓ Express (`server.ts` + `src/server/routes/`)
  ↓ Supabase (`services/supabaseClient.ts`)
  ↓ Postgres, RPCs e Storage
```

- `src/App.tsx` — shell, autenticação de UI, navegação e layout global.
- `src/features/` — domínio por tela; `src/components/` — UI reutilizável.
- `src/context/DataContext.tsx` — estado de estoque, vendas, caixa e orçamentos.
- `src/hooks/useCatalogos.ts` — catálogos; `src/server/routes/` — API por domínio; `server.ts` — montagem da aplicação.

## Regra de continuidade

Ao encontrar implementação parcial, preserve o que estiver correto, determine estado real, identifique pendências e continue de onde o projeto está. Não recrie a feature desnecessariamente: trabalho parcial é trabalho em andamento, não descartável.

## Dados e regras críticas

Entidades principais: `categorias`, `modelos_moto`, `formas_pagamento`, `estoque`, `vendas`, `caixa`, `orcamentos` e `orcamento_itens`.

- O frontend não fala diretamente com Supabase. RLS está habilitado e o backend utiliza service role.
- `registrar_venda` baixa estoque, cria venda e lança caixa atomicamente. `cancelar_venda` reverte a venda e o lançamento correspondente. Não reimplementar como chamadas separadas.
- Estoque pode possuir componentes e unidades incompletas; regras específicas estão nas migrations/RPCs existentes.
- Orçamentos são rastreabilidade sobre estoque/vendas, não segunda fonte de verdade.

## Banco, segurança e deploy

Bootstrap: `supabase/schema.sql`; migrations manuais: `supabase/migration_002...007`. Não edite migrations já aplicadas, execute SQL em produção, altere RLS ou acesse/reproduza `.env` sem autorização. Service role nunca chega ao frontend.

Existe `render.yaml` para Render. README também menciona Cloud Run e o cliente contém referência Cloud Run. Confirme o destino operacional antes de mudança de infraestrutura.

## Convenções observadas

- TypeScript e organização por feature; APIs em `api.ts` e tipos próximos ao domínio quando aplicável.
- Tailwind, tema claro/escuro, interfaces desktop/mobile e Lucide.
- Navegação controlada principalmente por `App.tsx`.

## Limitações e riscos conhecidos

1. Não há testes automatizados configurados.
2. README e infraestrutura possuem informações de deploy conflitantes.
3. `schema.sql` pode não refletir integralmente migrations recentes.
4. Há arquivos grandes e compartilhados.
5. Configurações locais de agentes podem conter segredos.
6. Claude Code e Codex podem trabalhar em turnos; alterações locais devem sempre ser investigadas.

Consulte `AGENTS.md` para regras gerais, `CLAUDE.md` para Claude Code e `docs/AI_WORKFLOW.md` para o processo entre agentes.
