-- =============================================================================
-- RK Sucatas — Migração 030: natureza das formas de pagamento (fiado)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende de formas_pagamento, criada
-- em schema.sql).
--
-- Migração isolada e aditiva: coluna nova com default retrocompatível, não
-- toca em vendas/caixa. É o alicerce da Fase 2 "Fiado" — hoje "PENDÊNCIA" é
-- só um nome de forma de pagamento digitado à mão, sem significado formal
-- pro sistema; essa coluna dá um jeito confiável de saber "essa forma de
-- pagamento é fiado" mesmo que renomeiem o rótulo depois.
-- =============================================================================

alter table formas_pagamento
  add column natureza text not null default 'avista' check (natureza in ('avista', 'fiado'));

-- Backfill único: marca a forma de pagamento "PENDÊNCIA" já existente (seed
-- em schema.sql) como fiado. Se ela já tiver sido renomeada antes desta
-- migração rodar, não vai achar nada — precisa marcar manualmente depois
-- (ver Configurações > Formas de pagamento).
update formas_pagamento
set natureza = 'fiado'
where nome ilike 'pendência' or nome ilike 'pendencia';

NOTIFY pgrst, 'reload schema';
