import { describe, expect, it } from 'vitest';
import { normalizarMotivoPausa, podePausarTarefa } from './tarefas';

describe('pausa de tarefas', () => {
  it('normaliza e exige motivo não vazio', () => {
    expect(normalizarMotivoPausa('  peças pendentes  ')).toBe('peças pendentes');
    expect(normalizarMotivoPausa('   ')).toBe('');
    expect(normalizarMotivoPausa(null)).toBe('');
  });

  it('só permite pausar tarefa pendente', () => {
    expect(podePausarTarefa('pendente')).toBe(true);
    expect(podePausarTarefa('concluida')).toBe(false);
  });
});
