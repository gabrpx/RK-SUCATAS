# Visitas agendadas para clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Criar visitas como Tarefas vinculadas a clientes e mostrar as visitas pendentes no Painel de Clientes imediatamente após salvá-las.

**Architecture:** A lista e a ficha do cliente abrem um formulário pequeno de visita. O formulário usa a API e a estrutura persistida de Tarefas; após resposta válida, atualiza o estado compartilhado consumido pela Agenda e pelo Painel. Nenhuma tabela, rota ou contrato novo é necessário.

**Tech Stack:** React 19, TypeScript, Express, `tarefasApi`, estado local do hook `useTarefas`, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-vendas-avulsas-e-visitas-clientes-design.md`

## Global Constraints

- Criar visita como Tarefa com `tipo: 'visita'` e `cliente_id`.
- A ação exige a permissão `tarefas.criar`.
- Reutilizar `POST /api/tarefas` e `tarefasApi.listarResponsaveisPossiveis()`.
- Não criar tabela, rota, RPC ou migração específica de visitas.
- A visita só entra no estado local depois que a API confirmar a gravação.
- Não gravar tarefas de teste em dados reais.
- Não adicionar ou executar testes automatizados sem pedido explícito.

## Review Focus

1. Cliente precisa ser enviado como `cliente_id` mesmo que a visita tenha título próprio; validar que aparece como cliente relacionado no painel.
2. Data/hora local deve ser convertida para ISO sem trocar o dia no fuso de São Paulo; validar valor de verão/inverno e fim do dia.
3. Título, horário ou responsável ausente devem impedir submissão e mostrar orientação em português.
4. Usuário sem `tarefas.criar` não deve ver uma ação de agendamento habilitada.
5. Resposta com falha ou timeout não pode adicionar visita otimista ao Painel; sucesso não pode duplicar a tarefa na lista.

---

### Task 1: Criar formulário de visita associado a cliente

**Files:**
- Create: `src/features/clientes/components/AgendarVisitaModal.tsx`
- Read: `src/features/tarefas/api.ts`
- Read: `src/features/tarefas/types.ts`

**Interfaces:**
- Props: `cliente: Pick<Cliente, 'id' | 'nome'>`, `open: boolean`, `onOpenChange(open: boolean)`, `onCreated(tarefa: Tarefa)`.
- Payload `tarefasApi.criar`: `{ titulo, descricao: null, prazo: string ISO, atribuido_para: string, cliente_id: cliente.id, prioridade: 'media', tipo: 'visita', itens: [] }`.

- [ ] **Passo 1: Criar modal acessível usando `Modal` e tokens/componentes existentes.**

  Mostrar o nome do cliente como contexto, campo de assunto obrigatório, entrada `datetime-local` obrigatória e seletor de responsável. Não aceitar data anterior ao instante atual.

- [ ] **Passo 2: Carregar responsáveis e definir o valor inicial.**

  Usar `tarefasApi.listarResponsaveisPossiveis()`. Pré-selecionar o usuário armazenado em `localStorage.user_id` se ele estiver na resposta; se não, selecionar o primeiro responsável permitido. Enquanto carregar, desabilitar salvar; em falha, oferecer nova tentativa.

- [ ] **Passo 3: Converter o horário local para `prazo` ISO com uma rotina única.**

  Interpretar os segmentos locais do campo sem anexar `Z` à string local e salvar `new Date(valorLocal).toISOString()`. Rejeitar valor inválido ou passado antes de chamar a API.

- [ ] **Passo 4: Criar tarefa e só chamar `onCreated` em sucesso.**

  Em `tarefasApi.criar`, enviar `tipo: 'visita'`, `cliente_id` fixo do `cliente` atual, `prioridade: 'media'`, título trimado, responsável e prazo. Em falha, manter modal aberto com mensagem amigável; em sucesso, chamar `onCreated(response.data)` e fechar.

- [ ] **Passo 5: Conferir tipos e ergonomia do formulário.**

  Rodar `node node_modules/typescript/bin/tsc --noEmit` e confirmar que o novo componente não inventa campos em `TarefaInput`.

### Task 2: Ativar agendamento pela lista/ficha e atualizar o estado compartilhado

**Files:**
- Modify: `src/features/clientes/ClientesView.tsx`
- Modify: `src/features/clientes/components/ClientesLista.tsx`
- Modify: `src/features/clientes/components/ClienteDrawer.tsx`
- Read: `src/features/tarefas/useTarefas.ts`

**Interfaces:**
- `ClientesLista` recebe `onAgendarVisita?: (cliente: ClienteOperacaoListaItem) => void`; sem callback, ação permanece indisponível. A tela só passa callback se `pode('tarefas.criar')`.
- O drawer ativo `ClienteDrawer` recebe o mesmo callback com `Cliente`; botão da ficha respeita a mesma permissão.
- `ClientesView` controla o cliente escolhido e atualiza tarefas via `agenda.setTarefas((atuais) => [tarefa, ...atuais])` sem incluir duplicatas por ID.

- [ ] **Passo 1: Ligar a ação “Visita” da lista a `onAgendarVisita`.**

  Reutilizar o botão existente na coluna de ações/cartão móvel. Não alterar sua hierarquia quando indisponível; preservar estado disabled, rótulo acessível e foco.

- [ ] **Passo 2: Ligar a ação de visita na ficha ativa do cliente.**

  A tela atual abre `ClienteDrawer`; `ClienteDetalheModal` permanece no fluxo legado. Reutilizar a prop `onAgendarVisita` e o botão `CalendarPlus` já existente no drawer, respeitando permissão e estados acessíveis. O callback abre o formulário para o cadastro atual.

- [ ] **Passo 3: Montar o modal a partir da tela Clientes e manter contexto de permissão.**

  Controlar um `clienteParaVisita: Cliente | null`. A lista operacional retorna dados parciais; ao selecionar um cliente nela, resolver o cadastro completo por `buscarCliente(id)` antes de abrir o modal. Na ficha, usar o objeto completo já carregado.

- [ ] **Passo 4: Atualizar a lista compartilhada sem duplicação após sucesso.**

  Em `onCreated`, usar `agenda.setTarefas` com um `Map` por `id` ou checagem de ID antes de inserir. Fechar e limpar o cliente selecionado. Não inserir quando o request falhar.

- [ ] **Passo 5: Validar lista, ficha e Painel no preview local.**

  Em `http://127.0.0.1:3001/clientes`, verificar ações habilitadas conforme permissão e abrir o formulário a partir da lista/ficha sem enviar uma criação à API real. Conferir que o formato recebido pelo Painel satisfaz os filtros existentes `tipo === 'visita'`, status `pendente` e `prazo` futuro/passado. Executar type-check e `git diff --check`.

