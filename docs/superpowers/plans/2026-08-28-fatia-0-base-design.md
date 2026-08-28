# Fatia 0 — Base Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tokens novos, kit Animate UI e ~29 átomos core em `src/components/ui/*` sem mudar visualmente nenhuma tela existente, de modo que as Fatias 1–6 possam consumi-los.

**Architecture:** Extensão incremental. Novos átomos coexistem com legado no mesmo folder. Modal existente é reescrito preservando 100% da API pública (drop-in). Motion respeita `prefers-reduced-motion` via hook central `useMotionTier`. IBGE JSON carregado lazy no primeiro uso de `<StateCitySelect>` (dynamic import).

**Tech Stack:** React 18 + Tailwind v4 CSS-first (`@theme inline`) + `motion/react` + Radix UI + shadcn/cva + Vitest (jsdom + @testing-library/react) + Animate UI (adicionado via CLI).

**Spec:** [docs/superpowers/specs/2026-08-28-fatia-0-base-design.md](../specs/2026-08-28-fatia-0-base-design.md)

## Global Constraints

- **Tailwind v4 CSS-first only.** Nunca escrever hex direto em componente — sempre classe gerada (`bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`). Regra do [CLAUDE.md](../../../CLAUDE.md).
- **Cor sempre carrega significado.** `accent`, `positive`, `negative`, `warning`, `danger` têm propósito fixo — não trocar por estética.
- **Um único CTA `variant="accent-cta"` por tela.** Enforcement manual nesta fatia.
- **Todo alerta com ação associada.** Se não há nada pra usuário fazer, não é alerta.
- **Hierarquia visual:** número > label.
- **App é dark-only.** `<html>` já nasce escuro; sem `dark:` variants.
- **Modal atual (`src/components/Modal.tsx`) deve permanecer drop-in.** API pública igual (mesmas props, mesmo export nomeado). Só a implementação interna muda.
- **`useReducedMotion()` do `motion/react` obrigatório** em `<Reveal>`, sparkles, typing, animated-background, magnetic, e qualquer coisa que dispara sozinho.
- **Só animar `transform` / `opacity` / `filter`.** Nunca `width/height/top/left`.
- **`backdrop-blur` só em fixed/sticky.** Nunca em container que rola.
- **Backend dev server não recarrega sozinho** (memória `rk-sucatas-dev-server-manual-restart`) — Fatia 0 não toca `server.ts`.
- **Sempre atualizar patch notes** ao terminar (memória `rk-sucatas-sempre-atualizar-patchnotes`) — item final do plano.
- **Testes:** `npm test` deve terminar verde. Toda função pura + toda máscara tem teste unit; todo componente com overlay/keyboard tem teste jsdom.

---

## File Structure

**Novos arquivos:**
```
src/components/ui/
  Input.tsx                       Textarea.tsx
  Select.tsx                      Combobox.tsx                  MultiSelect.tsx
  StateCitySelect.tsx             CepInput.tsx
  CurrencyInput.tsx               PhoneInput.tsx                DocInput.tsx
  DatePicker.tsx                  TimePicker.tsx
  Sheet.tsx                       Drawer.tsx                    Confirm.tsx
  Accordion.tsx                   Reveal.tsx                    Kbd.tsx
  CommandPalette.tsx
  hooks/
    useConfirm.ts                 useMotionTier.ts              useIBGE.ts
  masks/
    cpf.ts                        cnpj.ts                       phone-br.ts    brl.ts
  data/
    ibge-municipios.json          (~350 kB gzip; dynamic import)
  motion.ts                       (estender existente)
```

Testes ao lado do arquivo com sufixo `.test.ts` / `.test.tsx` (padrão vigente).

**Reescritos preservando API:**
- `src/components/Modal.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/dialog.tsx` (z-index escala)
- `src/components/GlobalSearch.tsx` → passa a usar `CommandPalette` internamente
- `src/components/ui/MetricCard.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/StatusBadge.tsx`
- `src/components/ui/DataTable.tsx`
- `src/components/ui/button.tsx`

**Alterados:**
- `src/styles/theme.css` (add tokens novos)
- `src/features/patchnotes/data.ts` (item final)
- `package.json` (deps novos: `react-day-picker` + primitivos Animate UI via CLI)

---

## Task 1: Extender `theme.css` com tokens novos

**Files:**
- Modify: `src/styles/theme.css`

**Interfaces:**
- Consumes: nada (raiz da fatia)
- Produces: utilities Tailwind `shadow-elevation-{1..4}`, `shadow-glow-accent`, `rounded-pill`, `rounded-modal`, e novos CSS vars `--ease-out-expo`, `--ease-in-out-quart`, `--ease-bounce-soft`, `--duration-hero`, `--duration-showcase`, `--z-nav|dropdown|modal|toast|tooltip`, `--focus-ring-color`, `--focus-ring-offset`.

- [ ] **Step 1: Ler o `theme.css` atual pra localizar seções**

Run: abrir `src/styles/theme.css`. Confirmar onde ficam blocos `--duration-*`, `--radius-*`, `--shadow-*` e o `@theme inline`.

- [ ] **Step 2: Adicionar bloco de motion extra em `:root` (depois do `--ease-soft`)**

```css
/* Motion — presets pra vitrine (Login, PatchNotes, Dashboard) */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
--ease-bounce-soft: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-hero: 700ms;
--duration-showcase: 1200ms;
```

- [ ] **Step 3: Adicionar elevations em `:root` (logo abaixo dos `--shadow-elevated-*`)**

```css
/* Elevation — 4 níveis explícitos + glow do CTA único */
--elevation-1: 0 1px 2px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04);
--elevation-2: 0 4px 12px -2px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);
--elevation-3: 0 12px 32px -8px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.06);
--elevation-4: 0 24px 60px -16px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.08);
--elevation-glow-accent: 0 0 40px -8px rgba(242,117,28,.45);
```

- [ ] **Step 4: Adicionar raios extras no bloco `/* Raios */`**

```css
--radius-pill: 999px;
--radius-modal: 20px;
--radius-sheet-mobile: 24px 24px 0 0;
```

- [ ] **Step 5: Adicionar foco + escala z-index no fim de `:root` (antes do `}`)**

```css
/* Foco acessível */
--focus-ring-color: var(--accent);
--focus-ring-offset: var(--surface-page);

/* Z-index escala — mata o z-[9999] espalhado */
--z-nav: 40;
--z-dropdown: 50;
--z-modal: 60;
--z-toast: 70;
--z-tooltip: 80;
```

- [ ] **Step 6: Mapear em `@theme inline` (dentro do bloco)**

Adicionar dentro de `@theme inline { ... }`:
```css
--shadow-elevation-1: var(--elevation-1);
--shadow-elevation-2: var(--elevation-2);
--shadow-elevation-3: var(--elevation-3);
--shadow-elevation-4: var(--elevation-4);
--shadow-glow-accent: var(--elevation-glow-accent);

--radius-pill: var(--radius-pill);
--radius-modal: var(--radius-modal);

--ease-out-expo: var(--ease-out-expo);
--ease-in-out-quart: var(--ease-in-out-quart);
--ease-bounce-soft: var(--ease-bounce-soft);
--duration-hero: var(--duration-hero);
--duration-showcase: var(--duration-showcase);
```

- [ ] **Step 7: Verificar typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: PASS. Vite processa novos vars sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat(design-system): add motion, elevation, radius, focus & z-index tokens

Base da Fatia 0 (spec: docs/superpowers/specs/2026-08-28-fatia-0-base-design.md).
Zero impacto visual — só disponibiliza utilities novas."
```

---

## Task 2: `useMotionTier()` hook (degrada motion em low-end / reduced-motion)

**Files:**
- Create: `src/components/ui/hooks/useMotionTier.ts`
- Test: `src/components/ui/hooks/useMotionTier.test.ts`

**Interfaces:**
- Consumes: `matchMedia` do DOM, `navigator.deviceMemory`.
- Produces:
  ```ts
  export type MotionTier = 'reduced' | 'low' | 'standard' | 'showcase';
  export function useMotionTier(): MotionTier;
  ```

- [ ] **Step 1: Escrever teste**

Create `src/components/ui/hooks/useMotionTier.test.ts`:
```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMotionTier } from './useMotionTier';

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('useMotionTier', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
  });

  it('retorna "reduced" quando prefers-reduced-motion está ativo', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('reduced');
  });

  it('retorna "low" quando deviceMemory < 4 e reduced-motion desativado', () => {
    mockMatchMedia(false);
    Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('low');
  });

  it('retorna "showcase" quando deviceMemory >= 4 e reduced-motion desativado', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMotionTier());
    expect(result.current).toBe('showcase');
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npx vitest run src/components/ui/hooks/useMotionTier.test.ts`
Expected: FAIL — "Cannot find module './useMotionTier'"

- [ ] **Step 3: Implementar**

Create `src/components/ui/hooks/useMotionTier.ts`:
```ts
import { useEffect, useState } from 'react';

export type MotionTier = 'reduced' | 'low' | 'standard' | 'showcase';

function compute(): MotionTier {
  if (typeof window === 'undefined') return 'standard';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 4) return 'low';
  return 'showcase';
}

export function useMotionTier(): MotionTier {
  const [tier, setTier] = useState<MotionTier>(() => compute());

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setTier(compute());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return tier;
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npx vitest run src/components/ui/hooks/useMotionTier.test.ts`
Expected: PASS (3 asserts).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/hooks/useMotionTier.ts src/components/ui/hooks/useMotionTier.test.ts
git commit -m "feat(design-system): useMotionTier hook — reduced/low/standard/showcase"
```

---

## Task 3: Instalar primitivos Animate UI via CLI

**Files:**
- Modify: `package.json` (via CLI)
- Create: paths sob `src/components/animate-ui/*` (gerados pela CLI)

**Interfaces:**
- Consumes: nada
- Produces: componentes prontos pra import — `motion-number`, `counting-number`, `ripple`, `highlighter`, `rolling-text`, `typing-text`, `sparkles`, `magnetic`, `motion-effect`, `animated-background`, `gradient-text`, `border-trail`.

- [ ] **Step 1: Verificar CLI oficial**

Run: `npx animate-ui@latest --help`
Expected: mostra comandos disponíveis (`add`, `init`).

- [ ] **Step 2: Adicionar primitivos em lote**

Run: `npx animate-ui@latest add motion-number counting-number ripple highlighter rolling-text typing-text sparkles magnetic motion-effect animated-background gradient-text border-trail`
Expected: cada primitivo criado sob `src/components/animate-ui/` respeitando o path convention da lib.

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS. Se algum primitivo tiver dep faltando, `npm install` sugerido pela CLI já cobre.

- [ ] **Step 4: Smoke import**

Adicione temporariamente em `src/App.tsx` (topo do arquivo, apenas import):
```ts
import '@/components/animate-ui/primitives/effects/highlight';
```
Run: `npm run build`
Expected: PASS. Remova o import de smoke depois do PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(animate-ui): install primitives batch para Fatia 0

motion-number, counting-number, ripple, highlighter, rolling-text,
typing-text, sparkles, magnetic, motion-effect, animated-background,
gradient-text, border-trail."
```

---

## Task 4: Masks utilities — `cpf`, `cnpj`, `phone-br`, `brl` (TDD unit)

**Files:**
- Create: `src/components/ui/masks/cpf.ts`, `cnpj.ts`, `phone-br.ts`, `brl.ts`
- Test: `src/components/ui/masks/cpf.test.ts`, `cnpj.test.ts`, `phone-br.test.ts`, `brl.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  ```ts
  // cpf.ts
  export function formatCpf(digits: string): string;      // "12345678900" → "123.456.789-00"
  export function stripCpf(masked: string): string;       // "123.456.789-00" → "12345678900"
  export function isValidCpf(digits: string): boolean;    // dígito verificador
  ```
  ```ts
  // cnpj.ts
  export function formatCnpj(digits: string): string;     // "12345678000199" → "12.345.678/0001-99"
  export function stripCnpj(masked: string): string;
  export function isValidCnpj(digits: string): boolean;
  ```
  ```ts
  // phone-br.ts
  export function formatPhoneBr(digits: string): string;  // "83999999999" → "(83) 9 9999-9999"
  export function stripPhone(masked: string): string;
  ```
  ```ts
  // brl.ts
  export function formatBrl(cents: number): string;       // 12345 → "R$ 123,45"
  export function parseBrl(input: string): number;        // "R$ 1.234,56" → 123456 (cents)
  ```

- [ ] **Step 1: Escrever teste cpf**

Create `src/components/ui/masks/cpf.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatCpf, stripCpf, isValidCpf } from './cpf';

describe('cpf', () => {
  it('formata 11 dígitos', () => {
    expect(formatCpf('12345678900')).toBe('123.456.789-00');
  });
  it('formata parcial (5 dígitos)', () => {
    expect(formatCpf('12345')).toBe('123.45');
  });
  it('strip remove tudo que não é dígito', () => {
    expect(stripCpf('123.456.789-00')).toBe('12345678900');
  });
  it('valida CPFs conhecidos', () => {
    expect(isValidCpf('52998224725')).toBe(true);  // test vector público
    expect(isValidCpf('11144477735')).toBe(true);
  });
  it('rejeita CPFs inválidos', () => {
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar teste — falha**

Run: `npx vitest run src/components/ui/masks/cpf.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar cpf.ts**

Create `src/components/ui/masks/cpf.ts`:
```ts
export function stripCpf(masked: string): string {
  return masked.replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(input: string): string {
  const d = stripCpf(input);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function isValidCpf(input: string): boolean {
  const d = stripCpf(input);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += Number(d[i]) * (slice + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
```

- [ ] **Step 4: Rodar teste — passa**

Run: `npx vitest run src/components/ui/masks/cpf.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever teste cnpj**

Create `src/components/ui/masks/cnpj.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatCnpj, stripCnpj, isValidCnpj } from './cnpj';

