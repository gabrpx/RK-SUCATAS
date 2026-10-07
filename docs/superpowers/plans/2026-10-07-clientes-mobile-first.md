# Clientes: auditoria mobile-first e microinterações

## Objetivo

Corrigir as lacunas observadas em Clientes: transições abruptas, affordance de clique inconsistente, adaptação mobile que replica o desktop e espaçamento excessivo no formulário de cliente. Preservar contratos, identidade visual e comportamento funcional existente.

## Escopo

- Auditar header, abas, filtros/lista, painel/mapa, agenda, drawer de seleção de pedido e drawer de cadastro em 375px, 568px e desktop.
- Comparar padrões responsivos e microinterações com Estoque e Tarefas.
- Priorizar ações e informações em cards mobile; reduzir controles e espaços redundantes sem ocultar contexto necessário.
- Ajustar transições para feedback suave e respeitar `prefers-reduced-motion`.
- Garantir `cursor-pointer` em alvos clicáveis, sem aplicar em controles desabilitados ou não interativos.
- Registrar os dois padrões globais solicitados no `AGENTS.md`.

## Fora de escopo

- Alterações de API, schema, regras de negócio, identidade global, dependências ou telas fora de Clientes.
- Mudar conteúdo/produto além do necessário para acomodar a hierarquia mobile.

## Critérios de aceite

- Em 375px e 568px não há overflow horizontal acidental; header, filtros, lista e drawers cabem e mantêm alvos de toque utilizáveis.
- Filtros são apresentados numa hierarquia própria para mobile, sem controles espremidos ou quebra inconsistente.
- Cards de cliente mostram dados em ordem legível, com ações acessíveis sem competir com as informações principais.
- Os drawers não deixam grandes áreas vazias causadas por espaçamento/layout; conteúdo e rodapé permanecem utilizáveis.
- Movimento de entrada/saída e hover/focus é consistente, breve e desativado/atenuado com movimento reduzido.
- Elementos clicáveis têm affordance visual e cursor coerentes; elementos desabilitados mantêm estado correto.
- Testes relacionados, build/lint disponíveis, `git diff --check` e conferência visual em viewport mobile/desktop executados ou limitações documentadas.

## Riscos e validação

- Há muitas alterações pré-existentes no workspace; manter alterações fora do escopo intactas.
- Não alterar arquivos críticos de API/estado/banco.
- Usar testes locais dos componentes alterados e browser preview em `http://127.0.0.1:3001/clientes`.
