# Plano de implementação — Componentes animados da view de ESTOQUE (RK Sucatas)

> Prompt agêntico no padrão **Template M** deste projeto (mesmo formato dos prompts de ML/Shopee/redesign). Pensado pra ser colado no **Claude Code** e executado em fases, com **parada obrigatória de aprovação na FASE 1** antes de propagar. Cobre **todos** os componentes animados mapeados pra tela de Estoque — os novos a adotar **e** o refino dos que já estão no código — com escolha de provider **por melhor encaixe caso a caso** (justificada na tabela abaixo).
>
> Baseado na leitura do código real (agosto/2026): `src/features/estoque/EstoqueView.tsx` (~1850 linhas) e componentes auxiliares. Links dos componentes verificados um a um.

---

## 0. Bloco de contexto (ler antes de tudo)

**Stack:** React 19 + Vite 6 + Tailwind v4 (CSS-first, sem `tailwind.config`) + shadcn/ui (new-york, neutral) + Radix + Tremor/Recharts + **`motion`** (motion/react, já instalado e já usado no Estoque) + Sonner + Capacitor 8 (o mesmo build vira app Android via WebView).

**Design system (obrigatório — CLAUDE.md + `src/styles/theme.css`):**
- Cor sempre carrega significado; nada de cor decorativa. Semânticas fixas: `accent` (roxo #5b3df0), `positive`, `negative`, `warning`, `danger`.
- No máximo **UM** botão de acento preenchido (`accent`) por tela. Na Estoque o accent já é o **"Salvar e cadastrar próxima"** (fluxo de catalogação) e o **"Nova peça"** — não criar um terceiro foco de accent com componente animado.
- Todo alerta precisa de ação associada.
- Hierarquia **número > label** nos cards (o valor numérico é o elemento mais forte).
- Nunca escrever hex direto — usar as classes de token (`bg-surface-card`, `text-text-primary`, `text-positive`, `rounded-card`, etc.).

**Otimização mobile que NÃO pode ser quebrada (`src/index.css`):** `backdrop-blur` desativado em telas `<=768px` (WebView Capacitor), substituído por gradiente; sombras pesadas reduzidas. Toda animação nova precisa **respeitar** isso — gradiente é o recurso "barato" de profundidade, blur não.

**Regra de movimento (nova, válida pra todas as fases):** todo componente animado deve respeitar `prefers-reduced-motion` (cair pra transição instantânea / sem spring quando o usuário pedir menos movimento) e reusar o token de spring já existente em `src/components/ui/motion.ts` (`SPRING_MICRO`) onde fizer sentido, pra o movimento novo ficar coerente com o que a tela já faz.

**Escopo travado — NÃO tocar em:** `src/services/**`, `src/server/**`, `supabase/**`, qualquer `api.ts`, `types.ts`, `metricas.ts`/`valorEstoque.ts`/`resumoDoDia.ts` (lógica de negócio/cálculo), nem asserções de teste sobre comportamento/dado. As mudanças são de **markup / className / troca de componente de apresentação**, mais `useState` local de UI quando o componente animado exigir (nunca persistido em backend/localStorage). Nenhuma rota, contrato de dados ou cálculo muda.

**Arquivos no escopo desta tela:**
- `src/features/estoque/EstoqueView.tsx` — header, alternador de visualização, tabela, cards mobile, painel expandido, modal criar/editar, bloco "Conferência do dia".
- `src/features/estoque/EstoqueByMoto.tsx` + `MotoCard.tsx` — grade "Por moto".
- `src/features/estoque/EstoqueItemExpandido.tsx` — detalhe inline (fotos, avarias, links).
- `src/features/estoque/EstoqueFiltrosPopover.tsx` — painel de filtros.
- `src/features/estoque/EstoqueBuscaSugestoes.tsx` — busca com sugestões (refino).
- `src/features/estoque/EstoqueUploadFotos.tsx` — dropzone de fotos (refino).
- Compartilhados que podem ser trocados por versão animada: `src/components/ui/switch.tsx`, `src/components/ui/checkbox.tsx` (avaliar impacto global antes — ver FASE 5/6).

**Instalação de componentes:** cada componente é copy-paste via CLI shadcn. **Copiar o comando exato da aba "Installation" de cada link** (o caminho do registry `.json` muda por provider); o padrão é `pnpm dlx shadcn@latest add "<url-do-registry>"`. O **Animate UI Tabs já está no repo** (`src/components/animate-ui/components/animate/tabs.tsx`) — não reinstalar.

---

## 1. Decisões de provider (misto — melhor encaixe caso a caso)

| Peça da Estoque | Componente escolhido | Provider | Por que este e não o concorrente |
|---|---|---|---|
| Alternador Lista/Por moto/Organograma + Categorias/Motos | **Tabs** | Animate UI | Já instalado no repo; construído sobre Radix (já usado); indicador que desliza com spring. |
| Valores em **R$** (header, "somados hoje", valor da linha) | **animated-number** | Cult UI | Formata moeda nativamente (`Intl`/precisão), casa com o `formatCurrency` existente sem montar formatação por fora. Melhor que Counting Number pra dinheiro. |
| **Contagens inteiras** (itens, "peças cadastradas hoje", contagem do MotoCard) | **Counting Number** | Animate UI | Contador inteiro simples com `inView`; mantém o número puro sem máscara de moeda. |
| Expansão da **linha desktop** (altura animada à mão hoje) | **Auto Height (effect)** | Animate UI | Feito exatamente pra `height: 0 → auto`; remove o `motion.div` manual dentro do `<td>`. |
| Expansão do **card mobile** | **Expandable** (manter) | Cult UI | Já em uso e funcionando no mobile; só refinar, não trocar. |
| Miniaturas de foto (expandido + prévia do upload) | **Image Zoom (effect)** | Animate UI | Clique → zoom fullscreen; ganho real pra conferir avaria. |
| Toggles publicar ML/Shopee | **Switch** | Animate UI | Radix animado, thumb com spring; troca de baixo risco. |
| Checkboxes dos filtros | **Checkbox** | Animate UI | Radix animado; pareia com o resto da família Radix/Animate UI. |
| Casca do popover de Filtros | **manter `popover.tsx` atual** (Cult `popover` opcional) | — / Cult UI | O popover próprio já é temático e funciona; o ganho real é o checkbox. Trocar a casca é opcional. |
| Busca com sugestões (refino) | **action-search-bar** | Kokonut UI | Já é a base do `EstoqueBuscaSugestoes`; só alinhar ao padrão canônico. |
| Dropzone de fotos (refino) | **file-upload** | Kokonut UI | Já é a base do `EstoqueUploadFotos`; manter e integrar Image Zoom na prévia. |
| Destaque "cadastradas hoje" / estoque baixo (opcional) | **card-stack** | Kokonut UI | Pilha que expande no clique pra um conjunto **pequeno** curado; enhancement, não obrigatório. |

**Conflitos "escolher um" resolvidos:** expansão de linha = **Auto Height (desktop) + Expandable (mobile)**, *não* card-stack nem Skiper 23 pra esse papel (card-stack fica reservado só ao destaque curado da FASE 7); moeda = **animated-number (Cult)**, *não* Counting Number; contagem inteira = **Counting Number (Animate UI)**, *não* animated-number.

**Links (todos verificados):**
- Tabs — https://animate-ui.com/docs/components/animate/tabs
- Counting Number — https://animate-ui.com/docs/primitives/texts/counting-number
- Sliding Number (alternativa de moeda) — https://animate-ui.com/docs/primitives/texts/sliding-number
- Auto Height — https://animate-ui.com/docs/primitives/effects/auto-height
- Image Zoom — https://animate-ui.com/docs/primitives/effects/image-zoom
- Switch — https://animate-ui.com/docs/components/radix/switch
- Checkbox — https://animate-ui.com/docs/components/radix/checkbox
- Popover (Animate UI, alternativa) — https://animate-ui.com/docs/components/radix/popover
- Tooltip (Animate UI, opcional desktop) — https://animate-ui.com/docs/components/animate/tooltip
- animated-number (Cult UI) — https://www.cult-ui.com/docs/components/animated-number
- expandable (Cult UI) — https://www.cult-ui.com/docs/components/expandable
- popover / PopoverForm (Cult UI) — https://www.cult-ui.com/docs/components/popover
- action-search-bar (Kokonut UI) — https://kokonutui.com/docs/navigation/action-search-bar
- file-upload (Kokonut UI) — https://kokonutui.com/docs/inputs/file-upload
- card-stack (Kokonut UI) — https://kokonutui.com/docs/cards/card-stack

---

## FASE 0 — Preparação e baseline

1. Criar branch dedicada: `git checkout -b feat/estoque-componentes-animados`.
2. Rodar `pnpm install`, depois `pnpm lint`, `pnpm test` e `pnpm build` **antes de qualquer mudança** e guardar o resultado como baseline (nada abaixo pode piorar lint/test/build).
3. Instalar os componentes que serão usados nas fases seguintes, copiando o comando exato da aba **Installation** de cada link da seção 1. Instalar agora:
   - Cult UI `animated-number`
   - Animate UI `counting-number`, `auto-height`, `image-zoom`, `radix/switch`, `radix/checkbox`
   - (Tabs do Animate UI **já existe** no repo — não instalar.)
   - `card-stack` (Kokonut UI) só se a FASE 7 for executada.
4. Conferir que cada componente instalado usa `motion/react` (não `framer-motion`) — o projeto usa `motion`. Se algum vier com import `framer-motion`, ajustar o import pra `motion/react` (as APIs são compatíveis).
5. **Não** propagar nada ainda. Seguir pra FASE 1.

**Critério de aceite FASE 0:** build/lint/test verdes com os componentes instalados e ainda não usados; nenhum arquivo de `services/`, `server/`, `supabase/`, `api.ts`, `types.ts` alterado.

---

## FASE 1 — Amostra de direção (PARADA DE APROVAÇÃO) 🚦

Objetivo: aplicar **duas** mudanças de alto impacto e baixo risco só no topo da tela, mostrar, e **parar pra aprovação** antes de propagar pro resto.

**1a. Alternador de visualização → Animate UI Tabs**
- Arquivo: `EstoqueView.tsx` (~linhas 984–1042).
- Trocar os botões manuais (`<button>` com `bg-surface-card shadow-sm` no ativo) que alternam `visualizacao` (`'lista' | 'por_moto' | 'organograma'`) por `Tabs`/`TabsList`/`TabsTrigger` do Animate UI, mantendo o `useState` `visualizacao` como está (o Tabs só controla o valor). Fazer o mesmo com o sub-alternador `orgChartDominio` (`'categorias' | 'motos'`).
- **Usar as Tabs só pro indicador da `TabsList`** (o realce que desliza). **Não** envolver o conteúdo (tabela/organograma) em `TabsContents` animado — o painel é pesado (tabela de centenas de linhas / orgchart) e animar a troca pode travar na WebView. Renderizar o conteúdo condicionalmente como já é hoje.
- Mobile/WebView: OK (anima só um elemento com transform).

**1b. Valores em R$ do header → Cult UI animated-number**
- Arquivo: `EstoqueView.tsx` (~linha 909: `{formatCurrency(valorTotalEstoque)} em estoque`).
- Trocar o número renderizado por `<AnimatedNumber>` configurado pra formatar como moeda BRL (reaproveitar a mesma lógica de `formatCurrency`). O `{items.length} itens` vira Counting Number só na FASE 2 (aqui é só o R$, pra amostra ficar enxuta).
- Mobile/WebView: OK (motion value de texto).

**🚦 PARAR AQUI.** Rodar `pnpm build` + revisar no mobile (360/390/414px) e pedir aprovação da direção antes de seguir. Só depois de aprovado, propagar nas fases 2+.

**Critério de aceite FASE 1:** alternador funciona idêntico (mesmos 3 modos + sub-modo), indicador desliza suave, número do header anima ao carregar/pós-Sincronizar; sem scroll horizontal novo no mobile; `prefers-reduced-motion` cai pra estático.

---

## FASE 2 — Números animados no resto da tela

- **"Conferência do dia"** (`EstoqueView.tsx` ~linhas 956–981): `resumoDoDia.itens` → **Counting Number** (inteiro); `formatCurrency(resumoDoDia.valorTotal)` ("somados hoje") → **animated-number** (moeda).
- **Header** (~linha 909): `{items.length}` → **Counting Number**.
- **Contagem do card de moto** (`MotoCard.tsx` ~linha 48, `{quantidadePecas}`) → **Counting Number**, com `inView` pra animar quando o card entra na viewport (a grade "Por moto" pode ter muitos cards).
- **Valores da tabela** (`EstoqueView.tsx` coluna `valor`, ~linha 642): trocar por **animated-number** é **opcional**. Ressalva: são muitas linhas; animar cada célula ao paginar/ordenar pode poluir. Recomendação: **não** animar as células da tabela; deixar animated-number só nos agregados (header, conferência, total da linha quando existe preço por unidade). Documentar a decisão no PR.

Mobile/WebView: OK — todos são motion values de texto. Usar `inView` em tudo que aparece em lista/grade pra não reanimar a cada scroll.

**Critério de aceite:** todo agregado numérico anima uma vez ao entrar em tela; contagens da grade "Por moto" animam por card via `inView`; nenhuma célula de tabela pisca ao paginar/ordenar.

---

## FASE 3 — Expansão da linha / card

**3a. Linha desktop → Animate UI Auto Height**
- Arquivo: `EstoqueView.tsx` (~linhas 1174–1190). Hoje a altura do painel expandido é animada à mão com `motion.div` (`initial/animate/exit` de `height`), porque um `Expandable` não pode ficar entre `<tr>` dentro de `<tbody>`.
- Trocar esse `motion.div` manual por `<AutoHeight>` envolvendo `<EstoqueItemExpandido>` dentro do mesmo `<td colSpan>`. Manter o `AnimatePresence` externo pra montar/desmontar a linha.
- Ressalva WebView: animar `height` força reflow por frame — manter o conteúdo de `EstoqueItemExpandido` leve (já é). Não aplicar Auto Height a nada maior que esse painel.

**3b. Card mobile → refinar o Cult UI Expandable existente**
- Arquivo: `EstoqueView.tsx` (~linha 1211, `<Expandable>` do Cult UI já em uso).
- Não trocar de componente. Refino: alinhar o preset de animação (`preset="fade"` já usado) ao spring do resto da tela e garantir `prefers-reduced-motion`. Conferir que o `stopPropagation` do trigger (comentado no código) continua correto após qualquer ajuste.

**Critério de aceite:** expandir/recolher continua funcionando em desktop (dentro da tabela, sem HTML inválido) e mobile; altura transiciona suave; sem "pulo" de layout ao abrir a última linha da página.

---

## FASE 4 — Fotos com zoom

- Arquivo: `EstoqueItemExpandido.tsx` (~linhas 70–75) — as miniaturas das fotos da peça.
- Arquivo: `EstoqueUploadFotos.tsx` (~linhas 142–148) — as prévias das fotos anexadas no upload.
- Envolver cada `<img>` de miniatura com **Image Zoom (Animate UI)** em **modo clique** (tap → amplia fullscreen).
- Ressalva WebView: **desligar o modo hover** (`hover` não dispara em toque e o zoom-on-hover atrapalha na WebView) — deixar só clique. Escalar uma imagem isolada é barato na GPU.
- Não mexer na lógica de capa (primeira foto) nem no botão de remover foto — só adicionar o zoom por cima da imagem.

**Critério de aceite:** tocar/clicar numa miniatura amplia; fechar volta ao normal; o botão "remover foto" e o badge "Capa" continuam clicáveis sem disparar o zoom.

---

## FASE 5 — Filtros

- Arquivo: `EstoqueFiltrosPopover.tsx`.
- **Checkbox → Animate UI Radix Checkbox:** trocar o `Checkbox` usado em `FiltroCheckboxRow` (~linha 53). ⚠️ Esse `Checkbox` vem de `src/components/ui/checkbox.tsx`, **compartilhado** por outras telas — avaliar impacto global antes de trocar o arquivo compartilhado. Duas opções: (a) trocar `checkbox.tsx` pela versão animada e rodar a suíte inteira; (b) criar um checkbox animado local só pro popover de filtros. **Recomendado: (a)** se a suíte passar, pra não fragmentar; senão (b).
- **Casca do popover:** manter o `popover.tsx` atual (já temático e funcional). Trocar pela **Cult UI `popover`/PopoverForm** é **opcional** e só se quiser o spring de abertura — nesse caso, só a casca; os checkboxes de dentro continuam os animados acima.

**Critério de aceite:** marcar/desmarcar filtro anima o check; a contagem de filtros ativos e o comportamento de filtragem não mudam; suíte de testes do checkbox compartilhado verde (se optar por (a)).

---

## FASE 6 — Toggles de publicação

- Arquivo: `EstoqueView.tsx` (~linhas 1648 e 1692) — `Switch` de "Publicar automaticamente no Mercado Livre / na Shopee".
- Trocar por **Animate UI Radix Switch** (thumb com spring). Mesma ressalva da FASE 5: `src/components/ui/switch.tsx` é **compartilhado** — preferir trocar o arquivo compartilhado e rodar a suíte; se quebrar algo, versão local só pro modal.
- Manter intactos os handlers `onCheckedChange` (inclusive o que dispara `remocaoFundo.iniciarTodas` no toggle do ML — é lógica, não mexer no que ele faz).

**Critério de aceite:** ligar/desligar publicação anima o thumb; o efeito colateral de pré-processar remoção de fundo ao ligar o ML continua igual; sem regressão em telas que usam o Switch compartilhado.

---

## FASE 7 — Refino do existente + enhancement opcional

**7a. Busca com sugestões (`EstoqueBuscaSugestoes.tsx`)** — já é recriação do action-search-bar (Kokonut UI). Refino: revisar contra o padrão canônico (https://kokonutui.com/docs/navigation/action-search-bar) e garantir navegação por teclado (setas ↑/↓ + Enter pra selecionar sugestão, Esc pra fechar) e `aria-activedescendant`. **Não** trocar por outro componente — manter controlado e alimentado pelos itens filtrados como está.

**7b. Dropzone de fotos (`EstoqueUploadFotos.tsx`)** — já é adaptação do file-upload (Kokonut UI). Refino: manter (múltiplos arquivos + sem simulação falsa de progresso). A integração de Image Zoom nas prévias já entrou na FASE 4.

**7c. (Opcional) Destaque curado com card-stack (Kokonut UI)** — só se o usuário quiser: usar `card-stack` pra destacar um **conjunto pequeno** (ex.: "peças cadastradas hoje" ou "estoque baixo") como pilha que expande no clique, fora da lista principal. ⚠️ Ressalva WebView: anima transform/layout de vários cards — **nunca** aplicar à grade inteira de modelos nem à lista de estoque; limitar a ~3–6 itens curados. Se não for pedido, pular.

**Critério de aceite:** busca navegável por teclado; upload inalterado no comportamento; card-stack (se usado) só sobre conjunto pequeno e sem jank no mobile.

---

## FASE 8 — QA e fechamento

1. `pnpm lint` — zero erros novos.
2. `pnpm test` — suíte verde (inclui `EstoqueView.tabela.test.tsx`, `EstoqueFiltrosPopover.test.tsx`, `EstoqueBuscaSugestoes.test.tsx`, `EstoqueItemExpandido.test.tsx`, `EstoqueUploadFotos.test.tsx`). Ajustar só seletores de teste quebrados por mudança de markup — **nunca** afrouxar asserção de comportamento/dado.
3. `pnpm build` — verde.
4. Revisão mobile real na WebView em **360 / 390 / 414px**: sem scroll horizontal novo; nenhuma animação com queda de frames perceptível (atenção especial a Auto Height e card-stack).
5. Checagem de acessibilidade/movimento: com `prefers-reduced-motion: reduce` ativo, todas as animações caem pra estático/instantâneo.
6. Conferir regras do design system: continua **1 accent preenchido** por tela; **número > label** preservado; nenhuma cor decorativa nova; nenhum hex direto (só tokens).
7. Abrir PR com: lista de componentes instalados (+ provider + link), o que mudou por arquivo, e as **decisões documentadas** (células de tabela não animadas; checkbox/switch compartilhado trocado global vs. local; card-stack usado ou não).

---

## Regras gerais (valem em todas as fases)

- Só **markup / className / troca de componente de apresentação** + `useState` local de UI quando o componente exigir. Zero mudança em rota, contrato de dado ou cálculo.
- **Nunca** tocar `services/`, `server/`, `supabase/`, `api.ts`, `types.ts`, `metricas.ts`/`valorEstoque.ts`/`resumoDoDia.ts`, nem asserções de comportamento nos testes.
- Preservar a otimização mobile do `index.css` (blur off `<=768px`); usar gradiente, não blur, pra profundidade.
- Respeitar `prefers-reduced-motion` em todo componente animado; reusar `SPRING_MICRO` (`components/ui/motion.ts`) pra coerência de movimento.
- Componentes que vierem com `framer-motion` devem ser ajustados pra `motion/react`.
- Um componente compartilhado (`switch.tsx`, `checkbox.tsx`) só é trocado globalmente se a suíte inteira passar; senão, versão local escopada ao Estoque.
- Cada fase termina com `pnpm build` verde e uma checada no mobile antes da próxima.

## Ordem sugerida (não obrigatória)

FASE 0 → **FASE 1 (parada de aprovação)** → 2 → 3 → 4 → 5 → 6 → 7 → 8. As fases 2–7 são independentes entre si depois da FASE 1 aprovada — dá pra reordenar ou fazer parcial. Este plano não depende dos outros prompts do projeto (redesign visual amplo / composição mobile) terem rodado antes; é complementar a eles.
