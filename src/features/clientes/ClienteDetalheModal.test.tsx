// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ClienteDetalheModal } from './ClienteDetalheModal';

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
  // StatusBadge agora usa o primitivo RollingText do animate-ui, que chama
  // useInView internamente (via useIsInView) — sem isso o mock incompleto de
  // motion/react derruba qualquer teste que renderize um StatusBadge.
  useInView: () => false,
}));

const baseProps = {
  aberto: true,
  onFechar: vi.fn(),
  onEditar: vi.fn(),
  onAlternarAtivo: vi.fn(),
  onAlternarBanido: vi.fn(),
  cliente: {
    id: '1',
    nome: 'João Silva',
    telefone: '11999990000',
    documento: '12345678900',
    data_nascimento: null,
    origem: null,
    preferencia_contato: null,
    tags: [],
    observacoes: '',
    cidade: 'São Paulo',
    estado: null,
    criado_em: '2024-01-01',
    atualizado_em: '2024-01-01',
    ativo: true,
    banido: false,
    pecas_procuradas: [],
    notas: [],
    comprovantes_pix: [],
    motos: [],
  },
  historico: {
    totalGasto: 5000,
    ticketMedio: 250,
    diasDesdeUltimaCompra: 10,
    quantidadeCompras: 20,
    vendas: [
      { id: 'v1', data: '2024-06-01', nome_item: 'Carenagem CG', valor_total: 250 },
      { id: 'v2', data: '2024-07-01', nome_item: 'Farol YBR', valor_total: 180 },
    ],
    orcamentosAbertos: [],
  },
  segmentoLabel: 'Campeão',
  segmentoTom: 'accent' as const,
  badges: [],
  tarefas: [],
  formatTelefoneBR: (t: string) => t,
  formatDocumentoBR: (d: string) => d,
  linkWhatsapp: (tel: string | null | undefined) => tel ? `https://wa.me/${tel}` : null,
  opcoesCategoria: [],
  opcoesModelo: [],
};

describe('ClienteDetalheModal', () => {
  afterEach(() => cleanup());

  it('mostra stat cards com valor mais forte que label', () => {
    render(<ClienteDetalheModal {...baseProps} />);

    const statEls = document.querySelectorAll('[data-stat-value]');
    expect(statEls.length).toBeGreaterThanOrEqual(3);

    statEls.forEach((el) => {
      expect(el.className).toMatch(/font-bold|font-semibold/);
    });
  });

  it('mostra badge de segmentação correto', () => {
    render(<ClienteDetalheModal {...baseProps} segmentoLabel="Campeão" segmentoTom="accent" />);

    const badge = document.querySelector('[data-segmento-badge]');
    expect(badge).not.toBeNull();
    // StatusBadge agora renderiza o texto via RollingText (animate-ui), que
    // duplica cada caractere em spans aria-hidden (efeito de flip) e só
    // repete o texto exato, sem duplicação, num <span class="sr-only"> pro
    // leitor de tela — por isso o textContent bruto não é mais igual ao
    // label 1:1; `toContain` continua verificando que o texto certo está lá.
    expect(badge!.textContent).toContain('Campeão');
  });

  it('botões de ação presentes (Editar, WhatsApp, Desativar)', () => {
    render(<ClienteDetalheModal {...baseProps} />);

    const buttons = Array.from(document.querySelectorAll('button'));
    const buttonTexts = buttons.map((b) => b.textContent?.trim());

    expect(buttonTexts.some((t) => t?.includes('Editar'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('WhatsApp'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('Desativar'))).toBe(true);
  });
});
