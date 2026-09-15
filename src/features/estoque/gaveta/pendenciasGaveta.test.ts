import { describe, it, expect } from 'vitest';
import {
  pendenciasDaUnidade,
  pendenciasDaVariante,
  resumirPendenciasEstoque,
  rotuloPendencia,
} from './pendenciasGaveta';
import type { Estoque, EstoqueUnidade } from '../types';

// Fábricas mínimas — só os campos que as regras de pendência olham.
function unidade(over: Partial<EstoqueUnidade> = {}): EstoqueUnidade {
  return {
    id: Math.random().toString(36).slice(2),
    estoque_id: 'e1',
    nome: null,
    avaria: false,
    avaria_descricao: null,
    descricao: null,
    fotos: [],
    valor: null,
    condicao_nota: null,
    vendida_em: null,
    criado_em: '',
    atualizado_em: '',
    ...over,
  };
}

function item(over: Partial<Estoque> = {}): Estoque {
  return {
    id: 'e1',
    codigo: 'C1',
    nome: 'Peça',
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '',
    atualizado_em: '',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    gaveta_id: 'g1',
    unidades: [],
    ...over,
  };
}

describe('pendenciasDaUnidade', () => {
  it('marca sem_foto quando a unidade não tem foto própria nem foto legada na variante', () => {
    const pai = item({ imagens: [] });
    expect(pendenciasDaUnidade(unidade({ fotos: [] }), pai)).toContain('sem_foto');
  });

  it('marca foto_legada quando a unidade herda a foto da variante em vez de ter foto própria', () => {
    const pai = item({ imagens: ['capa.jpg'] });
    const p = pendenciasDaUnidade(unidade({ fotos: [] }), pai);
    expect(p).toContain('foto_legada');
    expect(p).not.toContain('sem_foto');
  });

  it('não marca foto quando a unidade tem foto própria', () => {
    const pai = item({ imagens: ['capa.jpg'] });
    const p = pendenciasDaUnidade(unidade({ fotos: ['propria.jpg'] }), pai);
    expect(p).not.toContain('foto_legada');
    expect(p).not.toContain('sem_foto');
  });

  it('marca com_avaria quando a unidade tem avaria', () => {
    expect(pendenciasDaUnidade(unidade({ avaria: true }), item())).toContain('com_avaria');
  });

  it('marca sem_preco quando a ficha não possui preço próprio válido', () => {
    expect(pendenciasDaUnidade(unidade({ valor: 0 }), item({ valor: 100 }))).toContain('sem_preco');
    expect(pendenciasDaUnidade(unidade({ valor: null }), item({ valor: 0 }))).toContain('sem_preco');
    expect(pendenciasDaUnidade(unidade({ valor: null }), item({ valor: 100 }))).toContain('sem_preco');
  });
});

describe('pendenciasDaVariante', () => {
  it('marca sem_gaveta quando o item não tem gaveta_id', () => {
    expect(pendenciasDaVariante(item({ gaveta_id: null }))).toContain('sem_gaveta');
    expect(pendenciasDaVariante(item({ gaveta_id: 'g1' }))).not.toContain('sem_gaveta');
  });

  it('marca ficha_pendente quando a quantidade é maior que as fichas disponíveis', () => {
    const semFichas = item({ quantidade: 3, unidades: [] });
    expect(pendenciasDaVariante(semFichas)).toContain('ficha_pendente');
    const completa = item({ quantidade: 1, unidades: [unidade()] });
    expect(pendenciasDaVariante(completa)).not.toContain('ficha_pendente');
  });

  it('não conta unidade vendida como ficha existente', () => {
    const v = item({ quantidade: 1, unidades: [unidade({ vendida_em: '2026-01-01' })] });
    expect(pendenciasDaVariante(v)).toContain('ficha_pendente');
  });

  it('agrega pendências das unidades disponíveis (avaria, foto)', () => {
    const v = item({
      imagens: [],
      quantidade: 1,
      unidades: [unidade({ avaria: true, fotos: [] })],
    });
    const p = pendenciasDaVariante(v);
    expect(p).toContain('com_avaria');
    expect(p).toContain('sem_foto');
  });
});

describe('resumirPendenciasEstoque', () => {
  it('conta sem_gaveta por variante e sem_foto/com_avaria por unidade disponível', () => {
    const itens: Estoque[] = [
      item({ gaveta_id: null, imagens: [], quantidade: 1, unidades: [unidade({ fotos: [], avaria: true })] }),
      item({ gaveta_id: 'g1', imagens: ['x.jpg'], quantidade: 1, unidades: [unidade({ fotos: [] })] }),
    ];
    const resumo = resumirPendenciasEstoque(itens);
    expect(resumo.porTipo.sem_gaveta).toBe(1);
    expect(resumo.porTipo.sem_foto).toBe(1); // 1ª unidade (sem foto legada); a 2ª é foto_legada
    expect(resumo.porTipo.foto_legada).toBe(1);
    expect(resumo.porTipo.com_avaria).toBe(1);
    expect(resumo.total).toBe(
      resumo.porTipo.sem_gaveta +
        resumo.porTipo.ficha_pendente +
        resumo.porTipo.sem_foto +
        resumo.porTipo.foto_legada +
        resumo.porTipo.com_avaria +
        resumo.porTipo.sem_preco,
    );
  });

  it('não muda o total geral quando recebe um subconjunto filtrado (é função pura da lista)', () => {
    const itens = [item({ gaveta_id: null }), item({ gaveta_id: null })];
    expect(resumirPendenciasEstoque(itens).porTipo.sem_gaveta).toBe(2);
    expect(resumirPendenciasEstoque(itens.slice(0, 1)).porTipo.sem_gaveta).toBe(1);
  });
});

describe('rotuloPendencia', () => {
  it('devolve um rótulo textual em pt-BR para cada tipo', () => {
    expect(rotuloPendencia('sem_foto', 2)).toMatch(/sem foto/i);
    expect(rotuloPendencia('ficha_pendente', 1)).toMatch(/ficha/i);
    expect(rotuloPendencia('sem_gaveta', 3)).toMatch(/gaveta/i);
  });
});
