# Auditoria comparativa — Tarefas nova × Estoque Preview

Data: 2026-09-21

## Escopo e evidências

Auditoria combinada de UX, design e riscos de acessibilidade em desktop. A referência é a nova tela de Tarefas publicada em `rk-sucatas.onrender.com/tarefas`; a superfície avaliada é `http://127.0.0.1:5173/estoque-preview`.

1. `01-tarefas-nova.png` — tela operacional e fila real de Tarefas. Saúde: boa referência visual.
2. `03-tarefas-criacao.png` — composer de criação em quatro etapas. Saúde: boa referência de fluxo, com ressalva tipográfica.
3. `02-estoque-preview-atendimento.png` — atendimento e catálogo demonstrativo. Saúde: parcial.
4. `04-estoque-mapa-vazio.png` — mapa das 88 seções. Saúde: fraca para uma operação grande.

## Veredito

A Estoque Preview já comunica corretamente a ideia Peça → Unidade, mas ainda não funciona como uma grande operação. Ela imita parte da paleta de Tarefas sem reproduzir seu sistema de composição, usa dois modelos demonstrativos contraditórios e não possui CRUD completo. O maior problema não é cosmético: o catálogo diz que há unidades em endereços como `P05-S03`, enquanto o mapa físico nasce vazio porque é alimentado por outro estado.

## O que deve ser preservado da nova tela de Tarefas

- Cabeçalho plano, conteúdo central com `max-width` de 1440 px e CTA azul.
- Título e abas no mesmo bloco, seguido por faixa de quatro métricas.
- Grade principal `1.5fr + 360px`: operação à esquerda, contexto à direita.
- Cartões brancos, bordas slate discretas, pouco raio e sombras quase invisíveis.
- Composer grande com etapas claras, resumo persistente, rodapé de ações e retorno de foco.
- Ações secundárias e destrutivas fora da leitura principal.

## Inconsistências confirmadas

### Estruturais — prioridade máxima

1. `catalogoDemo.ts` e `physicalStockModel.ts` são duas fontes de verdade independentes. Cadastro, edição, remoção, contadores e mapa podem divergir.
2. “Nova Peça / Lote” abre apenas uma explicação; não existe formulário de cadastro e nada entra no catálogo.
3. Não há edição nem exclusão/arquivamento de Peça ou Unidade.
4. O mapa exibe 88 cartões iguais ao mesmo tempo. Ele informa a capacidade, mas não ajuda a decidir onde guardar ou encontrar uma unidade.
5. Os números `84`, `88`, `3`, `2` e `1` misturam métricas reais e demonstrativas sem origem única.

### Visuais

1. A preview usa um grande contêiner arredondado, enquanto Tarefas é uma superfície plana e contínua.
2. O CTA principal herdou laranja; Tarefas usa azul consistente com a nova identidade.
3. A abertura do cadastro vira uma faixa azul permanente e empurra toda a tela; Tarefas usa overlay com contexto preservado.
4. A preview tem raios maiores, mais caixas decorativas e menor densidade útil que Tarefas.
5. A busca compete com o título; em Tarefas ela fica no cabeçalho global.
6. A tipografia principal é compatível, mas Tarefas ainda possui rótulos `font-mono`, contrariando o design system e a preferência já registrada do usuário. A Estoque nova deve usar Geist/Inter em tudo e não reproduzir esse defeito.

### Interação e acessibilidade

1. Os tabs do estoque não expõem `aria-controls`/painéis associados e não confirmam navegação por setas.
2. A faixa de cadastro tem baixo contraste no botão “Fechar” no estado observado.
3. Não existe confirmação contextual para exclusão, opção de desfazer ou explicação sobre impacto em histórico.
4. Não há estados de validação, erro, salvamento, edição concorrente ou feedback após mutação.
5. O mapa possui bons nomes acessíveis para as seções, mas 88 alvos sequenciais criam uma navegação por teclado excessiva.
6. Esta auditoria visual não confirma contraste numérico em todos os estados, `prefers-reduced-motion`, zoom, leitor de tela nem reflow mobile; esses pontos exigem teste após a reformulação.

## Modelo demonstrativo único recomendado

```text
Categoria do catálogo
  └─ Peça canônica
       └─ Unidade física individual
            ├─ SKU
            ├─ preço e estado
            ├─ foto própria ou “sem foto”
            ├─ origem opcional
            ├─ reserva opcional
            └─ endereço físico opcional → seção do mapa
```

O mapa deve derivar dessas mesmas unidades. Alterar o endereço de uma Unidade move sua referência no mapa; remover/arquivar uma Unidade a retira do saldo e do endereço; editar categoria ou Peça não duplica Unidade.

