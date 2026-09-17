# Especificação — Fichas individuais na Lista e SKU por unidade

**Status:** aprovada para planejamento; implementação e migration de produção aguardam execução controlada.

**Objetivo:** fazer com que cada unidade física de uma peça possa ser consultada e completada a partir de **Estoque → Lista → Ver mais detalhes**, sem confundir fotos da peça-pai com fotos da unidade. Cada unidade terá SKU numérico único e permanente.

## Decisões de produto confirmadas

1. Uma ficha só é **completa** quando possui ao menos uma foto própria e um valor próprio maior que zero.
2. Cada unidade deve ter sua própria foto; imagens da peça-pai nunca contam como imagem da unidade.
3. A venda de uma unidade incompleta é permitida, mas a tela de venda deve alertar visivelmente o operador.
4. Após aumentar a quantidade/adicionar um lote, o operador pode abrir a primeira ficha pendente.
5. Cada unidade física recebe um SKU global, numérico, exclusivo e permanente.
6. A implantação inicial numera todas as unidades existentes em ordem de criação crescente; portanto, a mais recente recebe o maior SKU. Novas unidades recebem sempre o próximo número. SKUs antigos não são renumerados em inclusões futuras.
7. A unidade vendida preserva ficha e SKU para rastreabilidade.

## Problema confirmado

No item `MESA COMPLETA CG 125` com 12 unidades, a Lista abre `EstoqueItemExpandido`, que mostra apenas categoria, anúncios e as fotos de `Estoque.imagens`. Não há lista nem edição das fichas.

No código remoto que corresponde à produção, `src/server/fotosUnidade.ts` aplica `item.imagens` como fallback de `unidade.fotos`. Como a migration 057 cria fichas físicas vazias, essa transformação faz uma ficha vazia parecer fotografada e impede que a pendência seja calculada corretamente.

## Escopo

Entra:

- Detalhe da Lista com resumo, unidades e anúncios.
- Consulta, edição e conclusão de fichas existentes.
- Estado explícito de ficha completa/incompleta, foto de referência e preço próprio.
- Alerta não bloqueante na venda de ficha incompleta.
- SKU por unidade, migration nova, backfill e sequência de geração.
- Testes de regras puras, API, componentes e roteiro manual.

Não entra:

- Reatribuir fotos históricas às unidades automaticamente.
- Alterar RPCs `registrar_venda`/`cancelar_venda` ou dividir sua atomicidade.
- Criar uma interface visual do zero ou instalar dependências.
- Executar migration, backfill, deploy, commit ou alteração de dados reais sem autorização operacional específica.

## Base e colaboração obrigatórias

O checkout local `main` não contém a implementação atual de gavetas/unidades; o código compatível com a produção está em `origin/main`. Antes de qualquer código:

1. Criar worktree/branch a partir de `origin/main` atual, nunca da cópia local antiga.
2. Confirmar com `git status --short --branch` que não há trabalho concorrente nos arquivos abaixo.
3. Ler `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md`, `CLAUDE.md` e esta especificação.
4. Não tocar em dados reais durante a validação de desenvolvimento.

## Componentes existentes a reutilizar

| Necessidade | Componentes existentes | Regra de uso |
| --- | --- | --- |
| Navegação do detalhe | `animate-ui/.../tabs.tsx` | Abas `Resumo`, `Unidades` e `Anúncios`; não criar uma barra de abas nova. |
| Consulta de ficha | `Modal`, `UnidadeDetailDialog` | Manter foco, Esc, scroll lock e animações do modal existente. |
| Edição da ficha | `UnidadeForm`, `Button`, `CurrencyInput` | Editar é uma ação explícita dentro da ficha. |
| Linhas de unidades | `UnidadeRow` | Reutilizar a linha acessível, sem criar um card paralelo para a Lista. |
| Pendências | `PendenciaChip`, `PendenciaVarianteChips`, `ResumoPendenciasChips` | Ícone + texto; nunca cor isolada. |
| Disponíveis/vendidas | `Accordion` ou `Expandable` | Vendidas começam recolhidas. |
| Feedback | `aviso`/Sonner toast | Após salvar, erro e CTA “Abrir primeira pendente”. |
| Números do resumo | `AnimatedNumber` | Usar apenas onde já houver resumo numérico; respeitar redução de movimento. |

Não criar progress bar, modal, drawer, toast, accordion ou sistema de animação novo.

## Modelo de dados e contratos

### Contrato da unidade

Adicionar a `EstoqueUnidade` e a `EstoqueUnidadeInput` somente o campo abaixo:

```ts
interface EstoqueUnidade {
  // campos atuais
  sku: number;
}
```

`sku` é imutável pela interface e não é aceito no payload de criação/edição normal. O backend o gera; PATCH não pode alterá-lo.

### Regras puras de apresentação

Criar, no domínio de estoque, helpers sem I/O:

```ts
export function fichaEstaCompleta(unidade: EstoqueUnidade): boolean {
  return unidade.fotos.length > 0 && Number(unidade.valor) > 0;
}

export function pendenciasObrigatoriasDaFicha(unidade: EstoqueUnidade): ('sem_foto' | 'sem_preco')[];
```

- `foto_legada` é informativa: a referência existe na peça-pai, mas não satisfaz `sem_foto`.
- Valor herdado da variante continua disponível para consulta, porém não satisfaz a ficha completa.
- O estado “ficha pendente” não depende de nome, avaria, descrição ou nota; esses campos permanecem opcionais.

### Fotos: contrato de leitura

`anexarUnidades` deve devolver `unidade.fotos` exatamente como persistido. Remover o fallback de `fotosEfetivasDaUnidade` no payload de API.

- `Estoque.imagens` permanece preservado e pode aparecer em seção secundária “Fotos de referência da peça”.
- A galeria principal da ficha usa exclusivamente `unidade.fotos`.
- Nenhuma foto histórica é duplicada, removida ou atribuída a uma unidade durante essa mudança.

### Endpoints

Preservar e reutilizar:

```text
PATCH /api/estoque/:id/unidades/:unidadeId
GET   /api/estoque
POST  /api/vendas
```

O PATCH atual é o fluxo correto para completar fichas físicas já criadas pela migration 057. Não usar `POST /:id/unidades` para completar uma ficha do lote, pois essa rota impede criar mais fichas que a quantidade física.

## Migration de SKU — somente após autorização operacional

Criar uma **nova** migration, sem editar as já aplicadas. Ela deve:

1. Adicionar `estoque_unidades.sku bigint` inicialmente anulável.
2. Criar uma sequence exclusiva, por exemplo `estoque_unidades_sku_seq`.
3. Preencher todas as unidades existentes com `row_number()` ordenado por `criado_em ASC, id ASC`.
4. Ajustar a sequence para o maior SKU preenchido.
5. Definir `DEFAULT nextval(...)`, `NOT NULL` e `UNIQUE` em `sku`.
6. Garantir que as inserções automáticas de `sincronizar_unidades_estoque` recebam o default da sequence.
7. Atualizar os `select`/tipos do backend para devolver SKU.

Pré-condições da execução em produção:

- backup ou snapshot verificável;
- ensaio em staging/cópia de dados;
- consulta de pré-checagem para unidades sem SKU, duplicidades e ordem calculada;
- janela operacional, pois o estoque será reindexado logicamente;
- smoke test de criar quantidade, completar ficha, vender ficha e cancelar venda;
- plano de reversão: a migration não deve apagar unidade nem foto; se a validação falhar antes de `NOT NULL`/`UNIQUE`, parar sem avançar as constraints.

## Fluxos de interface

### 1. Lista → detalhes → completar ficha

1. Operador abre `Ver mais detalhes` na Lista.
2. O detalhe usa as abas existentes:
   - **Resumo:** identificação, estoque, pendências agregadas e fotos de referência.
   - **Unidades:** `N completas`, `N pendentes`, lista de disponíveis e seção recolhida de vendidas.
   - **Anúncios:** conteúdo já existente.
3. Cada `UnidadeRow` mostra SKU, estado textual e miniatura somente quando houver foto própria.
4. Ficha sem foto/valor mostra placeholder tracejado e chip `Ficha incompleta`; toque abre `UnidadeDetailDialog`.
5. O diálogo mostra “Pendências desta ficha” e o botão existente `Completar ficha`/`Editar unidade`.
6. Ao salvar foto própria e valor próprio, atualizar dados, retornar à lista e mover a unidade para o total completo.

### 2. Lote novo

Depois de criar/editar uma peça cuja quantidade aumentou e a sincronização criar fichas físicas:

- mostrar toast: `12 fichas criadas — 12 pendentes`;
- oferecer ação `Abrir primeira pendente`;
- se o operador aceitar, abrir diretamente o `UnidadeDetailDialog` da primeira unidade disponível e incompleta;
- não abrir automaticamente sem ação do usuário.

### 3. Venda de ficha incompleta

No modal de nova venda, quando uma ficha específica for selecionada:

- mostrar SKU, preço próprio/efetivo e chips de pendência;
- se faltar foto ou preço próprio, exibir aviso amarelo textual: `Ficha incompleta: sem foto própria` e/ou `sem preço próprio`;
- a ação de vender permanece disponível, conforme decisão de produto;
- seleção de “unidade genérica” não recebe alerta de uma ficha que não foi escolhida.

Não alterar o payload da venda nem a RPC; o alerta é preventivo na interface.

## Plano de implementação

### Etapa 0 — Fixar base e testes de caracterização

**Arquivos:** `src/features/estoque/EstoqueView.tsx`, `EstoqueItemExpandido.tsx`, `types.ts`, `src/server/fotosUnidade.ts`, `src/server/routes/estoque.ts`.

- Validar que a branch contém `src/features/estoque/gaveta/`.
- Adicionar testes para: API não fazer fallback de fotos; unidade sem foto/valor ser pendente; referência não completar ficha.
- Reproduzir o item de 12 unidades em ambiente não produtivo ou fixture.

