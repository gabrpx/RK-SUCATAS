export type LembreteStatus = 'pendente' | 'concluido';

export interface UsuarioResumo {
  id: string;
  nome_exibicao: string;
}

export interface Lembrete {
  id: string;
  titulo: string;
  descricao: string | null;
  atribuido_para: string;
  criado_por: string;
  status: LembreteStatus;
  // null = disparo único (horário fixo); not null = recorrente a cada N min.
  intervalo_minutos: number | null;
  proxima_notificacao_em: string | null;
  ultima_notificacao_em: string | null;
  concluido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  atribuido: UsuarioResumo | null;
  criador: UsuarioResumo | null;
}

// Exatamente um entre intervalo_minutos/horario_fixo — o backend recusa se
// vierem os dois ou nenhum (ver src/server/routes/lembretes.ts).
export interface LembreteInput {
  titulo: string;
  descricao?: string | null;
  atribuido_para?: string;
  intervalo_minutos?: number | null;
  horario_fixo?: string | null;
}

export interface LembreteUpdateInput {
  titulo?: string;
  descricao?: string | null;
  atribuido_para?: string;
  intervalo_minutos?: number | null;
  horario_fixo?: string | null;
}