## Dados reais selecionados para a demonstração

Os nomes, categorias, valores, quantidades e IDs abaixo foram lidos da tabela real de estoque. As posições físicas serão explicitamente fictícias na preview.

### RABETA

- RK-810 — Suporte de placa (rabeta) CBX Twister 250 — R$ 150,00 — 1 unidade.
- RK-792 — Suporte de placa (rabeta) CG 150 Mix (09/13) — R$ 139,90 — 3 unidades.
- RK-791 — Suporte de placa (rabeta) CG 150 — R$ 139,90 — 1 unidade.

### ESCAPAMENTOS

- RK-315 — Escapamento Honda CB Twister 250F — R$ 450,00 — 1 unidade.
- RK-803 — Escapamento Dafra Kansas 150 — R$ 300,00 — 1 unidade.

### EMBREAGEM

- RK-798 — Embreagem completa com campana Factor 150 — R$ 320,00 — 1 unidade.
- RK-790 — Embreagem completa CG 160 — R$ 299,90 — 1 unidade.
- RK-789 — Campana de embreagem CG 160 — R$ 199,90 — 1 unidade.

Regra da demonstração: registros com quantidade maior que 1 serão exibidos como Unidades individuais, por exemplo `RK-792-01`, `RK-792-02` e `RK-792-03`. Como a tabela observada não possui imagem nesses registros, a preview deve mostrar “Sem foto”, sem inventar fotografia.

## Direção proposta

### Atendimento

- Mesmo cabeçalho, largura, alinhamento e densidade da tela de Tarefas.
- Faixa de métricas derivada do modelo único.
- Fila operacional à esquerda: Peças agrupadas por categoria e suas Unidades expansíveis.
- Painel à direita: reservas vencendo, itens sem endereço e demanda sem saldo.
- Busca única por Peça, categoria, moto compatível, SKU e endereço.
- Alternância compacta entre cartões e lista; cartões são padrão, lista é secundária.

### Organização

- Fila de Unidades sem foto, sem preço, sem compatibilidade ou sem endereço.
- Ação principal “Continuar organização” abre diretamente o campo pendente.
- Origem desconhecida é estado válido e não gera pendência sozinha.

### Mapa físico

- Navegação por Prateleira primeiro; somente a prateleira selecionada mostra suas oito seções.
- Resumo: seções ocupadas, vazias, sem categoria e Unidades localizadas.
- Cada seção mostra categoria configurada, total de Unidades e três exemplos; abrir revela o restante.
- A preview demonstra RABETA, ESCAPAMENTOS e EMBREAGEM em seções fictícias claramente marcadas.

### Criação, edição e exclusão

- Criar: composer em quatro passos inspirado em Tarefas — escolher/criar Peça, cadastrar uma Unidade, definir organização, revisar.
- Editar: menu contextual separa “Editar Peça” de “Editar esta Unidade”. Mudar endereço atualiza o mapa no mesmo estado.
- Excluir: confirmação contextual com nome/SKU e impacto. Para preservar histórico, a recomendação é arquivar; a preview pode oferecer desfazer.

## Limites e riscos

- Nenhum dado de produção foi alterado; a leitura do estoque real foi somente visual.
- As localizações demonstrativas não afirmam posições reais do galpão.
- A rota local `/tarefas-preview` não está conectada no `App.tsx` atual, embora a nova tela esteja publicada e seus componentes existam. Corrigir essa divergência envolve arquivo crítico e não entra automaticamente na reformulação de Estoque.
- Integração real de CRUD, banco, storage, reservas e migração dos 810 itens exige etapa posterior, autorização e revisão específica de schema/API.

## Atualização após reformulação da preview

Em 22/09/2026, a reformulação local foi executada sobre este diagnóstico.

- A fonte duplicada foi substituída por `inventoryPreviewModel.ts`, que alimenta catálogo, busca, métricas, fila, mapa e arquivados.
- Os registros RK-810, RK-792, RK-791, RK-315, RK-803, RK-798, RK-790 e RK-789 foram demonstrados; RK-792 foi desdobrado em três unidades individuais.
- A criação agora existe em composer de quatro etapas; a edição ocorre em drawer; exclusão foi implementada como arquivamento reversível com confirmação e restauração.
- A visualização principal usa cartões; a lista é alternativa; o mapa mostra uma prateleira por vez com oito seções.
- O critério novo adicionado à skill `ux-user-audit` foi: todas as vistas operacionais relacionadas devem derivar do mesmo identificador e fonte de estado, atualizando juntas após mutações.
- Limitação preservada: a preview permanece em memória e não grava na rota real, API, Supabase ou storage.
