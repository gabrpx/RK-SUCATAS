# Handoff para o Codex — correções da auditoria do `/estoque-preview` (23/09/2026)

> Escrito pelo Claude ao fim da sessão de 23/09/2026. Leia este arquivo
> primeiro. Ele substitui a seção "Próximos passos" de
> `docs/HANDOFF_CODEX_2026-09-23.md` (o histórico daquele arquivo continua
> válido). As regras de `AGENTS.md` continuam valendo.

## Handoff

### Tarefa
Resolver os 12 achados P1/P2 e os 5 secundários da auditoria Codex do módulo
`/estoque-preview`, rodar uma auditoria complementar própria (componentes,
microinterações, animações, design) e entregar para revisão do Codex.

### Objetivo
Deixar o novo estoque coerente entre UI, API e banco — reserva só com sinal de
20%, prazo idêntico nas três camadas, histórico real, permissões respeitadas,
arquivar/restaurar reais — sem aplicar migration nem trocar a rota `/estoque`.

### Status
**Código concluído e validado localmente na cópia da nuvem.** Em 24/09/2026 o
usuário informou que **aplicou a 067 e a 068** no Supabase (confirme com a
consulta da seção "Conferir o banco" abaixo antes de testar). Revisão do Codex
obrigatória (estoque/vendas/SQL, ver AGENTS.md).

**Atenção — nada foi commitado.** Em 24/09 a branch
`wip/estoque-reservas-cliente` ainda apontava para `6479f1e`; todas as
mudanças desta sessão estão só na árvore de trabalho de `D:\SISTEMA CLAUDE`.
Audite nesse checkout (`git status` / `git diff`) — um worktree novo do Codex
criado a partir da branch **não** terá essas alterações.

### Conferir o banco (somente leitura)
```sql
select
  exists (select 1 from information_schema.columns where table_name = 'estoque_reservas' and column_name = 'cliente_id')  as migration_067,
  exists (select 1 from information_schema.columns where table_name = 'estoque_reservas' and column_name = 'valor_sinal') as migration_068,
  exists (select 1 from information_schema.tables  where table_name = 'estoque_unidade_eventos')                          as tabela_eventos,
  (select count(*) from pg_proc where proname = 'reservar_unidade_estoque') as versoes_reservar,  -- esperado: 1
  (select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'reservar_unidade_estoque' limit 1) as assinatura_reservar;
```
Esperado: `true, true, true, 1` e assinatura com 8 argumentos. Como as duas
migrations agora estão no banco, **o backend publicado precisa ser o desta
branch** para reservar (a RPC exige sinal); liberar/arquivar/restaurar
funcionam com o backend antigo, sem autoria.

### Onde está o trabalho
- Repositório: `D:\SISTEMA CLAUDE`, branch `wip/estoque-reservas-cliente`,
  base `6479f1eb77b3f2d84b0f25559cf08d86517223c4`.
- O shell local (Cowork) **não iniciou nesta sessão**. Todo o trabalho foi
  feito numa cópia do repositório na nuvem (sem `.env`; testes de rota com
  variáveis falsas) e os arquivos foram gravados de volta na pasta.
  `git status` não pôde ser rodado localmente — **rode antes de tudo**.
- Commit: o usuário pediu commit ao final. Se o commit não constar no
  `git log`, os arquivos estão apenas modificados na árvore (veja a lista
  abaixo) — faça o commit/confira antes de seguir.

## Decisões do usuário (levantadas com `/grill-me`)

| Pergunta | Resposta do usuário |
| --- | --- |
| Como registrar o sinal de 20%? | **Gravar na reserva** via migration nova (068), criada mas **não aplicada**. Até aplicar, a reserva real fica bloqueada com aviso. **Não lançar no Caixa.** |
| Unidade sem preço | **Bloquear a reserva** e levar para "Definir preço". |
| Rota `/estoque-preview` | Manter a URL. "A rota será alterada quando, após uma auditoria completa, a nota para o novo módulo de estoque for 10/10 pelos agentes Codex e Claude." Só corrigir textos/guia agora. |
| Desativar local com peças | **Bloquear** enquanto houver unidades ativas no local. |
| Autoria no histórico | **Incluir na 068** (quem reservou/liberou/arquivou/restaurou). |
| Forma de pagamento do sinal | **Formas cadastradas** (`formas_pagamento`, natureza à vista; fiado recusado). |
| Regra do valor | **Mínimo 20%, pode mais**, nunca acima do preço. |