### Task 3: Mostrar corretamente o horizonte da agenda no Painel

**Files:**
- Modify: `src/features/clientes/components/ClientesPainel.tsx`
- Modify: `src/features/clientes/components/ClienteDrawer.tsx`

**Critérios:**
- O Painel inclui visitas pendentes vencidas, de hoje e dos próximos sete dias; concluidas ficam fora.
- Visitas fora de hoje, incluindo atrasadas, exibem data e horário suficientes para não confundir dias diferentes; o resumo descreve corretamente o horizonte exibido.
- O estado vazio informa que o recorte é de hoje/próximos sete dias e mantém o caminho para a agenda completa.
- O texto da ficha não diz que visitas serão integradas futuramente depois da integração estar ativa.
- Preservar o layout/token do Painel e validar em `/clientes` sem criar dados reais.

### Task 4: Evitar que uma resposta antiga sobrescreva mudanças locais de Tarefas

**Files:**
- Modify: `src/features/tarefas/useTarefas.ts`
- Read: `src/features/tarefas/TarefasPreviewIntegrated.tsx`

**Critério:**
- Se uma busca de tarefas começou antes de uma criação/edição/conclusão/exclusão confirmada e sua resposta chegar depois, aplicar as mudanças locais posteriores sobre a resposta para a tela não perder estado recente.
- A API segue como fonte de dados remotos; nenhuma mutação deve ser perdida e nenhuma duplicata local deve ser introduzida.
- Preservar polling, tratamento de erro e API pública do hook (`tarefas`, `setTarefas`, `loading`, `error`, `refetch`).
