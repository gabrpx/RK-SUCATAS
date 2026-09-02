# Famílias de peça no Estoque — design

Data: 2026-09-02
Status: aprovado para plano de implementação

## Problema

Hoje o Estoque não tem noção de "família de peça". Cada combinação
peça+modelo de moto vira um registro `estoque` totalmente independente
(código RK-XXXX próprio, preço, quantidade, fotos, fichas de unidade
próprias). Uma peça genérica como "Tanque de Combustível CG 125"
aparece replicada na tabela como "Tanque de Combustível CG 125 Titan
99", "Tanque de Combustível Today", "Tanque de Combustível CG 125
Fan" — três linhas sem nenhuma relação estrutural entre si além do
nome parecido.

O pedido: a tabela de Estoque deve mostrar **uma linha por família**
("Tanque de Combustível CG 125"). Ao clicar, abre um modal que agrupa
as unidades por modelo/ano de moto ("CG 125 · 1999", "CG 125 ·
2004–2008", ...), cada grupo com seus cards de unidade individuais —
conforme mockup fornecido pelo usuário.

## Não-objetivos desta entrega

- Abas "Histórico" e "Relacionadas" do modal — aparecem desabilitadas
  ("em breve"), sem funcionalidade.
- Propagar o conceito de família para Vendas, Orçamentos, publicação
  ML/Shopee, Dashboard ou a visão "Por moto" — essas telas continuam
  operando sobre fichas-filhas (`estoque`) individuais, sem noção de
  família, exatamente como hoje.
- Migrar/fundir automaticamente peças duplicadas sem revisão humana.

Esses pontos ficam de fora *nesta* entrega, mas a Seção "Arquitetura
para expansão futura" abaixo garante que adotá-los depois não exige
reescrever a camada de dados.

## Modelo de dados

### Nova tabela `estoque_familias`

```sql
create table estoque_familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid references categorias(id),
  descricao text,
  imagem_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table estoque add column familia_id uuid references estoque_familias(id);
```

- `estoque.familia_id` é **opcional**. Uma peça sem família continua
  se comportando exatamente como hoje: aparece como linha própria na
  tabela, abre o modal de detalhe mostrando um único grupo (o dela
  mesma). Nada quebra para quem não migrou.
- Uma família agrupa N fichas-filhas (`estoque`), cada uma mantendo
  seu `modelo_moto_id` próprio — é isso que define os grupos
  modelo/ano dentro do modal.
- Migration: `supabase/migration_056_estoque_familias.sql`.

### Unidades passam a ser sempre explícitas

Hoje `estoque_unidades` só ganha registro para uma unidade que é
**diferente** das demais (avaria, apelido, preço próprio, nota
própria) — uma peça com 5 unidades idênticas tem zero fichas, só o
número `estoque.quantidade`.

Nova regra: toda vez que `estoque.quantidade` for definida ou
alterada (criar peça, editar, registrar unidade), o backend garante
que existam exatamente `quantidade` linhas em `estoque_unidades` para
aquele `estoque_id`:

- Se faltar unidade, cria uma "em branco" (sem avaria/apelido/preço
  próprio) preenchida com foto e preço herdados da peça-mãe **apenas
  no backfill de migração** (ver abaixo) — a partir desta entrega,
  todo cadastro de unidade *novo* pelo formulário exige foto e preço
  próprios (ver "Registrar unidade").
- Se `quantidade` diminuir, o backend não apaga unidade que já tenha
  `vendida_em` preenchido ou dado próprio (apelido/avaria/preço/nota)
  — o usuário precisa excluir manualmente a unidade específica antes.
  Reduzir `quantidade` só apaga unidades "em branco" automaticamente,
  das mais recentes para as mais antigas, até bater o número.
- Migration: `supabase/migration_057_estoque_unidades_explicitas.sql`,
  incluindo o backfill que cria as unidades faltantes para todo o
  estoque já cadastrado em produção (cópia de foto/preço da
  peça-mãe como valor inicial, editável depois).

Esta é a mudança de maior risco do projeto — o backfill roda sobre
dados de produção e precisa ser testado num dump antes de aplicar.

### Migração assistida das duplicatas existentes

Não é fusão automática. Reaproveita a heurística de similaridade de
nome já existente em
[`detectarDuplicata.ts`](../../../src/features/estoque/detectarDuplicata.ts)
(Jaccard sobre tokens do nome, corte 0.6) rodando sobre todo o
estoque atual para **sugerir** grupos de família.

Nova tela ("Fundir famílias", acessível a partir de Estoque) lista os
grupos sugeridos lado a lado (nome, modelo, foto de cada ficha) com
checkbox por peça — o usuário confirma/desmarca antes de qualquer
`familia_id` ser gravado. Nenhuma fusão acontece sem clique explícito.

### Arquitetura para expansão futura

Toda lógica de agregação (faixa de preço, contagem de modelos,
unidades disponíveis, ordenação por ano) vive em um módulo puro
compartilhado — não embutida nos componentes de UI do Estoque — para
que Vendas/Orçamentos/outras telas possam adotar o conceito de
família mais tarde reaproveitando as mesmas funções, sem reescrever
a camada de dados.

## Tabela de Estoque (`EstoqueView.tsx`)

- Uma linha da tabela representa uma família (quando `familia_id`
  existe) ou uma ficha avulsa (quando não existe) — comportamento
  atual preservado para fichas avulsas.
- Linha de família mostra um badge de contagem de fichas-filhas ao
  lado do nome.
- Colunas agregadas sobre as fichas-filhas, usando os helpers
  compartilhados (extensão de
  [`valorEstoque.ts`](../../../src/features/estoque/valorEstoque.ts)
  para operar sobre uma lista de `estoque`, não um item só):
  - **Moto**: nome do modelo único, ou "N modelos".
  - **Valor**: preço único, ou faixa "R$ 380 – 480" quando variar
    entre as fichas-filhas.
  - **Quantidade**: soma de `quantidade` de todas as fichas-filhas; a
    cor do indicador (positivo/atenção/crítico) usa a mesma regra de
    hoje (`isEstoqueBaixo`), aplicada ao total.
- Busca e filtros (nome/código/categoria/modelo) passam a também
  considerar os campos das fichas-filhas — buscar "Titan 99" encontra
  a família mesmo que esse texto só apareça no nome de uma
  ficha-filha específica.
- Clique na linha abre o novo modal de família (ver abaixo), tanto
  para famílias quanto para fichas avulsas (que mostram um único
  grupo).

## Componentes animate-ui usados

Confirmado no catálogo de <https://animate-ui.com/docs/components>:
Accordion, Dropdown Menu, Popover e Dialog existem na variante **Radix
UI** do catálogo. Checagem no projeto (não presumir — verificar antes
de decidir se precisa instalar): o pacote unificado `radix-ui`
(`^1.6.7`) **já é dependência do projeto** — não precisa instalar
nada novo. O projeto já tem inclusive versões próprias, animadas com
Motion sobre Radix, de três desses quatro componentes:
[`Modal.tsx`](../../../src/components/ui/Modal.tsx) (Dialog + Motion
spring), [`dropdown-menu.tsx`](../../../src/components/ui/dropdown-menu.tsx)
(DropdownMenu + Motion spring) e
[`popover.tsx`](../../../src/components/ui/popover.tsx) (Popover
custom + Motion, já usado em `EstoqueFiltrosPopover`). O
[`Accordion.tsx`](../../../src/components/ui/Accordion.tsx) existente
é Radix mas anima só com classe CSS (`animate-in`/`fade-in`, sem
Motion) e tem API rígida (lista fixa de itens) que não serve para
grupos com conteúdo dinâmico.

**Decisão do usuário**: construir os 4 componentes (Dialog, Accordion,
Dropdown Menu, Popover) como cópias novas e dedicadas do catálogo
animate-ui.com, em vez de reaproveitar `Modal.tsx`/`dropdown-menu.tsx`/
`popover.tsx` — mesmo isso duplicando funcionalidade equivalente.
**Débito técnico registrado, fora do escopo desta entrega**: depois
que a feature estiver no ar, avaliar consolidar `Modal.tsx`,
`dropdown-menu.tsx` e `popover.tsx` com os novos componentes
animate-ui (mesma receita Radix + Motion, dois lugares fazendo a
mesma coisa).

Arquivos novos, seguindo a convenção de pastas já usada por
`src/components/animate-ui/{primitives,components}/animate/tabs.tsx`
(primitive = lógica/comportamento; component = estilizado com os
tokens do projeto, pronto pra usar):

- `src/components/animate-ui/primitives/radix/dialog.tsx` +
  `src/components/animate-ui/components/radix/dialog.tsx`
- `src/components/animate-ui/primitives/radix/accordion.tsx` +
  `src/components/animate-ui/components/radix/accordion.tsx`
- `src/components/animate-ui/primitives/radix/dropdown-menu.tsx` +
  `src/components/animate-ui/components/radix/dropdown-menu.tsx`
- `src/components/animate-ui/primitives/radix/popover.tsx` +
  `src/components/animate-ui/components/radix/popover.tsx`

Uso nesta entrega:

- **Tabs** (nativo, já instalado) — abas Unidades / Histórico /
  Relacionadas.
- **Dialog** (Radix, novo) — o modal de família em si, e o modal
  empilhado de "Registrar unidade".
- **Accordion** (Radix, novo) — grupos colapsáveis por modelo/ano.
- **Dropdown Menu** (Radix, novo) — menu kebab em cada card de
  unidade.
- **Popover** (Radix, novo) — filtros (Modelo / status / avaria) e o
  seletor de grupo destino em "Mover para outro modelo/ano".
- **Tooltip** (nativo, já instalado) — onde fizer sentido explicar um
  ícone/badge.

`StatusBadge` (customizado, já existente no projeto) continua sendo
usado para os badges de status — não faz parte do catálogo
animate-ui.

## Modal de família

### Header de métricas

Seis números agregados sobre as fichas-filhas da família:

| Métrica | Definição |
|---|---|
| Modelos | nº de grupos modelo/ano distintos |
| Variações | nº total de unidades físicas (soma de fichas em todos os grupos) |
| Em estoque | unidades disponíveis (não vendidas), somadas |
| Valor em estoque | soma do preço resolvido (próprio ou herdado) das unidades disponíveis |
| Faixa de preço | min–max entre as disponíveis (ou preço único se todas iguais) |
| Com avaria | contagem de unidades com avaria e disponíveis |

### Filtros e ações

Busca (apelido/modelo/código), Popover "Modelo" (filtra por grupo),
Popover de status, Popover de avaria — como no mockup. Botões
Selecionar / Venda rápida / Registrar unidade.

### Abas

Unidades (funcional) / Histórico / Relacionadas (desabilitadas,
rótulo "em breve").

### Corpo da aba Unidades — grupos ordenados por ano

Grupos ordenados do modelo mais antigo para o mais novo, extraindo o
primeiro ano numérico do texto livre de `modelos_moto.ano` (que pode
ser "1999", "2004-2008" etc. — precisa de um parser tolerante a
formato).

Cada grupo (`Accordion.Item`): cabeçalho "CG 125 · 2004–2008" + badge
de contagem, linha-resumo ("4 em estoque · R$ 380–480"), lista de
cards de unidade abaixo quando expandido.

Dentro do grupo, badges "Melhor estado" e "Melhor preço" são
**calculados automaticamente** (maior `condicao_nota` / menor preço
entre as unidades disponíveis do grupo) — não é campo manual.

### Card de unidade

Foto, nota de condição, apelido/título ("Padrão" quando sem apelido),
badges de estado (melhor estado / melhor preço / avaria), código RK,
"cadastrada há X" (reutiliza `formatarTempoRelativoCurto`), preço,
status (Disponível/Vendida), menu kebab (editar / excluir / marcar
vendida).

### Rodapé

- **Editar peça**: edita dados da família (`estoque_familias`) — nome,
  categoria, descrição, foto de capa. Editar um grupo específico
  (nome do modelo vem da árvore de motos, não editável aqui) ou uma
  unidade específica é feito no próprio card/grupo.
- **Excluir**: remove a família inteira, com confirmação. Bloqueado
  com aviso se qualquer unidade de qualquer grupo já tiver
  `vendida_em` preenchido (preserva histórico de venda) — nesse caso
  oferece "desvincular peças" (zera `familia_id` de cada ficha-filha,
  preserva tudo o mais) em vez de apagar.
- **WhatsApp**: mantém o comportamento atual.

## Fluxos de ação

### Registrar unidade

Dialog empilhado sobre o modal de família. Passo 1: escolher um grupo
modelo/ano já existente na família **ou** "Novo modelo/ano" (abre o
`MotoCascadeSelect` já usado hoje no cadastro). Passo 2: foto e preço
(agora **obrigatórios** para toda unidade cadastrada por este
formulário), condição, apelido opcional, avaria opcional. Ao salvar:
cria a ficha-filha (`estoque`) se o grupo for novo, ou reaproveita a
existente, e cria a unidade em `estoque_unidades`.

### Venda rápida

Abre o fluxo de nova venda já existente
([`VendasView.tsx`](../../../src/features/vendas/VendasView.tsx)) com
a busca de peça pré-preenchida para mostrar só as fichas-filhas
daquela família — é um atalho de conveniência (pré-filtro), não uma
integração profunda: o `VendasView` continua operando sobre
fichas-filhas (`estoque`) individuais, sem ganhar noção de família,
consistente com o não-objetivo de não propagar o conceito para
Vendas nesta entrega. A partir do pré-filtro, o usuário segue o fluxo
normal (escolher componente/unidade).

### Selecionar (multi-seleção)

Ativa checkboxes nos cards de unidade. Barra de ação com:

- **Excluir selecionadas** — exclusão em lote, mesma regra de
  bloqueio de unidade vendida do "Excluir" da família.
- **Mover para outro modelo/ano** — Popover com a lista de grupos da
  família + opção "novo grupo". Move a(s) unidade(s) selecionada(s)
  para a ficha-filha destino (criando-a se for grupo novo).

## Testes

Seguindo o padrão já usado no projeto (Vitest + Testing Library,
arquivos `*.test.ts(x)` ao lado do código-fonte):

- Helpers de agregação (módulo compartilhado) testados isoladamente:
  família com 1 modelo só, família com múltiplos modelos, preços
  iguais vs. faixa, contagem de avaria, ordenação por ano com formatos
  variados de `modelos_moto.ano` ("1999", "2004-2008", vazio/nulo).
- Regra de sincronização de `estoque_unidades` com `quantidade`
  testada no backend: criar peça nova cria N unidades em branco;
  aumentar quantidade cria as que faltam; diminuir quantidade apaga só
  as "em branco" mais recentes; diminuir além do que sobra sem dado
  próprio é bloqueado com erro claro.
- Teste de render do modal de família cobrindo agrupamento por
  modelo/ano e a ordem correta dos grupos.
- Teste do backfill de migração (`migration_057`) rodado sobre uma
  cópia/dump antes de aplicar em produção.

## Fases de implementação

1. Schema + migrations (056, 057) + backend (`estoque_familias` CRUD,
   regra de sincronizar `estoque_unidades` com `quantidade`).
2. Helpers de agregação compartilhados (faixa de preço, contagem,
   ordenação por ano).
3. Tabela de Estoque: linha de família + busca/filtro estendidos.
4. Construir os 4 componentes animate-ui Radix dedicados
   (Dialog/Accordion/Dropdown Menu/Popover) e montar o modal de
   família com eles, com a aba Unidades completa e
   Histórico/Relacionadas como placeholder desabilitado.
5. Fluxos: Registrar unidade, Venda rápida, Selecionar
   (excluir/mover em lote), Editar peça/Excluir família.
6. Tela de sugestão de fusão (migração assistida das duplicatas já
   cadastradas).

## Decisões registradas (para não virarem ambiguidade depois)

- Família é um agrupamento opcional — peça avulsa sempre continua
  funcionando sem família.
- Fusão de duplicatas existentes é sempre assistida por sugestão +
  confirmação manual, nunca automática/silenciosa.
- Toda unidade física vira card individual no modal, mesmo sem
  diferença em relação às demais (sem "resumo agregado" de unidades
  idênticas).
- Foto e preço são obrigatórios ao registrar unidade nova pelo
  formulário; unidades criadas pelo backfill de migração herdam
  foto/preço da peça-mãe como valor inicial editável.
- "Registrar unidade" permite tanto adicionar a um grupo existente
  quanto criar um grupo novo, no mesmo fluxo.
- Escopo desta entrega é só o módulo Estoque; a camada de dados é
  desenhada para permitir expansão futura sem reescrita.
