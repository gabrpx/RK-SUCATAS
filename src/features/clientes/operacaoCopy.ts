import type { PedidoBuscaAcao, PedidoBuscaSituacao, SituacaoClienteCodigo } from './operacaoTypes';

export const pedidoStatusCopy: Record<PedidoBuscaSituacao, string> = {
  nova: 'Pedido novo',
  em_busca: 'Procurando peça',
  peca_disponivel: 'Peça disponível',
  aguardando_cliente: 'Aguardando resposta',
  vendida: 'Venda concluída',
  nao_encontrada: 'Peça não encontrada',
  cliente_desistiu: 'Cliente desistiu',
  cancelada: 'Cancelado',
  aguardando: 'Procurando peça',
  atendida: 'Atendido anteriormente',
  reservada: 'Aguardando retirada',
  visita_agendada: 'Visita agendada',
};

export const pedidoAcaoCopy: Record<PedidoBuscaAcao, string> = {
  iniciar_busca: 'Iniciar busca',
  cliente_avisado: 'Cliente avisado',
  cliente_desistiu: 'Cliente desistiu',
  aguardando_resposta: 'Aguardando resposta',
  vai_buscar: 'Vai buscar',
  nao_quer_mais: 'Não quer mais',
  marcar_nao_encontrada: 'Marcar como não encontrada',
  cancelar: 'Cancelar pedido',
  reabrir: 'Reabrir busca',
};

export const situacaoCopy: Record<SituacaoClienteCodigo, string> = {
  visita_atrasada: 'Visita atrasada',
  visita_hoje: 'Visita hoje',
  promessa_vencida: 'Promessa vencida',
  reserva_vencida: 'Reserva vencida',
  reserva_vencendo: 'Reserva vencendo',
  aguardando_retirada: 'Aguardando retirada',
  peca_disponivel: 'Peça disponível',
  aguardando_resposta: 'Aguardando resposta',
  busca_antiga: 'Busca precisa de atenção',
  visita_agendada: 'Visita agendada',
  pedido_novo: 'Pedido novo',
  procurando_peca: 'Procurando peça',
  sem_pendencias: 'Sem pendências',
};
