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
