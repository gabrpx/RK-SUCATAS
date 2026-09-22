# Plano de implementação — Estoque Preview: grande operação

> **Escopo:** somente a preview local. Sem banco, API, rota real, commit ou deploy.

**Objetivo:** reconstruir a preview do estoque com uma fonte única, dados reais demonstrativos e fluxos locais completos de adicionar, editar, arquivar e organizar Unidades.

**Arquitetura:** uma store imutável em `inventoryPreviewModel.ts` mantém categorias, Peças e Unidades. Seletores puros derivam busca, métricas e planta física. A UI React mantém essa store em memória, usando modal para criação e painel lateral para edição.

**Stack:** React 19, TypeScript, Tailwind, Radix/Dialog existente, Lucide e Vitest/Testing Library.

---

### Tarefa 1: Consolidar o modelo demonstrativo

**Arquivos:**
- Criar: `src/features/estoque-preview/inventoryPreviewModel.ts`
- Criar: `src/features/estoque-preview/inventoryPreviewModel.test.ts`
- Remover ao final, se sem consumidores: `catalogoDemo.ts`, `catalogoDemo.test.ts`, `physicalStockModel.ts`, `physicalStockModel.test.ts`, `estoquePreviewModel.ts`, `estoquePreviewModel.test.ts`

1. Escrever testes para: três categorias reais; quantidade RK-792 desdobrada em três SKUs; origem/foto opcionais; busca por todos os campos; métricas derivadas; mapa derivado; adicionar; editar; arquivar; restaurar.
2. Rodar o teste focado e confirmar falha pela ausência do novo módulo.
3. Implementar tipos, seed auditado, seletores e comandos imutáveis mínimos.
4. Rodar novamente e confirmar aprovação.

### Tarefa 2: Reconstruir a casca, atendimento e lista

**Arquivos:**
- Modificar: `src/features/estoque-preview/EstoquePreview.tsx`
- Modificar: `src/features/estoque-preview/EstoquePreview.test.tsx`

1. Substituir expectativas antigas por testes da nova identidade, métricas reais, categorias reais, busca e alternância cartões/lista.
2. Rodar o teste e confirmar falha.
3. Construir casca plana e densa, cabeçalho, CTA azul, indicadores derivados, abas acessíveis e atendimento com cartões/lista.
4. Rodar o teste focado.

### Tarefa 3: Implementar criação e edição local

**Arquivos:**
- Criar: `src/features/estoque-preview/InventoryComposer.tsx`
- Criar: `src/features/estoque-preview/InventoryUnitDrawer.tsx`
- Modificar: `src/features/estoque-preview/EstoquePreview.tsx`
- Modificar: `src/features/estoque-preview/EstoquePreview.test.tsx`

1. Escrever testes de abrir composer, preencher uma Unidade, revisar/salvar e abrir/editar uma Unidade existente.
2. Confirmar RED.
3. Implementar composer em quatro etapas com resumo lateral e drawer de Unidade/Peça.
4. Confirmar GREEN e revisar foco/rótulos.

### Tarefa 4: Implementar organização, mapa e arquivo

**Arquivos:**
- Modificar: `src/features/estoque-preview/EstoquePreview.tsx`
- Modificar: `src/features/estoque-preview/InventoryUnitDrawer.tsx`
- Modificar: `src/features/estoque-preview/EstoquePreview.test.tsx`

1. Escrever testes para uma prateleira por vez, oito seções, categoria editável, mudança de endereço, arquivamento com confirmação e restauração.
2. Confirmar RED.
3. Implementar fila Organizar, seletor de prateleira, mapa derivado e aba Arquivados.
4. Confirmar GREEN.

### Tarefa 5: Refinar microinterações e validar

**Arquivos:**
- Modificar: `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`
- Atualizar: `docs/auditorias/estoque-preview-2026-09-21/AUDITORIA.md`

1. Aplicar estados hover/focus/disabled, feedback de sucesso e desfazer sem animação excessiva.
2. Adicionar ao skill local o critério geral confirmado de consistência entre vistas derivadas.
3. Rodar testes focados, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build` e `git diff --check`.
4. Verificar visualmente no localhost em desktop e largura móvel; salvar evidências na pasta da auditoria.
5. Revisar o diff, confirmar que arquivos críticos e dados reais não foram alterados.

