# Continuação — redesign da prévia de estoque

> **MAIS RECENTE — 23/09/2026:** leia primeiro `docs/HANDOFF_CODEX_2026-09-23.md`.
> O trabalho está na branch `wip/estoque-reservas-cliente` (não na `main`).
> A 066 foi aplicada na versão original; a 067 (correções + cliente na reserva)
> existe só no repositório e ainda não foi aplicada.

> **ATUALIZAÇÃO CRÍTICA — 22/09/2026:** este documento contém o contexto
> inicial e partes superadas. Para continuar o trabalho atual, leia primeiro
> `docs/HANDOFF_CLAUDE_ESTOQUE_PRONTO_PARA_USO_2026-09-22.md` (seção “LEIA
> PRIMEIRO”), depois investigue o código e o diff. O usuário aplicou a
> migration 065; a 066 foi apenas criada localmente e **não foi aplicada**.
> A rota `/estoque` não pode ser trocada antes de concluir/testar o sistema e
> obter autorização. A referência visual de Tarefas é a **aba light mode nova**
> deste projeto, nunca o projeto antigo laranja com barra lateral. Há também
> um relato novo de perda de rascunho no formulário de Tarefas, ainda não
> reproduzido; veja o handoff. O texto abaixo é histórico, não estado atual.

## Objetivo atual

Continuar o desenvolvimento da rota `http://127.0.0.1:5173/estoque-preview` para validar, antes da implementação definitiva em `/estoque`, o novo método de organização do estoque da RK Sucatas.

Esta tela é uma **prévia**. Ela consulta dados reais para demonstração, mas não deve gravar, alterar banco, schema, migrations ou dados de produção sem uma autorização nova e explícita.

## Contexto de produto confirmado

- A tela **Tarefas em modo claro** é a única referência visual aprovada. A captura enviada pelo usuário mostra: fundo muito claro, cartões brancos, bordas azul-acinzentadas, ação em azul, textos escuros e tipografia sem aparência monoespaçada.
- Não usar a identidade visual antiga de superfícies pretas e detalhes laranja na prévia de estoque.
- Estoque físico: 11 prateleiras, 8 seções por prateleira. Nem todos os espaços precisam de rótulo/uso logo no início.
- A organização física é por **categoria/seção**, não por marca da moto.
- O catálogo pode ter peças cuja moto doadora é desconhecida; aproximadamente 80% do legado é peça solta. “Origem não identificada” é um dado válido, não uma pendência que bloqueia o cadastro.
- Uma reserva exige 20% de sinal e vale por 7 dias. A unidade continua no endereço físico e deve indicar que está reservada e o tempo restante.
- Tirar uma peça da prateleira para o cliente olhar no balcão não cria estado de “separada”.
- Busca cotidiana: principalmente pelo nome; foto é ajuda, não requisito. Às vezes o atendimento só conhece a categoria.

## Modelo de organização aprovado

1. **Peça** = o nome pesquisável/cadastro de catálogo (por exemplo, “Tampa do magneto CG 160”).
2. **Unidade** = uma peça física individual, com identificador próprio, preço, grau/condição, origem, foto e endereço próprios.
3. Várias unidades podem pertencer à mesma peça, mas nunca compartilham implicitamente foto, preço ou estado.
4. Se o local ainda não foi definido, a unidade entra em **Para organizar**, sem impedir o cadastro.
5. Ao digitar o nome para criar uma peça, a interface busca peças semelhantes. Quando houver correspondência, mostra **Usar existente** para anexar uma nova unidade ao cadastro existente e evitar catálogo duplicado.

## Implementação já entregue

### Identidade clara isolada

- `src/features/estoque-preview/InventoryDrawer.tsx` foi criado.
- Usa Radix Dialog e Motion para manter o comportamento de drawer da tela de tarefas: entrada e saída lateral, foco preso, Esc, overlay e scroll lock.
- Ele redefine tokens somente dentro da prévia para superfícies claras e azul de ação. Não altere `src/styles/theme.css` para esta demanda: o tema global ainda é usado por outras áreas.
- `EstoquePreview.tsx` importa `lightInventoryTokens` e aplica esses tokens na raiz da prévia. Isto é necessário porque o tema global atual é escuro/preto-laranja.

