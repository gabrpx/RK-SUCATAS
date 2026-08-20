// @vitest-environment jsdom
//
// Cobre a migração da lista de Estoque pra TanStack Table + shadcn Table:
// ordenação por coluna (Peça/Valor/Qtd), todos os filtros existentes
// continuando a funcionar através da tabela nova, o filtro novo "Sem link
// ML", paginação, e o fluxo de editar/excluir uma peça pela linha. Seam:
// DOM renderizado por <EstoqueView /> via @testing-library/react, com
// useData/useCatalogos/./api mockados e os sub-modais pesados alheios à
// tabela (publicar ML, importar planilha, editor de anúncios ML) dublados.
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EstoqueView } from './EstoqueView';
import type { Estoque } from './types';
import type { Categoria, ModeloMoto } from '../../types/catalog';

const mockEstado = vi.hoisted(() => ({
  estoque: [] as Estoque[],
  loading: false,
  estoqueError: false,
  categorias: [] as Categoria[],
  modelos: [] as ModeloMoto[],
}));

vi.mock('./api', () => ({
  estoqueApi: {
    criar: vi.fn(),
    atualizar: vi.fn(),
    excluir: vi.fn(() => Promise.resolve({ success: true })),
  },
  uploadImagemEstoque: vi.fn(),
}));

vi.mock('../../context/DataContext', () => ({
  useData: () => {
    const [estoque, setEstoque] = React.useState<Estoque[]>(mockEstado.estoque);
    return {
      estoque,
      setEstoque,
      loading: mockEstado.loading,
      estoqueError: mockEstado.estoqueError,
      refreshData: vi.fn(),
    };
  },
}));

vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({
    categorias: mockEstado.categorias,
    modelos: mockEstado.modelos,
    criarCategoria: vi.fn(),
    criarNoMoto: vi.fn(),
  }),
}));

