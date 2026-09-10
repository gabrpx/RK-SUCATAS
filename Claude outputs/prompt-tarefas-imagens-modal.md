# Tarefas: progresso multi-participante, imagens, borda animada, notificações e fix de modal

## Objective
Implementar 6 mudanças na aba Tarefas e no sistema de modais: (1) tarefas gerais com progresso por participante e conclusão em duas etapas, (2) borda animada persistente em tarefas novas não lidas, (3) campo de anexar imagens ilimitadas nas tarefas, (4) auditoria de integridade das notificações push no mobile, (5) corrigir botão fechar dos modais de imagem/peça no mobile, (6) corrigir navegação de retorno nos modais empilhados (fechar imagem deve voltar pros detalhes da peça, não fechar tudo).

## Context

**Stack:** React + TypeScript + Supabase + Radix Dialog + motion/react. Tailwind v4 CSS-first com design tokens em `src/styles/theme.css`. Push notifications via VAPID (web) e FCM (mobile/APK).

**Tarefas — modelo atual:**
- Tipo `Tarefa` em `src/features/tarefas/types.ts`: campo `atribuido_para: string` (um único responsável). Quando `atribuido_para === 'todos'` (sentinel em `tarefas.ts` linha 33), o backend cria N linhas independentes — uma por elegível — cada uma com sua própria cópia do checklist. Não existe conceito de "participantes múltiplos numa mesma tarefa com barra de progresso individual".
- Conclusão atual: se a tarefa tem itens de checklist, `derivarConclusao()` (linha 54-64 de `tarefas.ts`) marca como `concluida` automaticamente quando TODOS os itens estão marcados. Se não tem checklist, `PATCH /:id/concluir` marca direto. Não existe etapa de "aprovação pelo criador".
- Notificação push já existe: `notificarUsuario()` é chamado no `POST /` (linhas 203-207 e 248-253 de `tarefas.ts`) — fire-and-forget. O serviço está em `src/services/pushNotificationService.ts`.
- Frontend: `TarefasView.tsx` — `VisaoCriador` (gerente) e `VisaoResponsavel` (executor). Formulário de criação usa `<select>` com lista de `responsaveis` (linha 581) + opção "Todos" (linha 590).

**Imagens — infra existente:**
- Upload genérico em `src/server/routes/upload.ts`: `POST /api/upload/imagem` aceita JPG/PNG/WEBP/GIF até 5MB, sobe pro Supabase Storage via `uploadImagem()` e retorna URL pública. Não existe tabela nem campo de imagens para tarefas — só para estoque (`estoque.imagens`) e unidades (`estoque_unidades.fotos`).

**Modais/Overlays — componentes existentes:**
- `Modal` (`src/components/ui/Modal.tsx`): Radix Dialog, bottom-sheet no mobile. `onOpenChange` chama `onFechar()`. O `Overlay` tem `onClick={onFechar}` (linha 47) — fecha ao clicar fora.
- `ImageZoom` (`src/components/ui/image-zoom.tsx`): portal em `document.body` com `z-[3000]`. Fecha ao clicar em qualquer lugar do overlay (linha 83-86) ou no botão X (linha 104-112). Usa `e.stopPropagation()` no trigger (linha 58) e no X.
- `VisualizadorFotos` (`src/components/ui/VisualizadorFotos.tsx`): overlay com `z-[4000]`, fecha ao clicar no fundo (`onClick={onFechar}` na div root, linha 28). A imagem tem `e.stopPropagation()` (linha 44).
- **Bug de fechar no mobile:** No mobile (WebView/Capacitor ou PWA), o botão X do `ImageZoom` e do `VisualizadorFotos` não responde ao toque — o usuário só consegue fechar clicando nos espaços em branco ao redor. Causa provável: área de toque (`size-11` = 44px no ImageZoom, `size-10` = 40px no VisualizadorFotos) insuficiente ou conflito de `stopPropagation` com eventos touch.
- **Bug de navegação em pilha de modais:** Quando o usuário abre detalhes de uma peça (ex: expandir item no Estoque → Modal de detalhes) e depois clica numa imagem (abre ImageZoom/VisualizadorFotos por cima), ao fechar a imagem, em vez de voltar pro modal de detalhes da peça, fecha TUDO — o overlay da imagem e o modal pai. Causa provável: o `onClick={onFechar}` do overlay da imagem propaga pra baixo e aciona o `onClick={onFechar}` do overlay do Modal pai, ou o `onOpenChange` do Radix Dialog do modal pai reage ao evento.

## Target State