describe('cnpj', () => {
  it('formata 14 dígitos', () => {
    expect(formatCnpj('12345678000199')).toBe('12.345.678/0001-99');
  });
  it('strip', () => {
    expect(stripCnpj('12.345.678/0001-99')).toBe('12345678000199');
  });
  it('valida CNPJs conhecidos', () => {
    expect(isValidCnpj('11444777000161')).toBe(true);
  });
  it('rejeita inválidos', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('12345678000100')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });
});
```

- [ ] **Step 6: Rodar teste — falha, então implementar**

Run: `npx vitest run src/components/ui/masks/cnpj.test.ts` → FAIL

Create `src/components/ui/masks/cnpj.ts`:
```ts
export function stripCnpj(masked: string): string {
  return masked.replace(/\D/g, '').slice(0, 14);
}

export function formatCnpj(input: string): string {
  const d = stripCnpj(input);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function isValidCnpj(input: string): boolean {
  const d = stripCnpj(input);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice: number, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += Number(d[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(12, w1) === Number(d[12]) && calc(13, w2) === Number(d[13]);
}
```

Run: `npx vitest run src/components/ui/masks/cnpj.test.ts` → PASS

- [ ] **Step 7: Escrever teste phone-br**

Create `src/components/ui/masks/phone-br.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatPhoneBr, stripPhone } from './phone-br';

describe('phone-br', () => {
  it('formata celular com DDD (11 dígitos)', () => {
    expect(formatPhoneBr('83999999999')).toBe('(83) 9 9999-9999');
  });
  it('formata fixo com DDD (10 dígitos)', () => {
    expect(formatPhoneBr('8332221111')).toBe('(83) 3222-1111');
  });
  it('formata parcial', () => {
    expect(formatPhoneBr('83')).toBe('(83');
    expect(formatPhoneBr('839')).toBe('(83) 9');
    expect(formatPhoneBr('83999')).toBe('(83) 9 99');
  });
  it('strip remove tudo que não é dígito', () => {
    expect(stripPhone('(83) 9 9999-9999')).toBe('83999999999');
  });
});
```

- [ ] **Step 8: Implementar phone-br.ts**

Run: `npx vitest run src/components/ui/masks/phone-br.test.ts` → FAIL

Create `src/components/ui/masks/phone-br.ts`:
```ts
export function stripPhone(masked: string): string {
  return masked.replace(/\D/g, '').slice(0, 11);
}

export function formatPhoneBr(input: string): string {
  const d = stripPhone(input);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length === 3) return `(${d.slice(0, 2)}) ${d[2]}`;
  if (d.length <= 6 && d.length > 3) {
    // celular parcial após o "9"
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3)}`;
  }
  if (d.length <= 10) {
    // fixo (10 dígitos) ou celular ainda incompleto
    if (d.length === 10) {
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    }
    // celular parcial (7-9 dígitos totais)
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}${d.length > 7 ? `-${d.slice(7)}` : ''}`;
  }
  // celular completo 11 dígitos
  return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
```

Run: `npx vitest run src/components/ui/masks/phone-br.test.ts` → PASS

- [ ] **Step 9: Escrever teste brl**

Create `src/components/ui/masks/brl.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatBrl, parseBrl } from './brl';

describe('brl', () => {
  it('formata cents em BRL', () => {
    expect(formatBrl(0)).toBe('R$ 0,00');
    expect(formatBrl(1)).toBe('R$ 0,01');
    expect(formatBrl(12345)).toBe('R$ 123,45');
    expect(formatBrl(1234567)).toBe('R$ 12.345,67');
  });
  it('parse aceita string formatada', () => {
    expect(parseBrl('R$ 1.234,56')).toBe(123456);
    expect(parseBrl('1.234,56')).toBe(123456);
    expect(parseBrl('123,45')).toBe(12345);
    expect(parseBrl('1234.56')).toBe(123456);   // formato "americano" colado
    expect(parseBrl('')).toBe(0);
  });
});
```

- [ ] **Step 10: Implementar brl.ts**

Run: `npx vitest run src/components/ui/masks/brl.test.ts` → FAIL

Create `src/components/ui/masks/brl.ts`:
```ts
export function formatBrl(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBrl(input: string): number {
  if (!input) return 0;
  let s = input.replace(/[^\d,.]/g, '');
  // se tem vírgula e ponto, ponto é separador de milhar; vírgula é decimal
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}
```

Run: `npx vitest run src/components/ui/masks/brl.test.ts` → PASS

- [ ] **Step 11: Rodar suite inteira de masks**

Run: `npx vitest run src/components/ui/masks/`
Expected: PASS todas (4 suites, ~16 asserts).

- [ ] **Step 12: Commit**

```bash
git add src/components/ui/masks/
git commit -m "feat(masks): cpf, cnpj, phone-br, brl (fmt/strip/validate)

Base compartilhada dos inputs formatados (PhoneInput, DocInput,
CurrencyInput). Suite Vitest cobre casos válidos, inválidos e edge
(parciais, paste). Test vectors públicos usados pra CPF/CNPJ."
```

---

## Task 5: `<Input>` átomo base

**Files:**
- Create: `src/components/ui/Input.tsx`
- Test: `src/components/ui/Input.test.tsx`

**Interfaces:**
- Consumes: `cn` de `src/utils`, tokens do theme.
- Produces:
  ```tsx
  interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    helper?: string;
    error?: string;
    state?: 'default' | 'error' | 'success' | 'loading';
    size?: 'sm' | 'md' | 'lg' | 'mobile';
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
    clearable?: boolean;
    onClear?: () => void;
  }
  export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
  ```

- [ ] **Step 1: Escrever teste**

Create `src/components/ui/Input.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('<Input>', () => {
  it('renderiza label acima e associa htmlFor/id', () => {
    render(<Input label="E-mail" id="email" />);
    const input = screen.getByLabelText('E-mail');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).id).toBe('email');
  });

  it('exibe helper quando não há erro', () => {
    render(<Input label="X" helper="Ajuda" />);
    expect(screen.getByText('Ajuda')).toBeDefined();
  });

  it('substitui helper por error quando error existe', () => {
    render(<Input label="X" helper="Ajuda" error="Obrigatório" />);
    expect(screen.queryByText('Ajuda')).toBeNull();
    expect(screen.getByText('Obrigatório')).toBeDefined();
  });

  it('dispara onClear quando clearable e onClear passados', () => {
    const onClear = vi.fn();
    render(<Input label="X" value="abc" onChange={() => {}} clearable onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: /limpar/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar teste — falha**

Run: `npx vitest run src/components/ui/Input.test.tsx` → FAIL

- [ ] **Step 3: Implementar**

Create `src/components/ui/Input.tsx`:
```tsx
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/utils';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helper?: string;
  error?: string;
  state?: 'default' | 'error' | 'success' | 'loading';
  size?: 'sm' | 'md' | 'lg' | 'mobile';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
}

const sizeClass: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-8 text-sm',
  md: 'h-9 text-sm',
  lg: 'h-11 text-base',
  mobile: 'h-11 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, state, size = 'md', iconLeft, iconRight, clearable, onClear, id, className, ...rest },
  ref
) {
  const uid = React.useId();
  const inputId = id ?? uid;
  const describedById = `${inputId}-desc`;
  const effectiveState = error ? 'error' : state ?? 'default';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div
        className={cn(
          'relative flex items-center rounded-control border bg-surface-inset transition-colors',
          effectiveState === 'error' && 'border-danger',
          effectiveState === 'success' && 'border-positive',
          effectiveState === 'default' && 'border-border-default focus-within:border-accent',
          effectiveState === 'loading' && 'border-border-default',
          sizeClass[size]
        )}
      >
        {iconLeft && <span className="pl-3 text-text-muted">{iconLeft}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={helper || error ? describedById : undefined}
          aria-invalid={effectiveState === 'error' || undefined}
          className={cn(
            'flex-1 bg-transparent px-3 outline-none text-text-primary placeholder:text-text-faint',
            iconLeft && 'pl-2',
            (iconRight || clearable) && 'pr-2',
            className
          )}
          {...rest}
        />
        {clearable && (rest.value ?? '').toString().length > 0 && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={onClear}
            className="px-2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
        {iconRight && !clearable && <span className="pr-3 text-text-muted">{iconRight}</span>}
      </div>
      {(helper || error) && (
        <p
          id={describedById}
          className={cn(
            'text-2xs',
            error ? 'text-danger' : 'text-text-faint'
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
});
```

- [ ] **Step 4: Rodar teste — passa**

Run: `npx vitest run src/components/ui/Input.test.tsx` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Input.tsx src/components/ui/Input.test.tsx
git commit -m "feat(ui): Input atom com label/helper/error/clearable/icons"
```

---

## Task 6: `<Textarea>`

**Files:**
- Create: `src/components/ui/Textarea.tsx`
- Test: `src/components/ui/Textarea.test.tsx`

**Interfaces:**
- Consumes: nada além de tokens.
- Produces:
  ```tsx
  interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string; helper?: string; error?: string;
    autoResize?: boolean; showCount?: boolean;
  }
  export const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
  ```

- [ ] **Step 1: Escrever teste**

Create `src/components/ui/Textarea.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Textarea } from './Textarea';

describe('<Textarea>', () => {
  it('renderiza label associado', () => {
    render(<Textarea label="Descrição" />);
    expect(screen.getByLabelText('Descrição')).toBeDefined();
  });
  it('showCount exibe contador atualizado', () => {
    render(<Textarea label="X" showCount maxLength={100} defaultValue="hello" />);
    expect(screen.getByText('5 / 100')).toBeDefined();
  });
  it('showCount atualiza ao digitar', () => {
    render(<Textarea label="X" showCount maxLength={100} />);
    const t = screen.getByLabelText('X') as HTMLTextAreaElement;
    fireEvent.change(t, { target: { value: 'abc' } });
    expect(screen.getByText('3 / 100')).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx vitest run src/components/ui/Textarea.test.tsx` → FAIL

- [ ] **Step 3: Implementar**

Create `src/components/ui/Textarea.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/src/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
  autoResize?: boolean;
  showCount?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helper, error, autoResize, showCount, id, className, defaultValue, value, onChange, maxLength, ...rest },
  ref
) {
  const uid = React.useId();
  const inputId = id ?? uid;
  const [internal, setInternal] = React.useState((defaultValue as string) ?? '');
  const controlled = value !== undefined;
  const current = controlled ? (value as string) : internal;
  const localRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement);

  const handle = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!controlled) setInternal(e.target.value);
    if (autoResize && localRef.current) {
      localRef.current.style.height = 'auto';
      localRef.current.style.height = localRef.current.scrollHeight + 'px';
    }
    onChange?.(e);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={localRef}
        id={inputId}
        value={controlled ? (value as string) : undefined}
        defaultValue={!controlled ? (defaultValue as string) : undefined}
        onChange={handle}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full min-h-[80px] rounded-control border bg-surface-inset px-3 py-2 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors',
          error ? 'border-danger' : 'border-border-default focus-within:border-accent',
          className
        )}
        {...rest}
      />
      <div className="flex justify-between text-2xs">
        <span className={error ? 'text-danger' : 'text-text-faint'}>{error ?? helper ?? ''}</span>
        {showCount && (
          <span className="text-text-faint">
            {current.length} {maxLength ? `/ ${maxLength}` : ''}
          </span>
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Rodar — passa**

Run: `npx vitest run src/components/ui/Textarea.test.tsx` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Textarea.tsx src/components/ui/Textarea.test.tsx
git commit -m "feat(ui): Textarea atom com autoResize e showCount"
```

---

## Task 7: `<PhoneInput>` (mask + Input)

**Files:**
- Create: `src/components/ui/PhoneInput.tsx`
- Test: `src/components/ui/PhoneInput.test.tsx`

**Interfaces:**
- Consumes: `formatPhoneBr`, `stripPhone` de `./masks/phone-br`; `<Input>` de `./Input`.
- Produces:
  ```tsx
  interface PhoneInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: string;               // dígitos ("83999999999")
    onChange: (digits: string) => void;
  }
  export function PhoneInput(props: PhoneInputProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/PhoneInput.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhoneInput } from './PhoneInput';

describe('<PhoneInput>', () => {
  it('exibe valor formatado a partir de dígitos', () => {
    render(<PhoneInput label="Tel" value="83999999999" onChange={() => {}} />);
    const input = screen.getByLabelText('Tel') as HTMLInputElement;
    expect(input.value).toBe('(83) 9 9999-9999');
  });
  it('emite onChange com dígitos puros ao digitar', () => {
    const onChange = vi.fn();
    render(<PhoneInput label="Tel" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Tel');
    fireEvent.change(input, { target: { value: '(83) 9 9999-9999' } });
    expect(onChange).toHaveBeenCalledWith('83999999999');
  });
});
```

- [ ] **Step 2: FAIL → implementar**

Run: `npx vitest run src/components/ui/PhoneInput.test.tsx` → FAIL

Create `src/components/ui/PhoneInput.tsx`:
```tsx
import * as React from 'react';
import { Input } from './Input';
import { formatPhoneBr, stripPhone } from './masks/phone-br';

type BaseProps = React.ComponentProps<typeof Input>;
interface PhoneInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, inputMode, ...rest }: PhoneInputProps) {
  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'tel'}
      value={formatPhoneBr(value)}
      onChange={(e) => onChange(stripPhone(e.target.value))}
    />
  );
}
```

Run: `npx vitest run src/components/ui/PhoneInput.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/PhoneInput.tsx src/components/ui/PhoneInput.test.tsx
git commit -m "feat(ui): PhoneInput — mascara (BR) e emite dígitos puros"
```

---

## Task 8: `<DocInput>` (CPF/CNPJ auto)

**Files:**
- Create: `src/components/ui/DocInput.tsx`
- Test: `src/components/ui/DocInput.test.tsx`

**Interfaces:**
- Consumes: masks cpf/cnpj, `<Input>`.
- Produces:
  ```tsx
  interface DocInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: string;                                    // dígitos
    onChange: (digits: string) => void;
    onValidityChange?: (valid: boolean, kind: 'cpf' | 'cnpj' | 'unknown') => void;
  }
  export function DocInput(props: DocInputProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/DocInput.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocInput } from './DocInput';

