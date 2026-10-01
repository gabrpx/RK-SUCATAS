# Auditoria e prontidão da tela de Vendas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a tela nova de Vendas operacional e responsiva, cobrindo ações de movimentações, pendências/clientes, filtros e copy sem quebrar contratos existentes.

**Architecture:** Reutilizar as APIs e componentes já existentes do Caixa, Pendências, Clientes e Vendas. A tela nova receberá apenas a orquestração de estado/modal/refresh necessária; as RPCs de vendas e o modelo financeiro existente permanecem intactos.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Express, Vitest.

**Spec:** Requisitos diretamente fornecidos pelo usuário nesta conversa e AGENTS.md.

## Global Constraints

- Trabalhar somente em `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`.
- Preservar alterações locais existentes e não tocar em `package-lock.json`, `.env`, `dist/`, `node_modules/` ou migrations.
- O frontend usa a API Express; não acessar Supabase diretamente.
- Não substituir a atomicidade de `registrar_venda`/`cancelar_venda`.
- Reutilizar contratos existentes de `caixaApi`, `caixaPendenciasApi`, `clientesApi` e permissões granulares.
- Toda implementação nova deve ter item em `src/features/patchnotes/data.ts`, conforme CLAUDE.md.

## Review Focus

- Permissão sem criar/editar/excluir: os botões devem desaparecer ou ficar somente leitura, e erros de API não podem gerar estado falso.
- Lançamento vinculado a venda/recebimento: não oferecer exclusão destrutiva indevida; respeitar as rotas de reversão existentes.
- Pendência parcial/quitada: o saldo e o vínculo de cliente devem continuar consistentes após editar, receber ou reverter.
- Viewport estreita: nenhum controle deve forçar overflow horizontal acidental em 320–414px.
- Revalidação: toda mutação concluída deve refletir Movimentações/Pendências sem exigir reload manual.

### Task 1: Integração funcional de Movimentações e Pendências

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify or create: `src/features/vendas-preview/components/MovementActionDrawer.tsx`
- Modify or create: `src/features/vendas-preview/components/PendingCreateDrawer.tsx`
- Test: `src/features/vendas-preview/VendasPreview.test.tsx`
- Test: `src/features/vendas-preview/components/*.test.tsx` quando necessário

**Interfaces:**
- Consome: `caixaApi`, `caixaPendenciasApi`, `clientesApi`, `podeAtual`, tipos de Caixa e `InventoryDrawer`/inputs compartilhados.
- Produz: ações autorizadas para criar/excluir lançamento manual, criar pendência manual, vincular cliente e revalidar os dados da aba.

- [x] **Step 1: Write failing tests** para visibilidade/acionamento das ações, payloads de entrada/saída/pendência, cliente e refresh após sucesso.
- [x] **Step 2: Run targeted tests** e confirmar falha por ausência da ação.
- [x] **Step 3: Implementar o menor fluxo** reutilizando APIs/componentes existentes; não criar endpoint novo.
- [x] **Step 4: Rodar testes direcionados** e corrigir erros reais.

### Task 2: Simplificação de filtros e conteúdo

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Test: `src/features/vendas-preview/VendasPreview.test.tsx`

- [x] **Step 1: Adicionar teste falhando** que não encontra o filtro `Com saldo` e não encontra a copy de “dados reais”/“modo somente leitura” na tela embutida.
- [x] **Step 2: Confirmar falha.**
- [x] **Step 3: Remover apenas o filtro/copy solicitados**, preservando o filtro `Pagas` e os estados de permissão.
- [x] **Step 4: Confirmar testes direcionados.**

### Task 3: Correção mobile e acessibilidade

**Files:**
- Modify: `src/features/vendas-preview/VendasPreview.tsx`
- Modify: `src/features/vendas-preview/components/MovementActionDrawer.tsx`
- Modify: `src/features/vendas-preview/components/PendingCreateDrawer.tsx`
- Test: `src/features/vendas-preview/VendasPreview.test.tsx`

- [x] **Step 1: Fixar testes/asserções** para classes de largura, wrapping, foco e ações tocáveis.
- [x] **Step 2: Confirmar falha.**
- [x] **Step 3: Aplicar classes responsivas locais**, preservando scroll intencional das tabs e sem adicionar dependências.
- [x] **Step 4: Rodar testes, lint e build.**

### Task 4: Documentação e regressão final

**Files:**
- Modify: `src/features/patchnotes/data.ts`
- Test: suíte completa existente

- [x] **Step 1: Adicionar patchnote factual** sobre as ações disponíveis na nova tela.
- [x] **Step 2: Rodar `npm test`.** (equivalente direto com o Vitest local; o wrapper npm está quebrado no ambiente)
- [x] **Step 3: Rodar `npm run lint`.** (equivalente direto com `tsc`; erros preexistentes fora do escopo)
- [x] **Step 4: Rodar `npm run build`.** (equivalente direto com Vite; passou)
- [x] **Step 5: Revisar diff e confirmar que alterações locais pré-existentes foram preservadas.**

## Resultado da auditoria

Os fluxos de movimentação manual, exclusão protegida, criação de pendência e vínculo de cliente foram implementados e cobertos por testes. O modelo atual de `caixa_pendencias` representa somente valores a receber; uma conta a pagar real, com fornecedor, vencimento e status de pagamento, continua dependendo de decisão de produto e migration nova.
