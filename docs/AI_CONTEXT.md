# Contexto técnico de IA — RK Sucatas

## Objetivo

Sistema interno de operação de uma loja de peças de moto: dashboard, estoque, vendas, orçamentos, caixa, frete, clientes, catálogos e integrações de marketplace (Mercado Livre, Shopee). É multiusuário: `usuarios` autenticam e recebem JWT, e o acesso é controlado por **permissões granulares por tela/ação** (`usuarios.permissoes` jsonb, `{ "<tela>": { "<acao>": boolean } }`, migration_047), que substituíram o antigo controle por cargo fixo. A coluna `roles` permanece, hoje sobretudo como marcador de `admin` (super-usuário) e proteção do último admin ativo.

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
| Testes | `npm test` |
| Build web + servidor | `npm run build` |
| Servir build | `npm start` |
| Sincronizar Android | `npm run cap-sync` |

O runner de testes é o Vitest (`npm test` → `vitest run`); os testes ficam em `*.test.ts`/`*.test.tsx` ao lado do arquivo. A cobertura é parcial, não exaustiva.

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

Entidades principais: `categorias`, `modelos_moto`, `formas_pagamento`, `estoque`, `estoque_unidades`, `gavetas`, `vendas`, `caixa`, `orcamentos`, `orcamento_itens`, `usuarios`, `clientes`.

- **Hierarquia de estoque: Gaveta → Variante → Unidade.** A gaveta agrupa peças semelhantes (organização 100% manual; peça sem gaveta cai em "ITENS NÃO AGRUPADOS"). A variante é o item de catálogo (modelo/ano/condição) e a unidade (`estoque_unidades`) é a peça física individual. O **preço pertence à UNIDADE**, nunca à variante — a variante mostra apenas a faixa min~max computada das suas unidades. Introduzida na migration_061; famílias (conceito anterior) ainda coexistem em paralelo nesta fase, sem conversão automática.
- **Venda exige seleção de unidade obrigatória**, quantidade sempre 1 (uma peça física).
- O frontend não fala diretamente com Supabase. RLS está habilitado e o backend utiliza service role.
- `registrar_venda` baixa estoque, cria venda e lança caixa atomicamente; `cancelar_venda` reverte venda e lançamento. Não reimplementar como chamadas separadas. Ambas evoluíram por migrations (overloads, `cliente_id`, item avulso, valor recebido/líquido) — confirme a assinatura vigente antes de alterar.
- Orçamentos são rastreabilidade sobre estoque/vendas, não segunda fonte de verdade.

## Banco, segurança e deploy

Bootstrap: `supabase/schema.sql`; migrations manuais numeradas de `migration_002` a `migration_063`, aplicadas em ordem no editor SQL do Supabase. **Atenção à sequência:** há uma colisão de numeração documentada (dois arquivos `060` e dois `061`) e **não existe migration `062`** — ver `docs/migrations-colisao-060-061.md`. Nem toda migration está necessariamente aplicada no ambiente alvo; confirme a sequência aplicada antes de propor alteração. Não edite migrations já aplicadas, execute SQL em produção, altere RLS ou acesse/reproduza `.env` sem autorização. Service role nunca chega ao frontend.

Existe `render.yaml` para Render. README também menciona Cloud Run e o cliente contém referência Cloud Run. Confirme o destino operacional antes de mudança de infraestrutura.

## Convenções observadas

- TypeScript e organização por feature; APIs em `api.ts` e tipos próximos ao domínio quando aplicável.
- Tailwind, tema claro/escuro, interfaces desktop/mobile e Lucide.
- Navegação controlada principalmente por `App.tsx`.

## Limitações e riscos conhecidos

1. Há Vitest configurado, mas a cobertura é parcial; ausência de teste não aprova feature automaticamente.
2. README e infraestrutura possuem informações de deploy conflitantes.
3. `schema.sql` pode não refletir integralmente migrations recentes.
4. Há arquivos grandes e compartilhados.
5. Configurações locais de agentes podem conter segredos.
6. Claude Code e Codex podem trabalhar em turnos; alterações locais devem sempre ser investigadas.

Consulte `AGENTS.md` para regras gerais, `CLAUDE.md` para Claude Code e `docs/AI_WORKFLOW.md` para o processo entre agentes.