## Achados da auditoria Codex — status

### P1
| # | Achado | Status | Como |
| --- | --- | --- | --- |
| 1 | Reserva sem sinal de 20% | **Resolvido no código; bloqueado no banco até aplicar 067+068** | Formulário exige sinal (pré-preenchido com 20%, validação mín./máx.) + forma de pagamento; API exige `valor_sinal`/`forma_pagamento_id` e **recusa (409) se a 068 não estiver aplicada** (detecção por `select valor_sinal limit 0`); RPC da 068 confere ≥20% do preço vigente, ≤ preço, forma não-fiado, preço definido e saldo de quantidade. |
| 2 | Prévia grava no real mas diz que é sessão local | **Resolvido** | Selo "Estoque real · alterações gravadas", aviso explícito, modo demonstração com "Tentar conectar"; `docs/GUIA-NOVO-ESTOQUE.md` reescrito ("Sobre esta tela"). URL mantida por decisão do usuário. |
| 3 | Prazo máximo: UI 18h do dia X × banco 30×24h | **Resolvido** | API recebe `dias` (1–30) e calcula `agora + dias×24h` (`vencimentoReserva`); a UI usa a mesma fórmula só para pré-visualizar; no limite de 30 dias há folga de 60 s para diferença de relógio API↔Postgres. Teste de paridade UI×API. |
| 4 | Validar bloqueio de venda de reservada/arquivada contra o banco real | **Parcial — script pronto, execução pendente** | `docs/validacao-estoque-reservas-067-068.sql`: roteiro autocontido `begin … rollback` com 47 cenários (usa `registrar_venda`/`cancelar_venda` reais da migration_059/038). Rodou **47/47 PASS** num Postgres 16 local com esqueleto do schema + 065→066→067→068. **Falta rodar em homologação com o schema real.** |

### P2
| # | Achado | Status | Como |
| --- | --- | --- | --- |
| 5 | "Localizadas" caía ao reservar | **Resolvido** | `getMetricas().localizadas` conta unidades com endereço (inclui reservadas); cartões: Valor, Disponíveis (com nº de reservadas), Localizadas, Para organizar. |
| 6 | `p_cliente_id` quebra sem 067 | **Resolvido** | Detecção de `cliente_id`; sem 067 o seletor vira nome livre e a API não envia o vínculo. (Na prática a reserva real depende da 068, que exige a 067.) |
| 7 | Arquivar/restaurar desabilitados no real; "Editar" para vendida/arquivada | **Resolvido** | Diálogo de arquivamento com motivo obrigatório (3–240) → `arquivar_unidade_estoque`; "Restaurar" na aba Fora do ativo; menu/drawer não oferecem edição para vendida/arquivada. |
| 8 | Escape fechava combobox e drawer juntos | **Resolvido** | `Combobox` escuta Escape em `window` (captura), fecha só a lista, interrompe a propagação e devolve o foco ao gatilho; o próximo Escape fecha o drawer. Teste. |
| 9 | Histórico não era real | **Resolvido (autoria depende da 068)** | `GET /organizacao/unidades/:id/historico` monta a linha do tempo (cadastro, endereço, reservas com sinal, liberação/vencimento, arquivamento, restauração, venda). Com a 068: tabela `estoque_unidade_eventos` + autoria. Sem ela: datas das colunas, "autor não registrado". |
| 10 | Ações não checavam `estoque.editar` | **Resolvido** | `usePermissao()`: sem `estoque.criar` some "Nova peça"; sem `estoque.editar` somem menu, reservar, editar, arquivar, restaurar e edição do mapa ("Somente consulta"). Teste com mock de permissão. |
| 11 | "Adicionar unidade" não clicável | **Resolvido** | Botão na lista e no card sem estoque; abre o cadastro em "Usar existente" com a peça escolhida. |
| 12 | Upload de fotos sem idempotência/órfãos | **Resolvido** | Cache arquivo→URL por sessão do cadastro (retry reaproveita); ao abandonar, `POST /organizacao/fotos/descartar` apaga só URLs enviadas pelo **mesmo usuário** pela nova rota `POST /organizacao/fotos` na última hora e **não referenciadas** em `estoque_unidades.fotos`/`estoque.imagens`. Registro em memória (reiniciar o servidor só perde a limpeza, nunca apaga nada indevido). |

