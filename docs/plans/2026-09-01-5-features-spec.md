# RK Sucatas — 5 Features (Badge, Tarefa-para-todos, Nota, Estoque, Truncamento)

Use `/tdd` e `/superpowers`. Pense cuidadosamente antes de iniciar cada fase.

## Objective
Implementar 5 features no sistema RK Sucatas (React + TS + Tailwind + Express + Supabase). Cada fase é independente — commite ao final de cada uma.

## Context
- **Stack**: React 18, TypeScript, Tailwind CSS, motion/react (Framer Motion), @dnd-kit, Express, Supabase/PostgreSQL
- **Permissões**: `usePermissao()` → `{ pode, isAdmin }`. `VisaoCriador` = visão admin, `VisaoResponsavel` = visão usuário comum
- **Tarefas**: `Tarefa` tem `atribuido: UsuarioResumo | null` (com `nome_exibicao`), `itens: TarefaItem[]`. `TarefaItem` já tem `concluido_por` e `concluido_em`
- **Nota/Invoice**: gerada via `createPortal` + `@media print` CSS. URL e paginação no rodapé vêm do header/footer padrão do browser, NÃO do template
- **Estoque**: lógica de cor por quantidade já existe (danger/warning/positive) mas só no número, não no nome

## Scope
Trabalhe apenas nestes arquivos (crie novos somente se necessário para backend):
| Arquivo | Linhas-chave |
|---------|-------------|
| `src/features/tarefas/TarefaCards.tsx` | L449 (título), L462 (descrição), L465-468 (badges), L90-138 (ItemChecklistArrastavel) |
| `src/features/tarefas/TarefasView.tsx` | L28 (usePermissao), L67 (VisaoResponsavel), L146 (VisaoCriador), L182 (podeEditar), L184-236 (form) |
| `src/features/tarefas/types.ts` | TarefaItem (L12-19), Tarefa (L26-44), TarefaInput (L46-55) |
| `src/features/tarefas/api.ts` | tarefasApi (L10-21) |
| `src/server/routes/tarefas.ts` | Backend de tarefas |
| `src/components/DeclaracaoVenda/NotaTemplate.tsx` | L64-80 (watermark), L29-45 (print CSS) |
| `src/features/estoque/EstoqueView.tsx` | L569 (nome com max-w-[240px]), L681-682 (cor quantidade), L826-827 (mesma cor desktop), L839 (nome desktop) |
| `src/features/vendas/VendasView.tsx` | L179 (nome truncado), L452 (nome truncado detalhe) |

**NÃO toque**: `.env`, `package.json`, migrations, schemas do banco, arquivos fora do scope.

## Constraints
- Sem dependências novas
- Sem refactor além do pedido — only make changes directly requested
- Manter padrões existentes: `cn()` para classes condicionais, Tailwind utilities, motion/react para animações
- Componentes novos só se claramente justificável (prefira inline)

---

## Fase 1 — Badge do Responsável na Tarefa

**O quê**: Mostrar o nome do responsável como badge no card colapsado da tarefa, sem precisar abrir os detalhes.

**Onde**: `TarefaCards.tsx`, área de badges do card colapsado (L465-468, após `StatusDaTarefa` e badge de prioridade).

**Como**:
1. Adicionar badge com `tarefa.atribuido?.nome_exibicao` — só renderizar se `atribuido` não for null
2. Estilo: badge pequeno similar ao de prioridade, cor neutra (ex: `bg-surface-secondary text-text-secondary`)
3. **Visibilidade**: este badge só aparece na `VisaoCriador` (admin). Na `VisaoResponsavel` o usuário só vê as próprias tarefas, então o badge é redundante. Passe uma prop `mostrarResponsavel?: boolean` ao componente de card e só a ative na VisaoCriador.

**Acceptance**:
- [ ] Card colapsado mostra badge "João" quando `atribuido.nome_exibicao = "João"`, apenas na visão admin
- [ ] Badge não aparece quando `atribuido` é null
- [ ] Badge não aparece na VisaoResponsavel
- [ ] Layout não quebra com nomes longos (truncar com max-w se necessário)

---

## Fase 2 — Tarefa para Todos

**O quê**: Permitir criar uma tarefa atribuída a "todos" simultaneamente. Cada pessoa tem seu checkbox individual que só ela pode marcar. Após marcar, exibe quem concluiu e quando.

**Backend** (`src/server/routes/tarefas.ts`):
1. Aceitar `atribuido_para: "todos"` (ou valor especial) no POST de criação
2. Quando `atribuido_para = "todos"`, criar uma tarefa por responsável possível (usar mesma lista de `listarResponsaveisPossiveis`) com mesmo título/descrição/itens, OU criar uma tarefa única com flag `para_todos: true` — escolha a abordagem que exija menos mudança no schema (preferir a que não precise de migration).

**Frontend**:
1. No form de criação (`TarefasView.tsx` L184-236): adicionar opção "Todos" no select de responsável
2. Em `ItemChecklistArrastavel` (`TarefaCards.tsx` L90-138): quando `item.concluido === true` e `item.concluido_por` existe, mostrar texto: `"Concluído por {nome} há {tempo}"` abaixo do texto do item. Usar `concluido_em` para calcular o tempo relativo
3. Restrição: checkbox só pode ser marcado pelo responsável da tarefa (`tarefa.atribuido_para === meuId`) ou admin

**Acceptance**:
- [ ] Admin consegue criar tarefa com responsável "Todos"
- [ ] Cada responsável vê a tarefa na sua VisaoResponsavel
- [ ] Item concluído mostra "Concluído por Eduardo há 2 horas" (exemplo)
- [ ] Usuário não-admin não consegue marcar checkbox de tarefa atribuída a outro

