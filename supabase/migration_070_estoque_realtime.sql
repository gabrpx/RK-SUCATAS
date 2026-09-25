-- Publica mudanças de catálogo e fichas físicas para invalidação em tempo real
-- no backend. O evento enviado aos navegadores contém apenas um aviso genérico.
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.estoque, public.estoque_unidades;
