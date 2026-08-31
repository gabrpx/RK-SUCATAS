# Fatia 1 — Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a feature Clientes pros átomos da Fatia 0, introduzir `estado` como coluna separada de `cidade` (com backfill best-effort do formato "Cidade - UF" legado), e fixar Ruling R10 (a11y Select/Combobox) nos átomos compartilhados.

**Architecture:** Faseado em duas etapas separadas por CHECKPOINT humano — Fase 1a (R10 fix + migration + backend) deploya sozinha; usuário roda a migration em produção; Fase 1b (frontend refactor com 6 átomos) deploya depois. Fase 1a NÃO quebra nada em produção mesmo com o bundle antigo rodando, porque o backend aceita `estado` opcional e clientes já existentes ficam com `estado` NULL até serem editados.

**Tech Stack:** React 18 + Tailwind v4 + motion/react + Radix + shadcn/cva + Vitest (jsdom + @testing-library/react) + Supabase (SQL migrations). Sem infra de teste no backend Node — verificação manual via curl.

**Spec:** [docs/superpowers/specs/2026-08-29-fatia-1-clientes-design.md](../specs/2026-08-29-fatia-1-clientes-design.md)

## Global Constraints

- **Tailwind v4 CSS-first only.** Nunca hex direto — sempre tokens (`bg-surface-inset`, `text-text-primary`, `rounded-control`, `border-border-default`, `text-danger`, etc.).
- **App é dark-only.** Sem variantes `dark:`.
- **Só animar `transform` / `opacity` / `filter`.** Nunca `width/height/top/left`.
- **Testes de componente com jsdom** exigem no topo do arquivo:
  ```ts
  // @vitest-environment jsdom
  import { afterEach } from 'vitest';
  import { cleanup } from '@testing-library/react';
  import '@testing-library/jest-dom/vitest';
  afterEach(cleanup);
  ```
- **Alias `@/` resolve pra RAIZ do projeto**, não `src/`. Imports usam `@/src/components/...` (Ruling R13).
- **Sem `@types/react` instalado.** Para `React.HTMLAttributes` etc, usar intersection type (`type X = Base & {...}`), nunca `interface X extends React.HTMLAttributes<...>` (Ruling R15).
- **Verificação:** `npm run lint` (não existe script `typecheck`) e `npm test` (Ruling R4).
- **AnimatePresence + tests:** aplicar mock `vi.mock('motion/react', ...)` seguindo o padrão de [ClienteDetalheModal.test.tsx](../../../src/features/clientes/ClienteDetalheModal.test.tsx) quando o teste depende de unmount síncrono (Ruling R9).
- **`<Modal>` deste projeto tem API portuguesa**: `aberto` / `onFechar` / `titulo` / `subtitulo` / `icone` / `tamanho` / `rodape` (não `isOpen`/`onClose`/`title`). Ele fica em [src/components/ui/Modal.tsx](../../../src/components/ui/Modal.tsx).
- **Migration ordering:** próximo número é 055. Rodar em ordem, sem pular.
- **Backend dev server não recarrega automaticamente** — mudança em `src/server/routes/*.ts` exige restart manual do `npm run dev` (Ruling do repo). Executor documenta no report onde manda o usuário reiniciar.
- **Sempre atualizar patch notes** — última task do plano faz isso (regra do repo).

---

## Fase 1a — Backend + a11y (deployável independente)

## Task 1: R10 fix — Select `aria-labelledby` combinado

**Files:**
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: comportamento a11y aprimorado — `aria-labelledby` no `<button>` passa a combinar `labelId` + `valueId` (dois espaços separados). API pública inalterada.

- [ ] **Step 1: Ler o arquivo atual e localizar o padrão**

Run: abrir `src/components/ui/Select.tsx`. Localizar linha que define `const uid = React.useId();` e o `<button aria-labelledby={label ? uid : undefined}>`.

- [ ] **Step 2: Escrever o teste novo (adicionar ao final do describe existente)**

Editar `src/components/ui/Select.test.tsx` adicionando dentro do `describe('<Select>', () => { ... })`:

```tsx
it('aria-labelledby combina id do label + id do valor quando label passado', () => {
  render(<Select label="Estado" options={opts} value="b" onChange={() => {}} />);
  const btn = screen.getByRole('button');
  const aria = btn.getAttribute('aria-labelledby');
  expect(aria).toBeTruthy();
  const parts = aria!.split(' ');
  expect(parts).toHaveLength(2);
  // Ambos os ids devem existir no DOM
  parts.forEach((id) => {
    expect(document.getElementById(id)).not.toBeNull();
  });
});

it('aria-labelledby ausente quando label não passado', () => {
  render(<Select options={opts} value="a" onChange={() => {}} />);
  const btn = screen.getByRole('button');
  expect(btn.getAttribute('aria-labelledby')).toBeNull();
});
```

- [ ] **Step 3: Rodar teste — deve falhar**

Run: `npx vitest run src/components/ui/Select.test.tsx`
Expected: FAIL — aria-labelledby atual tem só 1 id (o `uid` do label).

- [ ] **Step 4: Implementar mudança em Select.tsx**

Localizar o bloco `const uid = React.useId();` e a estrutura do `<label>`/`<button>`. Substituir:

```tsx
// ANTES
const uid = React.useId();
// ...
<label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>
// ...
<button
  ...
  aria-labelledby={label ? uid : undefined}
>
  <span className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
  ...
</button>
```

Por:

```tsx
// DEPOIS
const labelId = React.useId();
const valueId = React.useId();
// ...
<label id={labelId} className="text-xs font-medium text-text-secondary">{label}</label>
// ...
<button
  ...
  aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
>
  <span id={valueId} className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
  ...
</button>
```

Renomear todas as referências a `uid` no arquivo pra `labelId` (deve ser só o `<label>`).

- [ ] **Step 5: Rodar teste — deve passar**

Run: `npx vitest run src/components/ui/Select.test.tsx`
Expected: PASS — todos os asserts do arquivo, incluindo os 2 novos.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Select.tsx src/components/ui/Select.test.tsx
git commit -m "fix(Select): a11y — aria-labelledby combina label + valor (R10)

Screen reader passa a ler 'Estado: Paraíba' em vez de só 'Estado' ou só
'Paraíba'. Ruling R10 corrigido na fonte."
```

---

## Task 2: R10 fix — Combobox `aria-labelledby` combinado

**Files:**
- Modify: `src/components/ui/Combobox.tsx`
- Modify: `src/components/ui/Combobox.test.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: mesma correção do Task 1, para Combobox.

- [ ] **Step 1: Ler Combobox.tsx e localizar o padrão idêntico ao Select**

Run: abrir `src/components/ui/Combobox.tsx`. Localizar `const uid = React.useId()` e o `<button aria-labelledby={label ? uid : undefined}>`.

- [ ] **Step 2: Escrever os testes novos em Combobox.test.tsx**

Adicionar dentro do describe existente:

```tsx
it('aria-labelledby combina id do label + id do valor quando label passado', () => {
  render(<Combobox label="Cidade" options={opts.slice(0, 5)} value="v2" onChange={() => {}} />);
  const btn = screen.getByRole('button');
  const aria = btn.getAttribute('aria-labelledby');
  expect(aria).toBeTruthy();
  const parts = aria!.split(' ');
  expect(parts).toHaveLength(2);
  parts.forEach((id) => {
    expect(document.getElementById(id)).not.toBeNull();
  });
});

it('aria-labelledby ausente quando label não passado', () => {
  render(<Combobox options={opts.slice(0, 3)} value="" onChange={() => {}} />);
  const btn = screen.getByRole('button');
  expect(btn.getAttribute('aria-labelledby')).toBeNull();
});
```

- [ ] **Step 3: FAIL → implementar**

Run: `npx vitest run src/components/ui/Combobox.test.tsx` → FAIL.

Aplicar em Combobox.tsx a mesma transformação do Task 1:

```tsx
// substituir
const uid = React.useId();
// por
const labelId = React.useId();
const valueId = React.useId();

// no <label>: id={labelId}
// no <button>: aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
// no <span> do valor selecionado dentro do button: id={valueId}
```

- [ ] **Step 4: PASS**

Run: `npx vitest run src/components/ui/Combobox.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Combobox.tsx src/components/ui/Combobox.test.tsx
git commit -m "fix(Combobox): a11y — aria-labelledby combina label + valor (R10)"
```

---

## Task 3: StateCitySelect cleanup — remover workaround dos spans externos

**Files:**
- Modify: `src/components/ui/StateCitySelect.tsx`
- Modify: `src/components/ui/StateCitySelect.test.tsx`

**Interfaces:**
- Consumes: `<Select>` e `<Combobox>` agora com a11y correta.
- Produces: `<StateCitySelect>` volta a passar `label` normal para os átomos internos, sem spans decorativos.

- [ ] **Step 1: Ler StateCitySelect.tsx atual**

Run: abrir `src/components/ui/StateCitySelect.tsx`. Localizar os spans externos que foram adicionados como workaround do R10 na Fatia 0 (provavelmente rendering explícito de "Estado" / "Cidade" em `<span>` fora dos átomos).

- [ ] **Step 2: Simplificar — passar label direto para Select/Combobox**

Substituir a estrutura por (ajustar aos props reais do componente):

```tsx
export function StateCitySelect({
  value, onChange, labelEstado = 'Estado', labelCidade = 'Cidade', error,
}: StateCitySelectProps) {
  const ufs = useUFs();
  const { data: cidades, loading } = useCidades(value.estado);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
      <Select
        label={labelEstado}
        options={ufs.map((u) => ({ value: u.sigla, label: u.nome }))}
        value={value.estado}
        onChange={(estado) => onChange({ estado, cidade: '' })}
        placeholder="UF"
        error={error?.estado}
      />
      <Combobox
        label={labelCidade}
        options={cidades.map((c) => ({ value: c, label: c }))}
        value={value.cidade}
        onChange={(cidade) => onChange({ estado: value.estado, cidade })}
        placeholder={loading ? 'Carregando…' : value.estado ? 'Selecione cidade' : 'Escolha uma UF primeiro'}
        error={error?.cidade}
      />
    </div>
  );
}
```

Remover qualquer `<span>` de label externo que existia como workaround.

- [ ] **Step 3: Rodar suite existente do StateCitySelect**