describe('<DocInput>', () => {
  it('formata como CPF até 11 dígitos', () => {
    render(<DocInput label="Doc" value="12345678900" onChange={() => {}} />);
    expect((screen.getByLabelText('Doc') as HTMLInputElement).value).toBe('123.456.789-00');
  });
  it('formata como CNPJ para 14 dígitos', () => {
    render(<DocInput label="Doc" value="12345678000199" onChange={() => {}} />);
    expect((screen.getByLabelText('Doc') as HTMLInputElement).value).toBe('12.345.678/0001-99');
  });
  it('emite onValidityChange com kind correto', () => {
    const onValid = vi.fn();
    const { rerender } = render(
      <DocInput label="Doc" value="52998224725" onChange={() => {}} onValidityChange={onValid} />
    );
    expect(onValid).toHaveBeenCalledWith(true, 'cpf');
    rerender(<DocInput label="Doc" value="11444777000161" onChange={() => {}} onValidityChange={onValid} />);
    expect(onValid).toHaveBeenLastCalledWith(true, 'cnpj');
  });
});
```

- [ ] **Step 2: FAIL → implementar**

Create `src/components/ui/DocInput.tsx`:
```tsx
import * as React from 'react';
import { Input } from './Input';
import { formatCpf, isValidCpf, stripCpf } from './masks/cpf';
import { formatCnpj, isValidCnpj, stripCnpj } from './masks/cnpj';

type BaseProps = React.ComponentProps<typeof Input>;
interface DocInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
  onValidityChange?: (valid: boolean, kind: 'cpf' | 'cnpj' | 'unknown') => void;
}

export function DocInput({ value, onChange, onValidityChange, inputMode, ...rest }: DocInputProps) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  const isCnpj = digits.length > 11;
  const formatted = isCnpj ? formatCnpj(digits) : formatCpf(digits);

  React.useEffect(() => {
    if (!onValidityChange) return;
    if (digits.length === 11) onValidityChange(isValidCpf(digits), 'cpf');
    else if (digits.length === 14) onValidityChange(isValidCnpj(digits), 'cnpj');
    else onValidityChange(false, 'unknown');
  }, [digits, onValidityChange]);

  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'numeric'}
      value={formatted}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
        onChange(raw);
      }}
    />
  );
}
```

Run: `npx vitest run src/components/ui/DocInput.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/DocInput.tsx src/components/ui/DocInput.test.tsx
git commit -m "feat(ui): DocInput — auto CPF/CNPJ com validação de dígito verificador"
```

---

## Task 9: `<CurrencyInput>` (BRL + motion-number)

**Files:**
- Create: `src/components/ui/CurrencyInput.tsx`
- Test: `src/components/ui/CurrencyInput.test.tsx`

**Interfaces:**
- Consumes: masks/brl, `<Input>`. `motion-number` do animate-ui (opt-in display).
- Produces:
  ```tsx
  interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: number;                                    // centavos
    onChange: (cents: number) => void;
    showStepper?: boolean;
    stepCents?: number;                               // default 100
  }
  export function CurrencyInput(props: CurrencyInputProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/CurrencyInput.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CurrencyInput } from './CurrencyInput';