---

## Fase 3 — Correções da Nota/Invoice

**O quê**: 3 ajustes na nota de venda impressa.

**Onde**: `NotaTemplate.tsx`

**Ajuste 1 — Watermark 3× maior** (L64-80):
```
// DE:
width: '420px', height: '420px'
// PARA:
width: '1260px', height: '1260px'
```

**Ajuste 2 — Remover URL do rodapé** (L29-45, dentro do `@media print`):

Adicionar dentro do bloco `@page`:
```css
@page {
  size: A4;
  margin: 10mm 14mm;
  @bottom-center { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
  @top-center { content: none; }
  @top-left { content: none; }
  @top-right { content: none; }
}
```

E adicionar fora do `@page`:
```css
@media print {
  /* ... regras existentes ... */
  /* Suprimir header/footer do browser via margin boxes não funciona em todos os browsers.
     Fallback: margin 0 força o browser a não ter espaço para header/footer */
}
```

**Nota**: A URL (`rk-sucatas.onrender.com/estoque`) e o indicador `1/1` são injetados pelo browser como header/footer padrão de impressão. A solução mais confiável cross-browser é: `@page { margin: 0; }` + padding manual via CSS no container. Ajuste a margin de `@page` para `0` e adicione padding equivalente no `#declaracao-venda-print`.

**Ajuste 3 — Remover paginação**: Resolvido junto com o Ajuste 2 (mesma origem: header/footer do browser).

**Acceptance**:
- [ ] Watermark ocupa ~3× mais área na página impressa
- [ ] URL do sistema não aparece no rodapé ao imprimir
- [ ] Indicador "1/1" não aparece ao imprimir
- [ ] Conteúdo da nota não é cortado pelas margens

---

## Fase 4 — Indicador de Fora de Estoque

**O quê**: Quando `quantidade === 0`, o nome da peça deve ficar visualmente diferente (escurecido/opaco) para indicar fora de estoque.

**Onde**: `EstoqueView.tsx`

**Como**:
1. **L569** (card mobile): mudar classe do nome de `text-text-primary` para condicional:
   ```
   className={cn('text-[12.5px] font-medium truncate max-w-[240px]',
     item.quantidade === 0 ? 'text-text-tertiary line-through' : 'text-text-primary'
   )}
   ```
2. **L839** (tabela desktop): aplicar a mesma lógica condicional no `<p>` do nome
3. Opcionalmente adicionar um badge "Sem estoque" pequeno se `quantidade === 0`

**Acceptance**:
- [ ] Nome da peça com quantidade 0 aparece com texto terciário e riscado (ou estilo visual similar indicando indisponibilidade)
- [ ] Peças com quantidade > 0 mantêm estilo normal
- [ ] Funciona na view mobile (card) e desktop (tabela)

---

## Fase 5 — Texto Truncado (PC e Mobile)

**O quê**: Nomes de itens estão cortados e difíceis de ler em várias telas. O `truncate` com largura máxima fixa é a causa raiz.

**Onde e como**:

1. **`EstoqueView.tsx` L569** — causa raiz principal:
   ```
   // DE:
   className="text-[12.5px] font-medium text-text-primary truncate max-w-[240px]"
   // PARA:
   className="text-[12.5px] font-medium text-text-primary break-words line-clamp-2 min-w-0"
   ```
   Remover `truncate max-w-[240px]`. Usar `line-clamp-2` para permitir até 2 linhas, ou `break-words` para wrapping completo. O container pai já deve ter `min-w-0` para flex truncation funcionar.

2. **`EstoqueView.tsx` L839** (tabela desktop):
   ```
   // DE:
   className="text-sm font-medium text-text-primary truncate"
   // PARA:
   className="text-sm font-medium text-text-primary break-words line-clamp-2 min-w-0"
   ```

3. **`VendasView.tsx` L179**:
   ```
   // DE:
   className={cn('font-bold text-sm truncate min-w-0', 'text-text-primary')}
   // PARA:
   className={cn('font-bold text-sm break-words line-clamp-2 min-w-0', 'text-text-primary')}
   ```

4. **`VendasView.tsx` L452**:
   ```
   // DE:
   className="font-bold truncate"
   // PARA:
   className="font-bold break-words line-clamp-2"
   ```

5. **`TarefaCards.tsx` L449** (título da tarefa):
   ```
   // DE:
   className="text-sm font-medium text-text-primary truncate"
   // PARA:
   className="text-sm font-medium text-text-primary break-words line-clamp-2 min-w-0"
   ```

**Acceptance**:
- [ ] "TANQUE DE COMBUSTÍVEL..." mostra nome completo (ou até 2 linhas) no estoque mobile
- [ ] "SISTEMA DE FREIO TRASEIRO FAL..." mostra nome legível no estoque mobile
- [ ] Nomes de itens em VendasView não cortam no meio da palavra
- [ ] Nomes de tarefas não cortam no card colapsado
- [ ] Layout não quebra em tela estreita (320px) — verificar com DevTools responsive

---

## Stop Conditions
Pare e pergunte antes de:
- Deletar qualquer arquivo
- Adicionar dependência ao package.json
- Criar ou modificar migrations/schema do banco
- Alterar arquivos fora do Scope
- Se um erro não resolver em 2 tentativas

## Progress
Após cada fase concluída: ✅ Fase N — [resumo] — [arquivos afetados]

## Session Strategy
Nova sessão. Execute as 5 fases em sequência (1→2→3→4→5). Commite cada fase separadamente.