### Secundários
| Achado | Status |
| --- | --- |
| Farol RK-825 em "Embreagem" | **Resolvido** — categoria "Iluminação" no demo. |
| Mapa: editar/desativar local, prioridade, alvo do "×" | **Resolvido** — `PATCH /organizacao/locais/:id` (código, descrição, ativo; desativação bloqueada com peças), `PATCH /organizacao/locais/:id/categorias/:categoriaId` (prioridade 1–3: Principal/Secundária/Eventual), "×" com 44×44 px, filtro "Mostrar locais desativados" + Reativar. |
| Combobox sem setas | **Resolvido** — ↑/↓, PageUp/PageDown, Home/End, Enter, `aria-activedescendant`, abre com ↓ no gatilho. |
| Métricas com `min-w-[920px]` | **Resolvido** — grade 1→2→4 colunas, sem rolagem lateral. |
| Fonte monoespaçada | **Resolvido** — removida do módulo (teste garante ausência de `.font-mono`). |

## Auditoria complementar (Fase 3)

Feita com a skill local `plugins/ux-user-audit` (critérios obrigatórios) e
screenshots reais (Playwright/Chromium em modo demonstração, 1440, 1024 e
375 px). Corrigidos dentro do escopo:

1. **Mobile: cards de peça e do mapa cortados à direita** (item de grid sem `min-w-0`; CTA "Adicionar unidade" ficava fora da tela) — corrigido.
2. **Mobile: abas cortadas sem indicação** — faixa com snap e fade na borda.
3. **Tema claro incompleto**: `positive/warning/negative/info/danger`, sombras e scrim herdavam valores escuros do tema global; portais recebem os tokens — `lightInventoryTokens` completo.
4. **Classes de sombra inexistentes** (`shadow-elevated-sm/md` não geram CSS) — trocadas por `shadow-sm/md/lg`.
5. **Cores cruas e hex no módulo** (slate/blue/emerald/amber/violet/rose, `#f7f9fc`, `#2563eb` no gráfico) — migradas para tokens.
6. **Cor sem significado fixo**: "Para organizar" em violeta e "Sem estoque" em âmbar → `warning` (pendência) e `negative` (ruptura); disponível = `positive`, reservada = accent.
7. **Diálogo de arquivamento era `div` sem foco preso/Escape/animação** → `InventoryDialog` (Radix + Motion, reduced-motion).
8. **Menu de ações**: não fechava ao clicar fora, sem animação, alvo 36 px → corrigido (44 px, anima, fecha fora, devolve foco).
9. **Toast** sem entrada/saída e com timers acumulados → AnimatePresence, timer único, `aria-live`.
10. **Troca de modo do drawer** (detalhe/editar/reservar) brusca → transição; bloco "Reserva ativa" com entrada/saída; linha do tempo com entrada escalonada.
11. **Botões de gravação sem carregamento** (salvar edição, confirmar reserva, liberar, restaurar, local) → spinner + desabilitado; duplo envio da edição bloqueado.
12. **Estado vazio ausente** na fila "Organizar" → mensagem.
13. **Campos herdando negrito do rótulo** e rótulo do Combobox diferente dos demais → `font-normal` nos campos; `size="lg"` com rótulo `text-sm font-semibold`.
14. **Alvos de toque < 44 px** (fechar drawer, alternar visualização, remover foto, botões h-10) → 44 px.
15. **Hierarquia número > rótulo**: preço acima do SKU na unidade, total numérico no "Ritmo", números destacados nos avisos.
16. **Alerta sem ação** (demo) → "Tentar conectar". **Dois botões accent** (mapa "Cadastrar local") → secundário.
17. Drawer respeita `prefers-reduced-motion`; `focus-visible` em todos os controles novos.

