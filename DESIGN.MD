# RK Sucatas — Operational Interface Design System

This document is the visual source of truth for generating new RK Sucatas screens in Google Stitch.

Use it for the new operational tabs, especially **Clientes**, **Agenda de visitas**, **Tarefas**, **Estoque**, **Vendas**, and **Caixa**. The product is an internal Brazilian motorcycle-parts operation tool. It is used by a small team during real work: registering customers, following parts requests, planning visits, finding inventory, recording sales, and reconciling cash.

The interface must feel like a dependable operations desk: clear, compact, calm, and immediately actionable. It is not a marketing site, a consumer calendar, or a generic SaaS dashboard.

## 0. Non-negotiable project context

- Product name: **RK Sucatas**.
- Interface language: **Brazilian Portuguese (pt-BR)**.
- Currency: **Brazilian Real**, formatted as `R$ 1.234,56`.
- Date format: `dd/mm/yyyy` in compact contexts; use natural Portuguese labels such as `Hoje`, `Amanhã`, `Atrasada` and `Próximas visitas` where they improve scanning.
- Time format: 24-hour clock, for example `14:30`.
- Canonical new-system preview: `http://127.0.0.1:3001`.
- Do not use the legacy project, its visual language, or port `4173` as a reference.
- The new operational tabs use the light operational surface described below. Do not infer the dark global theme as the visual direction for these screens.
- The frontend is mobile-first and must remain useful at `375px` wide.
- Desktop content is contained in a maximum width of approximately `1440px`.

## 1. Visual theme and atmosphere

### The feeling

RK Sucatas should feel like a well-organized service counter inside a motorcycle-parts shop: practical, tactile, trustworthy, and ready for the next action. The visual language is editorial-operational rather than decorative. Every border, label, color, and spacing decision should help a worker answer a question or complete a task faster.

Atmosphere calibration:

- Density: **6/10 — daily operations desk**.
- Variance: **3/10 — predictable and highly scannable**.
- Motion: **3/10 — restrained, responsive, and functional**.
- Emotional tone: **precise, grounded, calm under pressure**.
- Visual contrast: strong text hierarchy with quiet surfaces and one controlled action color.
- Composition: left-aligned content with right-anchored actions and navigation.

### What makes this identity specific

The memorable visual element is not a gradient, illustration, or oversized hero. It is the combination of:

1. a bright, almost-white work surface;
2. blue action controls used sparingly;
3. compact operational rows with strong typographic hierarchy;
4. status colors that carry real meaning;
5. restrained borders and small radius controls;
6. drawers that feel like working panels rather than promotional modals.

The interface should look immediately familiar across Clientes, Agenda, Tarefas, Estoque, Vendas, and Caixa. New screens may introduce domain-specific information, but they must not introduce a new visual language.

## 2. Color palette and semantic roles

Use one coherent light neutral family. Do not mix warm cream, cool gray, blue-gray, and charcoal systems in the same screen.

### Core palette

| Token | Hex | Role |
| --- | --- | --- |
| `surface-page` | `#F8FAFC` | Main application canvas and page background |
| `surface-card` | `#FFFFFF` | Primary cards, panels, drawers, and working surfaces |
| `surface-raised` | `#F8FAFC` | Raised-but-quiet surfaces and hover backgrounds |
| `surface-overlay` | `#EFF6FF` | Informational panel background and selected operational context |
| `surface-inset` | `#F8FAFC` | Inputs, compact controls, and recessed areas |
| `border-subtle` | `#F1F5F9` | Very light separators inside dense regions |
| `border-default` | `#E2E8F0` | Card borders, control borders, table separators |
| `text-primary` | `#0F172A` | Headings, names, high-priority values, primary actions on light surfaces |
| `text-secondary` | `#475569` | Supporting content, descriptions, secondary values |
| `text-muted` | `#64748B` | Metadata, helper text, timestamps, quiet controls |
| `text-faint` | `#94A3B8` | Eyebrows, disabled context, empty-state icons |
| `accent` | `#2563EB` | Single primary action, active tab, focused control, selected date |
| `accent-hover` | `#1D4ED8` | Hover and pressed state for the primary action |
| `accent-soft-bg` | `#EFF6FF` | Selected state, soft action background, informational emphasis |
| `accent-soft-fg` | `#1D4ED8` | Text and icons on the soft blue background |

### Semantic status colors

These colors are not decorative. Never use them merely to make a card more colorful.

