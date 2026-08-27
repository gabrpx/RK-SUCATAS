// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const C = (props: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
        const Tag = tag as any;
        return <Tag {...rest} />;
      };
      C.displayName = `motion.${tag}`;
      return C;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    vendas: [],
    fiadoRecebimentos: [],
    caixaPendencias: [],
    caixaPendenciaRecebimentos: [],
    loading: false,
    refreshData: vi.fn(),
  }),
}));
vi.mock('../../hooks/usePermissao', () => ({
  usePermissao: () => ({ pode: () => true }),
}));
vi.mock('../../hooks/useCatalogos', () => ({
  useCatalogos: () => ({ formasPagamento: [], modelos: [], categorias: [] }),
}));
vi.mock('./api', () => ({
  caixaPendenciasApi: {},
  cobrancasApi: { listar: vi.fn().mockResolvedValue({ success: true, data: [] }) },
  anexarBoletoCobranca: vi.fn(),
}));
vi.mock('../fiado/api', () => ({ fiadoApi: {} }));
vi.mock('../fiado/metricas', () => ({ vendasFiadoEmAberto: () => [] }));
vi.mock('../../utils/whatsapp', () => ({ linkWhatsapp: () => null }));

import { CardPendencia } from './PendenciasUnificadasTab';

function CardPendenciaTestable({ item }: { item: any }) {
  return <CardPendencia item={item} onAtualizarCobranca={() => {}} />;
}

describe('PendenciasUnificadasTab — CardPendencia', () => {
  afterEach(() => cleanup());

  const baseItem = {
    id: 'fiado-1',
    tipo: 'fiado' as const,
    descricao: 'Carenagem CG 160',
    clienteNome: 'João Silva',
    clienteTelefone: '11999990000',
    data: '2024-01-01',
    saldo: 350,
    diasEmAberto: 45,
    vendaId: 'v1',
  };

  it('badge "Atrasado" usa tom danger para 30d+', () => {
    render(<CardPendenciaTestable item={{ ...baseItem, diasEmAberto: 45 }} />);
    const badge = document.querySelector('[data-pendencia-status]');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('data-pendencia-status')).toBe('danger');
    expect(badge!.textContent).toMatch(/atrasado/i);
  });

  it('badge "Vence em breve" usa tom warning para 15–29d', () => {
    render(<CardPendenciaTestable item={{ ...baseItem, diasEmAberto: 20 }} />);
    const badge = document.querySelector('[data-pendencia-status]');
    expect(badge!.getAttribute('data-pendencia-status')).toBe('warning');
  });

  it('badge "Em dia" usa tom positive para <15d', () => {
    render(<CardPendenciaTestable item={{ ...baseItem, diasEmAberto: 5 }} />);
    const badge = document.querySelector('[data-pendencia-status]');
    expect(badge!.getAttribute('data-pendencia-status')).toBe('positive');
  });

  it('valor R$ é visualmente mais forte que o nome do cliente', () => {
    render(<CardPendenciaTestable item={baseItem} />);
    const valorEl = document.querySelector('[data-pendencia-valor]');
    const nomeEl = document.querySelector('[data-pendencia-cliente]');
    expect(valorEl).not.toBeNull();
    expect(nomeEl).not.toBeNull();
    expect(valorEl!.className).toMatch(/font-bold/);
    expect(nomeEl!.className).not.toMatch(/font-bold/);
  });

  it('card expõe botão de ação concreta "Cobrar"', () => {
    render(<CardPendenciaTestable item={baseItem} />);
    const buttons = Array.from(document.querySelectorAll('button'));
    const cobrarBtn = buttons.find((b) => b.textContent?.match(/cobrar/i));
    expect(cobrarBtn).toBeTruthy();
  });
});
