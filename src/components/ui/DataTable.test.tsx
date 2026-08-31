// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

afterEach(() => {
  cleanup();
});

interface Item {
  id: number;
  nome: string;
}

const dados: Item[] = [
  { id: 1, nome: 'Item A' },
  { id: 2, nome: 'Item B' },
];

const colunas: DataTableColumn<Item>[] = [
  { key: 'nome', header: 'Nome', render: (item) => item.nome },
];

describe('<DataTable>', () => {
  it('renderiza linhas e cabeçalho normalmente (baseline)', () => {
    render(
      <DataTable
        colunas={colunas}
        dados={dados}
        getRowKey={(item) => item.id}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
      />
    );
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
  });

  it('não aplica classes sticky no thead quando stickyHeader está ausente', () => {
    render(
      <DataTable
        colunas={colunas}
        dados={dados}
        getRowKey={(item) => item.id}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
      />
    );
    const thead = screen.getByText('Nome').closest('thead');
    expect(thead).not.toHaveClass('sticky');
  });

  it('aplica sticky top-0 bg-surface-card no thead quando stickyHeader=true', () => {
    render(
      <DataTable
        colunas={colunas}
        dados={dados}
        getRowKey={(item) => item.id}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
        stickyHeader
      />
    );
    const thead = screen.getByText('Nome').closest('thead');
    expect(thead).toHaveClass('sticky', 'top-0', 'bg-surface-card', 'z-10');
  });
});
