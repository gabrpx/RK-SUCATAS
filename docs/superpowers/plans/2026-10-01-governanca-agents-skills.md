# Governança de AGENTS e Skills — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tornar o contrato de agentes do RK Sucatas mais claro, acionável e seguro, incorporando roteamento de skills, uso disciplinado de subagents, níveis de atenção e verificações proporcionais ao risco.

**Architecture:** O `AGENTS.md` continuará sendo o contrato transversal do repositório. `CLAUDE.md` continuará contendo regras específicas do Claude Code, enquanto `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md` permanecem como contexto e processo detalhados. Skills serão referenciadas por gatilhos e não copiadas integralmente para o contrato.

**Tech Stack:** Markdown, Codex/Claude Code, Agent Skills, React/Vite/TypeScript/Tailwind, Express, Supabase/Postgres, Vitest.

**Spec:** Requisitos do usuário nesta conversa; fontes oficiais OpenAI, Anthropic e Agent Skills consultadas em 2026-10-01.

## Global Constraints

- Não alterar código da aplicação nesta tarefa.
- Não remover ou substituir regras existentes do `AGENTS.md`.
- Não permitir que subagents editem simultaneamente o mesmo arquivo.
- Não autorizar operações destrutivas, SQL real, deploy, commit ou push sem autorização explícita.
- Manter a distinção entre instruções permanentes, skills sob demanda e planos de execução.

## Review Focus

- O novo roteamento não pode obrigar o agente a carregar todas as skills em toda tarefa.
- Os níveis de atenção precisam distinguir UI simples de vendas, caixa, autenticação e banco.
- A delegação deve impedir subagents concorrentes no mesmo arquivo ou domínio crítico.
- O contrato não pode contradizer `CLAUDE.md`, `docs/AI_CONTEXT.md` ou `docs/AI_WORKFLOW.md`.
- As instruções precisam continuar utilizáveis por Codex e Claude Code.

### Task 1: Atualizar o contrato transversal

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: regras atuais de identidade, segurança, banco, git e conclusão.
- Produces: seções de roteamento de skills, subagents, níveis de atenção, workflow e fontes.

- [x] Adicionar as seções sem duplicar o conteúdo detalhado dos documentos existentes.
- [x] Validar consistência textual com `CLAUDE.md`, `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md`.
- [x] Revisar o diff e confirmar que não há alteração em código ou configuração da aplicação.

### Task 2: Verificar a documentação

**Files:**
- Test: `AGENTS.md`, `CLAUDE.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md`

- [x] Executar busca por termos conflitantes (`rg`) e revisar os resultados.
- [x] Executar `git diff --check`.
- [x] Confirmar `git status --short --branch` e identidade do projeto.
