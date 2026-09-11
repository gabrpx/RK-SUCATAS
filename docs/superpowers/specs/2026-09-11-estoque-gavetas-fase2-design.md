# Estoque por Gavetas — Fase 2 (design)

**Data:** 2026-09-11
**Branch base:** `main` (Fase 1 já mergeada — commit `b2d9757`)
**Pré-requisitos de schema:** `migration_061_gavetas` já rodada em produção.
**Continuação de:** [Fase 1](2026-09-10-estoque-gavetas-fase1-design.md)

## Objetivo

Fechar duas lacunas deixadas na Fase 1, ambas de UI/dados sobre a fundação
que já existe (tabela `gavetas`, `estoque.gaveta_id`, rotas CRUD):

1. **Editar / excluir gaveta pela interface.** O backend (`PATCH`/`DELETE`
   `/api/gavetas/:id`) já existe e está testado; falta a UI. Hoje só dá pra
   *criar* gaveta e mover peças pra dentro/fora — não há como renomear, trocar
   categoria/ícone, nem excluir uma gaveta pela tela.
2. **Badges com cor própria + campo "Novo".** Na Fase 1 os badges de
   `VarianteCard` foram mapeados nos 4 tokens semânticos que já existiam
   (`accent`/`warning`/`danger` + contorno neutro pra Paralela) e o badge
   "Novo" foi **omitido** por não ter dado real por trás (ver comentário em
   `VarianteCard.tsx:6-17`). A Fase 2 dá cor própria a cada badge e cria o
   dado que falta.

### Fora de escopo (Fase 3+)

- Mover em lote otimizado (hoje `AdicionarPecasGaveta` chama `mover` N vezes,
  uma por peça — funciona, mas não é atômico). Continua como está.
- Toast de erro no fluxo de mover (o hook expõe `error`, mas ainda não vira
  toast). Item pequeno, agrupar com o batch quando for feito.
- Qualquer migração automática de família → gaveta. Segue proibido: a
  organização é 100% manual, feita pelo dono.

### Invariantes que continuam valendo (não renegociar)

- Nada da lógica de negócio de "famílias" é reaproveitado; famílias coexiste.
- O estoque é sempre o mesmo — nada é recadastrado nem duplicado.
- Preço pertence à **unidade**; variante mostra faixa mín~máx computada.
- Excluir gaveta **solta** as peças (`gaveta_id = null`), nunca apaga peça.
- Design: no máximo **um** botão accent preenchido por superfície (modal com
  scrim conta como superfície própria — precedente `DeclaracaoVendaModal`).
- Cor sempre carrega significado; proibido hex cru fora de `theme.css`.

---

## Frente 1 — Editar / excluir gaveta (UI)

### O que já existe (não mexer no backend)

- `PATCH /api/gavetas/:id` — atualiza `nome`/`categoria_id`/`icone`, valida
  nome não-vazio, 404 se a gaveta não existe (`maybeSingle` + guard).
- `DELETE /api/gavetas/:id` — solta as peças (`estoque.gaveta_id = null`) e
  depois apaga a gaveta; idempotente.
- Hooks `useAtualizarGaveta` e `useExcluirGaveta` (`gaveta/hooks.ts`) já
  chamam essas rotas e fazem `refreshData()`.

O trabalho da Fase 1 parou exatamente na UI. Nenhum endpoint novo, nenhuma
migration.

### Componentes

**1.1 `EditarGavetaDialog.tsx`** (novo, em `gaveta/`)

- Reaproveita `components/ui/Modal` (mesmo padrão de `AdicionarPecasGaveta`).
- Props: `{ gaveta: Gaveta; onFechar: () => void }`.
- Campos: `nome` (obrigatório), `categoria_id` (select de categorias
  existentes — reusar o mesmo select já usado no cadastro de peça),
  `icone` (emoji opcional, input curto — igual ao usado na criação).
- Botão de confirmar: **accent** (é o único CTA preenchido do modal), label
  "Salvar alterações". Cancelar = ghost/outline.
- Ao confirmar: `useAtualizarGaveta().atualizar(id, payload)` → fecha no
  sucesso; em erro, exibe a mensagem inline (o hook já expõe `error`).

**1.2 Excluir — com confirmação (T13)**

- Ação de excluir mora **dentro** do `EditarGavetaDialog` como ação
  destrutiva secundária (link/botão `danger` discreto no rodapé), não na
  linha da listagem — evita exclusão acidental num toque e mantém a listagem
  limpa (1 accent por superfície continua respeitado: o accent é o "Salvar";
  excluir é `danger` textual, não preenchido).