**Aceite:** os testes falham com o comportamento legado e descrevem a regra nova.

### Etapa 1 — Corrigir dados retornados e estado de completude

**Arquivos:** `src/server/fotosUnidade.ts`, `src/server/routes/estoque.ts`, `src/features/estoque/types.ts`, `gaveta/pendenciasGaveta.ts`, testes correlatos.

- Retornar fotos próprias cruas.
- Incluir distinção entre referência e ausência de foto própria.
- Definir completude exclusivamente por foto própria + valor próprio.
- Revisar `UnidadeRow` para que uma unidade vazia permaneça pendente mesmo se a peça tiver imagens.

**Aceite:** nenhuma unidade vazia recebe imagem da peça-pai ou status de concluída.

### Etapa 2 — Levar as fichas para o detalhe da Lista

**Arquivos:** `EstoqueItemExpandido.tsx`, possivelmente `EstoqueItemDetailDialog.tsx`, `gaveta/UnidadeRow.tsx`, `gaveta/UnidadeDetailDialog.tsx`, `gaveta/UnidadeForm.tsx`, `gaveta/PendenciaBadges.tsx`.

- Compor os componentes existentes; não duplicar markup da ficha.
- Inserir Tabs animadas no detalhe e manter conteúdo atual em Resumo/Anúncios.
- Adicionar aba Unidades, consulta e edição explícita.
- Mostrar SKU, completos/pendentes e seção de vendidas recolhida.
- Garantir foco, Escape, labels e navegação por teclado.

**Aceite:** de uma linha da Lista, o usuário completa qualquer uma das 12 fichas sem ir a outra tela.

### Etapa 3 — Ajustar formulário e sequência do lote

**Arquivos:** `gaveta/UnidadeForm.tsx`, ponto que altera quantidade em `EstoqueView.tsx`, toast existente.

- Tornar foto e preço próprios requisitos para a ação de conclusão.
- Manter campos opcionais como nome, descrição, avaria e nota.
- Reaproveitar `onSalvarEContinuar` onde aplicável.
- Adicionar CTA de toast para abrir a primeira ficha pendente após criar lote.

**Aceite:** a ficha não é marcada como completa sem os dois dados e o operador tem caminho curto para a próxima.

### Etapa 4 — SKU por unidade

**Arquivos:** nova `supabase/migration_XXX_sku_unidades.sql`, `types.ts`, `src/server/routes/estoque.ts`, selects/fixtures/testes relacionados.

- Implementar a migration somente depois de aprovada para o ambiente-alvo.
- Exibir SKU como número legível em Linha, Ficha e escolha de venda.
- Nunca expor edição de SKU na interface.
- Validar valor único nos testes e no smoke test pós-migration.

**Aceite:** cada ficha, inclusive vendida, possui um SKU único; a próxima unidade criada recebe `maior SKU + 1`.

### Etapa 5 — Alerta de venda

**Arquivos:** `src/features/vendas/VendasView.tsx`, testes de venda/componentes se existentes.

- Calcular pendência da ficha selecionada com o helper comum.
- Mostrar alerta não bloqueante, sem mudar `vendasApi.registrar` ou `registrar_venda`.
- Exibir SKU no botão de seleção da ficha para evitar escolha ambígua.

**Aceite:** o operador enxerga o risco antes de confirmar a venda, mas a transação permanece a mesma e atômica.

### Etapa 6 — Validação e revisão

- Rodar testes focados, `npm run lint` e `npm run build`.
- Roteiro manual desktop e mobile: Lista → unidade vazia → concluir foto/valor → próxima; referência legada; venda de ficha incompleta; venda de ficha completa; cancelamento; teclado; zoom de 200%.
- Revisar `git diff --check` e todos os arquivos críticos.
- Reexecutar `ux-user-audit` após implementação e registrar antes/depois.

## Critérios globais de aceite

- Lista não mostra foto da peça-pai como foto da unidade.
- Unidades vazias são visíveis, acionáveis e identificadas como incompletas.
- Foto própria e valor próprio são obrigatórios para completar ficha.
- A ficha individual é acessível pela Lista e editável por ação explícita.
- Referências históricas continuam disponíveis, rotuladas e sem mutação.
- Venda selecionada por ficha alerta sobre incompletude, sem bloquear nem alterar a RPC financeira.
- SKU é único, permanente, sequencial e preservado após venda.
- Interface usa somente os componentes existentes listados acima.

## Riscos e revisão humana necessária

- A migration de SKU altera dados reais e exige autorização operacional separada, backup e ensaio.
- A divergência entre checkout local e `origin/main` deve ser resolvida antes de codificar.
- Upload de fotos deve ser validado em dispositivo móvel real; não se deve assumir que uma foto enviada e não salva foi vinculada a uma ficha.
- O alerta de venda não é bloqueio de qualidade; a gerência deve monitorar se a operação começa a vender fichas incompletas com frequência.
