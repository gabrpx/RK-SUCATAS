-- =============================================================================
-- RK Sucatas — Migração 018: promoções com desconto e prazo
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 017 aplicadas).
--
-- Uma promoção aplica desconto a um alvo (peça específica, modelo de moto —
-- vale pra ele e toda a subárvore de variações abaixo, categoria — mesma
-- lógica, ou o estoque inteiro) durante uma janela de tempo. `data_fim` nula
-- = sem prazo definido (só termina quando alguém desativar/excluir).
--
-- Não existe job/cron pra "expirar": o preço promocional é calculado na hora
-- da consulta (ver estoque.ts), comparando `now()` com o início/fim — uma
-- promoção vencida simplesmente para de valer no próximo GET, sem precisar
-- de nada rodando em background.
-- =============================================================================

create table promocoes (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('peca', 'modelo_moto', 'categoria', 'global')),
  -- Nulo só quando escopo = 'global'; validado na aplicação (não dá pra
  -- expressar "obrigatório exceto quando X" direto num check simples).
  alvo_id uuid,
  tipo_desconto text not null check (tipo_desconto in ('percentual', 'valor_fixo')),
  valor numeric(10,2) not null check (valor > 0),
  descricao text,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint promocoes_periodo_valido check (data_fim is null or data_fim > data_inicio)
);

create index idx_promocoes_escopo_alvo on promocoes(escopo, alvo_id);
-- Cobre a query "quais promoções valem agora" sem varrer a tabela inteira.
create index idx_promocoes_janela_ativa on promocoes(ativo, data_inicio, data_fim);

-- Mesmo padrão do resto do schema (ver schema.sql): RLS ligado sem policy —
-- só a service role key (usada pelo backend) acessa a tabela.
alter table promocoes enable row level security;

NOTIFY pgrst, 'reload schema';