Run: `npx vitest run src/components/ui/StateCitySelect.test.tsx`
Expected: PASS — testes de Fatia 0 continuam válidos (trocar UF esvazia cidade; cidade selecionada é mostrada). Se o teste usava `getByRole('button', {name: /paraíba/i})` e agora o nome muda por causa do `aria-labelledby` combinado (que inclui "Estado" + "Paraíba"), o matcher regex `/paraíba/i` continua casando — não precisa mudar.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/StateCitySelect.tsx src/components/ui/StateCitySelect.test.tsx
git commit -m "refactor(StateCitySelect): usa label direto do Select/Combobox

Workaround dos spans externos removido — R10 corrigido nos átomos.
API pública do StateCitySelect inalterada."
```

---

## Task 4: Migration 055 — clientes_estado_split

**Files:**
- Create: `supabase/migration_055_clientes_estado_split.sql`

**Interfaces:**
- Consumes: schema.sql + migrations 002..054.
- Produces: coluna `estado CHAR(2)` em `clientes`; dados legados de `cidade` no formato "Cidade - UF" migrados para as duas colunas.

- [ ] **Step 1: Verificar que 054 é o último aplicado**

Run: `ls supabase/migration_*.sql | tail -3`
Expected: última linha termina em `migration_054_clientes_cidade.sql`.

- [ ] **Step 2: Criar o arquivo com o SQL completo**

Create `supabase/migration_055_clientes_estado_split.sql`:

```sql
-- =============================================================================
-- RK Sucatas — Migração 055: split de clientes.cidade em (cidade, estado)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 054).
-- Adiciona a coluna estado (CHAR(2)) e faz backfill best-effort do padrão
-- "Cidade - UF" (com ou sem espaço) que hoje é gravado concatenado.

alter table clientes add column if not exists estado char(2);

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

- [ ] **Step 3: Verificar sintaticamente (dry parse via psql, se disponível localmente — opcional)**

Este passo é opcional. Se o executor tem psql apontando pra um Supabase local ou uma instância de dev:
```bash
psql "$DATABASE_URL_DEV" -f supabase/migration_055_clientes_estado_split.sql --dry-run
```
Se não tem, pular — validação real é o usuário rodando no editor SQL do Supabase entre Fase 1a e 1b.

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_055_clientes_estado_split.sql
git commit -m "feat(db): migration 055 — split clientes.cidade em (cidade, estado)

Backfill best-effort do padrão 'Cidade - UF' (com ou sem espaço), com
whitelist das 27 UFs BR pra evitar false positives (ex: 'Rua João - AB').
Registros que não casarem ficam com cidade intacta e estado=NULL."
```

---

## Task 5: Backend — routes/clientes.ts aceita `estado`

**Files:**
- Modify: `src/server/routes/clientes.ts`

**Interfaces:**
- Consumes: coluna `estado` disponível no schema (via migration 055 no DB de dev).
- Produces: rotas POST/PATCH de clientes aceitam campo `estado` opcional (`CHAR(2)` ou null). Rota GET retorna `estado` naturalmente via `select *`.

- [ ] **Step 1: Ler o arquivo e localizar CAMPOS_EDITAVEIS**

Run: abrir `src/server/routes/clientes.ts`. Localizar linha 16: `const CAMPOS_EDITAVEIS = [...] as const;`.

- [ ] **Step 2: Adicionar 'estado' ao array**

Substituir:
```ts
const CAMPOS_EDITAVEIS = ['nome', 'telefone', 'documento', 'data_nascimento', 'origem', 'preferencia_contato', 'tags', 'observacoes', 'ativo', 'banido', 'ml_nickname', 'cidade'] as const;
```
Por:
```ts
const CAMPOS_EDITAVEIS = ['nome', 'telefone', 'documento', 'data_nascimento', 'origem', 'preferencia_contato', 'tags', 'observacoes', 'ativo', 'banido', 'ml_nickname', 'cidade', 'estado'] as const;
```

- [ ] **Step 3: Localizar a linha que sanitiza `cidade` no POST e adicionar `estado`**

Run: procurar por `cidade: req.body?.cidade` no arquivo (aparece por volta da linha 135 no POST). Verificar como cidade é validada e replicar o padrão para estado.

Adicionar imediatamente abaixo:
```ts
        estado: (() => {
          const raw = req.body?.estado;
          if (raw == null || raw === '') return null;
          const s = String(raw).trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(s)) return null;                   // silenciosamente descarta formato inválido
          return s;
        })(),
```

- [ ] **Step 4: Replicar sanitização no PATCH se houver uma seção separada**

Procurar por `PATCH` ou `updateCliente` no arquivo. Se há um segundo ponto onde os campos são sanitizados (não apenas via CAMPOS_EDITAVEIS whitelist), aplicar a mesma normalização de `estado`.

Se o handler PATCH apenas pica-pau os campos permitidos via whitelist sem normalizar, adicionar normalização inline:
```ts
if (body.estado !== undefined) {
  const s = String(body.estado ?? '').trim().toUpperCase();
  body.estado = /^[A-Z]{2}$/.test(s) ? s : null;
}
```

- [ ] **Step 5: Verificar lint**

Run: `npm run lint`
Expected: sem erros novos em `src/server/routes/clientes.ts`. Erros pré-existentes em outros arquivos são baseline (documentados em rulings anteriores).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/clientes.ts
git commit -m "feat(api/clientes): aceita campo estado (CHAR(2)) opcional

CAMPOS_EDITAVEIS ganha 'estado'. Validação normaliza pra UF maiúscula ou
descarta silenciosamente formato inválido. Backend deploy pode ir sozinho
— frontend antigo continua funcionando sem mandar estado."
```

