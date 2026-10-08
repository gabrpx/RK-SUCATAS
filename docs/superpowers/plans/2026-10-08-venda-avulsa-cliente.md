# Venda avulsa vinculada a cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Registrar uma peça vendida sem estoque como venda vinculada ao cliente, com Caixa pela RPC existente e sem movimentar o inventário.

**Architecture:** A tela de venda adiciona um modo manual que envia nome e `estoque_id: null`. A API valida o payload e continua chamando a RPC `registrar_venda`, que já grava venda e Caixa atomicamente. A ficha do cliente abre esse mesmo fluxo com o cliente pré-selecionado.

**Tech Stack:** React 19, TypeScript, Express, `src/utils/api.ts`, Supabase RPC existente, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-vendas-avulsas-e-visitas-clientes-design.md`

## Global Constraints

- Preservar venda + Caixa na RPC `registrar_venda` atômica.
- Item sem estoque usa `estoque_id: null` e nome livre; nenhuma baixa ou ficha de estoque é criada.
- Seguir a forma de pagamento atual; fiado mantém os recebimentos posteriores.
- A ação exige a permissão `vendas.criar`.
- Não alterar RPC, migrations, schema, RLS, atomicidade ou regras de baixa.
- Não criar linhas financeiras de teste nem modificar dados reais.
- Não adicionar ou executar testes automatizados sem pedido explícito.

## Review Focus

1. Nome vazio ou só espaços não pode gerar venda. Verificar no modo manual da tela e na validação da API.
2. Quantidade zero/negativa, valor negativo ou forma de pagamento ausente deve ser rejeitada antes da RPC; valores válidos devem ser preservados sem arredondamento indevido.
3. Cliente inexistente ou banido não pode receber venda; manter a proteção atual e tratar `cliente_id` opcional.
4. Venda avulsa cancelada não pode incrementar estoque nem atualizar fichas; validar que continua indo somente por `cancelar_venda`.
5. Falha da RPC não pode atualizar o resumo/histórico local nem mostrar sucesso; não exibir erro de transporte bruto.

---

### Task 1: Ampliar o contrato de venda e permitir item sem estoque na API

**Files:**
- Modify: `src/features/vendas/types.ts`
- Modify: `src/features/vendas/api.ts`
- Modify: `src/server/routes/vendas.ts`

**Interfaces:**
- `VendaInput` passa a aceitar `estoque_id?: string | null` e `nome_item?: string | null`. Chamadas existentes de estoque continuam enviando `estoque_id` como antes.
- Para venda manual, o payload válido contém `estoque_id: null`, `nome_item` preenchido, `quantidade`, `valor_unitario`, `forma_pagamento_id` e o vínculo de cliente opcional.
- A rota chama a mesma RPC com `p_estoque_id: null`, `p_nome_item` com o nome informado e `p_valor_recebido: null`.

- [ ] **Passo 1: Inspecionar todos os consumidores de `VendaInput` e a chamada RPC atual.**

  Confirmar no repositório que a tela Vendas e integrações existentes continuam compatíveis com o campo opcional e que a rota já envia os 13 argumentos correntes.

- [ ] **Passo 2: Atualizar a validação da rota sem mudar o contrato financeiro.**

  Validar separadamente os dois casos:

  ```ts
  const estoqueId = typeof estoque_id === 'string' && estoque_id.trim() ? estoque_id : null;
  const nomeItem = typeof nome_item === 'string' ? nome_item.trim() : '';
  if (!estoqueId && !nomeItem) return res.status(400).json({ success: false, error: 'Informe o nome do item vendido' });
  if (estoqueId && nomeItem) return res.status(400).json({ success: false, error: 'Selecione um item do estoque ou informe um item avulso' });
  if (!estoqueId && (componente || unidade_id)) return res.status(400).json({ success: false, error: 'Item avulso não aceita componente ou unidade de estoque' });
  ```

  Manter validações atuais de quantidade, preço, pagamento, cliente banido e permissão. Passar `p_estoque_id: estoqueId`, `p_nome_item: estoqueId ? null : nomeItem` e `p_valor_recebido: null`; só avisar anúncios desatualizados quando houver `estoqueId`.

- [ ] **Passo 3: Ajustar o tipo e a função `vendasApi.registrar` para o payload manual.**

  Preservar os nomes públicos usados pelos chamadores atuais. Não criar outra rota, RPC ou chamada direta a `caixa`/`estoque`.

- [ ] **Passo 4: Rodar a validação de tipos e revisar a rota.**

  Executar `node node_modules/typescript/bin/tsc --noEmit`; separar erros já existentes dos arquivos tocados. Conferir que a rota não faz atualização de estoque no código da aplicação e que a chamada da RPC conserva os campos antigos.

### Task 2: Adicionar modo de venda manual e pré-seleção de cliente

**Files:**
- Modify: `src/features/vendas/VendasView.tsx`
- Modify: `src/features/vendas/types.ts`
- Modify: `src/features/clientes/ClientesView.tsx`
- Modify: `src/features/clientes/components/ClienteDrawer.tsx`

**Interfaces:**
- `NovaVendaDrawer` recebe `initialClienteId?: string | null`; ao abrir com um ID, seleciona o cadastro existente e o limpa ao fechar.
- O drawer ativo `ClienteDrawer` recebe `onRegistrarVenda?: (cliente: Cliente) => void`; oculta/desabilita a ação conforme `vendas.criar`.
- A tela Clientes monta o mesmo `NovaVendaDrawer` com o ID selecionado e chama `refreshData()` apenas após sucesso.

- [ ] **Passo 1: Adicionar estado explícito de origem da venda ao `NovaVendaDrawer`.**

  O modo inicial permanece “Estoque”. Um controle secundário troca para “Item sem estoque”. Ao alternar modos, limpar apenas a seleção que deixa de valer (item do estoque/unidade/componente versus nome manual); manter o cliente, forma de pagamento, observações e data já digitados.

- [ ] **Passo 2: Implementar os campos do modo manual.**

  Exibir nome do item, quantidade e preço unitário; reutilizar a seleção atual de cliente, forma de pagamento, data e observações. Exigir nome não vazio, quantidade positiva, preço não negativo e forma de pagamento. Uma confirmação cria exatamente uma linha de venda por RPC.

  ```ts
  const payload = modo === 'estoque'
    ? { estoque_id: itemSelecionado!.id, nome_item: null, quantidade: qtd, valor_unitario: valor, forma_pagamento_id: formaPagamentoId, cliente_id: clienteId }
    : { estoque_id: null, nome_item: nomeItem.trim(), quantidade: Number(quantidade), valor_unitario: Number(valorUnitario), forma_pagamento_id: formaPagamentoId, cliente_id: clienteId };
  ```

  Na implementação final manter também os campos atuais de modelo, cliente_nome, observações, data, componente e unidade para a ramificação de estoque.

- [ ] **Passo 3: Pré-selecionar o cliente quando o drawer for aberto pela ficha.**

  Resolver o ID contra a lista de clientes já carregada no `NovaVendaDrawer`. Se o cadastro não estiver na lista, não converter em venda sem vínculo; manter a falha visível e permitir nova tentativa.

- [ ] **Passo 4: Ligar a ação da ficha ao drawer compartilhado.**

  Em `ClientesView`, montar estado `clienteParaVenda`, abrir o drawer com o cliente selecionado, adicionar o callback no drawer ativo e fechar a ficha antes de abrir a venda. Após confirmação, chamar `refreshData()` e limpar o estado; não duplicar a lógica da tela Vendas.

- [ ] **Passo 5: Verificar os fluxos no preview sem gravar dados reais.**

  Abrir `/vendas` e `/clientes` em `http://127.0.0.1:3001`. Conferir alternância de modo, estados vazios, campos, permissões, pré-seleção de cliente e a chamada construída no navegador sem enviá-la a um banco real. Rodar type-check e `git diff --check`.


### Task 3: Reforçar o peso dos valores nos cards de métrica de Vendas

**Files:**
- Modify: `src/features/vendas-preview/components/OverviewMetrics.tsx` ou o componente compartilhado `MetricCard`, após confirmar se a mudança pode ficar restrita aos cards de Vendas.

**Aceite:**
- Os valores numéricos dos cinco cards do resumo de Vendas usam peso tipográfico visivelmente maior, sem alterar rótulos, dimensões, espaçamento ou outros cards fora de Vendas.
- Validar visualmente em `/vendas` sem gravar dados.
