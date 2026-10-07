# Playbook de Geração e Qualidade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Registrar no projeto um método permanente para refinar prompts, gerar UI de qualidade, tratar microinterações e erros, usar Codex/subagents e validar vibecoding com evidências.

**Architecture:** `AGENTS.md` contém o contrato curto e obrigatório; `docs/AI_GENERATION_PLAYBOOK.md` contém o guia detalhado e referenciado. `CLAUDE.md`, `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md` continuam sendo fontes especializadas sem duplicação integral.

**Tech Stack:** Markdown, Codex/Claude Code, React/Vite/TypeScript/Tailwind, Express, Supabase/Postgres, Vitest e Playwright.

**Spec:** Pedido do usuário nesta conversa e pesquisa em fontes oficiais de OpenAI, W3C, Apple, Material, GOV.UK, NN/G e Microsoft Research.

## Global Constraints

- Alterar somente documentação de governança nesta tarefa.
- Não modificar dependências, banco, código ou dados reais.
- Manter o fluxo `Prompt → prompt-master → execução → verificação`.
- Usar critérios de qualidade proporcionais ao risco.

## Review Focus

- O protocolo não pode obrigar carregamento indiscriminado de todas as skills.
- As recomendações de acessibilidade, motion e erros precisam ser verificáveis.
- As instruções de subagents precisam impedir edição concorrente e escopo difuso.
- Vibecoding deve ser apresentado como loop com evidência, não como aceitação automática de código.

### Task 1: Criar o playbook detalhado

**Files:**
- Create: `docs/AI_GENERATION_PLAYBOOK.md`

- [x] Registrar prompt refinement, UI/UX, microinterações, componentes, erros, Codex, subagents e vibecoding.
- [x] Incluir referências externas e Definition of Done.

### Task 2: Ligar o playbook ao contrato

**Files:**
- Modify: `AGENTS.md`

- [x] Adicionar o protocolo permanente e o link para o playbook.
- [x] Preservar regras existentes e não duplicar documentação especializada.

### Task 3: Validar documentação

**Files:**
- Test: `AGENTS.md`, `docs/AI_GENERATION_PLAYBOOK.md`

- [x] Executar `git diff --check`.
- [x] Confirmar caminho canônico e `git status --short --branch`.
- [x] Revisar diff e confirmar ausência de alterações na aplicação.
