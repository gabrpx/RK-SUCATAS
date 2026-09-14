# Fatia 1 — Clientes: primeira migração real pros átomos + fim do "Juazeirinho-PB" digitado

**Data:** 2026-08-29
**Escopo:** Piloto real dos átomos da Fatia 0. Migra `src/features/clientes/*` pros novos componentes; introduz `estado` como coluna separada no banco; corrige R10 (a11y de Select/Combobox) que estava parked.
**Fatia dentro do plano maior:** ver seção "Contexto do projeto".

---

## Contexto do projeto

Fatia 0 (base do design system) foi mergeada em `main` no commit `c88152e`, disponibilizando ~29 átomos em `src/components/ui/` e uma escala de tokens/motion — sem mudar visualmente nenhuma tela. Fatia 1 (esta) é a **primeira consumidora real**: a feature Clientes vira o piloto que valida o padrão antes das fatias maiores (Estoque, ML, Vendas).

Decisões trazidas do brainstorming (aprovadas em conversa):

- **Backfill automático + UI limpa** para dados legados no campo `cidade`: migration parseia o padrão "Cidade - UF" via regex SQL, split em duas colunas; registros que não casarem ficam com `cidade` intacta e `estado=NULL` (sem badge de aviso ao usuário).
- **Fixar Ruling R10** aqui (extender Select/Combobox com `aria-labelledby` combinando label + valor) — afeta TODAS as fatias seguintes, então quanto antes melhor.
- **Faseado em duas etapas**: 1a (backend + migration) → checkpoint de aprovação + rodar migration em produção → 1b (frontend refactor). Reduz blast radius e permite deploy do backend antes do bundle novo.
- **Máscaras BR aplicadas completas** ao form: `PhoneInput` + `DocInput` + `CepInput` + `StateCitySelect`. Clientes vira o piloto completo dos átomos formatados.

---

## Design read

Feature interna operacional, dark-only, PWA/APK. Base já é Tailwind v4 + tokens semânticos. Refactor é substituição de HTML crus pelos átomos existentes — nenhum comportamento novo além de: (a) `estado` como campo separado, (b) máscaras nos inputs formatáveis, (c) autofill CEP estruturado, (d) a11y correta no Select/Combobox.

Regras herdadas do [CLAUDE.md](../../../CLAUDE.md) que continuam obrigatórias:
- Cor sempre com significado.
- Um único CTA `variant="accent-cta"` por tela (o form tem um "Salvar" — esse é o único accent).
- Todo alerta com ação associada.
- Hierarquia: número > label.

---

## Seção 1 — Fase 1a: R10 fix + migration + backend

### 1.1 R10 fix (átomos compartilhados)

**Files:** [src/components/ui/Select.tsx](../../../src/components/ui/Select.tsx), [src/components/ui/Combobox.tsx](../../../src/components/ui/Combobox.tsx), respectivos `.test.tsx`.

**Mudança na Select.tsx (mesma no Combobox.tsx):**
- Gerar dois ids via `React.useId()`: `labelId` e `valueId`.
- Wrap o label `<label>` com `id={labelId}`.
- Wrap o valor renderizado dentro do `<button>` com `<span id={valueId}>`.
- Wire `aria-labelledby={label ? `${labelId} ${valueId}` : undefined}` no botão.

**Efeito:** screen reader lê "Estado: Paraíba" em vez de só "Estado" ou só "Paraíba". API pública dos átomos permanece intacta — consumers que já passavam `label` ganham a a11y correta sem mudar nada.

**Testes:** cada `.test.tsx` ganha 1 assert extra:
```ts
it('aria-labelledby combina label id + value id quando label passado', () => {
  render(<Select label="Estado" options={opts} value="a" onChange={()=>{}} />);
  const btn = screen.getByRole('button');
  const aria = btn.getAttribute('aria-labelledby');
  expect(aria).toBeTruthy();
  expect(aria!.split(' ')).toHaveLength(2);
});
```

**Simplificação em consequência:** [StateCitySelect.tsx](../../../src/components/ui/StateCitySelect.tsx) volta a passar `label` normal para Select e Combobox e remove os `<span>` externos (workaround da Fatia 0).

### 1.2 Migration 055 — clientes_estado_split

**File:** `supabase/migration_055_clientes_estado_split.sql`