| Meaning | Foreground | Background | Use |
| --- | --- | --- | --- |
| Positive / completed | `#047857` | `#ECFDF5` | Compareceu, concluída, disponível, pagamento confirmado |
| Attention / pending | `#B45309` | `#FFFBEB` | Aguardando confirmação, próxima visita, prazo próximo |
| Negative / interruption | `#C2410C` | `#FFF7ED` | Não compareceu, saldo pendente, action requiring attention |
| Danger / destructive | `#DC2626` | `#FEF2F2` | Cancelar, excluir, irreversible or high-risk state |
| Secondary information | `#6D28D9` | `#F5F3FF` | Only domain-specific information that truly needs a separate semantic channel |

Rules:

- Blue is the single brand/action accent.
- Status color must always be accompanied by readable text.
- Do not create additional accent colors for individual screens.
- Do not use saturated gradients, neon fills, colored glows, or color noise.
- Never use pure black as a visual color. Use `#0F172A` for the deepest text.
- Never use the global dark theme palette on the new operational tabs unless the product owner explicitly defines a separate dark mode.

## 3. Typography architecture

### Typeface

- Primary UI typeface: **Geist**.
- Fallback: `Inter`, then `ui-sans-serif`, `system-ui`, `sans-serif`.
- Metadata and compact operational labels: **JetBrains Mono** or a system monospace fallback.
- Do not use serif typefaces in operational screens.
- Do not make the visual identity depend on Inter's metrics; Geist is the intended face.

### Type hierarchy

| Role | Size | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| Page title | `30px` mobile / `36px` desktop | 600 | approximately `-0.045em` | `Clientes`, `Agenda de visitas`, `Tarefas` |
| Section title | `18px–20px` | 600 | slightly tight | Panels and working areas |
| Card/entity name | `14px–16px` | 600 | normal | Customer names, visit titles, part names |
| Body | `14px` | 400–500 | normal | Descriptions and instructions |
| Compact body | `12px–13px` | 400–600 | normal | Secondary row information |
| Eyebrow | `10px` | 600 | `0.14em–0.16em` | Only for real operational context |
| Metadata | `11px–12px` | 500 | normal | Timestamps, responsible person, city |
| Numeric emphasis | tabular numerals | 600–700 | normal | Counts, prices, overdue totals |

Typography rules:

- Use sentence case for user-facing labels and buttons.
- Avoid making every label uppercase. Uppercase is reserved for small contextual eyebrows or compact table headers.
- Do not create a giant marketing hero headline.
- Do not highlight one random word in a different color inside a heading.
- Keep ordinary text lines below approximately `65ch`; dense operational rows may be shorter.
- Use weight and spacing to establish hierarchy before using color.
- Dates, times, currency and quantities should use tabular numerals where possible.

## 4. Layout system

### Page shell

- Canvas: `#F8FAFC`.
- Desktop max width: `1440px`.
- Horizontal page padding: `24px` desktop, `12px` mobile.
- Desktop top spacing below the sticky header: approximately `40px` for a new page, `20px` on mobile.
- Content alignment: left aligned.
- Page actions and tabs: anchored to the right when the viewport allows it.
- Avoid large empty hero areas. Operational content should begin soon after the page context and filters.

### Spacing scale

Prefer a compact rhythm based on multiples of `4px`:

- `4px`: icon-to-label gap, micro separation;
- `8px`: compact internal gap;
- `12px`: row padding and control groups;
- `16px`: standard panel padding;
- `20px`: section spacing;
- `24px`: desktop card padding and major grouping;
- `32px`: page-level separation;
- `40px`: initial desktop page breathing room.

Do not use large spacing simply to make a screen look luxurious. This is a working interface.

### Radius and elevation

- Card radius: `8px`.
- Control radius: `6px`.
- Badge radius: `5px`.
- Drawer radius: square on desktop edge; `24px 24px 0 0` only when rendered as a mobile bottom sheet.
- Use one-pixel borders as the primary separation mechanism.
- Base card shadow: `0 1px 2px rgba(15, 23, 42, 0.04)`.
- Elevated panel shadow: `0 8px 24px rgba(15, 23, 42, 0.06)`.
- Shadows must be quiet and tinted toward the slate background.
- Do not give every nested element its own card and shadow.

### Desktop composition

Use asymmetry only when it improves operation. A recommended Clientes/Agenda composition is:

```text
┌──────────────────────────────────────────────────────────────┐
│ Brand/context                              Secondary | Primary │
├──────────────────────────────────────────────────────────────┤
│ Page title and description                   Tabs aligned right │
├──────────────────────────────────────────────────────────────┤
│ Date navigation / view mode / primary action                  │
├──────────────────────────────────────────────────────────────┤
│ Search + filters                                                │
├──────────────────────────────────────────────────────────────┤
│ Operational summary                                             │
├──────────────────────────────────────────────────────────────┤
│ Dense chronological list or two-column list + context panel    │
└──────────────────────────────────────────────────────────────┘
```

Use CSS Grid for page-level composition. Do not use absolute positioning for content stacking or percentage-based layout hacks.

### Mobile composition

Below `768px`:

- collapse to one column;
- keep actions usable at a minimum `44px` touch target;
- keep the primary CTA visible near the page title or in the sticky action area;
- let tabs and date strips scroll horizontally with no visible scrollbar;
- never create accidental horizontal overflow;
- move secondary filters into an expandable panel;
- preserve right-aligned tab behavior where possible, but do not sacrifice readable labels;
- use full-width cards and drawers;
- keep the bottom navigation clear of fixed drawer footers.

## 5. Shared chrome for the new tabs

### Sticky top header

The new tabs share a compact sticky header:

- white surface with a subtle bottom border;
- small `RK` mark in the accent color;
- `RK Sucatas` wordmark;
- small contextual subtitle such as `Cadastro e atendimento · sistema integrado`;
- actions anchored on the right;
- backdrop blur may be used subtly, but never as a visual effect by itself.

The header must not become a large branding area. The product work is the content below.

### Page context

Use this pattern:

```text
OPERAÇÃO DE CLIENTES
Clientes
Acompanhe pedidos, contatos e próximos atendimentos.
```

The eyebrow is useful because it identifies the operational domain. Do not add an eyebrow above every card or every heading.

### Tabs

- Use a compact segmented tab group.
- Container: `surface-inset`, `border-subtle`, `6px` radius.
- Active tab: white, accent text, quiet shadow or border distinction.
- Inactive tab: muted text.
- Minimum height: `40px` on mobile, `36px` on compact desktop contexts.
- Tabs remain right-aligned in the page header on desktop.
- On narrow screens, tabs may scroll horizontally without a visible scrollbar.

## 6. Component language

### Buttons

Primary button:

- maximum one filled blue CTA per screen;
- background `#2563EB`;
- hover `#1D4ED8`;
- white text;
- `6px` radius;
- `36px` desktop height, `44px` mobile touch target;
- direct verb, for example `Agendar visita`, `Registrar pedido`, `Salvar cliente`.

Secondary button:

- white or transparent surface;
- default border `#E2E8F0`;
- dark slate text;
- hover `#F8FAFC`;
- used for `Novo cliente`, `Reagendar`, `Abrir cliente`.

Destructive button:

- reserved for cancellation or deletion;
- use danger tone and explicit wording;
- never place it visually equal to the primary action unless the user is inside a confirmation dialog.

Every clickable control must:

- show `cursor: pointer`;
- have a visible hover state;
- have a visible keyboard focus ring;
- have a pressed state;
- preserve a clear disabled state;
- use an icon only when the icon is recognizable and paired with a label where ambiguity is possible.

### Cards and rows

Cards are for grouping or elevation, not decoration. Dense operational data should often use dividers and whitespace instead of nested cards.

Recommended row anatomy:

```text
[status/time]  [entity name + primary action context]  [metadata]  [actions]
```

Primary content should be visually stronger than metadata. The most important number or state should be easy to find without reading every line.

### Status badges

- compact, `5px` radius;
- readable text, never color-only;
- use a consistent vocabulary across screens;
- do not display more than two badges in a row unless the domain requires it;
- avoid pill-shaped badges for everything; reserve full pills for compact filters or tags.

Agenda status vocabulary:

- `Agendada`;
- `Confirmada`;
- `Reagendada`;
- `Compareceu`;
- `Não compareceu`;
- `Cancelada`.

### Inputs and filters

- label above the field;
- helper text below only when it changes behavior;
- error message directly below the field;
- `44px` touch height on mobile;
- inset surface `#F8FAFC`;
- border `#E2E8F0`;
- focus border/ring in accent blue;
- no floating labels;
- no placeholder used as the only label;
- filters must remain readable when many are active and must expose a clear reset action.

