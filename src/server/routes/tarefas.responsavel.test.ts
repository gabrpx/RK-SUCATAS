import { describe, it, expect } from 'vitest';
import { responsavelValido } from './tarefas';

const EXECUTOR = { roles: [], permissoes: { tarefas: { ver: true, concluir: true } }, ativo: true };
const GERENTE = { roles: [], permissoes: { tarefas: { ver: true, criar: true } }, ativo: true };
const SEM_PERMISSAO = { roles: [], permissoes: { tarefas: { ver: true } }, ativo: true };
const GERENTE_INATIVO = { roles: [], permissoes: { tarefas: { ver: true, criar: true } }, ativo: false };

describe('responsavelValido', () => {
  it('null nunca é válido', () => {
    expect(responsavelValido(null, false)).toBe(false);
  });
  it('o próprio usuário sempre é válido, mesmo sem ser executor/gerente', () => {
    expect(responsavelValido(SEM_PERMISSAO, true)).toBe(true);
  });
  it('executor de campo (tarefas.concluir sem tarefas.criar) é válido', () => {
    expect(responsavelValido(EXECUTOR, false)).toBe(true);
  });
  it('outro gerente/admin (tarefas.criar) também é válido como responsável', () => {
    expect(responsavelValido(GERENTE, false)).toBe(true);
  });
  it('gerente inativo continua inválido', () => {
    expect(responsavelValido(GERENTE_INATIVO, false)).toBe(false);
  });
  it('sem tarefas.concluir nem tarefas.criar, e não é o próprio -> inválido', () => {
    expect(responsavelValido(SEM_PERMISSAO, false)).toBe(false);
  });
});