```sql
-- =============================================================================
-- RK Sucatas — Migração 055: split de clientes.cidade em (cidade, estado)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 054).

-- 1) Adiciona a nova coluna. NULL permitido — legados que não casarem no
-- backfill ficam com estado=NULL e cidade intacta (regra do UI: mostra só o
-- que tem, sem badge de aviso).
alter table clientes add column if not exists estado char(2);

-- 2) Backfill best-effort:
-- Casos aceitos: "Juazeirinho - PB" e "Juazeirinho-PB" (com ou sem espaço).
-- Estado só é preenchido se for uma UF real do Brasil — regex genérica não
-- pega endereços tipo "Rua João - AB".
-- Sequência: primeiro os que casam "Cidade - UF" (com espaço), depois "Cidade-UF"
-- (sem espaço) para não deixar bagunça.
with brazilian_ufs as (
  select unnest(array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]) as uf
)
update clientes c
set
  estado = split_uf,
  cidade = split_cidade
from (
  select
    id,
    trim(split_part(cidade, ' - ', 1)) as split_cidade,
    upper(trim(split_part(cidade, ' - ', 2))) as split_uf
  from clientes
  where cidade ~ '^.+ - [A-Za-z]{2}$'
) parsed
where c.id = parsed.id
  and parsed.split_uf in (select uf from brazilian_ufs);

with brazilian_ufs as (
  select unnest(array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]) as uf
)
update clientes c
set
  estado = split_uf,
  cidade = split_cidade
from (
  select
    id,
    trim(split_part(cidade, '-', 1)) as split_cidade,
    upper(trim(split_part(cidade, '-', 2))) as split_uf
  from clientes
  where cidade ~ '^.+-[A-Za-z]{2}$'
    and estado is null
) parsed
where c.id = parsed.id
  and parsed.split_uf in (select uf from brazilian_ufs);

NOTIFY pgrst, 'reload schema';
```

**Rollback:** trivial — `alter table clientes drop column estado;`. Cadastros novos vão em duas colunas separadas; se rollback for necessário, novos cadastros ainda funcionam via `cidade` (frontend passa a mandar `cidade` formatado antigo → mas isso é rollback do frontend em conjunto).

### 1.3 Backend `src/server/routes/clientes.ts`

- Adicionar `'estado'` ao array `CAMPOS_EDITAVEIS` na linha 16.
- Validação: em POST/PATCH, aceitar `estado` como string com regex `/^[A-Z]{2}$/` ou `null`. Rejeitar formatos inválidos com 400.
- Leitura: nenhuma mudança — `select *` já retorna a coluna nova depois da migration.

Não há suite Vitest de backend nesta repo (memória confirma: dev server via `tsx server.ts` sem watch, sem test:server). Verificação = arrancar dev, criar cliente novo via curl/HTTPie com `estado: 'PB'`, ler de volta. Documentar comando no reporte.

---

## Seção 2 — Fase 1b: Frontend refactor

### 2.1 [src/features/clientes/types.ts](../../../src/features/clientes/types.ts)

```ts
export interface Cliente {
  // ...campos existentes...
  cidade: string | null;
  estado: string | null;                              // NOVO — CHAR(2)
}

export interface ClienteInput {
  // ...campos existentes...
  cidade?: string | null;
  estado?: string | null;                             // NOVO
}
```

### 2.2 [ClienteFormModal.tsx](../../../src/features/clientes/ClienteFormModal.tsx) (365 linhas)

Refactor cirúrgico — substituir HTML crus pelos átomos:

| Campo atual | Vira |
|---|---|
| `<input>` texto — nome | `<Input label="Nome" />` |
| `<input>` texto — RG | `<Input label="RG" />` |
| Texto livre — telefone | `<PhoneInput label="Telefone" />` |
| Texto livre — documento | `<DocInput label="CPF/CNPJ" onValidityChange={...} />` |
| `<input>` CEP + botão buscar | `<CepInput onAutoFill={({estado, cidade, bairro, rua}) => onFormChange({...})} />` |
| `<input>` cidade concatenado | `<StateCitySelect value={{estado, cidade}} onChange={({estado, cidade}) => onFormChange({...})} />` |
| `<textarea>` observações | `<Textarea autoResize />` |

**Mudanças pontuais:**
- Remover helper local `formatTelefoneBR` (obsoleto — `PhoneInput` cuida).
- CEP autofill (linha ~155 hoje): trocar `cidade: '${result.cidade} - ${result.uf}'` por `onAutoFill` estruturado.
- Estado do form ganha campo `estado: string`.
- Preservar API pública do componente (`onFormChange`, `onSubmit`, mesmos props) — `ClientesView` continua importando sem mudar.

**Testes:** [ClienteFormModal.test.tsx](../../../src/features/clientes/ClienteFormModal.test.tsx) (131 linhas) — adaptar asserts pros novos átomos + adicionar:
- Trocar UF esvazia cidade.
- CEP válido dispara `onFormChange` com estado + cidade + bairro + rua estruturados.

### 2.3 [ClientesView.tsx](../../../src/features/clientes/ClientesView.tsx) (814 linhas)

Mudança mínima — só a exibição:
- Linha 470 (`{ key: 'cidade', ... render: (c) => c.cidade || '—' }`) vira `render: (c) => formatarCidade({estado: c.estado, cidade: c.cidade}) || '—'`.
- Linha 528 (`c.cidade ? ` · ${c.cidade}` : ''`) vira `formatarCidade({estado: c.estado, cidade: c.cidade})`.
- Grepar por outros usos de `c.cidade` na tela e aplicar o mesmo.

Filtro/busca continua matching contra `c.cidade` textualmente — funciona tanto para dados backfilled quanto pra "Juazeirinho - PB" legado.

### 2.4 [ClienteDetalheModal.tsx](../../../src/features/clientes/ClienteDetalheModal.tsx) (493 linhas)

