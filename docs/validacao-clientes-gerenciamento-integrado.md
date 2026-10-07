# Validação visual — Clientes integrado

Data da calibração: 2026-10-03  
Projeto: `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`  
Rotas de referência: `http://127.0.0.1:3001/vendas`, `/estoque` e `/tarefas`

## Estado e bloqueio da sequência de migrations — 2026-10-05

O usuário informou que aplicou `migration_072_clientes_operacao_base.sql`. A validação somente leitura confirmou que a capability base está ativa e retorna os 45 clientes reais. O agente não executou SQL nem alterou o projeto Supabase.

O histórico do projeto conectado continua informando somente **uma migration aplicada**. Isso é compatível com o relato de aplicação da `072`, mas não comprova que todos os pré-requisitos anteriores foram registrados ou aplicados na ordem esperada. O checkout local possui 72 arquivos `migration_*.sql`, numerados entre `002` e `072`, com esta sequência não linear:

- números duplicados: `060`, `061` e `065`;
- números ausentes dentro do intervalo: `062` e `071`;
- `migration_072_clientes_operacao_base.sql` pressupõe a migration `071` de Vendas, porém não existe arquivo `migration_071_*.sql` neste working tree;
- o plano reserva `073` para visitas, `074` para matching e `075` para reservas, mas nenhum desses três arquivos existe neste working tree;
- portanto, a numeração do nome do arquivo não prova ordem de aplicação, nem permite inferir que `067`–`070`, tabelas, constraints ou assinaturas de RPC estejam presentes no ambiente conectado.

A sondagem runtime pós-`072` encontrou `base=true`, `visitas=false`, `reservas=false` e `matches=true`. A presença de `matches` sem um arquivo local `074` correspondente demonstra divergência entre o schema real, o histórico de migrations e os artefatos locais; ela não autoriza concluir que a etapa 074 foi aplicada por completo.

Antes de qualquer nova aplicação é obrigatório, com autorização explícita: identificar o registro único do histórico conectado; reconciliar os objetos reais com cada migration local necessária; confirmar os pré-requisitos consumidos pela `072`; resolver a ausência/numeração da `071`; escrever e revisar os artefatos ainda inexistentes; e só então definir uma sequência segura de homologação e produção. Até essa reconciliação, nenhuma migration adicional deve ser executada.

## Referência observada

Vendas e Estoque foram capturadas na aplicação nova em 1440 × 1100 e 375 × 812. A rota de Tarefas depende da API Express em `3000` e não chegou a uma superfície útil com apenas o Vite ativo; para ela, a calibração foi confirmada no componente real `src/features/tarefas-preview/TasksPreview.tsx`, que é o mesmo renderizador conectado por `TarefasView.tsx`. Nenhum preview da porta legada `4173` foi usado.

| Elemento | Valor real a preservar em Clientes |
| --- | --- |
| Base | `#f8fafc` (`slate-50`), cartões brancos, texto principal `slate-950` |
| Shell | largura máxima `1440px`; `24px` lateral no desktop e `12px` no celular |
| Cabeçalho | uma linha branca com borda inferior; marca à esquerda e ação principal azul à direita |
| Início da página | `40px` vertical no desktop de Tarefas; `20px` no celular; Estoque/Vendas usam a mesma hierarquia compacta |
| Eyebrow | mono, `10px`, peso 600, uppercase, tracking `0.16em`, `slate-400`; somente para contexto operacional real |
| Título | `30px` no celular e `36px` no desktop, peso 600, tracking negativo próximo de `-0.045em` |
| Descrição | `14px`, `slate-500`, entrelinha confortável e largura limitada |
| Separadores | borda `slate-200`; nenhuma sombra decorativa no shell |
| Cartões | raio `8px`, borda `slate-200`, sombra base `0 1px 2px rgba(15,23,42,.04)` |
| Controles | raio `6px`; altura `44px` no toque e `36px` quando compacto no desktop |
| Abas | fundo `slate-50`, borda `slate-200`, padding interno `2px`; ativa branca, texto azul e sombra curta |
| Ação primária | `blue-600`, texto branco, `blue-700` no hover; verbo direto (`Registrar pedido`, `Novo cliente`) |
| Estados | azul para ação/informação, esmeralda para concluído/disponível, âmbar para atenção, laranja/vermelho para risco/encerramento |
| Densidade | linhas e cartões operacionais compactos, sem grandes áreas decorativas; conteúdo começa logo após filtros/indicadores |
| Drawer padrão | `512px`; drawer de ficha de cliente `760px`; `100dvh`, conteúdo rolável e cabeçalho/rodapé fora da rolagem |
| Mobile | uma coluna; controles podem rolar horizontalmente; ações principais ocupam largura útil; navegação inferior não cobre o rodapé |

## Direção aplicada a Clientes

- Usar a gramática operacional já existente, sem criar um tema paralelo: slate claro, azul de ação, raios 6/8 px e tipografia Geist/Inter.
- Manter a característica principal de Tarefas: informação densa, hierarquia tipográfica firme e estados explicados por texto, não apenas cor.
- Usar o espaço amplo do desktop para `lista + mapa`, mas empilhar no celular sem reduzir o tamanho de toque.
- Tratar drawer como local de trabalho: título e contexto no topo, seções ativas no conteúdo e ações persistentes na base.
- Evitar cartões repetidos apenas por decoração, gradientes, cantos excessivamente arredondados e linguagem técnica de backend.

## Checklist para Tasks 7–10

- [ ] 375 px sem corte horizontal involuntário.
- [ ] Desktop respeita shell de 1440 px e lista/mapa não se esmagam.
- [ ] Tabs de WhatsApp/Instagram seguem o destaque branco/azul de Tarefas.
- [ ] Campos possuem rótulo, erro associado e foco visível.
- [ ] Rodapé do drawer permanece visível enquanto o conteúdo rola.
- [ ] Loading, erro, vazio inicial e vazio filtrado usam a mesma densidade de Vendas/Estoque.
- [ ] Ações e textos usam termos do dia a dia: `Pedidos de peças`, `Peça disponível`, `Aguardando resposta`.