### Fase 1 — Tarefas multi-participante com progresso
- Na criação de tarefa, substituir o `<select>` de responsável por uma lista de checkboxes com todos os responsáveis elegíveis + checkbox "Selecionar todos".
- Ao criar, o backend cria UMA tarefa com múltiplos participantes (nova tabela `tarefa_participantes` com `tarefa_id`, `usuario_id`, `concluido`, `concluido_em`) em vez de N linhas separadas.
- Cada participante pode marcar seu próprio progresso como "concluído" — o que atualiza `tarefa_participantes.concluido` e alimenta uma barra de progresso visual na lista.
- Quando TODOS os participantes marcarem, a tarefa entra em status `aguardando_aprovacao` (novo status) e o criador recebe notificação push.
- O criador vê um botão "Finalizar tarefa" que marca `status = 'concluida'`. Só ele pode finalizar.
- Manter retrocompatibilidade: tarefas existentes (com `atribuido_para` único e sem participantes) continuam funcionando exatamente como antes.
- Remover o sentinel `TODOS_SENTINEL` e o loop de criação de N linhas (linhas 166-213 de `tarefas.ts`) — substituir pelo novo fluxo.

### Fase 2 — Borda animada em tarefas novas não lidas
- Nova coluna `tarefa_participantes.lida` (boolean, default false) — ou `tarefa_leituras` se a Fase 1 não criar `tarefa_participantes`.
- No card da tarefa (`TarefaCards.tsx`), quando `lida === false` para o usuário logado, aplicar classe CSS com animação de borda pulsante (usar `@keyframes` com `box-shadow` ou `outline` animado — NÃO usar `border` animado nem `filter` que force composição pesada).
- A animação é leve: `will-change: box-shadow`, `animation-duration: 2s`, `animation-iteration-count: infinite`. Sem blur, sem transform 3D.
- Ao clicar nos detalhes (expandir o card), marcar `lida = true` via `PATCH /api/tarefas/:id/marcar-lida`.
- O estado `lida` é persistido no banco (não em localStorage) — se o usuário sair e voltar, a tarefa continua com borda animada até que ele abra.

### Fase 3 — Imagens nas tarefas
- Nova tabela `tarefa_imagens` (`id`, `tarefa_id`, `url`, `ordem`, `criado_em`).
- No formulário de criação/edição da tarefa (`TarefasView.tsx`, dentro do `<Modal>`), adicionar seção de upload de imagens abaixo da descrição.
- Reaproveitar o padrão visual de `EstoqueUploadFotos.tsx` (grade de miniaturas com botão de adicionar) e a rota `POST /api/upload/imagem` existente.
- Sem limite de quantidade por tarefa (a constraint vem só do bucket do Supabase Storage, que não será atingido).
- No card expandido (`TarefaCards.tsx`), exibir as imagens como galeria clicável usando `ImageZoom` ou `VisualizadorFotos`.
- No `SELECT_COM_JOINS` de `tarefas.ts` (linha 16-17), adicionar o join com `tarefa_imagens`.

### Fase 4 — Auditoria de notificações push no mobile
- Verificar que o service worker (`sw.js` ou equivalente) está registrado corretamente tanto na PWA instalada via Chrome quanto no APK (Capacitor).
- Verificar que `notificacoesApi.registrarWeb()` e `registrarFcm()` enviam o token correto e que o backend persiste a subscription ativa.
- Verificar que `notificarUsuario()` em `pushNotificationService.ts` envia pra TODAS as subscriptions ativas do usuário (web + fcm), não só a primeira.
- Testar o fluxo completo: criar tarefa atribuída → push aparece no dispositivo mobile do responsável.
- Se encontrar bugs, corrigir. Se o fluxo estiver íntegro, documentar no checkpoint.

### Fase 5 — Fix: botão fechar não responde no mobile
- Em `ImageZoom` (`src/components/ui/image-zoom.tsx`, botão X nas linhas 104-112): aumentar a área de toque para no mínimo `size-12` (48px) e garantir que não há elemento sobreposto interceptando o toque.
- Em `VisualizadorFotos` (`src/components/ui/VisualizadorFotos.tsx`, botão X na linha 30-36): mesma correção — `size-12` mínimo.
- Testar que o toque no X fecha o overlay sem precisar clicar nos espaços em branco.

