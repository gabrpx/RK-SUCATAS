export function formatarMomentoRelativo(iso: string | null, agora = Date.now()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const abs = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
  const diff = agora - d.getTime();
  const min = 60_000, hora = 60 * min, dia = 24 * hora;
  let rel: string;
  if (diff < min) rel = 'agora';
  else if (diff < hora) rel = `${Math.floor(diff / min)}min atrás`;
  else if (diff < dia) rel = `${Math.floor(diff / hora)}h atrás`;
  else if (diff < 2 * dia) rel = 'ontem';
  else rel = `${Math.floor(diff / dia)}d atrás`;
  return `${abs} · ${rel}`;
}

export function formatarTempoRelativoCurto(iso: string | null, agora = Date.now()): string | null {
  if (!iso) return null;
  const diff = agora - new Date(iso).getTime();
  const min = 60_000, hora = 60 * min, dia = 24 * hora;
  if (diff < min) return 'agora';
  if (diff < hora) return `há ${Math.floor(diff / min)}min`;
  if (diff < dia) return `há ${Math.floor(diff / hora)}h`;
  if (diff < 2 * dia) return 'ontem';
  return `há ${Math.floor(diff / dia)}d`;
}