Critérios generalizáveis registrados em `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`
(fim da lista de critérios): item de grade sem `min-w-0`, tema local completo,
rótulo × campo, ações assíncronas com estado, menu de contexto completo, faixa
de abas no mobile. A alteração local que já existia nesse arquivo foi preservada.

## Fora do escopo — precisa de decisão/revisão do Codex

1. **067 e 068 aplicadas pelo usuário em 24/09 (confirmar com a consulta acima).** O roteiro `docs/validacao-estoque-reservas-067-068.sql` foi feito para homologação; em produção, rodá-lo consome códigos RK/SKU (tudo mais é revertido). **Publicar o código desta branch** para reservar com sinal.
2. **Revisão obrigatória da 068** (SQL/estoque): RPC `reservar_unidade_estoque` (8 parâmetros, drop da de 4), `liberar/arquivar/restaurar` com autoria (drop das antigas), tabela `estoque_unidade_eventos` + trigger `after update of endereco_id` (não participa de `registrar_venda`). Autoria sem FK de propósito (bypass localhost usa id fixo inexistente).
3. **Lacuna conhecida (não corrigida no banco atual)**: venda sem `p_unidade_id` (orçamento/Mercado Livre) baixa a quantidade sem marcar ficha como vendida. A 068 impede aceitar sinal quando `quantidade <= reservas ativas`, mas a divergência ficha×quantidade continua existindo no sistema.
4. **Sinal fora do Caixa** (decisão do usuário). Não há estorno/registro de devolução quando a reserva é liberada ou vence. Se o produto quiser, precisa de RPC transacional própria.
5. **Reserva vencida não é fechada automaticamente** (fica `liberada_em null` até nova reserva); telas devem filtrar `reservada_ate > now()` (a API já filtra).
6. **Componentes compartilhados com classes de sombra inexistentes** (`shadow-elevated-*`): `NotificationList.tsx`, `animate-ui/components/animate/tabs.tsx`, `radix/dropdown-menu.tsx`, `radix/dialog.tsx`, `radix/popover.tsx` — afetam outras telas; não editados.
7. **`Combobox` é compartilhado** (`StateCitySelect` também usa): o comportamento de Escape/setas melhora para todos; a lista agora abre ancorada ao botão (`top-full`) em vez de `mt-14` — conferir visualmente a tela que usa `StateCitySelect`.
8. **Fonte monoespaçada em outras telas** (64 ocorrências de `font-mono` fora deste módulo) — não tocado.
9. `SeletorCliente` (compartilhado) tem campo de ~42 px e cores do tema global; dentro do estoque herda os tokens claros. Não alterado.
10. Primeiro endereço definido pelo cadastro (`adicionar_unidade_estoque`) não gera evento `endereco_alterado` (trigger só em update); o histórico usa `organizada_em` como fallback visual.
11. Troca da rota `/estoque` só após nota 10/10 de Claude e Codex e autorização do usuário.

## Arquivos alterados nesta sessão

