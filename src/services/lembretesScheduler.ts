// Disparo de Lembretes (ver migration_042) — mesmo molde de
// mercadolivreScheduler.ts/enviosScheduler.ts (setInterval simples, roda uma
// vez na subida + no intervalo), mas com tick de 30s: o menor intervalo
// oferecido na UI é 5min (300s), folga de 10x garante atraso máximo de ~30s
// sem gastar ciclo à toa. Diferente de notificacoesScheduler.ts (guard em
// memória, aceitável só pra varredura agregada diária), o "próximo disparo"
// aqui é persistido em lembretes.proxima_notificacao_em (ver
// disparar_lembretes_devidos), então sobrevive a restart/hibernação do
// Render free tier.
import type { SupabaseClient } from '@supabase/supabase-js';
import { notificarUsuario } from './pushNotificationService.js';

const INTERVALO_MS = 30 * 1000;

interface LembreteDevido {
  id: string;
  titulo: string;
  descricao: string | null;
  atribuido_para: string;
}

async function dispararLembretesDevidos(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc('disparar_lembretes_devidos');
  if (error) throw error;
  const devidos = (data ?? []) as LembreteDevido[];
  if (devidos.length === 0) return;

  await Promise.all(
    devidos.map((l) =>
      notificarUsuario(supabase, l.atribuido_para, { titulo: l.titulo, corpo: l.descricao || l.titulo, url: '/tarefas' }).catch((e) =>
        console.error(`Erro ao notificar lembrete ${l.id}:`, e)
      )
    )
  );
}

export function iniciarDisparoDeLembretes(supabase: SupabaseClient): void {
  const executar = () => {
    dispararLembretesDevidos(supabase).catch((err) => {
      console.error('Erro no disparo de lembretes:', err.message || err);
    });
  };

  executar();
  setInterval(executar, INTERVALO_MS);
}