---

## 🚦 CHECKPOINT humano — rodar migration em produção

**Ao chegar aqui, PARE.** Antes de continuar pra Fase 1b, o usuário precisa:

1. Aplicar a migration 055 no Supabase de produção (SQL Editor).
2. Reiniciar o servidor Node em produção (Render) pra pegar o backend novo (`estado` no CAMPOS_EDITAVEIS).
3. Verificar que a base de clientes em prod não regrediu:
   - Contar clientes com `estado != null` (backfilled)
   - Amostragem manual: 3-4 clientes que tinham "Cidade - PB" — confirmar que viraram `cidade='Cidade'`, `estado='PB'`

Depois desse OK, prosseguir com Fase 1b.

**O implementer NÃO executa esse checkpoint — reporta que Fase 1a terminou e espera o usuário confirmar antes de disparar Task 6.**

---

## Fase 1b — Frontend refactor

## Task 6: types.ts — Cliente ganha `estado`

**Files:**
- Modify: `src/features/clientes/types.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Cliente.estado: string | null`, `ClienteInput.estado?: string | null`.

- [ ] **Step 1: Ler types.ts e localizar interface Cliente e ClienteInput**

Run: abrir `src/features/clientes/types.ts`. Localizar linhas 95 (Cliente.cidade) e 127 (ClienteInput.cidade).

- [ ] **Step 2: Adicionar `estado` em ambas**

Editar `Cliente` interface. Logo abaixo de `cidade: string | null;` adicionar:
```ts
estado: string | null;
```

Editar `ClienteInput` interface. Logo abaixo de `cidade?: string | null;` adicionar:
```ts
estado?: string | null;
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: baseline errors só. Talvez apareçam NOVAS erros em consumers de `Cliente` que fazem destructuring `const {cidade} = cliente` — inspecionar cada; se houver, cada consumer NÃO PRECISA ser tocado agora (adicionar `estado` é aditivo, não requer changes downstream).

- [ ] **Step 4: Commit**

```bash
git add src/features/clientes/types.ts
git commit -m "feat(clientes/types): Cliente e ClienteInput ganham campo estado"
```

---

## Task 7: api.ts — envia `estado` no POST/PATCH

**Files:**
- Modify: `src/features/clientes/api.ts`

**Interfaces:**
- Consumes: `ClienteInput.estado` do Task 6.
- Produces: chamadas ao backend agora incluem `estado`.

- [ ] **Step 1: Ler api.ts**

Run: abrir `src/features/clientes/api.ts`. Localizar as funções que fazem POST/PATCH (`criarCliente`, `atualizarCliente`, ou nomes similares).

- [ ] **Step 2: Adicionar `estado` no payload**

Onde a função monta o body com `cidade`, adicionar `estado`. Exemplo (adaptar aos nomes reais):

```ts
// ANTES
const body = {
  nome: input.nome,
  telefone: input.telefone,
  cidade: input.cidade,
  // ...
};

// DEPOIS
const body = {
  nome: input.nome,
  telefone: input.telefone,
  cidade: input.cidade,
  estado: input.estado,                                             // NOVO
  // ...
};
```

Se o api.ts usa um spread `{...input}` para montar o body, e `input` já é tipo `ClienteInput` (que agora tem `estado`), nada precisa mudar — o `estado` flui automaticamente. Neste caso, apenas confirmar que o comportamento está correto pela leitura.

- [ ] **Step 3: Se houver tests em api.test.ts, verificar que passam**

Run: `npx vitest run src/features/clientes/api 2>/dev/null || echo "sem test"`

- [ ] **Step 4: Commit**

```bash
git add src/features/clientes/api.ts
git commit -m "feat(clientes/api): envia estado no POST/PATCH"
```

---

## Task 8: ClienteFormData ganha `estado`

**Files:**
- Modify: `src/features/clientes/ClienteFormModal.tsx` (interface ClienteFormData)

**Interfaces:**
- Consumes: nada.
- Produces: `ClienteFormData.estado: string`.

- [ ] **Step 1: Localizar a interface ClienteFormData no arquivo**

Run: abrir `src/features/clientes/ClienteFormModal.tsx`. Localizar interface `ClienteFormData` (por volta da linha 25).

- [ ] **Step 2: Adicionar campo estado**

Editar a interface, adicionar logo abaixo de `cidade: string;`:
```ts
estado: string;
```

- [ ] **Step 3: Localizar consumers que criam um ClienteFormData e adicionar valor inicial**

Run: `grep -n "cidade: '" src/features/clientes/ClientesView.tsx | head`

Provavelmente há 2 pontos em `ClientesView.tsx`:
- Linha ~77 (form inicial vazio pra "novo cliente")
- Linha ~260 (form preenchido pra "editar cliente")

Em cada, adicionar:
```ts
// ANTES
cidade: '',
// DEPOIS
cidade: '',
estado: '',
```

E na versão de "editar":
```ts
cidade: cliente.cidade || '',
estado: cliente.estado || '',
```

- [ ] **Step 4: Localizar o ponto de submit onde cidade vira null se vazia (em `ClientesView.tsx` linha ~293)**

Onde tem:
```ts
cidade: form.cidade?.trim() || null,
```

Adicionar:
```ts
cidade: form.cidade?.trim() || null,
estado: form.estado?.trim() || null,
```

- [ ] **Step 5: Rodar suite pra confirmar que nada quebrou (ainda não usamos estado no form UI)**

Run: `npm test`
Expected: 368 passing (baseline). Nenhuma regressão.

- [ ] **Step 6: Commit**

```bash
git add src/features/clientes/ClienteFormModal.tsx src/features/clientes/ClientesView.tsx
git commit -m "feat(clientes): ClienteFormData ganha campo estado

