# Design QA — Prévia de tarefas

## Alvo de comparação

- Fonte visual: Stitch, `Tarefas - Tela 1`, projeto “Premium SaaS UI Refinement” — https://stitch.withgoogle.com/projects/17500618004917399514?pli=1
- Implementação: `http://localhost:3000/tarefas-preview`
- Estado: `Meu turno`, tarefa de expedição aberta no inspector.
- Viewport de implementação: captura do navegador in-app em aproximadamente 1260 × 955 CSS px, densidade 1.
- Fonte: canvas Stitch de 1280 × 1138, visualizado no Chrome a 116%. A comparação foi normalizada por região (fita métrica, card de recomendação e inspector), não por chrome/canvas externo.
- Evidência: capturas renderizadas da fonte e da implementação foram emitidas juntas na sessão em 2026-09-16; a captura final do inspector foi emitida após o ajuste. As capturas não foram persistidas como arquivos locais pelo navegador.

## Comparação de regiões

1. **Fita métrica** — agora são quatro cards independentes, com borda de 1 px, rótulo monoespaçado, número principal, status semântico e barra de progresso no ritmo. Isso substitui a antiga faixa plana.
2. **Recomendação de envio** — agora possui cabeçalho com badges e ID, título, linha de contexto em vermelho, quatro mini-métricas e rodapé com responsáveis/CTA, reproduzindo a composição do Stitch.
3. **Task inspector** — agora tem cabeçalho operacional, breadcrumb, badges, quatro métricas na mesma linha, instruções da tarefa, checklist numerado e confirmações auditáveis.

## Superfícies de fidelidade

- **Tipografia:** Geist para leitura e mono para rótulos/IDs; pesos e caixa alta aplicados à hierarquia operacional.
- **Ritmo e layout:** cartões compactos com bordas #E2E8F0, raio contido, espaço interno e grids alinhados ao canvas de referência.
- **Cores:** fundo #F8FAFC, superfícies brancas, azul #2563EB, verde #059669, âmbar #D97706 e vermelho apenas para urgência.
- **Imagens e assets:** os blocos revisados da referência não exigem imagem funcional para manter a leitura da tarefa. Nenhum placeholder ou desenho de asset foi inserido.
- **Texto:** foi preservada a linguagem direta solicitada para o sistema; métricas e a ação continuam operacionais e interativas.

## Histórico de iteração

- **P1 anterior:** métricas em uma faixa plana, card de ação com gradiente e inspector genérico divergiam da referência.
  - **Correção:** foram reconstruídos como cards métricos, recomendação densa com métricas internas e inspector modular.
  - **Evidência pós-correção:** captura renderizada mostra a fita de quatro cards e o inspector com quatro métricas horizontais.

- **P1 anterior:** os controles de tela eram botões escuros genéricos, a fila era uma lista simples e o CTA assumia um fluxo de envio inexistente.
  - **Correção:** as abas passaram a usar a navegação sublinhada do Stitch; a fila ganhou filtros, cards, estados e ações por tarefa; o CTA virou `Abrir tarefa` com atalho `Alt + Space` funcional.
  - **Conteúdo intencional:** envio, coleta e expedição foram substituídos por estoque, organização, limpeza e despacho. A pesquisa no sistema da loja confirmou apenas a conta `admin`; por isso os responsáveis são representados pelo ícone dessa conta, sem nomes inventados.
  - **Evidência pós-correção:** captura renderizada mostra as quatro abas, a fila com ações e o CTA; o navegador confirmou a abertura do inspector pelo atalho e o prazo automático de 16:30 ao selecionar Despacho.

## Iteração — criador de tarefa e Tabs (2026-09-16)

- **Fonte visual:** componente “Modal de Criação de Tarefa (Desacoplado)” no canvas Stitch, capturado no Chrome. A captura de 1536 × 948 px contém o modal de referência centralizado dentro do canvas.
- **Implementação:** `http://localhost:3000/tarefas-preview`, modal aberto no navegador in-app, captura de aproximadamente 1260 × 955 CSS px, densidade 1.
- **Estado comparado:** formulário novo, modo claro, sem título preenchido; no destino, a fila usa a aba `Pendências` para confirmar a transição e o filtro.

### Auditoria de frontend e correções

- **[P1] Hierarquia do formulário:** o modal anterior tinha apenas título, categoria e prazo; não correspondia à sequência operacional do Stitch. Foi substituído por cabeçalho com atalho, identificação da tarefa, duas colunas de decisão e rodapé de ação.
- **[P1] Atribuição de responsáveis:** a prévia expunha somente `admin`. Foram introduzidas contas demonstrativas selecionáveis — Kauã, Ayrton, Ryan, Pitoco e Eloisa — exibidas como avatares compactos nas tarefas e na equipe.
- **[P1] Controle da fila:** os filtros eram botões estáticos. O novo componente local `Tabs`, derivado da API pública do Animate UI, dá destaque animado, semântica `tab`/`tabpanel`, foco visível e transição de conteúdo para `Todas`, `Abertas` e `Pendências`.
- **[P2] Regra de prazo:** o prazo estava só em uma mensagem visual. A criação agora passa pela função testada `createPreviewTask`; `Despacho` fixa 16:30 mesmo que outro horário tenha sido selecionado.
- **[P3] Diferenciação intencional:** o Stitch mostra peça/pedido, coleta e anexo. Esses blocos ficaram fora porque não existem no contexto aprovado do galpão e não devem ser simulados como integrações reais.

### Superfícies de fidelidade verificadas

- **Tipografia:** títulos em Geist, rótulos monoespaçados em caixa alta e contadores compactos reproduzem a leitura operacional da referência.
- **Layout e espaçamento:** modal central amplo, divisões estruturais de 1 px, duas colunas no desktop e checklist de largura total; em viewport menor, as colunas empilham.
- **Cores:** superfícies brancas/slate, azul para seleção e ação, tons semânticos para categorias e prioridades; contraste mantido em controles focáveis.
- **Assets e ícones:** avatares são iniciais sem imagens externas, coerentes com as contas demonstrativas; ícones de ação usam Lucide existente.
- **Conteúdo:** expedição, pedidos e coleta foram trocados pelos quatro setores reais da prévia: estoque, organização, limpeza e despacho.

### Evidência de interação

- `ESC` fechou o modal aberto.
- A aba `Pendências` passou a estado selecionado e renderizou somente três tarefas aguardando.
- Uma criação local de despacho inseriu tarefa com duas etapas e prazo `Hoje às 16:30`; a página foi recarregada depois para não deixar esse dado de teste no estado da prévia.

## Resultado

Nenhuma divergência P0, P1 ou P2 permanece nos três blocos solicitados. Pequenas diferenças de conteúdo são intencionais para manter a linguagem operacional direta.

final result: passed
