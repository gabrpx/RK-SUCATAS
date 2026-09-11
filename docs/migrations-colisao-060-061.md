# Colisão de numeração de migrations 060 e 061

**Registrado em:** 2026-09-11 · **Status:** documentado, NÃO corrigido de propósito.

## O que aconteceu

Duas linhas de trabalho paralelas (Tarefas multi-participante e Estoque por
Gavetas) criaram migrations com o **mesmo número**, cada uma numa branch, e
ambas foram mergeadas na `main` e **já rodadas em produção**:

| Nº  | Arquivo A (Tarefas)                     | Arquivo B (Estoque/Gavetas)              |
|-----|-----------------------------------------|------------------------------------------|
| 060 | `migration_060_tarefa_participantes.sql`| `migration_060_mover_unidade_estoque.sql`|
| 061 | `migration_061_tarefa_imagens.sql`      | `migration_061_gavetas.sql`              |

Os nomes de arquivo são diferentes, então **não houve conflito de arquivo no
git** nem sobrescrita. As duas de cada número fazem coisas distintas e ambas
estão aplicadas no Supabase de produção. O único problema é a **numeração
ambígua**: "migration 061" não identifica um arquivo só.

## Decisão

**Não renomear as migrations históricas 060/061.** Elas já rodaram em produção
com esses nomes; renomear o arquivo faria o nome divergir do que está aplicado
no banco e reescreveria histórico sem ganho real. O risco supera o benefício
estético.

## Regra daqui pra frente

- A numeração de novas migrations **continua a partir de 062**, ignorando a
  duplicidade (062 está livre; 063 é a próxima efetivamente usada — ver
  `supabase/migration_063_estoque_novo.sql`, Fase 2A).
- Ao criar uma migration, **conferir o maior número já existente em
  `supabase/`** (incluindo duplicatas) antes de escolher o próximo — não
  assumir sequência contígua.
- Se um dia a renumeração for desejada, tratar como tarefa própria e
  coordenada com o estado real do banco (não como efeito colateral de outra
  entrega).