Consumers em ClientesView passam estado inicial vazio no form novo e
preenchem a partir do cliente.estado no form de edição. Submit envia
null quando string vazia."
```

---

## Task 9: ClienteFormModal — trocar nome/RG/obs por `<Input>` / `<Textarea>`

**Files:**
- Modify: `src/features/clientes/ClienteFormModal.tsx`

**Interfaces:**
- Consumes: `<Input>` (Fatia 0), `<Textarea>` (Fatia 0).
- Produces: campos textuais do form usam átomos com label/error/helper padronizados.

- [ ] **Step 1: Ler ClienteFormModal.tsx inteiro** (365 linhas — cabe numa leitura)

Run: abrir arquivo. Mapear onde estão os inputs de nome, RG (se houver), documento (deixar pra Task 10), telefone (deixar pra Task 10), observações (Textarea), tags (deixar como está por enquanto — não tem átomo específico).

- [ ] **Step 2: Adicionar imports dos átomos**

No topo do arquivo, junto com outros imports de `@/src/components/ui/*`, adicionar:
```tsx
import { Input } from '@/src/components/ui/Input';
import { Textarea } from '@/src/components/ui/Textarea';
```

- [ ] **Step 3: Substituir input de nome**

Localizar o `<FloatingField label="Nome"...>` que contém um `<input>` cru. Substituir por:

```tsx
<Input
  label="Nome"
  value={form.nome}
  onChange={(e) => update({ nome: e.target.value })}
  autoFocus
/>
```

Onde `update` é o helper local que faz `onFormChange({...form, ...patch})` — verificar como está sendo usado no restante do arquivo e reaproveitar.

Remover o `<FloatingField>` wrapper — o `<Input>` já rende seu próprio label.

- [ ] **Step 4: Substituir input de RG (se houver) por `<Input>`**

Mesma coisa. Se não houver campo RG, pular.

- [ ] **Step 5: Substituir textarea de observações por `<Textarea>`**

Localizar o `<textarea>` cru. Substituir por:
```tsx
<Textarea
  label="Observações"
  value={form.observacoes}
  onChange={(e) => update({ observacoes: e.target.value })}
  autoResize
  rows={3}
/>
```

- [ ] **Step 6: Rodar test**

Run: `npx vitest run src/features/clientes/ClienteFormModal.test.tsx`
Expected: PASS após ajustes nos asserts (matchers `getByLabelText` continuam funcionando; `getByRole('textbox')` também). Se algum teste usa `getByPlaceholderText`, atualizar pro `getByLabelText`.

Run: `npm test`
Expected: suite total passa.

- [ ] **Step 7: Commit**

```bash
git add src/features/clientes/ClienteFormModal.tsx src/features/clientes/ClienteFormModal.test.tsx
git commit -m "refactor(ClienteFormModal): nome/obs usam Input/Textarea átomos"
```

---

## Task 10: ClienteFormModal — telefone → `<PhoneInput>`, documento → `<DocInput>`

**Files:**
- Modify: `src/features/clientes/ClienteFormModal.tsx`
- Modify: `src/features/clientes/ClienteFormModal.test.tsx`

**Interfaces:**
- Consumes: `<PhoneInput>` (Fatia 0 — recebe string de dígitos, emite dígitos), `<DocInput>` (auto CPF/CNPJ).
- Produces: telefone e documento com máscara automática + validação de dígito verificador em CPF/CNPJ.

- [ ] **Step 1: Adicionar imports**

```tsx
import { PhoneInput } from '@/src/components/ui/PhoneInput';
import { DocInput } from '@/src/components/ui/DocInput';
```

- [ ] **Step 2: Substituir telefone**

Localizar `<input>` de telefone. Antes provavelmente tinha `value={form.telefone}` + `onChange={(e) => update({ telefone: formatTelefoneBR(e.target.value) })}` ou algo similar.

Substituir por:
```tsx
<PhoneInput
  label="Telefone"
  value={form.telefone}
  onChange={(digits) => update({ telefone: digits })}
/>
```

`form.telefone` agora armazena SÓ dígitos (`'83999999999'`). PhoneInput renderiza formatado. Se o resto do app espera telefone formatado, verificar se há `formatTelefoneBR(cliente.telefone)` nos consumers (ClientesView, ProfileCard) — se sim, esses continuam funcionando porque recebem cliente.telefone (dígitos ou legado) e formatam na exibição.

Se o helper `formatTelefoneBR` existe local no ClienteFormModal e não é usado mais, remover a import/definição.

- [ ] **Step 3: Substituir documento por DocInput**

```tsx
<DocInput
  label="CPF/CNPJ"
  value={form.documento}
  onChange={(digits) => update({ documento: digits })}
  onValidityChange={(valid, kind) => {
    // opcional: exibir badge de valid/invalid via useState local
  }}
/>
```

`form.documento` agora armazena só dígitos. `onValidityChange` é opt-in — se você quiser mostrar erro inline quando o CPF/CNPJ é inválido, guarde em useState local e passe como prop `error` ao DocInput:

```tsx
const [docErro, setDocErro] = useState<string | null>(null);
// ...
<DocInput
  label="CPF/CNPJ"
  value={form.documento}
  onChange={(digits) => update({ documento: digits })}
  onValidityChange={(valid, kind) => {
    if (form.documento.length >= 11 && !valid) {
      setDocErro(kind === 'cpf' ? 'CPF inválido' : 'CNPJ inválido');
    } else {
      setDocErro(null);
    }
  }}
  error={docErro ?? undefined}
/>
```

- [ ] **Step 4: Atualizar testes**

Editar `ClienteFormModal.test.tsx`. Testes que consultavam telefone via `getByLabelText('Telefone')` continuam funcionando; se algum teste chamava `formatTelefoneBR` diretamente ou verificava `value` no input de telefone, ajustar pra `value` do input ser a versão FORMATADA (o PhoneInput internamente formata a string de dígitos).

Se algum teste dispara `fireEvent.change` no input de telefone com o valor formatado — continuar funcionando (o mock aceita string).

Adicionar um assert cobrindo o novo comportamento:
```tsx
it('telefone armazena só dígitos e exibe formatado', () => {
  const onFormChange = vi.fn();
  const form = { ...baseForm, telefone: '83999999999' };
  render(<ClienteFormModal aberto {...baseProps} form={form} onFormChange={onFormChange} />);
  const input = screen.getByLabelText('Telefone') as HTMLInputElement;
  expect(input.value).toBe('(83) 9 9999-9999');
});
```

- [ ] **Step 5: Rodar tests**

Run: `npx vitest run src/features/clientes/ClienteFormModal.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: suite total passa (369+).

- [ ] **Step 6: Commit**

```bash
git add src/features/clientes/ClienteFormModal.tsx src/features/clientes/ClienteFormModal.test.tsx
git commit -m "refactor(ClienteFormModal): PhoneInput e DocInput (auto CPF/CNPJ)

telefone e documento agora armazenam só dígitos no form. UI formata
enquanto o usuário digita. DocInput auto-detecta CPF vs CNPJ por
tamanho e valida dígito verificador."
```

---

## Task 11: ClienteFormModal — CEP → `<CepInput>` + endereço → `<StateCitySelect>`

**Files:**
- Modify: `src/features/clientes/ClienteFormModal.tsx`
- Modify: `src/features/clientes/ClienteFormModal.test.tsx`

**Interfaces:**
- Consumes: `<CepInput>` (Fatia 0 — autofill via ViaCEP com callback estruturado), `<StateCitySelect>` (Fatia 0).
- Produces: fim do "Juazeirinho - PB" concatenado — o form gerencia `cidade` e `estado` como campos separados.

- [ ] **Step 1: Adicionar imports**

```tsx
import { CepInput } from '@/src/components/ui/CepInput';
import { StateCitySelect } from '@/src/components/ui/StateCitySelect';
```

- [ ] **Step 2: Substituir CEP**

Localizar o `<input>` de CEP (por volta da linha 246 no original) que provavelmente tem `onChange={(e) => onFormChange({...form, cidade: `${result.cidade} - ${result.uf}`})}` ligado via helper `buscarCep`.

Substituir por:
```tsx
<CepInput
  label="CEP"
  value={form.cep}
  onChange={(digits) => update({ cep: digits })}
  onAutoFill={({ estado, cidade }) => update({ estado, cidade })}
/>
```

O CepInput internamente chama ViaCEP quando 8 dígitos são atingidos. `onAutoFill` recebe `{estado, cidade, bairro, rua}` — pegar `estado` e `cidade`. `bairro` e `rua` ficam no callback mas o form atual não guarda — se algum campo `bairro`/`rua` existir no form, aproveitar (verificar `ClienteFormData`).

- [ ] **Step 3: Remover import e uso de `buscarCep`/`validarCep`/`formatCep`**

Se o CepInput cobre esses três (busca via fetch, validação por regex, formatação), remover do topo do arquivo:
```tsx
// remover
import { formatCep, validarCep, buscarCep } from './cep';
```

Se algum outro consumer do repo ainda usa esses helpers, deixar o arquivo `./cep.ts` intacto — só parar de importar aqui.

- [ ] **Step 4: Substituir input cidade concatenado por StateCitySelect**

Localizar o `<input>` de cidade (por volta da linha 246-247 no original) — `<input value={form.cidade} onChange={(e) => update({ cidade: e.target.value })} />`.

Substituir por:
```tsx
<StateCitySelect
  value={{ estado: form.estado, cidade: form.cidade }}
  onChange={({ estado, cidade }) => update({ estado, cidade })}
/>
```

Se o `<FloatingField>` envolvia — remover o wrapper (StateCitySelect já renderiza seus próprios labels).

- [ ] **Step 5: Atualizar testes**

Se o teste tinha um assert `getByLabelText('Cidade')` que retornava um `<input>` cru, agora vai retornar o `<button>` do Combobox de cidade. Ajustar pra `getByRole('button', { name: /cidade/i })` ou similar.

Adicionar cobertura do novo comportamento:
```tsx
it('CEP válido dispara onFormChange com estado + cidade estruturados', async () => {
  // Mock fetch pra retornar ViaCEP simulado
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ uf: 'PB', localidade: 'Juazeirinho', bairro: 'Centro', logradouro: 'Rua A' }),
  });

  const onFormChange = vi.fn();
  const form = { ...baseForm };
  const { rerender } = render(<ClienteFormModal aberto {...baseProps} form={form} onFormChange={onFormChange} />);

  // simula chegada de CEP com 8 dígitos (rerender pra CepInput's useEffect disparar)
  rerender(<ClienteFormModal aberto {...baseProps} form={{ ...form, cep: '58500000' }} onFormChange={onFormChange} />);

  await waitFor(() => {
    expect(onFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'PB', cidade: 'Juazeirinho' })
    );
  });
});
```

- [ ] **Step 6: Rodar tests**

Run: `npx vitest run src/features/clientes/ClienteFormModal.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: suite total passa.

- [ ] **Step 7: Commit**

```bash
git add src/features/clientes/ClienteFormModal.tsx src/features/clientes/ClienteFormModal.test.tsx
git commit -m "refactor(ClienteFormModal): CepInput + StateCitySelect

Fim do 'Juazeirinho-PB' digitado à mão. CEP dispara autofill via ViaCEP
retornando {estado, cidade, bairro, rua}. Estado e cidade são campos
separados no form; UI usa dois selects encadeados baseados no IBGE."
```

---

## Task 12: ClientesView — usar `formatarCidade` na exibição

**Files:**
- Modify: `src/features/clientes/ClientesView.tsx`

**Interfaces:**
- Consumes: `formatarCidade` de `@/src/components/ui/formatarCidade`.
- Produces: lista de clientes exibe "Cidade, PB" mesmo quando `estado` está separado no banco.

- [ ] **Step 1: Adicionar import**

```tsx
import { formatarCidade } from '@/src/components/ui/formatarCidade';
```

- [ ] **Step 2: Localizar usos de `c.cidade` na renderização**

Run: `grep -n "c\\.cidade\\|cliente\\.cidade" src/features/clientes/ClientesView.tsx`

Expected pontos (linhas aprox):
- 470: `{ key: 'cidade', header: 'Cidade', render: (c) => c.cidade || '—' }`
- 528: `{c.cidade ? ` · ${c.cidade}` : ''}`

- [ ] **Step 3: Trocar por formatarCidade**

Linha 470:
```tsx
{ key: 'cidade', header: 'Cidade', render: (c) => formatarCidade({ estado: c.estado, cidade: c.cidade }) || '—' }
```

Linha 528:
```tsx
{formatarCidade({ estado: c.estado, cidade: c.cidade }) && ` · ${formatarCidade({ estado: c.estado, cidade: c.cidade })}`}
```

Ou refatorar pra guardar a string em variável:
```tsx
{(() => {
  const s = formatarCidade({ estado: c.estado, cidade: c.cidade });
  return s ? ` · ${s}` : '';
})()}
```

- [ ] **Step 4: Verificar outros usos com grep**

Run: `grep -n "\\.cidade" src/features/clientes/ClientesView.tsx | grep -v "test\\|\\.test\\."`

Se houver outros pontos que renderizam `cidade` cru, aplicar a mesma transformação.

- [ ] **Step 5: Rodar tests**

Run: `npm test`
Expected: passa. Não há teste específico da lista, mas nada regride.

- [ ] **Step 6: Commit**

```bash
git add src/features/clientes/ClientesView.tsx
git commit -m "refactor(ClientesView): usa formatarCidade na exibição

Lista mostra 'Cidade, UF' juntando as duas colunas separadas."
```

---

## Task 13: ClienteDetalheModal + ClienteProfileCard — passar `estado`

**Files:**
- Modify: `src/features/clientes/ClienteDetalheModal.tsx`
- Modify: `src/features/clientes/ClienteProfileCard.tsx`

**Interfaces:**
- Consumes: `formatarCidade`.
- Produces: detalhe do cliente exibe cidade+estado formatados.

- [ ] **Step 1: Adicionar `estado` no prop signature do ProfileCard**

Editar `src/features/clientes/ClienteProfileCard.tsx`. Localizar a interface de props (por volta da linha 19). Adicionar:
```tsx
estado?: string | null;
```

- [ ] **Step 2: Importar `formatarCidade` e trocar exibição**

No topo:
```tsx
import { formatarCidade } from '@/src/components/ui/formatarCidade';
```

Localizar linha 132 (`{cidade || '—'}`) e trocar por:
```tsx
{formatarCidade({ estado: estado ?? null, cidade: cidade ?? null }) || '—'}
```

Adicionar `estado` ao destructuring dos props (linha 48).

- [ ] **Step 3: ClienteDetalheModal — passar estado**

Editar `src/features/clientes/ClienteDetalheModal.tsx`. Localizar linha 233 (`cidade={cliente.cidade}`). Adicionar:
```tsx
estado={cliente.estado}
cidade={cliente.cidade}
```

- [ ] **Step 4: Rodar tests**

Run: `npx vitest run src/features/clientes/`
Expected: PASS. Se algum teste do ClienteDetalheModal.test.tsx testava a exibição da cidade, continuar funcionando; se testava valor exato, ajustar pro novo formato.

- [ ] **Step 5: Commit**

```bash
git add src/features/clientes/ClienteDetalheModal.tsx src/features/clientes/ClienteProfileCard.tsx
git commit -m "refactor(clientes/detalhe): ProfileCard recebe estado + formata via formatarCidade"
```

---

## Task 14: Patch notes v1.3.9

**Files:**
- Modify: `src/features/patchnotes/data.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nova entry no topo da lista de patch notes.

- [ ] **Step 1: Ler data.ts e identificar a versão atual mais nova**

Run: abrir `src/features/patchnotes/data.ts`. Verificar a versão do primeiro item (deve ser `1.3.8` da Fatia 0). Se for, nova versão = `1.3.9`.

- [ ] **Step 2: Adicionar entry nova no topo**

Adaptar formato aos entries existentes:

```ts
{
  version: '1.3.9',
  date: '2026-08-29',
  title: 'Cadastro de cliente sem digitação chata',
  changes: [
    'Estado e Cidade agora são campos separados — chega de digitar "Juazeirinho-PB" na mão.',
    'Telefone com formatação automática enquanto você digita: (83) 9 9999-9999.',
    'CPF/CNPJ detecta sozinho o tipo e valida se é um número real (rejeita 111.111.111-11 e similares).',
    'CEP preenche cidade + estado + bairro + rua sozinho.',
    'Screen readers passam a ler "Estado: Paraíba" em vez de só "Estado" ou só "Paraíba" (acessibilidade).',
  ],
},
```

Adaptar keys ao formato real do arquivo (pode ser `titulo`/`descricao`/`itens` em português — checar primeiro entry).

- [ ] **Step 3: Rodar tests + build pra confirmar que data.ts continua parseável**

Run: `npm test`
Expected: passa.

Run: `npm run build`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/features/patchnotes/data.ts
git commit -m "docs(patchnotes): v1.3.9 — cadastro de cliente com Estado/Cidade separados"
```

---

## Task 15: Verificação final

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS. Total ~370-372 tests (368 baseline Fatia 0 + ~4 novos da Fatia 1).

- [ ] **Step 2: Lint (typecheck via tsc --noEmit)**

Run: `npm run lint`
Expected: mesmos pre-existing errors da baseline (DeclaracaoVendaModal, VisaoDono, TarefaCards, vite.config.ts) — NENHUM erro NOVO em arquivos tocados por esta fatia.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS. Bundle sizes similares (nada novo pesado).

- [ ] **Step 4: Working tree clean**

Run: `git status --short`
Expected: vazio.

- [ ] **Step 5: Contagem de commits**

Run: `git log --oneline main..HEAD | wc -l`
Expected: ~15 commits (5 da Fase 1a + 9-10 da Fase 1b + patch notes).

- [ ] **Step 6: Smoke visual mínimo (opcional se `npm run dev` estiver disponível)**

Se der pra rodar o servidor local:
- Abrir /clientes
- Clicar em "Novo Cliente"
- Testar: digitar CEP `58500000` → deve autopreencher cidade "Juazeirinho" + estado "PB" + bairro
- Digitar CPF `529.982.247-25` → aceitar como válido
- Digitar CPF `111.111.111-11` → rejeitar como inválido (mostrar error inline)
- Digitar telefone `83999999999` → renderizar `(83) 9 9999-9999`
- Salvar
- Voltar pra lista → cliente aparece com "Juazeirinho, PB" na coluna cidade

Se o preview não estiver disponível, documentar como pending manual test para o usuário.

- [ ] **Step 7: Reportar status ao usuário**

Não é um commit. Ao terminar a Fase 1b, resumir:
- Total de commits.
- Suíte 372+ passing.
- Migration 055 já rodou em prod (checkpoint humano).
- Pronto pra merge de volta em main.

---

## Notas finais pro executor

- **Fase 1a e Fase 1b são separadas por um CHECKPOINT humano.** Não passe de Task 5 pra Task 6 sem confirmação explícita do usuário. Ao concluir Task 5, reportar Fase 1a completa e aguardar.
- **Rulings R7/R8/R9/R13/R15 herdadas da Fatia 0 aplicam.** Sempre `afterEach(cleanup)`, `@testing-library/jest-dom/vitest`, mock de motion/react quando AnimatePresence, alias `@/src/...`, intersection type sem `@types/react`.
- **Se qualquer refactor em ClienteFormModal quebrar mais tests do que o esperado**, reportar DONE_WITH_CONCERNS descrevendo cada test quebrado e a adaptação feita. Não inventar comportamento novo.
- **Não migrar `window.confirm` em Clientes** — grep confirmou zero uso.
- **Filtro por UF na ClientesView foi deferido** por escolha do usuário. Não adicionar.
- **CEP autofill devolve `bairro` e `rua` além de `estado`/`cidade`** — se ClienteFormData não tem esses campos, ignorar no callback. Não adicionar campos que não existem no form.