### Drawers

Use the existing operational drawer language:

- default width: approximately `512px`;
- wide detail drawer: approximately `760px`;
- full viewport height using `100dvh`;
- fixed header;
- scrollable content region;
- fixed footer for primary actions;
- white surface, left border, quiet shadow;
- preserve focus return when closed;
- use a spring-like entrance only when it helps the user understand the panel relationship.

Mobile drawers may become bottom sheets, but the content hierarchy and fixed footer must remain.

### Empty states

An empty state is an instruction, not a dead end.

Good example:

```text
Nenhuma visita para este dia
Agende um atendimento ou escolha outra data.
[Agendar visita]
```

Avoid oversized illustrations, decorative gradients, emoji, and vague text such as `Nada por aqui`.

### Error states

Errors must answer:

1. what failed;
2. whether the existing data is still safe;
3. what the user can do next.

Example:

```text
Não foi possível carregar a agenda.
Os dados anteriores continuam preservados.
[Tentar novamente]
```

## 7. Agenda of visits — screen-specific direction

The Agenda is a work queue for customer visits. It is not a month-view calendar.

### Recommended structure

```text
Agenda de visitas                                      Agendar visita
Organize os próximos atendimentos dos clientes.

[Hoje] [08 qua] [09 qui] [10 sex] [11 sáb]       [Dia] [Semana]

[Buscar cliente ou peça] [Responsável] [Situação] [Cidade]

3 atrasadas       2 hoje       5 próximas       1 aguardando confirmação

ATRASADAS
09:00  João Silva          Retirar peça           [Reagendar] [Mais]
       CG 160 · 2 pedidos  Carlos · Juazeirinho

HOJE
14:30  Maria Souza         Conferir peça          [Confirmar] [Mais]
       Honda Fan            Ayrton · Campina Grande
```

### Date strip

- `Hoje` is always accessible.
- Selected day is white with accent text and a clear border/shadow distinction.
- Days with visits show a small count.
- Days with overdue visits use an attention marker, not a large colored block.
- The date strip is horizontally scrollable on mobile.
- Use a monthly calendar only inside a date-picker popover.

### View switch

- `Dia` is the default because it supports immediate action.
- `Semana` is for planning and comparison.
- The selected view must be visually obvious and keyboard accessible.

### Visit row/card

Every visit should expose, in priority order:

1. time or `Dia inteiro`;
2. customer name;
3. visit title or purpose;
4. current status;
5. related part and motorcycle;
6. responsible person;
7. city, reservation, or other operational context;
8. next valid action.

The row is clickable to open the visit detail, but inline action buttons must not accidentally open the row at the same time.

### Visit creation drawer

Title: `Agendar visita`.

Description: `Defina o atendimento, o cliente e quando ele deve acontecer.`

Fields:

- customer selector;
- related part request(s), optional but encouraged;
- date;
- optional time;
- responsible person;
- notes.

Footer:

```text
Cancelar                              Agendar visita
```

The form must distinguish a missing date from an optional time. A visit without a specific time is not an error; visually label it `Dia inteiro`.

### Visit detail drawer

The detail drawer should feel like a focused customer-work context:

- status at the top;
- customer identity and contact action;
- date/time block;
- related part and motorcycle;
- responsible person;
- reservation context when available;
- notes;
- chronological event history;
- fixed action footer.

The user can open the full customer drawer without losing the selected visit context.

### Visit actions

Actions must be status-aware:

- `Agendada`: Confirmar, Reagendar, Cancelar;
- `Confirmada`: Compareceu, Não compareceu, Reagendar, Cancelar;
- `Reagendada`: Confirmar, Compareceu, Não compareceu, Cancelar;
- `Compareceu`: view history and customer;
- `Não compareceu`: Agendar nova visita and view reason;
- `Cancelada`: view history, with reactivation only if explicitly supported.

Do not show every possible action at once. Show the next useful action first and place rare actions under `Mais ações`.

## 8. Interaction and motion

Motion should explain state changes rather than decorate the interface.

Use the existing motion vocabulary:

- sheet/drawer transitions: spring similar to `SPRING_SHEET`;
- small item transitions: spring similar to `SPRING_MICRO`;
- content reveal: restrained opacity and transform;
- tabs: short position/opacity transition;
- status update: brief visual confirmation on the changed row;
- date change: subtle content transition, never a full-screen theatrical animation.

