// Quem recebe push de evento do sistema (não de tarefa pessoal): todo usuário
// ativo com papel admin ou equipe. Extraído de notificacoesScheduler.ts
// quando a fila de pedidos do Mercado Livre passou a precisar do mesmo
// público — duas cópias divergiriam na primeira vez que um papel novo
// entrasse no sistema.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function buscarDestinatariosEquipe(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('usuarios').select('id, roles').eq('ativo', true).or('roles.ov.{admin,equipe}');
  if (error) throw error;
  return (data ?? []).map((u: { id: string }) => u.id);
}
