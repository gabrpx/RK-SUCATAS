import { describe, it, expect } from 'vitest';
import { formatarMomentoRelativo, progressoChecklist, moverItem, elegiveisParaConcluirEmLote, ordenarTarefas } from './tarefaUtils';
import type { Tarefa, TarefaItem } from './types';

const AGORA = new Date('2026-08-24T18:00:00').getTime();
const isoAtras = (ms: number) => new Date(AGORA - ms).toISOString();
const min = 60_000, hora = 60 * min, dia = 24 * hora;

describe('formatarMomentoRelativo', () => {
  it('retorna null quando não há data', () => {
    expect(formatarMomentoRelativo(null, AGORA)).toBeNull();
  });
  it('mostra "agora" abaixo de 1 minuto', () => {
    expect(formatarMomentoRelativo(isoAtras(30_000), AGORA)).toContain('agora');
  });
  it('mostra minutos', () => {
    expect(formatarMomentoRelativo(isoAtras(5 * min), AGORA)).toContain('5min atrás');
  });
  it('mostra horas', () => {
    expect(formatarMomentoRelativo(isoAtras(2 * hora), AGORA)).toContain('2h atrás');
  });
  it('mostra "ontem"', () => {
    expect(formatarMomentoRelativo(isoAtras(28 * hora), AGORA)).toContain('ontem');
  });
  it('mostra dias', () => {
    expect(formatarMomentoRelativo(isoAtras(3 * dia), AGORA)).toContain('3d atrás');
  });
  it('inclui a data/hora antes do relativo', () => {
    const out = formatarMomentoRelativo(isoAtras(2 * hora), AGORA)!;
    expect(out).toMatch(/\d{2}\/\d{2}.*·/); // "24/08 às 16:00 · 2h atrás"
  });
});

const item = (concluido: boolean): TarefaItem => ({
  id: crypto.randomUUID(), texto: 'x', concluido, ordem: 0, concluido_em: null, concluido_por: null, concluido_por_usuario: null,
});

describe('progressoChecklist', () => {
  it('retorna null sem itens', () => {
    expect(progressoChecklist({ itens: [] })).toBeNull();
  });
  it('conta feitos e total', () => {
    expect(progressoChecklist({ itens: [item(true), item(false), item(true)] })).toEqual({ feitos: 2, total: 3 });
  });
});

describe('moverItem', () => {
  const itemComId = (id: string): TarefaItem => ({ id, texto: id, concluido: false, ordem: 0, concluido_em: null, concluido_por: null, concluido_por_usuario: null });
  const lista = [itemComId('a'), itemComId('b'), itemComId('c'), itemComId('d')];

  it('move um item pra baixo, preservando os outros na mesma ordem relativa', () => {
    expect(moverItem(lista, 'a', 'c').map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('move um item pra cima', () => {
    expect(moverItem(lista, 'd', 'b').map((i) => i.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('activeId === overId não muda nada', () => {
    expect(moverItem(lista, 'b', 'b').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('id inexistente devolve a lista original sem quebrar', () => {
    expect(moverItem(lista, 'x', 'b').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('ordenarTarefas', () => {
  const fakeTarefa = (id: string, status: 'pendente' | 'concluida'): Tarefa => ({
    id, titulo: `T ${id}`, descricao: null, status, prioridade: 'media', tipo: 'geral',
    atribuido_para: 'u1', criado_por: 'u2', prazo: null, criado_em: '', atualizado_em: '',
    concluida_em: null, cliente_id: null, cliente: null, itens: [], atribuido: null, criador: null,
  });

  it('moves concluded tasks after pending ones', () => {
    const tarefas = [fakeTarefa('c1', 'concluida'), fakeTarefa('p1', 'pendente'), fakeTarefa('c2', 'concluida'), fakeTarefa('p2', 'pendente')];
    expect(ordenarTarefas(tarefas).map((t) => t.id)).toEqual(['p1', 'p2', 'c1', 'c2']);
  });

  it('preserves relative order within each group', () => {
    const tarefas = [fakeTarefa('p3', 'pendente'), fakeTarefa('p1', 'pendente'), fakeTarefa('p2', 'pendente')];
    expect(ordenarTarefas(tarefas).map((t) => t.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('does not mutate the original array', () => {
    const tarefas = [fakeTarefa('c1', 'concluida'), fakeTarefa('p1', 'pendente')];
    const ids = tarefas.map((t) => t.id);
    ordenarTarefas(tarefas);
    expect(tarefas.map((t) => t.id)).toEqual(ids);
  });
});

describe('elegiveisParaConcluirEmLote', () => {
  const tarefa = (over: Partial<Tarefa>): Tarefa => ({
    id: over.id ?? 'x', titulo: 't', descricao: null, prazo: null, atribuido_para: 'u', criado_por: 'u',
    status: 'pendente', prioridade: 'media', tipo: 'geral', cliente_id: null, concluida_em: null,
    criado_em: '', atualizado_em: '', atribuido: null, criador: null, cliente: null, itens: [],
    ...over,
  });

  it('inclui tarefa pendente sem checklist selecionada', () => {
    const tarefas = [tarefa({ id: '1' })];
    expect(elegiveisParaConcluirEmLote(tarefas, new Set(['1']))).toEqual(['1']);
  });
  it('ignora tarefa já concluída', () => {
    const tarefas = [tarefa({ id: '1', status: 'concluida' })];
    expect(elegiveisParaConcluirEmLote(tarefas, new Set(['1']))).toEqual([]);
  });
  it('ignora tarefa com checklist (conclui sozinha ao marcar os itens)', () => {
    const tarefas = [tarefa({ id: '1', itens: [{ id: 'i1', texto: 'x', concluido: false, ordem: 0, concluido_em: null, concluido_por: null, concluido_por_usuario: null }] })];
    expect(elegiveisParaConcluirEmLote(tarefas, new Set(['1']))).toEqual([]);
  });
  it('ignora tarefa não selecionada', () => {
    const tarefas = [tarefa({ id: '1' }), tarefa({ id: '2' })];
    expect(elegiveisParaConcluirEmLote(tarefas, new Set(['1']))).toEqual(['1']);
  });
});