Rules:

- animate only `transform` and `opacity` whenever possible;
- do not animate layout dimensions, `top`, `left`, or `width` for ordinary state changes;
- no perpetual motion on a static operational screen;
- a pulse is allowed only for a meaningful unread or urgent state and must stop when acknowledged;
- respect `prefers-reduced-motion` by removing non-essential movement while preserving visible state feedback.

## 9. Accessibility and affordance

- Minimum touch target: `44px` on mobile.
- Focus rings must be visible in accent blue with sufficient contrast.
- Do not rely on hover for action discovery.
- Every icon-only action needs an accessible label and tooltip where appropriate.
- Status must be readable in text.
- Dialogs and drawers must return focus to the triggering control.
- Keyboard focus must not be hidden behind sticky headers or fixed footers.
- Selects and popovers must not be clipped by cards or scroll containers.
- Date navigation must be usable without a pointer.
- Tables must provide an equally usable mobile card representation.
- Error text must be associated with its field.

## 10. Copy and content rules

Use plain Brazilian Portuguese and active verbs.

Preferred:

- `Agendar visita`;
- `Confirmar visita`;
- `Registrar comparecimento`;
- `Marcar como não compareceu`;
- `Reagendar visita`;
- `Cancelar visita`;
- `Abrir cliente`;
- `Tentar novamente`.

Avoid:

- `Submit`;
- `Processar` when a more direct verb exists;
- technical terms such as `mutation`, `payload`, `status transition`, or `RPC`;
- marketing phrases such as `Experiência perfeita`, `Próxima geração`, `Revolucione`, or `Seamless`;
- vague empty-state copy;
- invented customer names or fake business metrics in generated screens.

When Stitch needs sample content, prefer domain-specific Portuguese examples such as:

- `João Silva`;
- `Maria Souza`;
- `Retirar peça reservada`;
- `Conferir compatibilidade da CG 160`;
- `Ayrton`;
- `Juazeirinho, PB`.

Sample data must look plausible but must never imply a real production record.

## 11. Anti-patterns — never generate these

- No dark dashboard treatment for the new operational tabs.
- No purple or neon primary actions.
- No large gradients, glowing borders, glassmorphism, or blurred decorative blobs.
- No generic three-column equal card grid.
- No month calendar as the dominant Agenda layout.
- No oversized hero section before operational content.
- No full-page centered empty state with decorative illustration.
- No excessive rounded cards; use `8px` cards and `6px` controls.
- No pure black text or pure black surfaces.
- No serif fonts in the application UI.
- No emoji as interface decoration or status markers.
- No tiny tap targets.
- No icon-only buttons when the action is ambiguous.
- No status communicated by color alone.
- No fake percentages, fake counts, or placeholder metrics such as `99.99%`.
- No generic names such as `John Doe`, `Acme`, `Nexus`, or `Jane Smith`.
- No labels written entirely in uppercase except compact contextual eyebrows and table headers.
- No unexplained abbreviations.
- No content overlap or absolute-positioned text stacks.
- No horizontal overflow on mobile.
- No hidden action behind hover only.
- No duplicated visit entity separate from the shared task identity.
- No fabricated reservation, customer, or appointment data presented as real.

## 12. Stitch generation checklist

Before accepting a generated screen, confirm:

- [ ] It uses the light operational palette in this document.
- [ ] The primary action is blue and there is no competing filled CTA.
- [ ] The page is contained at approximately `1440px` on desktop.
- [ ] The mobile layout works at `375px` without horizontal overflow.
- [ ] The page title, context, tabs, and actions follow the RK Sucatas shell.
- [ ] Cards use restrained borders and `8px` radius.
- [ ] Controls use approximately `6px` radius and comfortable touch height.
- [ ] Typography uses Geist first, with a controlled scale and no generic serif.
- [ ] Status colors communicate real operational meaning and include text.
- [ ] Empty, loading, error, disabled, selected, hover, focus, and pressed states are represented.
- [ ] The Agenda prioritizes overdue and today's work.
- [ ] The Agenda uses a date strip and list, not a decorative month grid.
- [ ] Drawers have fixed headers and footers with scrollable content.
- [ ] Motion is subtle, functional, and disabled where reduced motion is requested.
- [ ] Copy is in Brazilian Portuguese and uses direct verbs.
- [ ] No banned AI design clichés appear in the generated result.

