# Vendas avulsas e visitas de clientes

**Status:** aprovada pelo usuário em 2026-10-08
**Data:** 2026-10-08
**Projeto:** RK Sucatas — NOVO SISTEMA

## Objetivo

Permitir que a equipe registre no histórico de um cliente uma venda de peça sem cadastro ou saldo no estoque e que agende visitas vinculadas ao cliente, exibidas na agenda do Painel de Clientes.

## Contexto confirmado no código

- `NovaVendaDrawer` hoje só seleciona itens com quantidade disponível e exige um `estoque_id` antes de enviar.
- `POST /api/vendas` também exige `estoque_id`, embora encaminhe `p_nome_item` à RPC `registrar_venda`.
- A migration 059 define a RPC vigente com `p_estoque_id` nulo e `p_nome_item` preenchido como venda avulsa. Nesse caminho, a RPC não atualiza estoque; cria a linha de venda e aplica a regra atual de Caixa e forma de pagamento na mesma transação. O cancelamento existente já trata venda sem estoque.
- A tabela/API de Tarefas aceitam `tipo`, `prazo` e `cliente_id`. A tela integrada de Tarefas não envia `cliente_id` na criação. A tela de Clientes tem ações de agendamento desativadas, embora o Painel já leia visitas do estado compartilhado de Tarefas.
- Não há alteração local nesta etapa nos módulos de Vendas, Tarefas, API ou banco. As alterações locais existentes em Clientes devem ser preservadas.

## Desenho aprovado em conversa

### 1. Venda sem estoque

- Manter a seleção atual de itens de estoque e oferecer um modo separado para informar um item vendido sem estoque.
- O formulário de item avulso coleta nome, quantidade, preço unitário e forma de pagamento, além do cliente e data já usados pelo fluxo de venda.
- A ação na ficha do cliente abre a venda com esse cliente pré-selecionado. O fluxo geral de Vendas continua permitindo selecionar o cliente.
- O frontend envia `estoque_id: null` e `nome_item`; não envia componente nem unidade física.
- A API valida nome não vazio, quantidade positiva, preço permitido pelo contrato atual, forma de pagamento e cliente não banido. Mantém a permissão `vendas.criar` e chama a mesma RPC `registrar_venda` com `p_valor_recebido: null`.
- A venda afeta o Caixa segundo a regra atual da forma de pagamento (pagamento à vista lança entrada; fiado segue o registro posterior de recebimentos) e não movimenta estoque.
- Uma venda manual representa um item por transação, usando a atomicidade existente. Para vários itens distintos, a equipe registra cada item como venda separada.
- Histórico, total gasto e cancelamento continuam usando os contratos atuais de `vendas` e `cancelar_venda`.

### 2. Visitas vinculadas ao cliente

- Ativar a ação “Agendar visita” na lista e na ficha do cliente, respeitando a permissão `tarefas.criar`.
- Abrir um formulário associado ao cliente escolhido. Campos: assunto da visita, data/hora e responsável. O responsável começa como o usuário atual e pode ser escolhido entre os responsáveis permitidos já expostos pela API de Tarefas.
- Criar uma Tarefa com `tipo: 'visita'`, `cliente_id`, `titulo`, `prazo`, `atribuido_para`, prioridade padrão `media` e sem checklist obrigatório.
- Inserir a resposta no estado compartilhado de Tarefas após sucesso, para refletir imediatamente na Agenda e no Painel. O Painel segue exibindo visitas do dia/próximos sete dias e avisos de visitas atrasadas a partir dos registros persistidos.
- Não criar uma tabela ou endpoint específico de visita.

## Regras, permissões e falhas

- Não mudar a RPC, migrations, atomicidade financeira ou regras de baixa de estoque.
- Venda manual usa `vendas.criar`; agendamento usa `tarefas.criar`. O botão/atalho não deve aparentar ação disponível quando a permissão estiver ausente.
- Falha ao registrar uma venda não deve atualizar o histórico local nem exibir sucesso. Falha ao criar visita não deve inserir uma tarefa otimista no Painel.
- Mensagens apresentadas ao usuário devem ser claras em português e não expor erros técnicos de cancelamento de requisição.
- Nenhum dado real será criado ou alterado para validar a implementação.

## Fora de escopo

- Criar ou cadastrar automaticamente uma peça no inventário.
- Alterar estoque, migrations, schema, RLS ou contrato da RPC.
- Registrar várias linhas avulsas como uma única venda ou introduzir uma transação nova para múltiplos itens.
- Remodelar o criador geral de Tarefas ou criar uma entidade/tabela de visitas separada.
- Alterar cálculo de Caixa, fiado, relatórios financeiros ou permissões existentes.

## Critérios de aceite

1. Um usuário com `vendas.criar` registra uma venda avulsa ligada ao cliente, sem selecionar item do estoque.
2. O item, quantidade, valor e vínculo com cliente aparecem na venda e no histórico do cliente.
3. A operação cria a entrada de Caixa conforme a forma de pagamento e não altera quantidade nem fichas do estoque; fiado mantém o fluxo posterior existente.
4. O cancelamento da venda avulsa não cria devolução de estoque.
5. Venda comum de item de estoque mantém quantidade, unidade, componentes e Caixa como hoje.
6. Um usuário com `tarefas.criar` agenda visita pela lista/ficha, com cliente, título, data/hora e responsável persistidos.
7. Após salvar, a visita aparece na agenda e no Painel de Clientes sem recarga manual; tarefas concluídas não aparecem como pendentes.
8. Usuários sem a permissão correspondente não conseguem iniciar aquela ação.
9. A chamada de venda continua usando a RPC atômica existente; nenhuma chamada separada à tabela `caixa` ou `estoque` é introduzida na interface ou API.

## Arquivos previstos

- `src/features/vendas/VendasView.tsx`, `src/features/vendas/types.ts` e `src/features/vendas/api.ts`
- `src/server/routes/vendas.ts`
- `src/features/clientes/ClientesView.tsx` e componentes da ficha/lista do cliente
- Um formulário reutilizável de visita no domínio de Clientes, caso a inspeção de implementação confirme que ele não existe.
- `src/features/tarefas/useTarefas.ts` somente se a integração atual não permitir inserir a resposta criada no estado compartilhado.

## Validação planejada

- Revisar o diff dos arquivos críticos e confirmar que a venda avulsa usa exclusivamente a RPC `registrar_venda`.
- Type-check, lint e build relevantes, registrando falhas de base não relacionadas.
- Verificar visualmente `/clientes` e `/vendas` no novo sistema em desktop e viewport estreita.
- Executar testes existentes pertinentes se solicitados e disponíveis; não usar dados reais nem registrar uma venda/visita em produção.
- Não executar SQL nem alterar banco real. Confirmar compatibilidade com a assinatura de 13 parâmetros já usada pelo backend.