### Cartões, unidades e imagem

- Os cartões mostram **uma peça** e, internamente, suas **unidades físicas**.
- Mais de 3 unidades usam trilho horizontal com scroll suave, sem barra visível e com fade na borda direita.
- Todas as ações clicáveis devem usar `cursor-pointer`, foco visível e feedback de hover.
- `realInventoryAdapter.ts` não usa mais foto geral do item como fallback para a unidade. Só `unidade.fotos[0]` pode virar `fotoUrl`; ausência deve aparecer como “Sem foto”.

### Criação e detalhe

- `InventoryComposer.tsx` tem 4 etapas: identificar, ficha da unidade, guardar e conferir.
- Existem dois caminhos: **Criar peça** (novo nome de catálogo) e **Usar existente** (nova unidade de uma peça já cadastrada).
- O campo “Peça existente” aceita somente uma escolha exata do catálogo. Texto livre limpa a seleção e não pode anexar uma unidade à primeira peça por acidente.
- `InventoryUnitDrawer.tsx` detalha e edita uma unidade; inclui tabs animadas de visão geral e histórico.

### Abas

- Atendimento, Organizar, Mapa físico e Arquivados usam Animate UI Tabs e transição de conteúdo.
- A visualização em lista é complementar; cartões são a visão padrão.

## Arquivos relevantes

- `src/features/estoque-preview/EstoquePreview.tsx`
- `src/features/estoque-preview/InventoryDrawer.tsx`
- `src/features/estoque-preview/InventoryComposer.tsx`
- `src/features/estoque-preview/InventoryUnitDrawer.tsx`
- `src/features/estoque-preview/realInventoryAdapter.ts`
- `src/features/estoque-preview/EstoquePreview.test.tsx`
- `src/features/estoque-preview/realInventoryAdapter.test.ts`
- `docs/GUIA-NOVO-ESTOQUE.md`
- `docs/ESTOQUE_REDESIGN_CODEX_HANDOFF.md`
- `docs/ESTOQUE_REDESIGN_PLANTA_APROVADA.md`

## Validação já executada

Em 22/09/2026, depois das últimas mudanças:

```powershell
npm.cmd test -- src/features/estoque-preview
# 4 arquivos, 25 testes aprovados

npm.cmd run lint
# aprovado (tsc --noEmit)

npm.cmd run build
# aprovado
```

O Vitest pode imprimir `Not implemented: Window's scrollTo() method` por causa de Radix/jsdom; os testes terminam com sucesso e não é um erro do navegador real.

O build emite um aviso já conhecido sobre bundle acima de 500 kB; não foi introduzido como bloqueio nesta tarefa.

## Como retomar

1. Leia `AGENTS.md`, `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md` antes de editar.
2. Rode `git status --short --branch`; não descarte alterações existentes nem faça commit/push sem pedido explícito.
3. Abra ou atualize `http://127.0.0.1:5173/estoque-preview`.
4. Compare visualmente com a referência clara de Tarefas. A prévia deve permanecer clara inclusive em drawers, cards, tabs, menus e confirmações.
5. Preserve o modelo peça → unidades. Não volte ao modelo antigo em que um item representa várias unidades sem ficha individual.
6. Antes de concluir qualquer alteração, rode pelo menos os testes específicos, lint e build acima.

## Próximas prioridades sugeridas

1. Fazer uma auditoria visual manual completa depois que o usuário validar a prévia atual no navegador.
2. Refinar a densidade dos cartões e trilhos de unidades usando amostras reais, sem esconder a diferença entre peça e unidade.
3. Planejar a migração definitiva para `/estoque` somente quando o usuário aprovar método e visual; essa etapa exigirá revisar API, contratos e persistência antes de alterar dados reais.
4. Não criar categorias físicas obrigatórias automaticamente: categorias precisam chegar prontas para preenchimento e permanecer personalizáveis.

## Limites e decisões pendentes

- Não há autorização para migration, alteração de banco, persistência do novo fluxo ou substituição da rota de estoque atual.
- A prévia atual pode consultar itens reais, mas criação, edição e arquivamento servem somente para demonstração local.
- Se a automação do navegador falhar com `failed to write kernel assets`, isso é falha do ambiente de automação; valide pelo navegador aberto e pelos comandos de teste/build.