| Arquivo | Resumo |
| --- | --- |
| `supabase/migration_068_estoque_reservas_sinal_autoria.sql` (novo) | Sinal obrigatório (≥20%, ≤ preço, forma à vista, saldo), autoria, tabela/trigger de eventos. **Não aplicada.** |
| `docs/validacao-estoque-reservas-067-068.sql` (novo) | Roteiro de homologação `begin…rollback`, 47 cenários com `registrar_venda`/`cancelar_venda` reais. |
| `src/server/routes/estoqueOrganizacao.ts` | Detecção 067/068, reserva com `dias`+sinal, RPCs com autoria e fallback, histórico, PATCH de local e prioridade, upload/descarte seguro de fotos. |
| `src/server/routes/estoqueOrganizacao.test.ts` | Testes de validação, paridade de prazo, local, histórico, descarte. |
| `src/features/estoque-preview/organizacaoApi.ts` (novo) | Cliente HTTP das rotas novas (sem alterar `features/estoque/api.ts`). |
| `src/features/estoque-preview/EstoquePreview.tsx` | Permissões, métricas, arquivar/restaurar reais, reserva com sinal, textos de gravação real, tokens, animações, mobile. |
| `src/features/estoque-preview/InventoryUnitDrawer.tsx` | Formulário de sinal/forma/prazo, bloqueio sem preço, histórico real, estados de carregamento, transições. |
| `src/features/estoque-preview/InventoryDrawer.tsx` | Tokens claros completos, `InventoryDialog`, reduced-motion, alvo 44 px. |
| `src/features/estoque-preview/InventoryMap.tsx` | Editar/desativar/reativar local, prioridade, "×" 44 px, tokens, sem mono. |
| `src/features/estoque-preview/InventoryComposer.tsx` | Cache/descarte de fotos, peça inicial, tokens, alvos 44 px. |
| `src/features/estoque-preview/inventoryPreviewModel.ts` | `localizadas`, sinal mínimo, vencimento 24 h, bloqueio sem preço, histórico demo, RK-825. |
| `src/features/estoque-preview/realInventoryAdapter.ts` | Sinal/data da reserva e prioridades por local. |
| `src/features/estoque-preview/persistInventory.ts` | Upload com cache e flag `fotosAnexadas`. |
| `src/features/estoque-preview/*.test.ts(x)` | Testes atualizados + `EstoquePreview.permissao.test.tsx` (novo). |
| `src/components/ui/Combobox.tsx` / `.test.tsx` | Escape em camadas, setas, `size="lg"`, ancoragem. |
| `docs/GUIA-NOVO-ESTOQUE.md` | Gravação real, reserva com sinal, cartões, mapa, permissões. |
| `src/features/patchnotes/data.ts` | Entrada 1.7.6. |
| `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md` | 6 critérios novos (alteração local anterior preservada). |
| `PROSSIGA.MD` | Aponta para este handoff. |

## Testes executados (cópia na nuvem, Node 22, sem `.env`)

- `npm run lint` (`tsc --noEmit`): **ok**.
- `npm run build`: **ok** (aviso conhecido de chunk > 500 kB).
- `npm test`: ver resultado no fim deste arquivo. Linha de base antes das mudanças: **705/705**.
- Roteiro SQL: **47/47 PASS** em Postgres 16 local (esqueleto do schema; migrations 002–009, 024, 028/029 ausentes no repositório foram emuladas só nas colunas usadas).
- Inspeção visual real (Chromium) em modo demonstração: 1440/1024/375 px — catálogo, métricas, drawer de reserva com lista de formas, histórico, diálogo de arquivamento, mapa e cadastro (seta+Enter no Combobox).
- **Não executado**: API real, banco real, upload real, fluxo com `.env`.

## Próximo passo recomendado
1. `git status --short --branch` e `git log -1` em `D:\SISTEMA CLAUDE`; rode `npm run lint`, `npm test`, `npm run build` localmente.
2. Revisar este diff (foco: `estoqueOrganizacao.ts`, 068, `Combobox.tsx`).
3. Homologação: aplicar 067+068 e rodar `docs/validacao-estoque-reservas-067-068.sql` (ler o cabeçalho).
4. Com aprovação do usuário, aplicar 067+068 em produção junto do deploy deste backend.
5. Teste real pela UI: reservar com sinal (cliente e balcão), sem preço, liberar, arquivar/restaurar, desativar local com/sem peças, histórico com autoria, usuário sem `estoque.editar`.
6. Nova auditoria completa; só com 10/10 de Claude e Codex perguntar ao usuário sobre trocar `/estoque`.

## Resultado dos comandos (23/09/2026, cópia na nuvem)

- `npm run lint` → ok.
- `npm run build` → ok (aviso conhecido de chunk grande).
- `npm test` (suíte completa) → 725/726 na primeira execução; a única falha era
  uma asserção do próprio teste novo de Histórico (texto repetido nas duas
  abas montadas), corrigida em seguida. Reexecução dos 8 arquivos afetados
  (`src/features/estoque-preview`, `Combobox.test.tsx`,
  `estoqueOrganizacao.test.ts`) → **73/73**. Linha de base: 705/705.
- `git diff --check` → sem problemas; quebras de linha CRLF/LF originais
  preservadas nos arquivos que já as tinham.
