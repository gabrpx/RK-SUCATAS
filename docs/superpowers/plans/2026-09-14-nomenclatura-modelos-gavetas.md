# Nomenclatura inteligente de modelos e unidades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolver a nomenclatura exibida dos modelos de moto a partir da árvore real do catálogo e nomear automaticamente unidades novas com a variação correspondente, mantendo a Organização assistida disponível como prévia segura.

**Architecture:** A camada pura em `src/features/motos` reconstruirá o caminho do catálogo, removerá níveis repetidos e encontrará a variação filha/ano sem alterar os nomes persistidos. `VarianteCard` fornecerá essa sugestão ao formulário de unidade; nomes preenchidos pelo funcionário continuarão prioritários. A Organização assistida permanecerá isolada em um componente de prévia, sem movimentação real nesta entrega.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest, Animate UI/Radix, catálogo de modelos carregado pelo backend Express/Supabase.

**Spec:** Requisito confirmado na conversa: uma gaveta genérica como “Tanque de CG 150” deve exibir unidades de 2004–2008 como “Carburada” e aplicar o mesmo princípio às outras variações cadastradas.

## Global Constraints

- Não alterar dados reais do Supabase, migrations aplicadas ou nomes persistidos nesta entrega.
- O nome manual da unidade sempre tem prioridade sobre a sugestão automática.
- Só sugerir uma variação quando a árvore do catálogo fornecer uma correspondência segura.
- Não hardcodar cada motocicleta; usar `parent_id`, `nome` e `ano` existentes em `modelos_moto`.
- Preservar a Organização assistida como prévia demonstrativa; não mover itens no banco.
- Não incluir a alteração pré-existente de `src/server/routes/estoque.test.ts` no commit.

### Task 1: Formalizar resolução de modelo e variação

**Files:**
- Modify: `src/features/motos/nomeModelo.ts`
- Test: `src/features/motos/nomeModelo.test.ts`

**Interfaces:**
- Produces `formatarNomeModeloMoto(modelo, modelos): string` para título completo.
- Produces `obterNomeVariacaoModelo(modelo, modelos): string | null` para nome curto de unidade.

- [x] **Step 1: Write failing tests** para caminhos reais como `Honda > 150 > CG 150 > CG 150 Carburada`, `CG 150 Mix`, `CG 125 Titan 99`, `Bros NXR 160` sem variação e nomes manuais preservados fora do helper.
- [x] **Step 2: Run the focused test**; o runner falhou por erro de infraestrutura do Vite/EPERM ao criar `.vite-temp`, registrado na entrega.
- [x] **Step 3: Implement minimal pure resolver** que elimina prefixos repetidos, normaliza caixa apenas para apresentação e extrai o sufixo específico do nó filho sem lista por marca.
- [x] **Step 4: Revisar** casos de ano `2004-2008`, `2004 a 2008`, `2008+` e ano ausente nos testes e na captura do catálogo real.

### Task 2: Aplicar nomenclatura inteligente na tela de gaveta

**Files:**
- Modify: `src/features/estoque/gaveta/VarianteCard.tsx`
- Modify: `src/features/estoque/gaveta/UnidadeForm.tsx`
- Modify: `src/features/estoque/gaveta/UnidadeRow.tsx`
- Test: `src/features/estoque/gaveta/UnidadeRow.test.tsx`

**Interfaces:**
- `UnidadeForm` recebe `nomeSugerido?: string | null`.
- `UnidadeRow` continua aceitando `nomePadrao`, agora com prioridade para nome manual e fallback de variação.

- [x] **Step 1: Cobrir** unidade sem nome, unidade com nome manual e formulário novo com sugestão editável; os testes existentes de `UnidadeRow` cobrem a precedência visual.
- [x] **Step 2: Executar validação**; runner bloqueado pelo mesmo problema de Vite/EPERM.
- [x] **Step 3: Passar `modelos` pelo `useCatalogos`** em `VarianteCard`, calcular `nomeSugerido` a partir de `item.modelo_moto_id` e entregar o valor ao row/form.
- [x] **Step 4: Implementar precedência**: `unidade.nome` manual > sugestão de variação > nome completo da variante; edição existente nunca recebe sugestão por cima de valor salvo.
- [x] **Step 5: Revisar** visualmente o texto completo em desktop/mobile e manter o fallback sem truncamento.

### Task 3: Corrigir exibição completa do catálogo no restante do estoque

**Files:**
- Modify: `src/features/estoque/EstoqueView.tsx`
- Modify: `src/features/estoque/gaveta/buscaGavetas.ts`
- Test: `src/features/motos/nomeModelo.test.ts`

- [x] **Step 1: Reproduzir** o caminho repetido com a árvore real do Supabase.
- [x] **Step 2: Substituir** usos diretos de `modelo_moto.nome` nas células visíveis pelo formatador central.
- [x] **Step 3: Verificar** que famílias com múltiplos modelos continuam mostrando a contagem.
- [x] **Step 4: Rodar type-check**; os erros restantes estão em arquivos preexistentes fora deste escopo.

### Task 4: Manter e validar a Organização assistida

**Files:**
- Review/modify: `src/features/estoque/gaveta/OrganizacaoAssistidaPreview.tsx`
- Review/modify: `src/features/estoque/gaveta/GavetaList.tsx`
- Test: `src/features/estoque/gaveta/GavetaList.test.tsx`

- [x] **Step 1: Validar** o botão “Ver sugestões” e o título “Organização assistida” na árvore acessível do preview.
- [x] **Step 2: Confirmar** o dropdown Animate UI e seus estados de confiança na estrutura da tela.
- [x] **Step 3: Confirmar** que a cópia da prévia informa que nenhuma peça será movida.
- [x] **Step 4: Auditar responsividade** e corrigir sobreposição dos botões flutuantes com `z-index` dedicado no modal.

### Task 5: Verificação, documentação e entrega

**Files:**
- Modify: `docs/superpowers/plans/2026-09-14-nomenclatura-modelos-gavetas.md`

- [x] **Step 1: Run** `git diff --check`.
- [x] **Step 2: Run** `node_modules/.bin/tsc.cmd --noEmit`; o comando executou e reportou somente erros preexistentes em outras áreas. O Vitest permaneceu bloqueado por EPERM no `.vite-temp`.
- [x] **Step 3: Atualizar** este plano com o resultado real das validações e limitações.
- [ ] **Step 4: Commit** apenas arquivos desta entrega com mensagem `feat(estoque): resolve variacoes de motos nas unidades`.
- [ ] **Step 5: Push** para `origin/codex/estoque-gavetas-acabamento`.
- [x] **Step 6: Abrir/atualizar** o preview e capturar a prévia; a auditoria encontrou e corrigiu a sobreposição do modal pelos controles flutuantes.