- Clicar em "Excluir gaveta" abre confirmação (padrão T13 —
  `docs/mockups/T13-estados-preventivos.png`) deixando explícito que **as
  peças não somem, só saem da gaveta** ("As N peças voltam para 'Itens não
  agrupados'."). Só confirma com ação explícita.
- Confirmado: `useExcluirGaveta().excluir(id)` → fecha o dialog e volta pra
  listagem (a peça reaparece em "Itens não agrupados" via `refreshData`).

**1.3 Ponto de entrada**

- No cabeçalho do `GavetaDetail` (onde já vive o "+ Adicionar peças"),
  somar um botão **ghost** de editar (ícone `Pencil` lucide, `min-h-11` no
  mobile) que abre o `EditarGavetaDialog`. Mantém o "+ Adicionar peças" como
  o único accent do cabeçalho.
- **Não** adicionar ação de editar/excluir na `GavetaRow` da listagem nesta
  fase — a entrada é sempre via detalhe, pra não poluir a linha nem competir
  com o gesto de navegação (chevron).

### Testes

- `EditarGavetaDialog.test.tsx`: renderiza com os dados da gaveta
  pré-preenchidos; bloqueia salvar com nome vazio; chama `atualizar` com o
  payload certo; o fluxo de excluir pede confirmação antes de chamar
  `excluir`.
- Reusar o mock de hooks já montado nos testes da Fase 1.

---

## Frente 2 — Badges com cor própria + campo "Novo"

### Problema

`VarianteCard` hoje mapeia 5 badges do mockup em 4 tokens (comentário em
`VarianteCard.tsx:6-17`): Original=`accent`, ML=`warning`, Shopee=`danger`,
Paralela=contorno neutro, e **Novo omitido** (sem dado real). O mockup pede 5
matizes distintos (Original laranja / Paralela roxo / Novo azul / ML amarelo /
Shopee rosa). Faltam dois matizes (roxo, azul) e o dado do "Novo".

### 2.1 Tokens de tema (novos)

Adicionar em `src/styles/theme.css`, seguindo o padrão dos pares já
existentes (`--warning`/`--warning-bg`, `--danger`/`--danger-bg`), expostos no
bloco `@theme inline` como `--color-*`:

| Badge     | Token novo            | Significado fixo                          |
|-----------|-----------------------|-------------------------------------------|
| Paralela  | `--info` / `--info-bg`   | peça paralela (não-original) — **roxo**   |
| Novo      | `--accent-alt` / `--accent-alt-bg` | peça nova (não-usada) — **azul** |

- Regras do design system: cada uma tem propósito **fixo** (Paralela vs
  Original; Novo vs Usado). Não são cor decorativa.
- Original continua em `accent` (laranja de marca — já é a cor de
  `condicao='original'` em `EstoqueView`, mantém consistência).
- ML continua `warning` (amarelo), Shopee continua `danger` (rosa). Não mudam.
- Definir os hex no `:root` e o mapeamento `--color-...` no `@theme inline`;
  gerar classes `bg-info-bg text-info` / `bg-accent-alt-bg text-accent-alt`.
  **Nenhum hex cru nos componentes.**
- Verificar contraste dos dois novos matizes no tema (fundo escuro do app)
  antes de fechar — mesmo cuidado que o `theme.css` já documenta pro
  deslocamento de `warning`.

### 2.2 Campo "Novo" (dado real)

O tipo `Estoque` **não** tem flag novo/usado. `condicao_ml` existe, mas mora
no **vínculo de anúncio ML** (`VinculoMl`), é o estado enviado pra um anúncio
específico — não é atributo da peça. Portanto **não serve** de fonte pro
badge. Precisa de campo próprio.

- **Migration nova `062_estoque_novo.sql`** (numeração: usar **062**, não 061
  — ver nota de colisão abaixo):
  ```sql
  alter table estoque add column novo boolean not null default false;
  ```
  - `default false` → toda peça existente vira "usada" (comportamento seguro:
    hoje o negócio é sucata/usado; "Novo" é a exceção que o dono marca).
  - Degrada com segurança: sem a coluna, o backend só não devolve o campo e o
    badge não aparece — nada quebra (mesmo padrão dos outros campos opcionais).
- Tipo: adicionar `novo?: boolean` em `Estoque` (opcional pra tolerar payload
  antigo em cache, igual aos campos da migration_043).
- Backend: incluir `novo` no `SELECT` de estoque e aceitar no
  create/update de peça (rota `estoque.ts`).
- UI de edição da peça: um toggle "Peça nova" no formulário de peça
  (`RegistrarUnidadeDialog`/edição de variante) — marcação **manual** pelo
  dono, coerente com "organização 100% manual".

### 2.3 Render em `VarianteCard`

- Adicionar o badge "Novo" (`bg-accent-alt-bg text-accent-alt`) quando
  `item.novo === true`.
- Trocar Paralela do contorno neutro pra `bg-info-bg text-info` (roxo).
- Atualizar o comentário de cabeçalho do arquivo (linhas 6-17) — a limitação
  que ele documenta deixa de existir.

### Testes

- `gaveta/VarianteCard.test.tsx` (ou estender o existente): badge "Novo"
  aparece só com `novo: true`; Paralela usa a classe `info`; os 5 badges têm
  classes distintas.
- Teste de rota `estoque`: `novo` persistido no create/update e devolvido no
  GET.

---

## Nota operacional — colisão de numeração de migration

Produção tem **duas** migrations 061 já rodadas:
`migration_061_tarefa_imagens.sql` (veio da main/tarefas) e
`migration_061_gavetas.sql` (Fase 1). Nomes de arquivo diferentes, sem
conflito de arquivo, ambas aplicadas — mas a numeração ficou ambígua. **A
migration desta fase deve ser `062`**, e vale renumerar uma das duas 061
quando for conveniente pra desambiguar o histórico (não é bloqueante).

---

## Ordem de execução sugerida

1. **Frente 1** inteira (editar/excluir gaveta) — não precisa de migration,
   destrava valor imediato (hoje não dá pra corrigir o nome de uma gaveta).
2. **Frente 2.1** tokens de tema (roxo/azul) — isolado, verificável no preview.
3. **Frente 2.2** migration_062 + campo `novo` (backend + tipo + toggle na UI).
   → **avisar o dono pra rodar a migration_062 antes de subir o código** (a
   coluna degrada com segurança, mas o toggle só funciona depois de rodar).
4. **Frente 2.3** render dos badges + atualizar comentário do `VarianteCard`.

Cada frente é independente e verificável isoladamente no preview
(get_page_text/read_page + curl na API — o app faz polling contínuo, então
screenshot renderiza defasado).