// Dublê simples (native <select>) pra dirigir o filtro de categoria/modelo
// sem depender da UI real de árvore/busca do TreeDropdown — essa lógica não
// muda nesta migração, só a tabela por baixo dela.
vi.mock('../../components/TreeDropdown', () => ({
  TreeDropdown: ({ value, onChange, nodes, emptyOption, searchPlaceholder }: any) => (
    <select data-testid={searchPlaceholder} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={emptyOption.value}>{emptyOption.label}</option>
      {nodes.map((n: any) => (
        <option key={n.id} value={n.id}>
          {n.nome}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('./EstoqueAnunciosMlEditor', () => ({ EstoqueAnunciosMlEditor: () => null }));
vi.mock('./EstoquePublicarMlModal', () => ({ EstoquePublicarMlModal: () => null }));
vi.mock('./ImportarPlanilhaModal', () => ({ ImportarPlanilhaModal: () => null }));

function criarItem(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'nome'>): Estoque {
  return {
    codigo: `RK-${overrides.id}`,
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
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  };
}

/** Ordem em que os nomes aparecem no texto do corpo da tabela — usado pra
 *  verificar ordenação sem depender de detalhe de markup (classe/estrutura). */
function ordemNaTabela(...nomes: string[]): boolean {
  const corpo = document.querySelector('[data-slot="table-body"]');
  const texto = corpo?.textContent ?? '';
  const indices = nomes.map((n) => texto.indexOf(n));
  if (indices.some((i) => i === -1)) return false;
  return indices.every((idx, i) => i === 0 || idx > indices[i - 1]);
}

/** Escopa queries só pro corpo da tabela "desktop" — o mesmo nome aparece de
 *  novo no card empilhado do fallback mobile (sempre no DOM, só escondido
 *  por classe `md:hidden`), então buscar no document inteiro dá "multiple
 *  elements" mesmo quando só existe 1 peça de verdade. */
function tabela() {
  return within(document.querySelector('[data-slot="table-body"]') as HTMLElement);
}

/** Os filtros (categoria/modelo/situação) agora vivem atrás do popover
 *  "Filtros" — abrir antes de interagir com qualquer um deles. */
function abrirFiltros() {
  fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
}

function limpar() {
  mockEstado.estoque = [];
  mockEstado.loading = false;
  mockEstado.estoqueError = false;
  mockEstado.categorias = [];
  mockEstado.modelos = [];
}

describe('EstoqueView — tabela (TanStack + shadcn)', () => {
  afterEach(() => {
    cleanup();
    limpar();
  });

  it('ordena por Peça (nome) ao clicar no cabeçalho: 1º clique ascendente, 2º descendente', () => {
    mockEstado.estoque = [
      criarItem({ id: 'a', nome: 'Zeta', criado_em: '2026-01-01T00:00:00.000Z' }),
      criarItem({ id: 'b', nome: 'Alfa', criado_em: '2026-02-01T00:00:00.000Z' }),
      criarItem({ id: 'c', nome: 'Meia', criado_em: '2026-03-01T00:00:00.000Z' }),
    ];

    render(<EstoqueView onSelectItem={() => {}} />);

    // Sem ordenação ativa, ordem padrão é por criado_em desc (mais recente primeiro).
    expect(ordemNaTabela('Meia', 'Alfa', 'Zeta')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Peça' }));
    expect(ordemNaTabela('Alfa', 'Meia', 'Zeta')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Peça' }));
    expect(ordemNaTabela('Zeta', 'Meia', 'Alfa')).toBe(true);
  });

  it('ordena por Valor ao clicar no cabeçalho: 1º clique descendente (maior preço primeiro), 2º ascendente', () => {
    mockEstado.estoque = [
      criarItem({ id: 'a', nome: 'Zeta', valor: 100 }),
      criarItem({ id: 'b', nome: 'Alfa', valor: 300 }),
      criarItem({ id: 'c', nome: 'Meia', valor: 200 }),
    ];

    render(<EstoqueView onSelectItem={() => {}} />);

    // Colunas numéricas ordenam descendente no 1º clique (TanStack detecta o
    // tipo do valor e usa esse default pra número — maior preço primeiro é o
    // que faz sentido pra quem cataloga estoque).
    fireEvent.click(screen.getByRole('button', { name: 'Valor' }));
    expect(ordemNaTabela('Alfa', 'Meia', 'Zeta')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Valor' }));
    expect(ordemNaTabela('Zeta', 'Meia', 'Alfa')).toBe(true);
  });

  it('ordena por Qtd ao clicar no cabeçalho: 1º clique descendente (mais em estoque primeiro), 2º ascendente', () => {
    mockEstado.estoque = [
      criarItem({ id: 'a', nome: 'Zeta', quantidade: 5 }),
      criarItem({ id: 'b', nome: 'Alfa', quantidade: 1 }),
      criarItem({ id: 'c', nome: 'Meia', quantidade: 10 }),
    ];

    render(<EstoqueView onSelectItem={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Qtd' }));
    expect(ordemNaTabela('Meia', 'Zeta', 'Alfa')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Qtd' }));
    expect(ordemNaTabela('Alfa', 'Zeta', 'Meia')).toBe(true);
  });

  it('filtro "Estoque baixo" mostra só peças com quantidade 1 ou 2', () => {
    mockEstado.estoque = [criarItem({ id: 'a', nome: 'Peça Baixa', quantidade: 1 }), criarItem({ id: 'b', nome: 'Peça Normal', quantidade: 10 })];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByText('Estoque baixo'));

    expect(tabela().queryByText('Peça Baixa')).not.toBeNull();
    expect(tabela().queryByText('Peça Normal')).toBeNull();
  });

  it('filtro "Sem preço" mostra só peças com valor zerado', () => {
    mockEstado.estoque = [criarItem({ id: 'a', nome: 'Peça Sem Preço', valor: 0 }), criarItem({ id: 'b', nome: 'Peça Com Preço', valor: 50 })];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByText('Sem preço'));

    expect(tabela().queryByText('Peça Sem Preço')).not.toBeNull();
    expect(tabela().queryByText('Peça Com Preço')).toBeNull();
  });

  it('filtro "Com avaria" mostra só peças com alguma unidade avariada e disponível', () => {
    mockEstado.estoque = [
      criarItem({ id: 'a', nome: 'Peça Avariada', unidades: [{ id: 'u1', avaria: true, vendida_em: null } as any] }),
      criarItem({ id: 'b', nome: 'Peça Intacta' }),
    ];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByText('Com avaria'));

    expect(tabela().queryByText('Peça Avariada')).not.toBeNull();
    expect(tabela().queryByText('Peça Intacta')).toBeNull();
  });

  it('filtro "Sem foto" mostra só peças sem nenhuma imagem', () => {
    mockEstado.estoque = [criarItem({ id: 'a', nome: 'Peça Sem Foto', imagens: [] }), criarItem({ id: 'b', nome: 'Peça Com Foto', imagens: ['https://x/a.jpg'] })];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByText('Sem foto'));

    expect(tabela().queryByText('Peça Sem Foto')).not.toBeNull();
    expect(tabela().queryByText('Peça Com Foto')).toBeNull();
  });

  it('filtro novo "Sem link ML" mostra só peças sem nenhum anúncio vinculado (links_ml vazio)', () => {
    mockEstado.estoque = [
      criarItem({ id: 'a', nome: 'Peça Sem ML', links_ml: [] }),
      criarItem({ id: 'b', nome: 'Peça Com ML', links_ml: [{ id: 'l1', item_id_ml: 'MLB1', url: 'https://ml/1' } as any] }),
    ];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByText('Sem link ML'));

    expect(tabela().queryByText('Peça Sem ML')).not.toBeNull();
    expect(tabela().queryByText('Peça Com ML')).toBeNull();
  });

  it('filtro de categoria restringe às peças da categoria (e subcategorias) selecionada', () => {
    mockEstado.categorias = [{ id: 'cat-farol', nome: 'Farol', parent_id: null, ordem: 0 }];
    mockEstado.estoque = [criarItem({ id: 'a', nome: 'Peça Farol', categoria_id: 'cat-farol' }), criarItem({ id: 'b', nome: 'Peça Outra', categoria_id: null })];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.change(screen.getByTestId('Buscar categoria...'), { target: { value: 'cat-farol' } });

    expect(tabela().queryByText('Peça Farol')).not.toBeNull();
    expect(tabela().queryByText('Peça Outra')).toBeNull();
  });

  it('filtro de modelo de moto restringe às peças do modelo (e sub-modelos) selecionado', () => {
    mockEstado.modelos = [{ id: 'moto-cg', nome: 'CG 150', parent_id: null, ordem: 0, ano: null, imagem_url: null }];
    mockEstado.estoque = [criarItem({ id: 'a', nome: 'Peça CG', modelo_moto_id: 'moto-cg' }), criarItem({ id: 'b', nome: 'Peça Outra', modelo_moto_id: null })];

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.change(screen.getByTestId('Buscar moto...'), { target: { value: 'moto-cg' } });

    expect(tabela().queryByText('Peça CG')).not.toBeNull();
    expect(tabela().queryByText('Peça Outra')).toBeNull();
  });

  it('pagina quando há mais de 25 itens filtrados, com navegação pra próxima página', () => {
    mockEstado.estoque = Array.from({ length: 30 }, (_, i) =>
      criarItem({ id: `p${i}`, nome: `Peça ${String(i).padStart(2, '0')}`, criado_em: new Date(2026, 0, i + 1).toISOString() })
    );

    render(<EstoqueView onSelectItem={() => {}} />);

    // Ordem padrão: criado_em desc -> "Peça 29" (mais recente) na primeira página.
    expect(tabela().queryByText('Peça 29')).not.toBeNull();
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    // Os 5 itens mais antigos (Peça 00..Peça 04) ficam só na 2ª página.
    expect(tabela().queryByText('Peça 00')).toBeNull();

    fireEvent.click(screen.getByLabelText('Próxima página'));

    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(tabela().queryByText('Peça 00')).not.toBeNull();
    expect(tabela().queryByText('Peça 29')).toBeNull();
  });

  it('reseta pra página 1 ao aplicar um filtro enquanto estava na página 2', () => {
    mockEstado.estoque = Array.from({ length: 30 }, (_, i) => criarItem({ id: `p${i}`, nome: `Peça ${String(i).padStart(2, '0')}` }));

    render(<EstoqueView onSelectItem={() => {}} />);
    abrirFiltros();
    fireEvent.click(screen.getByLabelText('Próxima página'));
    expect(screen.getByText('Página 2 de 2')).toBeTruthy();

    fireEvent.click(screen.getByText('Sem foto'));

    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });

  it('clicar numa linha chama onSelectItem com a peça correspondente', () => {
    const item = criarItem({ id: 'a', nome: 'Peça Clicável' });
    mockEstado.estoque = [item];
    const onSelectItem = vi.fn();

    render(<EstoqueView onSelectItem={onSelectItem} />);
    fireEvent.click(tabela().getByText('Peça Clicável'));

    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  // Regressão: o chevron de expandir mora DENTRO da linha, que por sua vez tem
  // onClick={() => onSelectItem(item)}. Sem stopPropagation no botão, abrir os
  // detalhes inline abriria o DetailModal por cima — que é exatamente o que o
  // painel expandido existe pra evitar. Duas variantes do mesmo bug de
  // propagação já apareceram nesta branch (popover e trigger mobile), então
  // este caminho fica coberto explicitamente.
  it('clicar no chevron expande a linha sem abrir o DetailModal', () => {
    const item = criarItem({ id: 'a', nome: 'Peça Expansível' });
    mockEstado.estoque = [item];
    const onSelectItem = vi.fn();

    render(<EstoqueView onSelectItem={onSelectItem} />);
    const chevron = tabela().getByRole('button', { name: 'Ver mais detalhes' });
    expect(chevron.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(chevron);

    expect(onSelectItem).not.toHaveBeenCalled();
    expect(tabela().getByRole('button', { name: 'Recolher detalhes' }).getAttribute('aria-expanded')).toBe('true');
    // O painel só renderiza quando aberto — "Categoria completa" é rótulo dele.
    expect(tabela().queryByText('Categoria completa')).not.toBeNull();
  });

  it('com a linha já expandida, clicar no corpo da linha ainda abre o DetailModal', () => {
    const item = criarItem({ id: 'a', nome: 'Peça Expansível' });
    mockEstado.estoque = [item];
    const onSelectItem = vi.fn();

    render(<EstoqueView onSelectItem={onSelectItem} />);
    fireEvent.click(tabela().getByRole('button', { name: 'Ver mais detalhes' }));
    fireEvent.click(tabela().getByText('Peça Expansível'));

    expect(onSelectItem).toHaveBeenCalledWith(item);
  });

  it('ação de editar registrada via onRegisterActions abre o modal preenchido com os dados da peça', () => {
    const item = criarItem({ id: 'a', nome: 'Peça Editável', valor: 250 });
    mockEstado.estoque = [item];
    let acoes: { edit: (item: Estoque) => void; delete: (id: string) => void } | null = null;

    render(<EstoqueView onSelectItem={() => {}} onRegisterActions={(a) => (acoes = a)} />);
    act(() => acoes!.edit(item));

    expect((screen.getByDisplayValue('Peça Editável') as HTMLInputElement).value).toBe('Peça Editável');
  });

  it('ação de excluir registrada via onRegisterActions abre confirmação e, ao confirmar, remove a peça da tabela na hora (com desfazer)', () => {
    const item = criarItem({ id: 'a', nome: 'Peça a Excluir' });
    mockEstado.estoque = [item];
    let acoes: { edit: (item: Estoque) => void; delete: (id: string) => void } | null = null;

    render(<EstoqueView onSelectItem={() => {}} onRegisterActions={(a) => (acoes = a)} />);
    expect(tabela().queryByText('Peça a Excluir')).not.toBeNull();

    // delete(id) só abre a confirmação — a peça continua na tabela até confirmar.
    act(() => acoes!.delete('a'));
    expect(tabela().queryByText('Peça a Excluir')).not.toBeNull();

    fireEvent.click(screen.getByText('Excluir'));

    expect(tabela().queryByText('Peça a Excluir')).toBeNull();
  });
});
