# Handoff — Fase 2A: Estoque por Gavetas (edição/exclusão + campo "Novo")

**Data:** 2026-09-11 · **Autor:** Claude (Opus) · **Destino:** Codex
**Branch:** `handoff/estoque-gavetas-fase2a` (commitada em `7a5a074` e publicada;
SQL da migration **não** executado)
**Spec:** [docs/superpowers/specs/2026-09-11-estoque-gavetas-fase2-design.md](superpowers/specs/2026-09-11-estoque-gavetas-fase2-design.md)

## Escopo entregue (Fase 2A)

1. **Editar / excluir gaveta pela UI** (Frente 1) — backend já existia; era só UI.
2. **Campo "Novo" na peça + badges com cor própria** (Frente 2).

**Pendente (fora desta fase):** vendas por unidade e busca. Não tocados.

## Ação obrigatória antes de subir (você / dono)

- **Rodar `supabase/migration_063_estoque_novo.sql` no Supabase ANTES de subir
  o código** (SQL **não** foi executado por mim). É um `alter table estoque add
  column novo boolean not null default false`. **Pré-requisito obrigatório, não
  opcional:** só a leitura degrada bem (o GET apenas não devolve `novo`). A
  escrita não — o form sempre envia `novo` e `montarPayload()` sempre o inclui
  no INSERT/UPDATE, então **criar/editar peça falha** ("column novo does not
  exist") enquanto a migration não rodar.
- Numeração **063** de propósito (060/061 têm colisão dupla já em produção —
  ver [docs/migrations-colisao-060-061.md](migrations-colisao-060-061.md)).
  **Não renomear** as históricas.

## Arquivos alterados

**Backend**
- `src/server/routes/estoque.ts` — `validarNovo()` (novo, exportado): valida
  `novo` como **booleano estrito** (rejeita `"true"`, `1`, `"on"`, etc. com
  400; `null`/`undefined` = "não mexe"). Chamado no POST e no update
  compartilhado (PUT/PATCH). `montarPayload()` só grava `novo` quando é
  booleano de verdade (coluna é NOT NULL). `SELECT_COM_JOINS` usa `*`, então
  `novo` já volta no GET sem mudança. **RPCs `registrar_venda`/`cancelar_venda`
  intocadas.**
- `supabase/migration_063_estoque_novo.sql` — novo (não executado).

**Tipos**
- `src/features/estoque/types.ts` — `Estoque.novo?: boolean` e `'novo'` no
  `EstoqueInput` Pick.

**Frontend**
- `src/styles/theme.css` — tokens novos `--info`/`--info-bg` (roxo → Paralela)
  e `--accent-alt`/`--accent-alt-bg` (azul → Novo), no `:root` e no
  `@theme inline`. Pesquisei antes: não havia equivalente (o roxo de marca
  #5b3df0 foi aposentado); `info` o retoma.
- `src/features/estoque/gaveta/VarianteCard.tsx` — badge "Novo" (azul) quando
  `item.novo === true`; Paralela passa de contorno neutro pra roxo `info`;
  comentário de cabeçalho atualizado (a limitação documentada deixou de existir).
- `src/features/estoque/gaveta/EditarGavetaDialog.tsx` — **novo**. Edita
  nome/categoria/ícone (espelha o form de "Nova gaveta" do GavetaList) e exclui
  com confirmação (T13) que deixa explícito: **nenhuma peça é apagada, voltam
  pra "Itens não agrupados"**. Único `accent-cta` = "Salvar alterações";
  excluir é `danger` textual; botão de confirmar exclusão é `destructive`.
- `src/features/estoque/gaveta/GavetaDetail.tsx` — botão ghost "Editar gaveta"
  no cabeçalho abre o dialog; ao excluir, volta pra listagem (`onVoltar`).
  (A edição inline do título por clique continua existindo.)
- `src/features/estoque/EstoqueView.tsx` — toggle "Estado de uso" (Usada/Nova)
  no form da peça, ligado a `formData.novo`; incluído em `EMPTY_FORM` e no
  populate de edição. O payload é `{...formData}`, então flui automático.

**Infra de teste**
- `src/test/setup.ts` — polyfill guardado de `window.matchMedia` (o efeito
  Magnetic do animate-ui usa; jsdom não implementa). Inócuo no environment node
  (guardado por `window`). Antes cada teste de componente com Button repetia
  esse mock inline.

## Testes (novos)

- `src/server/routes/estoque.novo.test.ts` — `validarNovo` + `montarPayload`
  (booleano estrito, nunca grava null/coerção).
- `src/features/estoque/gaveta/VarianteCard.badges.test.tsx` — "Novo" só com
  `novo:true`; Paralela usa `info`; Original não rouba `info`.
- `src/features/estoque/gaveta/EditarGavetaDialog.test.tsx` — pré-preenche;
  bloqueia salvar vazio; payload correto; exclusão só após confirmação.

## Como rodar os testes NESTE ambiente (importante)

O ambiente está com pouca RAM livre; o pool padrão de threads do Vitest
(1 worker por CPU, cada um com heap próprio) **estoura (SIGABRT/OOM)**, e o
mesmo vale pra `tsc --noEmit` (lint) e `vite build` do projeto inteiro. Recipe
que funciona — worker único e excluindo worktrees irmãos (contaminam com cópias
do React, ver memória do projeto):

```bash
npx vitest run <caminhos> --pool=forks --maxWorkers=1 --exclude "**/.claude/worktrees/**"
```

Resultados obtidos:
- Fase 2A (3 arquivos de teste): **13/13 passam** (5 em `estoque.novo.test.ts`,
  4 em `VarianteCard.badges.test.tsx`, 4 em `EditarGavetaDialog.test.tsx`).
- Regressão da área tocada (EstoqueView.tabela, estoque route, RegistrarUnidade):
  **39/39 passam**.

## Verificação e lacunas

- **Backend** sobe limpo (`preview_logs` sem erro de servidor) — `estoque.ts`
  compila e roda.
- **Frontend**: os módulos editados (`VarianteCard`, `EditarGavetaDialog`,
  `EstoqueView` via imports) foram transformados e renderizados com sucesso
  pelo Vitest/Vite nos testes — sinal de compilação.
- **Não rodou:** `tsc --noEmit` (lint) e `vite build` completos — ambos OOM
  neste ambiente, não por causa do código. Recomendo rodar num ambiente com
  mais RAM antes do deploy.
- **Não rodou:** E2E logado da tela de gaveta (dev server não retornou dados —
  envs/timing). Sugiro smoke manual pós-migration: criar/editar/excluir gaveta
  e marcar uma peça como "Nova" pra ver o badge azul e o roxo de Paralela.

## Notas de conformidade

- Frontend **não** acessa Supabase direto — tudo via rotas Express
  (`estoqueApi`, `gavetasApi`) e hooks.
- Código commitado (`7a5a074`) e publicado na branch de handoff; **SQL e deploy
  não executados**.
- Regra "1 accent por superfície" respeitada no dialog novo.
- Invariante preservada: excluir gaveta **solta** as peças, nunca apaga.
