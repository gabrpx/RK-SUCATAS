import { describe, it, expect } from 'vitest';
import {
  pode,
  permissoesDeRoles,
  chaveExiste,
  CATALOGO_PERMISSOES,
  CHAVES_VALIDAS,
  type Permissoes,
} from './permissoes';

describe('catálogo de permissões', () => {
  it('toda tela tem "ver" como primeira ação', () => {
    for (const tela of CATALOGO_PERMISSOES) {
      expect(tela.acoes[0]?.chave, `tela ${tela.chave}`).toBe('ver');
    }
  });

  it('não tem chave de tela nem de ação duplicada', () => {
    const telas = CATALOGO_PERMISSOES.map((t) => t.chave);
    expect(new Set(telas).size).toBe(telas.length);
    expect(new Set(CHAVES_VALIDAS).size).toBe(CHAVES_VALIDAS.length);
  });

  it('chaveExiste bate com o catálogo', () => {
    expect(chaveExiste('estoque', 'criar')).toBe(true);
    expect(chaveExiste('estoque', 'ver')).toBe(true);
    expect(chaveExiste('estoque', 'inexistente')).toBe(false);
    expect(chaveExiste('tela_fantasma', 'ver')).toBe(false);
  });
});

describe('pode', () => {
  const perm: Permissoes = {
    estoque: { ver: true, criar: true, deletar: false },
    dashboard: { ver: true, ver_valores: false },
    vendas: { ver: false, criar: true }, // criar sem ver: inconsistente de propósito
  };

  it('admin é super-usuário e passa em tudo, mesmo com permissoes vazias/nulas', () => {
    expect(pode({}, true, 'estoque.deletar')).toBe(true);
    expect(pode(null, true, 'qualquer.coisa')).toBe(true);
    expect(pode(undefined, true, 'vendas.cancelar_fiado')).toBe(true);
  });

  it('libera ação quando ver=true e a ação=true', () => {
    expect(pode(perm, false, 'estoque.ver')).toBe(true);
    expect(pode(perm, false, 'estoque.criar')).toBe(true);
  });

  it('nega ação marcada como false', () => {
    expect(pode(perm, false, 'estoque.deletar')).toBe(false);
    expect(pode(perm, false, 'dashboard.ver_valores')).toBe(false);
  });

  it('exige ver da tela: ação sem ver nunca passa (dependência)', () => {
    // vendas.criar=true mas vendas.ver=false → não pode
    expect(pode(perm, false, 'vendas.criar')).toBe(false);
    expect(pode(perm, false, 'vendas.ver')).toBe(false);
  });

  it('nega tela/ação ausente do mapa e permissoes nulas quando não é admin', () => {
    expect(pode(perm, false, 'frete.ver')).toBe(false);
    expect(pode(perm, false, 'estoque.acao_que_nao_existe')).toBe(false);
    expect(pode(null, false, 'estoque.ver')).toBe(false);
    expect(pode({}, false, 'estoque.ver')).toBe(false);
  });

  it('nega chave malformada', () => {
    expect(pode(perm, false, 'estoque')).toBe(false);
    expect(pode(perm, false, '')).toBe(false);
    expect(pode(perm, false, '.ver')).toBe(false);
  });
});

// Equivalência 1:1 com o comportamento por CARGO de hoje. Os conjuntos
// esperados abaixo são a fonte da verdade independente (derivada de TAB_ROLES
// + gates das rotas), não recalculada a partir do código de produção.
describe('permissoesDeRoles (backfill)', () => {
  // Lista achatada de "tela.acao" ligadas (true) num mapa de permissões.
  function chavesLigadas(p: Permissoes): string[] {
    const out: string[] = [];
    for (const tela of Object.keys(p)) {
      for (const acao of Object.keys(p[tela])) {
        if (p[tela][acao]) out.push(`${tela}.${acao}`);
      }
    }
    return out.sort();
  }

  it('admin recebe todas as chaves do catálogo', () => {
    expect(chavesLigadas(permissoesDeRoles(['admin']))).toEqual([...CHAVES_VALIDAS].sort());
  });

  it('estoque_leitura só vê estoque + novidades + notificações (nada de escrita)', () => {
    expect(chavesLigadas(permissoesDeRoles(['estoque_leitura']))).toEqual(
      ['estoque.ver', 'notificacoes.ver', 'patchnotes.ver'].sort()
    );
  });

  it('mandados e mecanico veem e concluem tarefas + novidades + notificações', () => {
    const esperado = ['notificacoes.ver', 'patchnotes.ver', 'tarefas.concluir', 'tarefas.ver'].sort();
    expect(chavesLigadas(permissoesDeRoles(['mandados']))).toEqual(esperado);
    expect(chavesLigadas(permissoesDeRoles(['mecanico']))).toEqual(esperado);
  });

  it('equipe recebe tudo menos as ações exclusivas de admin', () => {
    const soAdmin = ['vendas.cancelar_fiado', 'vendas.excluir_comprovante', 'dashboard.ver_visao_dono'];
    const ligadas = new Set(chavesLigadas(permissoesDeRoles(['equipe'])));
    // Não recebe as ações admin-only de hoje...
    for (const chave of soAdmin) expect(ligadas.has(chave), chave).toBe(false);
    // ...mas recebe todo o resto do catálogo.
    const esperado = CHAVES_VALIDAS.filter((c) => !soAdmin.includes(c));
    expect([...ligadas].sort()).toEqual(esperado.sort());
  });

  it('vários cargos = união das permissões (estoque_leitura + mandados)', () => {
    const ligadas = new Set(chavesLigadas(permissoesDeRoles(['estoque_leitura', 'mandados'])));
    expect(ligadas.has('estoque.ver')).toBe(true);
    expect(ligadas.has('tarefas.ver')).toBe(true);
    expect(ligadas.has('tarefas.concluir')).toBe(true);
    expect(ligadas.has('estoque.criar')).toBe(false);
  });

  it('cargo desconhecido não liga nada', () => {
    expect(chavesLigadas(permissoesDeRoles(['cargo_inexistente']))).toEqual([]);
    expect(chavesLigadas(permissoesDeRoles([]))).toEqual([]);
  });
});