- Linha 233 (`cidade={cliente.cidade}`) passa a receber `estado + cidade` e aplica `formatarCidade` no ProfileCard, ou passa os dois campos e ProfileCard formata.

### 2.5 [ClienteProfileCard.tsx](../../../src/features/clientes/ClienteProfileCard.tsx) (176 linhas)

- Aceitar `estado?: string | null` na prop.
- Linha 132 (`{cidade || '—'}`) usa `formatarCidade({estado, cidade}) || '—'`.

### 2.6 [api.ts](../../../src/features/clientes/api.ts)

- Adicionar `estado` no payload dos POST/PATCH (backend já aceita depois da 1a).
- Nenhuma mudança na leitura.

### 2.7 Patch notes v1.3.9

Adicionar item ao topo de [src/features/patchnotes/data.ts](../../../src/features/patchnotes/data.ts):

```
Cadastro de cliente ficou mais gostoso: Estado e Cidade agora são
campos separados (chega de digitar "Juazeirinho-PB"), telefone e
CPF/CNPJ com formatação automática enquanto você digita, CEP preenche
endereço sozinho e valida se o CPF/CNPJ é real.
```

---

## Seção 3 — Riscos + guardrails

**R1 — Regex do backfill pega false positive.** UF-whitelist no WHERE evita "Rua João - AB" virar `estado='AB'`. Se a UF não estiver no dataset IBGE-BR, o registro fica intocado. Cost se errar: um punhado de cadastros ganha estado inválido — reversível editando manualmente.

**R2 — Deploy do backend antes do frontend.** Fase 1a landa em produção sozinha; frontend antigo continua funcionando (não manda `estado`, backend aceita omissão). Rollback = drop coluna. Cost: janela de horas/dias entre 1a e 1b onde clientes novos ficam com `estado=NULL` — ok, é o mesmo estado dos backfilled não-casados.

**R3 — StateCitySelect depende do dataset IBGE (85KB lazy).** Já em `main`. Primeira abertura do form provoca dynamic import (~100ms). Aceitável para form de cadastro.

**R4 — Cadastros que não casam no backfill.** Ficam com `cidade` texto original + `estado=NULL`. `formatarCidade` renderiza só `cidade`. Sem badge. Usuário nem percebe até editar. Cost: base "meio suja" persistente — mas invisível.

**R5 — Testes existentes de ClienteFormModal/ClienteDetalheModal quebram no refactor.** Adaptar como parte da mesma task, não deferir.

**R6 — R10 fix pode desestabilizar Fatia 0 tests.** Select.test.tsx e Combobox.test.tsx precisam do novo assert; testes antigos continuam válidos (aria-labelledby ganha valor em vez de perder). Cost baixo — pattern estabelecido.

---

## Arquivos afetados

**Novos:**
- `supabase/migration_055_clientes_estado_split.sql`

**Modificados (Fase 1a):**
- `src/components/ui/Select.tsx` — aria-labelledby combinado
- `src/components/ui/Combobox.tsx` — aria-labelledby combinado
- `src/components/ui/Select.test.tsx` — 1 assert extra
- `src/components/ui/Combobox.test.tsx` — 1 assert extra
- `src/components/ui/StateCitySelect.tsx` — remove workaround dos spans externos
- `src/server/routes/clientes.ts` — CAMPOS_EDITAVEIS + validation

**Modificados (Fase 1b):**
- `src/features/clientes/types.ts` — Cliente/ClienteInput ganham `estado`
- `src/features/clientes/ClienteFormModal.tsx` — refactor cirúrgico com átomos
- `src/features/clientes/ClienteFormModal.test.tsx` — testes atualizados
- `src/features/clientes/ClientesView.tsx` — 2-3 usos de `formatarCidade`
- `src/features/clientes/ClienteDetalheModal.tsx` — passa `estado`
- `src/features/clientes/ClienteProfileCard.tsx` — aceita `estado`
- `src/features/clientes/api.ts` — envia `estado`
- `src/features/patchnotes/data.ts` — v1.3.9

---

## Deliverable

- Migration 055 pronta pra rodar em produção (backfill best-effort de "Cidade - UF").
- Backend aceitando `estado` em CRUD de cliente.
- R10 resolvido nos átomos — todas fatias seguintes herdam a11y correta.
- ClienteFormModal usando 6 átomos da Fatia 0 (Input, PhoneInput, DocInput, CepInput, StateCitySelect, Textarea).
- ClientesView + ProfileCard + DetalheModal renderizando via `formatarCidade`.
- Suite de testes verde (368 baseline + ~4 novos = ~372).
- Patch notes v1.3.9.

Estimativa: 3-4 sessões grandes (Fase 1a: 1 sessão; Fase 1b: 2-3 sessões — o refactor do FormModal tem edge cases).

---

## Fora de escopo

- Filtro por UF na ClientesView (deferido por escolha na conversa).
- Testes de backend (sem infra hoje; verificação manual documentada).
- Migrar `window.confirm` em Clientes (não há — grep confirmou zero).
- Filtros de busca por estado (não pedido; se precisar depois, adição de 1 hora).
- Fixar Ruling R14 (dashboard reduced-motion) — Fatia 6.
- R16, R17 — outras fatias.
