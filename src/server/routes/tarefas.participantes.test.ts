// Testes das funções puras de tarefas multi-participante (Fase 1) — status
// "aguardando aprovação" é DERIVADO destas duas listas (nunca persistido em
// tarefas.status, que continua só 'pendente'/'concluida', a mesma constraint
// de sempre — ver comentário na migration_060_tarefa_participantes.sql).
import { describe, it, expect } from 'vitest';
import { souParticipante, progressoParticipantes, aguardandoAprovacao } from './tarefas';

describe('souParticipante', () => {
  it('true quando o usuário é o atribuido_para (tarefa antiga, sem participantes)', () => {
    expect(souParticipante({ atribuido_para: 'u1' }, 'u1')).toBe(true);
  });

  it('false quando o usuário não é nem atribuido_para nem participante', () => {
    expect(souParticipante({ atribuido_para: 'u1', participantes: [{ usuario_id: 'u2' }] }, 'u3')).toBe(false);
  });

  it('true quando o usuário está na lista de participantes, mesmo não sendo o atribuido_para', () => {
    expect(souParticipante({ atribuido_para: 'u1', participantes: [{ usuario_id: 'u2' }, { usuario_id: 'u3' }] }, 'u3')).toBe(true);
  });
});

describe('progressoParticipantes', () => {
  it('null quando não há participantes (tarefa do modelo antigo)', () => {
    expect(progressoParticipantes(undefined)).toBeNull();
    expect(progressoParticipantes([])).toBeNull();
  });

  it('conta quantos participantes concluíram', () => {
    expect(progressoParticipantes([{ concluido: true }, { concluido: false }, { concluido: true }])).toEqual({ feitos: 2, total: 3 });
  });
});

describe('aguardandoAprovacao', () => {
  it('false quando não há participantes', () => {
    expect(aguardandoAprovacao({ status: 'pendente', participantes: [] })).toBe(false);
  });

  it('false quando nem todos os participantes concluíram', () => {
    expect(aguardandoAprovacao({ status: 'pendente', participantes: [{ concluido: true }, { concluido: false }] })).toBe(false);
  });

  it('true quando todos os participantes concluíram e a tarefa ainda está pendente', () => {
    expect(aguardandoAprovacao({ status: 'pendente', participantes: [{ concluido: true }, { concluido: true }] })).toBe(true);
  });

  it('false quando a tarefa já foi finalizada (concluida), mesmo com todos os participantes concluídos', () => {
    expect(aguardandoAprovacao({ status: 'concluida', participantes: [{ concluido: true }] })).toBe(false);
  });
});
