import { describe, expect, it } from 'vitest';
import { telaImersiva } from './appShell';

describe('telaImersiva', () => {
  it('mantém os módulos com identidade nova fora da casca legada', () => {
    expect(telaImersiva('clientes')).toBe(true);
    expect(telaImersiva('estoque')).toBe(true);
    expect(telaImersiva('vendas')).toBe(true);
    expect(telaImersiva('tarefas')).toBe(true);
    expect(telaImersiva('dashboard')).toBe(false);
  });
});