describe('<CurrencyInput>', () => {
  it('renderiza valor em BRL', () => {
    render(<CurrencyInput label="Preço" value={12345} onChange={() => {}} />);
    expect((screen.getByLabelText('Preço') as HTMLInputElement).value).toContain('123,45');
  });
  it('emite cents ao digitar', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Preço" value={0} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Preço'), { target: { value: 'R$ 12,34' } });
    expect(onChange).toHaveBeenCalledWith(1234);
  });
  it('stepper +/- respeita stepCents', () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="P" value={500} onChange={onChange} showStepper stepCents={100} />);
    fireEvent.click(screen.getByRole('button', { name: /aumentar/i }));
    expect(onChange).toHaveBeenLastCalledWith(600);
    fireEvent.click(screen.getByRole('button', { name: /diminuir/i }));
    expect(onChange).toHaveBeenLastCalledWith(400);
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/CurrencyInput.tsx`:
```tsx
import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from './Input';
import { formatBrl, parseBrl } from './masks/brl';

type BaseProps = React.ComponentProps<typeof Input>;
interface CurrencyInputProps extends Omit<BaseProps, 'value' | 'onChange'> {
  value: number;
  onChange: (cents: number) => void;
  showStepper?: boolean;
  stepCents?: number;
}

export function CurrencyInput({
  value, onChange, showStepper, stepCents = 100, inputMode, iconRight, ...rest
}: CurrencyInputProps) {
  const stepper = showStepper ? (
    <span className="flex gap-1">
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(0, value - stepCents))}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(value + stepCents)}
        className="p-1 text-text-muted hover:text-text-primary"
      >
        <Plus size={14} />
      </button>
    </span>
  ) : null;

  return (
    <Input
      {...rest}
      inputMode={inputMode ?? 'decimal'}
      value={formatBrl(value)}
      onChange={(e) => onChange(parseBrl(e.target.value))}
      iconRight={stepper ?? iconRight}
    />
  );
}
```

Run: `npx vitest run src/components/ui/CurrencyInput.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CurrencyInput.tsx src/components/ui/CurrencyInput.test.tsx
git commit -m "feat(ui): CurrencyInput — BRL em cents, stepper opt-in"
```

---

## Task 10: `<CepInput>` (autofill via ViaCEP)

**Files:**
- Create: `src/components/ui/CepInput.tsx`
- Test: `src/components/ui/CepInput.test.tsx`

**Interfaces:**
- Consumes: `<Input>`. `fetch` global.
- Produces:
  ```tsx
  interface CepAutoFill {
    estado: string;    // UF ("PB")
    cidade: string;
    bairro: string;
    rua: string;
  }
  interface CepInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: string;                                    // dígitos
    onChange: (digits: string) => void;
    onAutoFill?: (data: CepAutoFill) => void;
  }
  export function CepInput(props: CepInputProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste (mock fetch)**

Create `src/components/ui/CepInput.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CepInput } from './CepInput';

describe('<CepInput>', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ uf: 'PB', localidade: 'Juazeirinho', bairro: 'Centro', logradouro: 'Rua A' }),
    });
  });

  it('formata CEP como 12345-678', () => {
    render(<CepInput label="CEP" value="58500000" onChange={() => {}} />);
    expect((screen.getByLabelText('CEP') as HTMLInputElement).value).toBe('58500-000');
  });

  it('chama onAutoFill quando CEP atinge 8 dígitos', async () => {
    const onAutoFill = vi.fn();
    const { rerender } = render(
      <CepInput label="CEP" value="" onChange={() => {}} onAutoFill={onAutoFill} />
    );
    rerender(<CepInput label="CEP" value="58500000" onChange={() => {}} onAutoFill={onAutoFill} />);
    await waitFor(() =>
      expect(onAutoFill).toHaveBeenCalledWith({
        estado: 'PB', cidade: 'Juazeirinho', bairro: 'Centro', rua: 'Rua A',
      })
    );
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/CepInput.tsx`:
```tsx
import * as React from 'react';
import { Input } from './Input';

interface CepAutoFill {
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
}

interface CepInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string;
  onChange: (digits: string) => void;
  onAutoFill?: (data: CepAutoFill) => void;
}

function fmtCep(d: string) {
  const clean = d.replace(/\D/g, '').slice(0, 8);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

export function CepInput({ value, onChange, onAutoFill, ...rest }: CepInputProps) {
  const [loading, setLoading] = React.useState(false);
  const lastQueried = React.useRef<string>('');

  React.useEffect(() => {
    if (!onAutoFill) return;
    if (value.length !== 8) return;
    if (lastQueried.current === value) return;
    lastQueried.current = value;
    setLoading(true);
    fetch(`https://viacep.com.br/ws/${value}/json/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (json.erro) return;
        onAutoFill({
          estado: json.uf ?? '',
          cidade: json.localidade ?? '',
          bairro: json.bairro ?? '',
          rua: json.logradouro ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [value, onAutoFill]);

  return (
    <Input
      {...rest}
      inputMode="numeric"
      state={loading ? 'loading' : rest.state}
      value={fmtCep(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
    />
  );
}
```

Run: `npx vitest run src/components/ui/CepInput.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CepInput.tsx src/components/ui/CepInput.test.tsx
git commit -m "feat(ui): CepInput — máscara + autofill ViaCEP"
```

---

## Task 11: `<Select>` base (single, com layoutId highlight)

**Files:**
- Create: `src/components/ui/Select.tsx`
- Test: `src/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: `motion/react`, `SPRING_SHEET`, `SPRING_MICRO` de `./motion`, tokens.
- Produces:
  ```tsx
  interface SelectOption { value: string; label: string; }
  interface SelectProps {
    label?: string; helper?: string; error?: string; placeholder?: string;
    options: SelectOption[];
    value: string; onChange: (value: string) => void;
    size?: 'sm' | 'md' | 'lg' | 'mobile';
  }
  export function Select(props: SelectProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Select.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

const opts = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gama' },
];

describe('<Select>', () => {
  it('mostra label do valor selecionado', () => {
    render(<Select label="X" options={opts} value="b" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveTextContent('Beta');
  });
  it('abre listbox no click e escolhe uma opção', () => {
    const onChange = vi.fn();
    render(<Select label="X" options={opts} value="" onChange={onChange} placeholder="Escolha" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Gama'));
    expect(onChange).toHaveBeenCalledWith('c');
  });
  it('fecha com Escape', () => {
    render(<Select label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Alpha')).toBeNull();
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Select.tsx`:
```tsx
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET, SPRING_MICRO } from './motion';

interface SelectOption { value: string; label: string }
interface SelectProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: SelectOption[];
  value: string; onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'mobile';
}

const heights = { sm: 'h-8', md: 'h-9', lg: 'h-11', mobile: 'h-11' } as const;

export function Select({ label, helper, error, placeholder, options, value, onChange, size = 'md' }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();
  const hlId = React.useRef(`sel-hl-${Math.random().toString(36).slice(2)}`).current;

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const current = options.find((o) => o.value === value);
  const highlight = hover ?? value;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? uid : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between rounded-control border bg-surface-inset px-3 text-sm text-text-primary transition-colors',
          heights[size],
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        <span className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING_MICRO}>
          <ChevronDown size={14} className="text-text-muted" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute mt-14 min-w-[180px] max-h-60 overflow-y-auto rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3 py-2"
            onMouseLeave={() => setHover(null)}
          >
            {options.map((o) => {
              const active = o.value === value;
              const hi = highlight === o.value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHover(o.value)}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    'relative flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                    active ? 'text-accent font-medium' : 'text-text-secondary'
                  )}
                >
                  {hi && (
                    <motion.span
                      layoutId={hlId}
                      transition={SPRING_MICRO}
                      className={cn('absolute inset-x-1 inset-y-0.5 rounded-md -z-0', active ? 'bg-accent/10' : 'bg-surface-inset')}
                    />
                  )}
                  <span className="relative z-10">{o.label}</span>
                  {active && <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-accent" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
```

Run: `npx vitest run src/components/ui/Select.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Select.tsx src/components/ui/Select.test.tsx
git commit -m "feat(ui): Select single com highlight deslizante (layoutId)"
```

---

## Task 12: `<Combobox>` (searchable + virtualizado > 100 itens)

**Files:**
- Create: `src/components/ui/Combobox.tsx`
- Test: `src/components/ui/Combobox.test.tsx`

**Interfaces:**
- Consumes: `<Input>`, primitivo `highlighter` do animate-ui.
- Produces:
  ```tsx
  interface ComboboxOption { value: string; label: string; }
  interface ComboboxProps {
    label?: string; helper?: string; error?: string; placeholder?: string;
    options: ComboboxOption[];
    value: string; onChange: (value: string) => void;
    virtualizeThreshold?: number;                     // default 100
  }
  export function Combobox(props: ComboboxProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Combobox.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Combobox } from './Combobox';

const opts = Array.from({ length: 200 }, (_, i) => ({ value: `v${i}`, label: `Opção ${i}` }));

describe('<Combobox>', () => {
  it('filtra por busca case-insensitive', () => {
    render(<Combobox label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'opção 42' } });
    expect(screen.getByText('Opção 42')).toBeDefined();
    expect(screen.queryByText('Opção 1')).toBeNull();
  });
  it('escolhe uma opção', () => {
    const onChange = vi.fn();
    render(<Combobox label="X" options={opts.slice(0, 5)} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Opção 2'));
    expect(onChange).toHaveBeenCalledWith('v2');
  });
  it('lista com > 100 itens renderiza sem travar (virtual)', () => {
    render(<Combobox label="X" options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    // Só um subset renderiza (janela virtual)
    const items = screen.getAllByRole('option');
    expect(items.length).toBeLessThan(opts.length);
  });
});
```

- [ ] **Step 2: Implementar (virtualização simples via slice de janela; sem react-window nesta fatia pra manter dep zero)**

Create `src/components/ui/Combobox.tsx`:
```tsx
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface ComboboxOption { value: string; label: string }
interface ComboboxProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: ComboboxOption[];
  value: string; onChange: (value: string) => void;
  virtualizeThreshold?: number;
}

const WINDOW = 60;  // itens renderizados por vez quando threshold estourado

export function Combobox({ label, helper, error, placeholder, options, value, onChange, virtualizeThreshold = 100 }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [visible, setVisible] = React.useState(WINDOW);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const shouldVirtualize = filtered.length > virtualizeThreshold;
  const shown = shouldVirtualize ? filtered.slice(0, visible) : filtered;

  const current = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? uid : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center justify-between h-9 rounded-control border bg-surface-inset px-3 text-sm text-text-primary transition-colors',
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        <span className={cn(!current && 'text-text-faint')}>{current?.label ?? placeholder ?? 'Selecione…'}</span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute mt-14 min-w-[220px] rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3"
          >
            <input
              autoFocus
              placeholder="Buscar…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setVisible(WINDOW); }}
              className="w-full px-3 py-2 bg-transparent border-b border-border-subtle text-sm outline-none text-text-primary placeholder:text-text-faint"
            />
            <ul
              role="listbox"
              className="max-h-60 overflow-y-auto py-1"
              onScroll={(e) => {
                if (!shouldVirtualize) return;
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                  setVisible((v) => Math.min(v + WINDOW, filtered.length));
                }
              }}
            >
              {shown.map((o) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(''); setVisible(WINDOW); }}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer hover:bg-surface-inset',
                    o.value === value ? 'text-accent font-medium' : 'text-text-secondary'
                  )}
                >
                  {o.label}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-text-faint">Sem resultados</li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
```

Run: `npx vitest run src/components/ui/Combobox.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Combobox.tsx src/components/ui/Combobox.test.tsx
git commit -m "feat(ui): Combobox — busca + virtualização por janela em > 100 itens"
```

---

## Task 13: `<MultiSelect>` (chips removíveis)

**Files:**
- Create: `src/components/ui/MultiSelect.tsx`
- Test: `src/components/ui/MultiSelect.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface MultiSelectProps {
    label?: string; helper?: string; error?: string; placeholder?: string;
    options: ComboboxOption[];
    value: string[]; onChange: (values: string[]) => void;
  }
  export function MultiSelect(props: MultiSelectProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/MultiSelect.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiSelect } from './MultiSelect';

const opts = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('<MultiSelect>', () => {
  it('renderiza chip por valor selecionado', () => {
    render(<MultiSelect label="X" options={opts} value={['a', 'b']} onChange={() => {}} />);
    expect(screen.getByText('Alpha')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });
  it('remove chip ao clicar no X', () => {
    const onChange = vi.fn();
    render(<MultiSelect label="X" options={opts} value={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remover/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/MultiSelect.tsx`:
```tsx
import * as React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface Opt { value: string; label: string }
interface MultiSelectProps {
  label?: string; helper?: string; error?: string; placeholder?: string;
  options: Opt[];
  value: string[]; onChange: (values: string[]) => void;
}

export function MultiSelect({ label, helper, error, placeholder, options, value, onChange }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const uid = React.useId();

  React.useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label id={uid} className="text-xs font-medium text-text-secondary">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'min-h-9 rounded-control border bg-surface-inset px-2 py-1 flex flex-wrap items-center gap-1 text-left transition-colors',
          error ? 'border-danger' : open ? 'border-accent' : 'border-border-default'
        )}
      >
        {value.length === 0 ? (
          <span className="text-sm text-text-faint px-1">{placeholder ?? 'Selecione…'}</span>
        ) : (
          value.map((v) => {
            const o = options.find((x) => x.value === v);
            if (!o) return null;
            return (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-badge bg-accent-soft-bg text-accent-soft-fg text-xs">
                {o.label}
                <button
                  type="button"
                  aria-label={`Remover ${o.label}`}
                  onClick={(e) => { e.stopPropagation(); toggle(v); }}
                  className="hover:text-danger"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown size={14} className="ml-auto text-text-muted shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top', zIndex: 'var(--z-dropdown)' as unknown as number }}
            className="absolute mt-14 max-h-60 overflow-y-auto rounded-modal border border-border-default bg-surface-raised/95 backdrop-blur-xl shadow-elevation-3 py-1 min-w-[200px]"
          >
            {options.map((o) => {
              const active = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={active}
                  onClick={() => toggle(o.value)}
                  className={cn('px-3 py-2 text-sm cursor-pointer hover:bg-surface-inset', active ? 'text-accent' : 'text-text-secondary')}
                >
                  {o.label}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      {(helper || error) && <p className={cn('text-2xs', error ? 'text-danger' : 'text-text-faint')}>{error ?? helper}</p>}
    </div>
  );
}
```

Run: `npx vitest run src/components/ui/MultiSelect.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/MultiSelect.tsx src/components/ui/MultiSelect.test.tsx
git commit -m "feat(ui): MultiSelect com chips removíveis"
```

---

## Task 14: `useIBGE()` hook + JSON de municípios

**Files:**
- Create: `src/components/ui/data/ibge-municipios.json`
- Create: `src/components/ui/hooks/useIBGE.ts`
- Test: `src/components/ui/hooks/useIBGE.test.ts`

**Interfaces:**
- Consumes: JSON estático.
- Produces:
  ```ts
  interface UFEntry { sigla: string; nome: string; cidades: string[]; }
  export function useUFs(): UFEntry[];                  // sync — carrega as 27 UFs sem cidades
  export function useCidades(uf: string | ''): { data: string[]; loading: boolean };  // lazy load cidades
  ```

- [ ] **Step 1: Baixar/gerar o JSON**

Executar script one-shot no scratchpad pra baixar do IBGE API oficial e salvar:
```bash
node -e "
(async () => {
  const estados = await (await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados')).json();
  const out = [];
  for (const uf of estados.sort((a,b)=>a.sigla.localeCompare(b.sigla))) {
    const municipios = await (await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'+uf.sigla+'/municipios')).json();
    out.push({ sigla: uf.sigla, nome: uf.nome, cidades: municipios.map(m=>m.nome).sort() });
    process.stderr.write('.');
  }
  require('fs').writeFileSync('src/components/ui/data/ibge-municipios.json', JSON.stringify(out));
})();
"
```
Expected: arquivo criado (~2 MB não-gzip, ~350 kB gzip). Se o network estiver offline, cair pra usar `snapshot-ibge-2024.json` (documentar como fallback no PR).

- [ ] **Step 2: Teste do hook**

Create `src/components/ui/hooks/useIBGE.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useUFs, useCidades } from './useIBGE';

describe('useIBGE', () => {
  it('useUFs retorna 27 UFs', async () => {
    const { result } = renderHook(() => useUFs());
    await waitFor(() => expect(result.current.length).toBe(27));
    expect(result.current.map((u) => u.sigla)).toContain('PB');
  });
  it('useCidades("PB") contém Juazeirinho', async () => {
    const { result } = renderHook(() => useCidades('PB'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toContain('Juazeirinho');
  });
  it('useCidades("") retorna vazio', () => {
    const { result } = renderHook(() => useCidades(''));
    expect(result.current.data).toEqual([]);
  });
});
```

- [ ] **Step 3: Implementar hook (dynamic import — só carrega quando alguém consulta)**

Create `src/components/ui/hooks/useIBGE.ts`:
```ts
import { useEffect, useState } from 'react';

interface UFEntry { sigla: string; nome: string; cidades: string[] }

let cachePromise: Promise<UFEntry[]> | null = null;

function load(): Promise<UFEntry[]> {
  if (!cachePromise) {
    cachePromise = import('../data/ibge-municipios.json').then((m) => m.default as UFEntry[]);
  }
  return cachePromise;
}

export function useUFs(): UFEntry[] {
  const [ufs, setUfs] = useState<UFEntry[]>([]);
  useEffect(() => {
    let alive = true;
    load().then((data) => { if (alive) setUfs(data); });
    return () => { alive = false; };
  }, []);
  return ufs;
}

export function useCidades(uf: string | ''): { data: string[]; loading: boolean } {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!!uf);
  useEffect(() => {
    if (!uf) { setData([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    load().then((all) => {
      if (!alive) return;
      const entry = all.find((u) => u.sigla === uf);
      setData(entry?.cidades ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [uf]);
  return { data, loading };
}
```

Run: `npx vitest run src/components/ui/hooks/useIBGE.test.ts` → PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/data/ibge-municipios.json src/components/ui/hooks/useIBGE.ts src/components/ui/hooks/useIBGE.test.ts
git commit -m "feat(ui): dataset IBGE municipios + useUFs/useCidades hooks (lazy)"
```

---

## Task 15: `<StateCitySelect>` — micro-UX chave

**Files:**
- Create: `src/components/ui/StateCitySelect.tsx`
- Create: `src/components/ui/formatarCidade.ts`
- Test: `src/components/ui/StateCitySelect.test.tsx`, `formatarCidade.test.ts`

**Interfaces:**
- Consumes: `useUFs`, `useCidades`, `<Select>`, `<Combobox>`.
- Produces:
  ```tsx
  export interface CityValue { estado: string; cidade: string; }
  interface StateCitySelectProps {
    value: CityValue;
    onChange: (v: CityValue) => void;
    labelEstado?: string;
    labelCidade?: string;
    error?: { estado?: string; cidade?: string };
  }
  export function StateCitySelect(props: StateCitySelectProps): React.ReactElement;
  export function formatarCidade(v: CityValue): string;   // { estado: "PB", cidade: "Juazeirinho" } → "Juazeirinho, PB"
  ```

- [ ] **Step 1: Testes**

Create `src/components/ui/formatarCidade.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatarCidade } from './formatarCidade';

describe('formatarCidade', () => {
  it('formata cidade + UF', () => {
    expect(formatarCidade({ estado: 'PB', cidade: 'Juazeirinho' })).toBe('Juazeirinho, PB');
  });
  it('vazio quando sem cidade', () => {
    expect(formatarCidade({ estado: 'PB', cidade: '' })).toBe('');
  });
  it('vazio quando sem UF', () => {
    expect(formatarCidade({ estado: '', cidade: 'Juazeirinho' })).toBe('Juazeirinho');
  });
});
```

Create `src/components/ui/StateCitySelect.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StateCitySelect } from './StateCitySelect';

describe('<StateCitySelect>', () => {
  it('trocar UF esvazia cidade', async () => {
    const onChange = vi.fn();
    render(<StateCitySelect value={{ estado: 'PB', cidade: 'Juazeirinho' }} onChange={onChange} />);
    await waitFor(() => screen.getByRole('button', { name: /paraíba/i }));
    fireEvent.click(screen.getByRole('button', { name: /paraíba/i }));
    fireEvent.click(await screen.findByText(/Pernambuco/));
    expect(onChange).toHaveBeenCalledWith({ estado: 'PE', cidade: '' });
  });
  it('mostra cidade selecionada quando UF já preenchida', async () => {
    render(<StateCitySelect value={{ estado: 'PB', cidade: 'Juazeirinho' }} onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Juazeirinho/i })).toBeDefined());
  });
});
```

- [ ] **Step 2: Implementar helper**

Create `src/components/ui/formatarCidade.ts`:
```ts
import type { CityValue } from './StateCitySelect';

