// Texto curto de "quanto falta" pra uma promoção terminar — usado em
// qualquer badge de desconto (Estoque, Vendas, detalhe da peça). Sem
// timer/ticking: como a lista recarrega periodicamente (refreshData) e a
// promoção em si já é recalculada a cada consulta no backend, um texto
// formatado na hora do render já é suficiente, não precisa de setInterval.
export function formatarPrazoRestante(dataFim: string | null): string {
  if (!dataFim) return 'sem prazo definido';

  const diffMs = new Date(dataFim).getTime() - Date.now();
  if (diffMs <= 0) return 'termina a qualquer momento';

  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `termina em ${diffMin} min`;

  const diffH = Math.round(diffMs / 3600000);
  if (diffH < 24) return `termina em ${diffH}h`;

  const diffDias = Math.round(diffMs / 86400000);
  if (diffDias === 1) return 'termina amanhã';
  if (diffDias <= 30) return `termina em ${diffDias} dias`;

  return `termina em ${new Date(dataFim).toLocaleDateString('pt-BR')}`;
}
