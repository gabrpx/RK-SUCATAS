# Integração operacional do Tarefas Preview

## Objetivo

Substituir a interface antiga de `/tarefas` pela experiência visual já aprovada
em `tarefas-preview`, conectada às tarefas, lembretes, participantes e usuários
reais do sistema. A nova tela preserva sua identidade visual; somente os dados
de demonstração são substituídos por dados persistidos.

## Base confirmada

- A implementação será iniciada a partir de `origin/main`, não da branch de
  preview, porque `main` contém a base real multiusuário.
- Os responsáveis vêm exclusivamente de `usuarios`: conta ativa e elegível
  conforme o endpoint existente `GET /api/usuarios/responsaveis-tarefa`.
- Ayrton é administrador e gestor. As regras já existentes de permissões
  continuam sendo a autoridade para visualizar, criar, editar e concluir.
- As rotas, tabelas e tipos atuais já suportam tarefas, checklist,
  participantes, imagens e lembretes. Não será criado cadastro duplicado de
  pessoas nem uma segunda API de tarefas.

## Arquitetura

1. Criar uma composição de tela operacional baseada nos componentes visuais do
   preview, mas alimentada pelos contratos de `src/features/tarefas` e
   `src/features/lembretes` da base `main`.
2. Criar adaptadores puros de apresentação entre `Tarefa`/`Lembrete` reais e os
   campos que os cards, drawer, métricas e trilhos renderizam. Os adaptadores
   não mantêm cópia sincronizada de estado: a fonte é `useTarefas` ou
   `useLembretes`.
3. Preservar o endpoint e as regras atuais de participantes. Uma tarefa em
   grupo usa `tarefa_participantes`; tarefas antigas com um único
   `atribuido_para` continuam válidas.
4. Substituir a rota visual de `/tarefas` no app por uma composição em tela
   cheia da nova experiência. As demais abas, rotas e shell do sistema não
   serão alterados.

## Estado operacional de foco

O rótulo e a ação “Foco” não podem representar estado fictício. Uma migration
nova e aditiva ampliará a constraint de `tarefas.status` para aceitar
`em_andamento`, preservando todas as linhas existentes em `pendente` e
`concluida`.

- `Iniciar foco` muda uma tarefa elegível de `pendente` para `em_andamento`.
- `Concluir` muda `em_andamento` ou `pendente` para `concluida`.
- `Reabrir` retorna uma tarefa concluída para `pendente`.
- O backend mantém autorização e validações existentes; o frontend não infere
  esse estado sem confirmação da API.

## Responsáveis e contexto de sucata

- O seletor mostra nome e iniciais dos usuários ativos retornados pelo endpoint
  existente. Pessoas sem acesso adequado não aparecem.
- A criação e o detalhe reaproveitam participantes, checklist, prazo,
  prioridade, cliente e imagens já existentes.
- A categoria visual do preview é derivada de dados verificáveis: tipo geral,
  cliente, imagens, checklist e palavras/área disponíveis. Quando não houver
  evidência suficiente, a tela apresenta “Outro”, sem fabricar setor ou etapa.
- Atividades recentes derivam de itens concluídos, participantes e atualizações
  reais; categorias vazias não ocupam espaço.

## Mobile e motion

- Os cards de métricas formam trilho horizontal com `scroll-snap`, rolagem por
  toque/teclado/trackpad e barra nativa visualmente suprimida.
- Um fade no limite do trilho, indicador de páginas/progresso e texto acessível
  “Arraste para ver mais indicadores” comunicam conteúdo adicional. O fade não
  bloqueia interação nem esconde itens de tecnologias assistivas.
- Antes da fila, categorias e atividades recentes aparecem em cards compactos,
  com entrada, saída e reposicionamento local equivalentes aos cards de
  tarefas. Em desktop mantêm o painel lateral aprovado.
- Filtros animam somente itens afetados; títulos, CTAs e contadores preservam
  geometria. Motion usa `opacity` e `transform` e respeita
  `prefers-reduced-motion`.

## Critérios de aceite

- `/tarefas` usa dados reais e não importa dados `seed`.
- Usuários elegíveis são os mesmos da Configurações/API existente.
- Criar, abrir, concluir, reabrir, marcar checklist, participar e finalizar
  atualizam a API real e retornam à tela sem discrepância de contadores.
- O status `em_andamento` é persistido e autorizado pela API.
- Em 320 px, nenhum painel de métrica mostra scrollbar padrão; o indicador de
  continuidade aparece quando houver mais cards fora da viewport.
- Categorias e atividades ficam antes da fila no mobile, nunca deslocam a ação
  prioritária para fora de alcance e entram/saem sem salto.
- Não há alteração visual deliberada no design aprovado de tarefas-preview.

## Fora do escopo

- Alterar login, credenciais, RLS, regras de vendas/estoque/caixa ou deploy.
- Criar usuários, permissões ou uma fonte paralela de responsáveis.
- Executar migrations no Supabase de produção sem uma etapa operacional
  explícita de deploy.
