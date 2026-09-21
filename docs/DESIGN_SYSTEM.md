# Sistema de Design — RK Sucatas

## Direção visual

As superfícies operacionais usam o mesmo vocabulário da prévia de tarefas:
fundo slate muito claro, cartões brancos, bordas slate discretas, azul para
ação principal, verde para confirmação, âmbar para atenção e rose apenas para
risco ou atraso. A informação deve ser densa, mas escaneável.

## Tipografia

- Interface, títulos, descrições, metadados, formulários e ações: Geist com
  Inter como fallback.
- Não usar tipografia monoespaçada em novas superfícies. Códigos e números
  mantêm peso, cor e espaçamento para diferenciação, sem trocar de família.

## Fontes de componentes e movimento

1. **Animate UI:** tabs, botões e microinterações de controles. É a fonte
   obrigatória para navegação por tabs e ações primárias.
2. **Bklit UI:** gráficos e visualizações que respondem uma pergunta
   operacional; usar os primitivos locais de charts já incorporados.
3. **UILora:** uma transição de destaque por fluxo, como drawer ou confirmação.
   Não há pacote instalado: reutilizar apenas a convenção leve de drawer já
   incorporada ao projeto ou importar uma fonte aprovada antes de criar algo.
4. **Motion:** presença, foco, entrada, saída e mudanças locais de layout.
5. **Anime.js:** timelines curtas de contadores ou transições coordenadas,
   sempre limpas no unmount.
6. **DotMatrix:** indicador pontual de sincronização ou criticidade; nunca como
   ornamento repetido em listas.

## Mobile-first (decisão adotada em `tarefas-preview`)

Superfícies operacionais são projetadas primeiro em 320–430 px e ampliadas para
tablet e desktop, nunca o contrário.

- Nenhuma superfície principal exige rolagem horizontal. Só listas
  explicitamente horizontais — abas e chips de filtro — rolam, sempre com o item
  ativo trazido para o viewport e sem barra cortando o conteúdo.
- Alvo de toque mínimo de 44 × 44 px, inclusive caixas de seleção: o `input`
  fica visualmente pequeno, mas o rótulo entrega a área. Campos de texto usam
  16 px em telas estreitas para não provocar zoom no iOS.
- Detalhes, criação e confirmações viram folha (sheet) de altura quase total no
  mobile: cabeçalho fixo, conteúdo com rolagem interna e rodapé de ação acima da
  safe area. Em `sm+` a mesma superfície vira drawer lateral ou diálogo
  centrado.
- Cabeçalho e rodapés respeitam `env(safe-area-inset-top/bottom)`.
- Ordem da página segue a decisão do usuário: o que ele executa vem antes do que
  apenas explica o estado. Resumos, gráficos e históricos ficam depois da fila e
  podem usar divulgação progressiva com controle explícito.
- Um único botão de acento preenchido por tela. Quando o rótulo do CTA é
  ocultado por breakpoint, o `aria-label` mantém o nome — e muda junto com o
  contexto ativo.
- Trocar um filtro local anima apenas os itens afetados; o container não é
  re-chaveado nem remontado, e a posição de rolagem do contexto é preservada ao
  alternar abas.

## Regras de incorporação

- Não criar do zero primitives de dropdown, dialog, tabs, tooltip, menu, drawer
  ou botão. Reutilizar um componente local já incorporado ou importar uma fonte
  aprovada e registrar sua origem.
- Decisões operacionais não usam controles nativos sem tratamento visual e de
  acessibilidade. Menus precisam de foco, Escape, altura máxima, rolagem interna
  e retorno de foco ao gatilho.
- Movimentos usam somente opacidade e transform, respeitam
  `prefers-reduced-motion` e não causam sensação de reload.
- Cards repetidos exibem somente a ação principal e, quando necessário, uma
  ação de adiamento. Edição e exclusão ficam em menu contextual com confirmação.