export function formatarCidade(v: CityValue): string {
  if (v.cidade && v.estado) return `${v.cidade}, ${v.estado}`;
  return v.cidade || v.estado || '';
}
```

- [ ] **Step 3: Implementar componente**

Create `src/components/ui/StateCitySelect.tsx`:
```tsx
import * as React from 'react';
import { Select } from './Select';
import { Combobox } from './Combobox';
import { useUFs, useCidades } from './hooks/useIBGE';

export interface CityValue { estado: string; cidade: string }

interface StateCitySelectProps {
  value: CityValue;
  onChange: (v: CityValue) => void;
  labelEstado?: string;
  labelCidade?: string;
  error?: { estado?: string; cidade?: string };
}

export function StateCitySelect({
  value, onChange, labelEstado = 'Estado', labelCidade = 'Cidade', error,
}: StateCitySelectProps) {
  const ufs = useUFs();
  const { data: cidades, loading } = useCidades(value.estado);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
      <Select
        label={labelEstado}
        options={ufs.map((u) => ({ value: u.sigla, label: u.sigla }))}
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

- [ ] **Step 4: Rodar suite**

Run: `npx vitest run src/components/ui/StateCitySelect.test.tsx src/components/ui/formatarCidade.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StateCitySelect.tsx src/components/ui/formatarCidade.ts src/components/ui/StateCitySelect.test.tsx src/components/ui/formatarCidade.test.ts
git commit -m "feat(ui): StateCitySelect + formatarCidade — micro-UX chave

Substitui o campo livre 'Juazeirinho-PB' por dois campos encadeados
(Estado + Cidade) baseados no dataset IBGE. Backend passa a ter colunas
separadas quando a Fatia 1 (Clientes) migrar."
```

---

## Task 16: `<DatePicker>` (react-day-picker + Radix Popover)

**Files:**
- Create: `src/components/ui/DatePicker.tsx`
- Test: `src/components/ui/DatePicker.test.tsx`
- Modify: `package.json` (add `react-day-picker`, `date-fns`)

**Interfaces:**
- Consumes: `react-day-picker`, Radix Popover, `<Input>`.
- Produces:
  ```tsx
  interface DatePickerProps {
    label?: string; helper?: string; error?: string;
    value: Date | null;
    onChange: (d: Date | null) => void;
  }
  export function DatePicker(props: DatePickerProps): React.ReactElement;
  ```

- [ ] **Step 1: Instalar deps**

Run: `npm install react-day-picker date-fns`
Expected: ambos em `package.json`.

- [ ] **Step 2: Teste**

Create `src/components/ui/DatePicker.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DatePicker } from './DatePicker';

describe('<DatePicker>', () => {
  it('renderiza valor em pt-BR dd/MM/yyyy', () => {
    render(<DatePicker label="D" value={new Date(2026, 7, 28)} onChange={() => {}} />);
    expect((screen.getByLabelText('D') as HTMLInputElement).value).toBe('28/08/2026');
  });
  it('parse manual do input dispara onChange', () => {
    const onChange = vi.fn();
    render(<DatePicker label="D" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('D'), { target: { value: '15/03/2027' } });
    fireEvent.blur(screen.getByLabelText('D'));
    expect(onChange).toHaveBeenCalledWith(new Date(2027, 2, 15));
  });
});
```

- [ ] **Step 3: Implementar**

Create `src/components/ui/DatePicker.tsx`:
```tsx
import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Calendar } from 'lucide-react';
import { Input } from './Input';

interface DatePickerProps {
  label?: string; helper?: string; error?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}

export function DatePicker({ label, helper, error, value, onChange }: DatePickerProps) {
  const [text, setText] = React.useState(value ? format(value, 'dd/MM/yyyy') : '');
  React.useEffect(() => {
    setText(value ? format(value, 'dd/MM/yyyy') : '');
  }, [value]);

  const commit = (t: string) => {
    if (!t) { onChange(null); return; }
    const parsed = parse(t, 'dd/MM/yyyy', new Date());
    if (isValid(parsed)) onChange(parsed);
  };

  return (
    <PopoverPrimitive.Root>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={label}
            helper={helper}
            error={error}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => commit(text)}
            iconRight={
              <PopoverPrimitive.Trigger asChild>
                <button type="button" aria-label="Abrir calendário" className="text-text-muted">
                  <Calendar size={16} />
                </button>
              </PopoverPrimitive.Trigger>
            }
          />
        </div>
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="rounded-modal border border-border-default bg-surface-raised p-2 shadow-elevation-3"
          style={{ zIndex: 'var(--z-dropdown)' as unknown as number }}
        >
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={value ?? undefined}
            onSelect={(d) => { onChange(d ?? null); }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
```

Run: `npx vitest run src/components/ui/DatePicker.test.tsx` → PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/DatePicker.tsx src/components/ui/DatePicker.test.tsx
git commit -m "feat(ui): DatePicker BR (react-day-picker + date-fns + Radix Popover)"
```

---

## Task 17: `<TimePicker>` (hh:mm)

**Files:**
- Create: `src/components/ui/TimePicker.tsx`
- Test: `src/components/ui/TimePicker.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface TimePickerProps {
    label?: string; helper?: string; error?: string;
    value: string;                     // "HH:mm"
    onChange: (v: string) => void;
  }
  export function TimePicker(props: TimePickerProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/TimePicker.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimePicker } from './TimePicker';

describe('<TimePicker>', () => {
  it('renderiza valor', () => {
    render(<TimePicker label="Hora" value="14:30" onChange={() => {}} />);
    expect((screen.getByLabelText('Hora') as HTMLInputElement).value).toBe('14:30');
  });
  it('mascara digits em HH:mm', () => {
    const onChange = vi.fn();
    render(<TimePicker label="H" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('H'), { target: { value: '0930' } });
    expect(onChange).toHaveBeenCalledWith('09:30');
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/TimePicker.tsx`:
```tsx
import * as React from 'react';
import { Input } from './Input';

interface TimePickerProps {
  label?: string; helper?: string; error?: string;
  value: string;
  onChange: (v: string) => void;
}

function fmt(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function TimePicker({ value, onChange, ...rest }: TimePickerProps) {
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={fmt(value)}
      onChange={(e) => onChange(fmt(e.target.value))}
      placeholder="HH:mm"
    />
  );
}
```

Run: `npx vitest run src/components/ui/TimePicker.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/TimePicker.tsx src/components/ui/TimePicker.test.tsx
git commit -m "feat(ui): TimePicker HH:mm"
```

---

## Task 18: `<Modal>` reescrito (drop-in, spring + rounded-modal + z-escala)

**Files:**
- Modify: `src/components/Modal.tsx`
- Create: `src/components/Modal.test.tsx`

**Interfaces:**
- Consumes: Radix Dialog, `motion/react`, tokens.
- Produces: mesma API pública já existente (`ModalProps`, export nomeado `Modal`).

- [ ] **Step 1: Escrever teste (garante drop-in)**

Create `src/components/Modal.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal } from './Modal';

describe('<Modal>', () => {
  it('renderiza título e body quando isOpen', () => {
    render(<Modal isOpen title="X" onClose={() => {}}>corpo</Modal>);
    expect(screen.getByText('X')).toBeDefined();
    expect(screen.getByText('corpo')).toBeDefined();
  });
  it('não renderiza content quando isOpen=false', () => {
    render(<Modal isOpen={false} title="X" onClose={() => {}}>corpo</Modal>);
    expect(screen.queryByText('corpo')).toBeNull();
  });
  it('chama onClose ao clicar no X', () => {
    const onClose = vi.fn();
    render(<Modal isOpen title="X" onClose={onClose}>corpo</Modal>);
    fireEvent.click(screen.getByRole('button', { name: '' }));   // botão X (sem label visível, mas único role button)
    expect(onClose).toHaveBeenCalled();
  });
  it('renderiza footer quando passado', () => {
    render(<Modal isOpen title="X" onClose={() => {}} footer={<div>footer!</div>}>corpo</Modal>);
    expect(screen.getByText('footer!')).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar teste — provavelmente já passa (API atual)**

Run: `npx vitest run src/components/Modal.test.tsx`
Expected: PASS (o Modal atual já entrega esses comportamentos).

- [ ] **Step 3: Reescrever Modal.tsx preservando API**

Substituir conteúdo de `src/components/Modal.tsx`:
```tsx
import React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils';
import { SPRING_SHEET } from './ui/motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  footer?: React.ReactNode;
}

const MotionContent = motion(DialogPrimitive.Content);

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, title, children, maxWidth = 'max-w-2xl',
  icon, iconBgColor = 'bg-surface-raised/50', iconColor = 'text-text-muted', footer,
}) => {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-overlay-scrim backdrop-blur-sm animate-in fade-in duration-200"
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
        />
        <MotionContent
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={SPRING_SHEET}
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] rounded-modal border shadow-elevation-4 overflow-hidden flex flex-col outline-none',
            maxWidth,
            'bg-surface-card border-border-default text-text-primary'
          )}
          style={{ zIndex: 'var(--z-modal)' as unknown as number }}
        >
          <div className="p-6 border-b border-border-default/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className={cn('p-2 rounded-xl', iconBgColor, iconColor)}>{icon}</div>
              )}
              {title ? (
                <DialogPrimitive.Title asChild>
                  <h3 className="text-lg font-bold">{title}</h3>
                </DialogPrimitive.Title>
              ) : (
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Title>Diálogo</DialogPrimitive.Title>
                </VisuallyHidden.Root>
              )}
            </div>
            <DialogPrimitive.Close
              className="p-2 rounded-xl transition-colors hover:bg-surface-raised text-text-muted"
              aria-label="Fechar"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Description>Conteúdo do diálogo</DialogPrimitive.Description>
          </VisuallyHidden.Root>
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">{children}</div>
          {footer && (
            <div className="p-6 border-t border-border-default/50 bg-surface-inset/20 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </MotionContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
```

- [ ] **Step 4: Rodar teste novamente + smoke visual**

Run: `npx vitest run src/components/Modal.test.tsx` → PASS

Smoke: `npm run dev` — abrir uma tela que usa Modal (ex: Estoque item), abrir/fechar. Verificar que anima com spring, backdrop tem blur, e nada visual quebrou.

- [ ] **Step 5: Commit**

```bash
git add src/components/Modal.tsx src/components/Modal.test.tsx
git commit -m "refactor(Modal): spring motion + rounded-modal + z-index escala

Drop-in: mesma API pública. Muda só implementação interna (motion.spring
em vez de animate-in classes, rounded-modal em vez de rounded-3xl,
--z-modal em vez de z-[9999], shadow-elevation-4 em vez de shadow-2xl)."
```

---

## Task 19: `<Sheet>` (bottom mobile / side desktop)

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Test: `src/components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: Radix Dialog (reaproveita mecânica), motion.
- Produces:
  ```tsx
  interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    side?: 'bottom' | 'right';                        // default: bottom mobile, right desktop via CSS
    children: React.ReactNode;
  }
  export function Sheet(props: SheetProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Sheet.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('<Sheet>', () => {
  it('renderiza título e children quando aberto', () => {
    render(<Sheet isOpen title="X" onClose={() => {}}>body</Sheet>);
    expect(screen.getByText('X')).toBeDefined();
    expect(screen.getByText('body')).toBeDefined();
  });
  it('fecha ao Escape', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen title="X" onClose={onClose}>body</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Sheet.tsx`:
```tsx
import * as React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: 'bottom' | 'right';
  children: React.ReactNode;
}

export function Sheet({ isOpen, onClose, title, side = 'bottom', children }: SheetProps) {
  const bottom = side === 'bottom';
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AnimatePresence>
        {isOpen && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-overlay-scrim"
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={bottom ? { y: '100%' } : { x: '100%' }}
                animate={bottom ? { y: 0 } : { x: 0 }}
                exit={bottom ? { y: '100%' } : { x: '100%' }}
                transition={SPRING_SHEET}
                className={cn(
                  'fixed bg-surface-card border-border-default text-text-primary shadow-elevation-4 outline-none',
                  bottom
                    ? 'left-0 right-0 bottom-0 rounded-t-[24px] pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto border-t'
                    : 'top-0 right-0 bottom-0 w-[400px] max-w-[95vw] border-l overflow-y-auto'
                )}
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              >
                <div className="p-4 flex items-center justify-between border-b border-border-default/50">
                  {title ? (
                    <DialogPrimitive.Title asChild>
                      <h3 className="text-base font-bold">{title}</h3>
                    </DialogPrimitive.Title>
                  ) : (
                    <VisuallyHidden.Root asChild>
                      <DialogPrimitive.Title>Sheet</DialogPrimitive.Title>
                    </VisuallyHidden.Root>
                  )}
                  <DialogPrimitive.Close aria-label="Fechar" className="p-2 rounded-xl hover:bg-surface-raised text-text-muted">
                    <X size={18} />
                  </DialogPrimitive.Close>
                </div>
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Description>Conteúdo do sheet</DialogPrimitive.Description>
                </VisuallyHidden.Root>
                <div className="p-4">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
```

Run: `npx vitest run src/components/ui/Sheet.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Sheet.tsx src/components/ui/Sheet.test.tsx
git commit -m "feat(ui): Sheet — bottom (mobile) e right (desktop), respeita safe-area"
```

---

## Task 20: `<Drawer>` (side drawer, alias semântico do Sheet)

**Files:**
- Create: `src/components/ui/Drawer.tsx`
- Test: `src/components/ui/Drawer.test.tsx`

**Interfaces:**
- Produces: mesma API do Sheet mas `side='right'` fixo. Alias semântico pra formulários longos.

- [ ] **Step 1: Teste**

Create `src/components/ui/Drawer.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Drawer } from './Drawer';

describe('<Drawer>', () => {
  it('renderiza como side sheet', () => {
    render(<Drawer isOpen title="Novo cliente" onClose={() => {}}>form</Drawer>);
    expect(screen.getByText('Novo cliente')).toBeDefined();
    expect(screen.getByText('form')).toBeDefined();
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Drawer.tsx`:
```tsx
import * as React from 'react';
import { Sheet } from './Sheet';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Drawer(props: DrawerProps) {
  return <Sheet {...props} side="right" />;
}
```

Run: `npx vitest run src/components/ui/Drawer.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Drawer.tsx src/components/ui/Drawer.test.tsx
git commit -m "feat(ui): Drawer — alias semântico do Sheet side=right"
```

---

## Task 21: `<Confirm>` + `useConfirm()` global

**Files:**
- Create: `src/components/ui/Confirm.tsx`
- Create: `src/components/ui/hooks/useConfirm.ts`
- Create: `src/components/ui/ConfirmProvider.tsx`
- Test: `src/components/ui/Confirm.test.tsx`
- Modify: `src/App.tsx` (envolver com `<ConfirmProvider>`)

**Interfaces:**
- Produces:
  ```tsx
  interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;                            // default "Confirmar"
    cancelLabel?: string;                             // default "Cancelar"
    destructive?: boolean;
  }
  export function ConfirmProvider(props: { children: React.ReactNode }): React.ReactElement;
  export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean>;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Confirm.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ConfirmProvider } from './ConfirmProvider';
import { useConfirm } from './hooks/useConfirm';

function Probe({ onResult }: { onResult: (r: boolean) => void }) {
  const confirm = useConfirm();
  return <button onClick={async () => onResult(await confirm({ title: 'Deletar?', destructive: true }))}>ask</button>;
}

describe('useConfirm', () => {
  it('resolve true no confirm', async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <Probe onResult={(r) => results.push(r)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('ask'));
    await waitFor(() => screen.getByText('Deletar?'));
    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() => expect(results).toEqual([true]));
  });
  it('resolve false no cancelar', async () => {
    const results: boolean[] = [];
    render(
      <ConfirmProvider>
        <Probe onResult={(r) => results.push(r)} />
      </ConfirmProvider>
    );
    fireEvent.click(screen.getByText('ask'));
    await waitFor(() => screen.getByText('Deletar?'));
    fireEvent.click(screen.getByText('Cancelar'));
    await waitFor(() => expect(results).toEqual([false]));
  });
});
```

- [ ] **Step 2: Implementar Confirm.tsx**

Create `src/components/ui/Confirm.tsx`:
```tsx
import * as React from 'react';
import { Modal } from '@/src/components/Modal';
import { cn } from '@/src/utils';

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onResolve: (result: boolean) => void;
}

export function Confirm({
  isOpen, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive, onResolve,
}: ConfirmProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={() => onResolve(false)}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            ref={cancelRef}
            onClick={() => onResolve(false)}
            className="px-4 py-2 rounded-control border border-border-default text-text-primary hover:bg-surface-raised"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={cn(
              'px-4 py-2 rounded-control text-white',
              destructive ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent/90'
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p className="text-sm text-text-secondary">{description}</p>}
    </Modal>
  );
}
```

- [ ] **Step 3: Provider + hook**

Create `src/components/ui/ConfirmProvider.tsx`:
```tsx
import * as React from 'react';
import { Confirm } from './Confirm';

interface State {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve?: (r: boolean) => void;
}

interface Ctx { ask: (opts: Omit<State, 'isOpen' | 'resolve'>) => Promise<boolean> }
export const ConfirmCtx = React.createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({ isOpen: false, title: '' });

  const ask = React.useCallback((opts: Omit<State, 'isOpen' | 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, isOpen: true, resolve });
    });
  }, []);

  const onResolve = (r: boolean) => {
    state.resolve?.(r);
    setState((s) => ({ ...s, isOpen: false }));
  };

  return (
    <ConfirmCtx.Provider value={{ ask }}>
      {children}
      <Confirm
        isOpen={state.isOpen}
        title={state.title}
        description={state.description}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        destructive={state.destructive}
        onResolve={onResolve}
      />
    </ConfirmCtx.Provider>
  );
}
```

Create `src/components/ui/hooks/useConfirm.ts`:
```ts
import { useContext } from 'react';
import { ConfirmCtx } from '../ConfirmProvider';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm requer <ConfirmProvider> na árvore');
  return (opts: ConfirmOptions) => ctx.ask(opts);
}
```

- [ ] **Step 4: Envolver App**

Localizar em `src/App.tsx` o ponto onde providers globais são montados. Adicionar `<ConfirmProvider>` no nível mais externo:
```tsx
import { ConfirmProvider } from '@/src/components/ui/ConfirmProvider';
// ...
<ConfirmProvider>
  {/* resto do app */}
</ConfirmProvider>
```

- [ ] **Step 5: Rodar suite**

Run: `npx vitest run src/components/ui/Confirm.test.tsx` → PASS
Run: `npm run typecheck` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Confirm.tsx src/components/ui/ConfirmProvider.tsx src/components/ui/hooks/useConfirm.ts src/components/ui/Confirm.test.tsx src/App.tsx
git commit -m "feat(ui): Confirm + useConfirm hook global (substituto do window.confirm)

Migração dos usos de window.confirm no app fica pras Fatias 1-6."
```

---

## Task 22: `<Toast>` refactor (sparkles opt-in em success)

**Files:**
- Modify: `src/components/ui/toast.tsx`
- Test: `src/components/ui/toast.test.tsx`

**Interfaces:**
- Consumes: primitivo `sparkles` do animate-ui.
- Produces: mesma API pública já existente (não quebrar callers). Ler o arquivo antes de reescrever pra confirmar o que consumidores esperam.

- [ ] **Step 1: Ler `src/components/ui/toast.tsx` atual e listar exports usados**

Run: abrir o arquivo e listar `export`s. Não descrever aqui — o executor tem que ler porque a API concreta define o refactor. Se houver `useToast()`, `toast.success()`, etc., preservar assinaturas.

- [ ] **Step 2: Escrever teste que fixa API atual (regressão)**

Create `src/components/ui/toast.test.tsx` com casos que exercitam os exports encontrados no step 1. Exemplo mínimo (adaptar):
```tsx
import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { /* importar exports atuais */ } from './toast';

describe('toast API', () => {
  it('mantém API pública', () => {
    // asserts baseados nos exports listados no step 1
  });
});
```

- [ ] **Step 3: Rodar teste — deve passar (fixa baseline)**

Run: `npx vitest run src/components/ui/toast.test.tsx` → PASS

- [ ] **Step 4: Modificar toast.tsx pra aceitar prop `withSparkles?: boolean` em success**

Editar `src/components/ui/toast.tsx`. Localizar a variante `success`. Envolver o ícone com o primitivo Sparkles do animate-ui quando `withSparkles === true`. Se a implementação atual usar Sonner ou outra lib, adaptar via `render` prop / `icon` prop.

Exemplo do padrão (adaptar ao que existe):
```tsx
import { Sparkles } from '@/components/animate-ui/primitives/effects/sparkles';
// ...
icon: withSparkles ? <Sparkles><CheckCircle size={16} /></Sparkles> : <CheckCircle size={16} />
```

- [ ] **Step 5: Rodar suite completa de toast**

Run: `npx vitest run src/components/ui/toast.test.tsx` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/toast.test.tsx
git commit -m "feat(toast): withSparkles opt-in em variante success (mantém API)"
```

---

## Task 23: `<Skeleton>` shimmer variant

**Files:**
- Create: `src/components/ui/Skeleton.tsx` (se não existir; verificar antes)
- Test: `src/components/ui/Skeleton.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface SkeletonProps { className?: string; shimmer?: boolean }
  export function Skeleton(props: SkeletonProps): React.ReactElement;
  ```

- [ ] **Step 1: Verificar se já existe**

Run: `ls src/components/ui/Skeleton* 2>/dev/null; ls src/components/SkeletonRow.tsx 2>/dev/null`

Se `SkeletonRow.tsx` existir mas não `Skeleton.tsx`, criar `Skeleton.tsx` como átomo genérico (não renomear `SkeletonRow` — outras telas dependem).

- [ ] **Step 2: Teste**

Create `src/components/ui/Skeleton.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from './Skeleton';

describe('<Skeleton>', () => {
  it('renderiza com className passada', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveProperty('className');
    expect((container.firstChild as HTMLElement).className).toContain('h-4');
  });
  it('aplica classe shimmer quando shimmer=true', () => {
    const { container } = render(<Skeleton shimmer />);
    expect((container.firstChild as HTMLElement).className).toContain('animate-shimmer');
  });
});
```

- [ ] **Step 3: Adicionar keyframes shimmer em `src/index.css` (ou onde as animations custom vivem)**

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.animate-shimmer {
  background: linear-gradient(90deg, var(--surface-raised) 0%, var(--surface-overlay) 50%, var(--surface-raised) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s var(--ease-in-out-quart) infinite;
}
```

- [ ] **Step 4: Implementar Skeleton.tsx**

Create `src/components/ui/Skeleton.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/src/utils';

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-badge bg-surface-raised',
        shimmer && 'animate-shimmer',
        className
      )}
    />
  );
}
```

Run: `npx vitest run src/components/ui/Skeleton.test.tsx` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/components/ui/Skeleton.test.tsx src/index.css
git commit -m "feat(ui): Skeleton átomo com variante shimmer"
```

---

## Task 24: `<EmptyState>` typing-text opt-in

**Files:**
- Modify: `src/components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: primitivo `typing-text` do animate-ui.
- Produces: mesma API pública + prop nova `typing?: boolean`.

- [ ] **Step 1: Ler EmptyState atual**

Run: abrir `src/components/ui/EmptyState.tsx`. Confirmar props.

- [ ] **Step 2: Adicionar prop opt-in**

Editar o componente pra aceitar `typing?: boolean`. Quando `true`, renderizar a mensagem (title/description) dentro do primitivo `TypingText` do animate-ui.

Exemplo (adaptar aos props reais):
```tsx
import { TypingText } from '@/components/animate-ui/components/animate/typing-text';
// ...
{typing ? <TypingText text={title} /> : <>{title}</>}
```

- [ ] **Step 3: Rodar suite existente do EmptyState (se houver) e typecheck**

Run: `npx vitest run src/components/ui/EmptyState 2>/dev/null; npm run typecheck` → PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/EmptyState.tsx
git commit -m "feat(EmptyState): prop typing opt-in usando animate-ui"
```

---

## Task 25: `<StatusBadge>` rolling-text nas transições

**Files:**
- Modify: `src/components/ui/StatusBadge.tsx`

**Interfaces:**
- Consumes: primitivo `rolling-text` do animate-ui.
- Produces: mesma API + comportamento novo (rolling na transição de label).

- [ ] **Step 1: Ler StatusBadge atual + envolver label num RollingText**

Editar `src/components/ui/StatusBadge.tsx`. Substituir o `<span>{label}</span>` por `<RollingText text={label} />`. Quando `label` mudar (props), o primitivo anima a transição.

- [ ] **Step 2: Rodar typecheck + smoke visual**

Run: `npm run typecheck` → PASS. Smoke: qualquer tela que muda status (Estoque de "criado" → "publicado") — abrir e mudar.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/StatusBadge.tsx
git commit -m "feat(StatusBadge): rolling-text na transição de label"
```

---

## Task 26: `<Reveal>` wrapper (blur-in + stagger)

**Files:**
- Create: `src/components/ui/Reveal.tsx`
- Test: `src/components/ui/Reveal.test.tsx`

**Interfaces:**
- Consumes: `motion/react`, `useMotionTier`.
- Produces:
  ```tsx
  interface RevealProps {
    children: React.ReactNode;
    delay?: number;
    stagger?: number;                                  // se children é array
    className?: string;
  }
  export function Reveal(props: RevealProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Reveal.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Reveal } from './Reveal';

describe('<Reveal>', () => {
  it('renderiza children normalmente', () => {
    render(<Reveal>hello</Reveal>);
    expect(screen.getByText('hello')).toBeDefined();
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Reveal.tsx`:
```tsx
import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/src/utils';
import { useMotionTier } from './hooks/useMotionTier';
import { EASE_STANDARD } from './motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
  className?: string;
}

export function Reveal({ children, delay = 0, stagger, className }: RevealProps) {
  const tier = useMotionTier();
  if (tier === 'reduced') return <div className={className}>{children}</div>;

  if (stagger && Array.isArray(children)) {
    return (
      <motion.div
        className={cn(className)}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {React.Children.map(children, (child, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE_STANDARD as unknown as number[] } },
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay, ease: EASE_STANDARD as unknown as number[] }}
    >
      {children}
    </motion.div>
  );
}
```

Run: `npx vitest run src/components/ui/Reveal.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Reveal.tsx src/components/ui/Reveal.test.tsx
git commit -m "feat(ui): Reveal wrapper — blur-in + stagger, respeita useMotionTier"
```

---

## Task 27: `<Tabs>` wrap do animate-ui/tabs

**Files:**
- Create: `src/components/ui/Tabs.tsx`
- Test: `src/components/ui/Tabs.test.tsx`

**Interfaces:**
- Consumes: `src/components/animate-ui/primitives/animate/tabs.tsx` (já instalado).
- Produces: wrap simples que fixa estilos default + expõe API do consumidor.
  ```tsx
  interface TabsProps<K extends string> {
    value: K; onChange: (v: K) => void;
    items: Array<{ key: K; label: string; content: React.ReactNode }>;
  }
  export function Tabs<K extends string>(props: TabsProps<K>): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Tabs.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from './Tabs';

describe('<Tabs>', () => {
  it('renderiza labels e o content ativo', () => {
    render(
      <Tabs
        value="a"
        onChange={() => {}}
        items={[
          { key: 'a', label: 'A', content: <div>Conteudo A</div> },
          { key: 'b', label: 'B', content: <div>Conteudo B</div> },
        ]}
      />
    );
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('Conteudo A')).toBeDefined();
  });
  it('dispara onChange ao clicar em outra tab', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="a"
        onChange={onChange}
        items={[
          { key: 'a', label: 'A', content: <div>A</div> },
          { key: 'b', label: 'B', content: <div>B</div> },
        ]}
      />
    );
    fireEvent.click(screen.getByText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Tabs.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/src/utils';
import { motion } from 'motion/react';
import { SPRING_MICRO } from './motion';

interface TabsProps<K extends string> {
  value: K;
  onChange: (v: K) => void;
  items: Array<{ key: K; label: string; content: React.ReactNode }>;
}

export function Tabs<K extends string>({ value, onChange, items }: TabsProps<K>) {
  const layoutId = React.useRef(`tabs-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div>
      <div role="tablist" className="flex gap-1 p-1 rounded-control bg-surface-inset border border-border-subtle w-max">
        {items.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cn(
                'relative px-4 py-1.5 text-sm font-medium transition-colors',
                active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={SPRING_MICRO}
                  className="absolute inset-0 rounded-control bg-surface-raised shadow-elevation-1 -z-0"
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        {items.find((t) => t.key === value)?.content}
      </div>
    </div>
  );
}
```

Run: `npx vitest run src/components/ui/Tabs.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Tabs.tsx src/components/ui/Tabs.test.tsx
git commit -m "feat(ui): Tabs com indicator elástico (layoutId)"
```

---

## Task 28: `<Accordion>` (Radix + motion)

**Files:**
- Create: `src/components/ui/Accordion.tsx`
- Test: `src/components/ui/Accordion.test.tsx`

**Interfaces:**
- Consumes: `radix-ui` Accordion primitive.
- Produces:
  ```tsx
  interface AccordionProps {
    items: Array<{ key: string; title: string; content: React.ReactNode }>;
    type?: 'single' | 'multiple';
    defaultValue?: string | string[];
  }
  export function Accordion(props: AccordionProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/Accordion.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Accordion } from './Accordion';

describe('<Accordion>', () => {
  it('expande item ao clicar', () => {
    render(
      <Accordion
        type="single"
        items={[
          { key: 'a', title: 'Cabeça A', content: <div>Corpo A</div> },
          { key: 'b', title: 'Cabeça B', content: <div>Corpo B</div> },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Cabeça A'));
    expect(screen.getByText('Corpo A')).toBeDefined();
  });
});
```

- [ ] **Step 2: Implementar**

Create `src/components/ui/Accordion.tsx`:
```tsx
import * as React from 'react';
import { Accordion as A } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/utils';

interface AccordionProps {
  items: Array<{ key: string; title: string; content: React.ReactNode }>;
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
}

export function Accordion({ items, type = 'single', defaultValue }: AccordionProps) {
  const Root = A.Root as React.ComponentType<Record<string, unknown>>;
  return (
    <Root type={type} collapsible={type === 'single' ? true : undefined} defaultValue={defaultValue} className="divide-y divide-border-subtle rounded-card border border-border-default overflow-hidden">
      {items.map((it) => (
        <A.Item key={it.key} value={it.key}>
          <A.Header>
            <A.Trigger className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-surface-raised data-[state=open]:bg-surface-raised group">
              {it.title}
              <ChevronDown size={16} className="text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </A.Trigger>
          </A.Header>
          <A.Content className={cn('overflow-hidden text-sm text-text-secondary', 'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out')}>
            <div className="px-4 py-3 bg-surface-inset">{it.content}</div>
          </A.Content>
        </A.Item>
      ))}
    </Root>
  );
}
```

Run: `npx vitest run src/components/ui/Accordion.test.tsx` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Accordion.tsx src/components/ui/Accordion.test.tsx
git commit -m "feat(ui): Accordion (Radix)"
```

---

## Task 29: `<Card>` variante `highlight` com border-trail

**Files:**
- Create: `src/components/ui/Card.tsx` (se não existir; verificar)

**Interfaces:**
- Consumes: primitivo `border-trail` do animate-ui.
- Produces:
  ```tsx
  interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'highlight';
  }
  export function Card(props: CardProps): React.ReactElement;
  ```

- [ ] **Step 1: Ver se `Card.tsx` já existe**

Run: `ls src/components/ui/Card* 2>/dev/null`
Se sim, ler antes de modificar.

- [ ] **Step 2: Criar/editar `Card.tsx`**

Create `src/components/ui/Card.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/src/utils';
import { BorderTrail } from '@/components/animate-ui/primitives/effects/border-trail';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlight';
}

export function Card({ variant = 'default', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-card border border-border-default bg-surface-card p-4 shadow-elevation-1',
        variant === 'highlight' && 'shadow-glow-accent',
        className
      )}
      {...rest}
    >
      {variant === 'highlight' && <BorderTrail />}
      {children}
    </div>
  );
}
```

Ajustar o `import` do BorderTrail conforme o path real gerado pela CLI do animate-ui (verificar em `src/components/animate-ui/`).

- [ ] **Step 3: Commit (sem teste — átomo puramente visual; smoke em Fatia 6 PatchNotes)**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat(ui): Card com variante highlight (border-trail)"
```

---

## Task 30: `<MetricCard>` counting-number

**Files:**
- Modify: `src/components/ui/MetricCard.tsx`

**Interfaces:**
- Consumes: primitivo `counting-number` do animate-ui.
- Produces: mesma API existente + comportamento animado no número.

- [ ] **Step 1: Ler o MetricCard atual**

Run: abrir `src/components/ui/MetricCard.tsx`. Localizar onde o valor numérico é renderizado.

- [ ] **Step 2: Envolver o número com `CountingNumber`**

Editar substituindo `{value}` por `<CountingNumber value={value} />` (adaptar o import ao path da CLI).

- [ ] **Step 3: Rodar typecheck + smoke visual no Dashboard**

Run: `npm run typecheck` → PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/MetricCard.tsx
git commit -m "feat(MetricCard): counting-number no valor principal"
```

---

## Task 31: `<DataTable>` — hover row + sticky header + column resize opt-in

**Files:**
- Modify: `src/components/ui/DataTable.tsx`

**Interfaces:**
- Produces: mesma API existente + props novas `stickyHeader?: boolean`, `resizableColumns?: boolean`.

- [ ] **Step 1: Ler DataTable atual**

Run: abrir `src/components/ui/DataTable.tsx`. Mapear estrutura da tabela e onde row/header vivem.

- [ ] **Step 2: Adicionar hover row animado (transição de background)**

Em cada `<tr>` do body, adicionar `hover:bg-surface-raised transition-colors duration-150`.

- [ ] **Step 3: Adicionar sticky header opt-in**

Se `stickyHeader`, aplicar `sticky top-0 bg-surface-card z-10` no `<thead>` / `<tr>` do header.

- [ ] **Step 4: Column resize (implementação simples via `onMouseDown` no separador de cada `<th>`)**

Adicionar dentro de cada `<th>` (quando `resizableColumns`), um `<span>` posicionado à direita com `onMouseDown` que ajusta `style.width` do `<th>` no `mousemove`. Cleanup no `mouseup`.

Exemplo:
```tsx
{resizableColumns && (
  <span
    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40"
    onMouseDown={(e) => startResize(e, headerRef)}
  />
)}
```
Onde `startResize` guarda `pageX` inicial e ajusta `header.style.width` no `mousemove` global.

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/DataTable.tsx
git commit -m "feat(DataTable): hover row + stickyHeader + resizableColumns opt-in"
```

---

## Task 32: `<Kbd>`

**Files:**
- Create: `src/components/ui/Kbd.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function Kbd({ children, className }: { children: React.ReactNode; className?: string }): React.ReactElement;
  ```

- [ ] **Step 1: Implementar direto (átomo visual trivial)**

Create `src/components/ui/Kbd.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/src/utils';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-badge border border-border-default bg-surface-inset text-2xs font-mono text-text-secondary',
        className
      )}
    >
      {children}
    </kbd>
  );
}
```

- [ ] **Step 2: Commit (átomo puro CSS; sem teste)**

```bash
git add src/components/ui/Kbd.tsx
git commit -m "feat(ui): Kbd atom"
```

---

## Task 33: `<CommandPalette>` — refactor de GlobalSearch

**Files:**
- Create: `src/components/ui/CommandPalette.tsx`
- Modify: `src/components/GlobalSearch.tsx` (passa a usar CommandPalette internamente)
- Test: `src/components/ui/CommandPalette.test.tsx`

**Interfaces:**
- Consumes: primitivo `highlighter` do animate-ui, `<Kbd>`, `motion/react`, Radix Dialog.
- Produces:
  ```tsx
  interface CommandItem { key: string; label: string; hint?: string; shortcut?: string; onSelect: () => void; }
  interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    items: CommandItem[];
    placeholder?: string;
  }
  export function CommandPalette(props: CommandPaletteProps): React.ReactElement;
  ```

- [ ] **Step 1: Teste**

Create `src/components/ui/CommandPalette.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

describe('<CommandPalette>', () => {
  const items = [
    { key: 'a', label: 'Ir pra Estoque', shortcut: 'g e', onSelect: vi.fn() },
    { key: 'b', label: 'Novo Cliente', shortcut: 'n c', onSelect: vi.fn() },
  ];
  it('filtra por query', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={items} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cliente' } });
    expect(screen.getByText(/Novo Cliente/)).toBeDefined();
    expect(screen.queryByText(/Ir pra Estoque/)).toBeNull();
  });
  it('Enter executa onSelect do primeiro resultado', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={items} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cliente' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(items[1].onSelect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implementar CommandPalette**

Create `src/components/ui/CommandPalette.tsx`:
```tsx
import * as React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { cn } from '@/src/utils';
import { SPRING_SHEET } from './motion';
import { Kbd } from './Kbd';

interface CommandItem {
  key: string;
  label: string;
  hint?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

function highlightMatch(label: string, q: string) {
  if (!q) return label;
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <span className="bg-accent-soft-bg text-accent-soft-fg">{label.slice(i, i + q.length)}</span>
      {label.slice(i + q.length)}
    </>
  );
}

export function CommandPalette({ open, onOpenChange, items, placeholder = 'Digite pra buscar…' }: CommandPaletteProps) {
  const [q, setQ] = React.useState('');
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => it.label.toLowerCase().includes(s));
  }, [items, q]);

  React.useEffect(() => { if (!open) setQ(''); }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-overlay-scrim backdrop-blur-sm" style={{ zIndex: 'var(--z-modal)' as unknown as number }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -10 }}
                transition={SPRING_SHEET}
                className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl rounded-modal border border-border-default bg-surface-raised shadow-elevation-4 overflow-hidden outline-none"
                style={{ zIndex: 'var(--z-modal)' as unknown as number }}
              >
                <VisuallyHidden.Root asChild><DialogPrimitive.Title>Command Palette</DialogPrimitive.Title></VisuallyHidden.Root>
                <VisuallyHidden.Root asChild><DialogPrimitive.Description>Busca global</DialogPrimitive.Description></VisuallyHidden.Root>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
                  <Search size={16} className="text-text-muted" />
                  <input
                    autoFocus
                    role="textbox"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filtered[0]) {
                        filtered[0].onSelect();
                        onOpenChange(false);
                      }
                    }}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
                  />
                </div>
                <ul className="max-h-80 overflow-y-auto py-2">
                  {filtered.length === 0 && <li className="px-4 py-6 text-sm text-text-faint text-center">Sem resultados</li>}
                  {filtered.map((it) => (
                    <li key={it.key}>
                      <button
                        className={cn('w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-surface-inset text-text-primary')}
                        onClick={() => { it.onSelect(); onOpenChange(false); }}
                      >
                        <span>{highlightMatch(it.label, q)}</span>
                        {it.shortcut && <span className="flex gap-1">{it.shortcut.split(' ').map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 3: Refactor GlobalSearch**

Ler `src/components/GlobalSearch.tsx`. Substituir sua implementação por um wrap fino que:
- controla `open` via `Ctrl+K` (registro que já existe hoje);
- monta a lista de comandos (rotas do app);
- renderiza `<CommandPalette open={open} onOpenChange={setOpen} items={commands} />`.

Preservar API pública se o componente for exportado com props (default export `<GlobalSearch />`).

- [ ] **Step 4: Suite**

Run: `npx vitest run src/components/ui/CommandPalette.test.tsx` → PASS
Run: `npm run typecheck` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CommandPalette.tsx src/components/GlobalSearch.tsx src/components/ui/CommandPalette.test.tsx
git commit -m "feat(ui): CommandPalette + refactor GlobalSearch (highlighter + Kbd + spring)"
```

---

## Task 34: `<Button>` extensão (accent-cta, positive, soft, mobile size)

**Files:**
- Modify: `src/components/ui/button.tsx`
- Test: `src/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: primitivos `ripple` e `magnetic` do animate-ui.
- Produces: extensão do `buttonVariants` cva + wrapper interno que aplica ripple/magnetic quando `variant="accent-cta"`.

- [ ] **Step 1: Teste**

Create `src/components/ui/button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('<Button>', () => {
  it('renderiza label', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeDefined();
  });
  it('aceita variant accent-cta sem quebrar', () => {
    render(<Button variant="accent-cta">Confirmar</Button>);
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDefined();
  });
  it('aceita variant positive', () => {
    render(<Button variant="positive">Ok</Button>);
    expect(screen.getByRole('button', { name: 'Ok' })).toBeDefined();
  });
  it('aceita size mobile', () => {
    render(<Button size="mobile">Tap</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-11');
  });
});
```

- [ ] **Step 2: Modificar button.tsx**

Editar `src/components/ui/button.tsx`. Adicionar variantes e size novos ao `cva`:
```ts
// dentro de variants.variant:
"accent-cta": "text-white bg-[image:var(--gradient-accent-cta)] hover:brightness-110 shadow-elevation-2 hover:shadow-glow-accent transition-all",
"positive": "bg-positive text-surface-page hover:bg-positive/90",
"soft": "bg-accent-soft-bg text-accent-soft-fg hover:bg-accent-soft-bg/80",

// dentro de variants.size:
mobile: "h-11 px-4 text-base has-[>svg]:px-3",
```

Wrap opcional pra ripple/magnetic (só quando `variant === 'accent-cta'`):
```tsx
import { Ripple } from '@/components/animate-ui/primitives/effects/ripple';
import { Magnetic } from '@/components/animate-ui/components/animate/magnetic';

function Button({ className, variant = 'default', size = 'default', asChild = false, children, ...props }) {
  const Comp = asChild ? Slot.Root : 'button';
  const isCta = variant === 'accent-cta';
  const inner = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {isCta ? <Ripple>{children}</Ripple> : children}
    </Comp>
  );
  return isCta ? <Magnetic strength={0.15}>{inner}</Magnetic> : inner;
}
```

Ajustar imports conforme paths reais gerados pela CLI do animate-ui (Step 2 da Task 3 já criou os arquivos).

- [ ] **Step 3: Rodar teste**

Run: `npx vitest run src/components/ui/button.test.tsx` → PASS

- [ ] **Step 4: Smoke — abrir uma tela com botão accent (ex: qualquer modal com salvar)**

Run: `npm run dev` — clicar no botão principal; ver ripple + magnetic (só desktop). Reduced-motion desliga tudo.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.tsx
git commit -m "feat(Button): variants accent-cta/positive/soft + size mobile

accent-cta ganha ripple (touch) e magnetic (desktop hover). Regra do
app: no máximo 1 accent-cta por tela."
```

---

## Task 35: Item novo em Patch Notes

**Files:**
- Modify: `src/features/patchnotes/data.ts`

- [ ] **Step 1: Ler `src/features/patchnotes/data.ts` e adicionar novo item no topo**

Adicionar (adaptar formato ao array existente):
```ts
{
  version: '<próxima versão>',
  date: '2026-08-28',
  title: 'Fundação de UI expandida',
  changes: [
    'Novo kit de átomos: Input, Select, Combobox, MultiSelect, StateCitySelect, PhoneInput, DocInput, CurrencyInput, CepInput, DatePicker, TimePicker, Sheet, Drawer, Confirm, Accordion, Reveal, Kbd, CommandPalette.',
    'Modal agora anima com spring, respeita a nova escala de z-index e usa rounded-modal.',
    'Botão ganha variante "accent-cta" com ripple e magnetic (desktop).',
    'CommandPalette com highlighter e atalhos de teclado no lugar do GlobalSearch legado.',
    'Base pra Estado + Cidade separados (fim do "Juazeirinho-PB" digitado à mão) — chega nas próximas fatias.',
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add src/features/patchnotes/data.ts
git commit -m "docs(patchnotes): registra fundação de UI da Fatia 0"
```

---

## Task 36: Verificação final — typecheck, tests, build, smoke preview

- [ ] **Step 1: Suite inteira**

Run: `npm run typecheck`
Expected: 0 erro.

Run: `npm test`
Expected: todos os arquivos `*.test.ts(x)` passam.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build passa; nada de bundle warning novo relevante (IBGE JSON aparece como chunk lazy — esperado).

- [ ] **Step 3: Smoke preview**

Run: `npm run dev`
- Login: verificar que a tela abre normal (não tocada nesta fatia).
- Estoque: abrir um item, ver Modal (deve animar com spring, novo blur).
- Um `window.confirm` conhecido do app (ex: excluir uma peça): não migrar ainda; só confirmar que continua funcionando.
- DevTools > Elements: verificar que o Modal usa `z-index: 60` (`--z-modal`), não `9999`.
- DevTools > Performance ou toggle "Reduce motion" no OS: recarregar; verificar que motion pesado desliga (`<Reveal>` não anima, sparkles não aparecem).

- [ ] **Step 4: Commit se algo precisou de ajuste (senão pular)**

Se o smoke revelou bug, corrigir no arquivo apropriado e commitar com mensagem `fix(ui/...): ...`.

- [ ] **Step 5: Nota final ao usuário**

Reportar:
- Total de commits da Fatia 0.
- Novos átomos disponíveis (link pra pasta).
- Deferido pras próximas fatias: migração de `window.confirm` (task da Fatia 1), migração de screens pros novos átomos, migração de `cliente.cidade` no banco pra colunas separadas (migration junto com Fatia 1).

---

## Notas finais pro executor

- Se algum primitivo do Animate UI não estiver disponível na CLI oficial no momento (nomes podem variar), inspecione `src/components/animate-ui/` para ver o que a CLI criou e ajuste o import no átomo consumidor. Nunca invente um path — leia o que existe.
- **Não migrar** `window.confirm` pras chamadas de `useConfirm` nesta fatia. Isso é Fatia 1+.
- **Não migrar** imports de tela pros átomos novos nesta fatia. Isso é Fatia 1+.
- **Não trocar fonte** (Inter permanece).
- Testes de máscara usam vetores públicos conhecidos. Se algum vector falhar, checar a implementação — não trocar o vector.
- Suite `motion/react` funciona em jsdom com `useReducedMotion` mockado; se algum teste flakear por causa de `AnimatePresence`, envolver em `act()` ou usar `waitFor`.

### Deferido explicitamente pra próxima fatia
- **Padronização de delays em `Popover` / `Tooltip`** (open 200ms, close 100ms) — o spec Seção 3 item 21 pede, mas os componentes existentes já funcionam. A mudança é trivial e será feita na Fatia 1 quando um consumidor real precisar de delay padronizado. Não bloqueia Fatia 0.
- **ESLint rule `no-more-than-one-accent-cta`** — regra manual até que a Fatia 1 forneça um caso real de violação pra calibrar o linter.
- **Visual regression setup** (Chromatic/Playwright) — Fatia 1 ou posterior.