### Fase 6 — Fix: fechar imagem fecha tudo (navegação em pilha)
- **Causa raiz:** quando `ImageZoom` ou `VisualizadorFotos` fecha (click no overlay), o evento de click propaga pra camada abaixo — o overlay do `Modal` pai — que também tem `onClick={onFechar}` (Modal.tsx linha 47). No desktop o `e.stopPropagation()` resolve porque é evento de mouse; no mobile com touch events, o evento sintético de click pode vazar.
- **Fix em `ImageZoom`:** o overlay `<motion.div>` (linha 82-86) já tem `e.stopPropagation()`. Adicionar `onTouchEnd={(e) => e.stopPropagation()}` no mesmo elemento pra cobrir eventos touch. Dentro do handler de click, chamar `setAberto(false)` MAS NÃO propagar — já faz isso, mas confirmar que funciona com touch.
- **Fix em `VisualizadorFotos`:** a div root (linha 28) tem `onClick={onFechar}` mas NÃO tem `stopPropagation`. Ao fechar, o click propaga pro overlay do Modal pai. Corrigir: em vez de `onClick={onFechar}`, usar `onClick={(e) => { e.stopPropagation(); onFechar(); }}` e adicionar `onTouchEnd={(e) => e.stopPropagation()}`.
- **Fix no `Modal`:** o `Overlay` (linha 43-47) tem `onClick={onFechar}` — adicionar verificação de que `e.target === e.currentTarget` antes de chamar `onFechar()`, pra que cliques em filhos (como o portal do ImageZoom/VisualizadorFotos que renderiza no body) não acionem o fechamento. Considerar que o portal renderiza fora da árvore DOM do Modal, mas o z-index pode causar interação visual.
- Garantir que fechar a imagem volta pro modal de detalhes da peça visível e funcional.

## Scope
- Trabalhar em: `src/features/tarefas/`, `src/server/routes/tarefas.ts`, `src/components/ui/image-zoom.tsx`, `src/components/ui/VisualizadorFotos.tsx`, `src/components/ui/Modal.tsx`, `src/server/routes/upload.ts` (se precisar), `src/services/pushNotificationService.ts`, migrations (criar novas), `src/styles/theme.css` (se precisar de keyframe).
- NÃO tocar: `.env`, `package-lock.json`, `supabase/config.toml`, rotas de estoque/vendas/orçamentos, `src/features/mercadolivre/`, `src/features/shopee/`.

## Constraints
- Design tokens do `theme.css`: nunca hex direto nos componentes. Usar classes semânticas (`bg-surface-card`, `text-accent-soft-fg`, etc.).
- No máximo UM botão accent preenchido por tela.
- Animação da borda: sem `filter`, sem `backdrop-blur`, sem `transform: translate3d`. Usar `box-shadow` ou `outline` com `@keyframes`. `will-change: box-shadow` pro browser otimizar.
- Migrations Supabase: arquivos SQL em `supabase/migrations/` com timestamp no nome. Cada fase que alterar schema cria sua própria migration.
- Só fazer as mudanças pedidas. Não adicionar features, abstrações ou refatorações extras.

## Acceptance Criteria
- [ ] Criar tarefa com múltiplos participantes via checkboxes funciona; cada um vê a tarefa e pode marcar seu progresso
- [ ] Barra de progresso reflete quantos participantes concluíram (ex: "3/5 concluídos")
- [ ] Quando todos concluem, criador recebe notificação e vê botão "Finalizar"
- [ ] Tarefas antigas (atribuido_para único, sem participantes) continuam funcionando sem mudança
- [ ] Borda animada aparece em tarefas novas não lidas e persiste entre sessões (banco, não localStorage)
- [ ] Borda desaparece ao expandir o card da tarefa
- [ ] Imagens podem ser anexadas na criação/edição e aparecem na visualização do card expandido
- [ ] Upload usa a rota existente `POST /api/upload/imagem`
- [ ] Notificações push chegam no mobile (PWA e APK) ao receber tarefa — ou bugs encontrados são corrigidos
- [ ] Botão X de `ImageZoom` e `VisualizadorFotos` fecha ao toque no mobile
- [ ] Fechar imagem em cima de modal de peça volta pro modal de peça, não fecha tudo
- [ ] Testes existentes (`TarefaCards.test.tsx`, `tarefas.todos.test.ts`, `tarefas.itens.test.ts`) passam ou são atualizados

## Stop Conditions
Parar e perguntar antes de:
- Excluir qualquer arquivo
- Adicionar dependência nova ao `package.json`
- Alterar schema de tabelas existentes (criar novas é permitido)
- Mudar comportamento de rotas fora do escopo (vendas, estoque, orçamentos)
- Se um bug de notificação exigir mudanças no service worker que afetem cache/offline

## Progress
Rodar nesta ordem. Fazer `/compact` entre a Fase 3 e a Fase 4.

- Fase 1: Migration + backend + frontend de tarefas multi-participante
- Fase 2: Borda animada persistente
- Fase 3: Imagens nas tarefas (migration + backend + frontend)
- `/compact` — foco nas Fases 4-6
- Fase 4: Auditoria de notificações push mobile
- Fase 5: Fix botão fechar no mobile
- Fase 6: Fix navegação em pilha de modais

Após cada fase: ✅ [o que foi feito] — [arquivos afetados]

## Session Strategy
Nova sessão — contexto limpo. Rodar as 6 fases com `/compact` no meio (após Fase 3).
