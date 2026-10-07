// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClientesMapa } from './ClientesMapa';
import type { ClienteOperacaoListaItem, SituacaoCliente } from '../operacaoTypes';
import estados from './brasil-estados.geo.json';
import centroides from './municipios-centroides.json';

function cliente(id: string, nome: string, cidade: string | null, estado: string | null): ClienteOperacaoListaItem {
  return { id, nome, telefone: null, instagram_usuario: null, preferencia_contato: 'whatsapp', origem: 'balcao', cidade, estado, ativo: true, banido: false, criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z', motos: [], pedidos: [] };
}

const situacao: SituacaoCliente = { codigo: 'pedido_novo', rotulo: 'Pedido novo', nivel: 'informativo', proximaAcaoEm: null };
const situacaoCritica: SituacaoCliente = { codigo: 'promessa_vencida', rotulo: 'Promessa vencida', nivel: 'critico', proximaAcaoEm: '2026-10-06T12:00:00.000Z' };

describe('ClientesMapa', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('agrupa a cidade, informa cadastros sem cidade e abre seus clientes', () => {
    const onSelectCliente = vi.fn();
    render(<ClientesMapa itens={[cliente('a', 'Ana Souza', 'Juazeirinho', 'PB'), cliente('b', 'Bruno Lima', 'Juazeirinho', 'PB'), cliente('c', 'Caio', null, null)]} situacoesPorCliente={new Map([['a', situacao], ['b', situacao]])} onSelectCliente={onSelectCliente} />);

    const marcador = screen.getByRole('button', { name: /Juazeirinho, PB: 2 clientes/i });
    fireEvent.click(marcador);
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByText(/1 cliente sem cidade registrada/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ana Souza/i }));
    expect(onSelectCliente).toHaveBeenCalledWith('a');
  });

  it('permite abrir um marcador pelo teclado', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana Souza', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map([['a', situacao]])} onSelectCliente={() => {}} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Campina Grande, PB/i }), { key: 'Enter' });
    expect(screen.getByText('Ana Souza')).toBeTruthy();
  });

  it('mantém Parari e Soledade nas coordenadas geográficas exatas', () => {
    const itens = [cliente('parari', 'Cliente de Parari', 'Parari', 'PB'), cliente('soledade', 'Cliente de Soledade', 'Soledade', 'PB')];
    render(<ClientesMapa itens={itens} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);

    const pontos = estados.features.flatMap((feature) => {
      const geometria = feature.geometry;
      if (!geometria) return [];
      const coordenadas = geometria.coordinates as unknown as number[][][][];
      return (geometria.type === 'Polygon' ? coordenadas.flat(1) : coordenadas.flat(2)) as [number, number][];
    });
    const longitudes = pontos.map(([longitude]) => longitude);
    const latitudes = pontos.map(([, latitude]) => latitude);
    const longitudeMinima = Math.min(...longitudes);
    const longitudeMaxima = Math.max(...longitudes);
    const latitudeMinima = Math.min(...latitudes);
    const latitudeMaxima = Math.max(...latitudes);

    for (const cidade of ['Parari', 'Soledade'] as const) {
      const coordenada = centroides[`PB:${cidade.toLowerCase()}` as keyof typeof centroides];
      const marcador = screen.getByRole('button', { name: new RegExp(`${cidade}, PB`) });
      const foreignObject = marcador.parentElement;
      expect(foreignObject).not.toBeNull();
      const tamanhoAlvo = Number(foreignObject?.getAttribute('width'));
      const centroX = Number(foreignObject?.getAttribute('x')) + tamanhoAlvo / 2;
      const centroY = Number(foreignObject?.getAttribute('y')) + Number(foreignObject?.getAttribute('height')) / 2;
      const esperadoX = 24 + ((coordenada.longitude - longitudeMinima) / (longitudeMaxima - longitudeMinima)) * 512;
      const esperadoY = 24 + ((latitudeMaxima - coordenada.latitude) / (latitudeMaxima - latitudeMinima)) * 412;

      expect(centroX).toBeCloseTo(esperadoX, 2);
      expect(centroY).toBeCloseTo(esperadoY, 2);
    }
  });

  it('permite aproximar, afastar e redefinir o enquadramento por controles acessíveis', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB'), cliente('b', 'Bia', 'João Pessoa', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    const larguraInicial = Number(mapa.getAttribute('viewBox')?.split(' ')[2]);
    const marcador = screen.getByRole('button', { name: /Campina Grande, PB/i });
    const tamanhoPontoInicial = Number(marcador.querySelector('circle')?.getAttribute('r'));

    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }));
    const larguraAproximada = Number(mapa.getAttribute('viewBox')?.split(' ')[2]);
    expect(larguraAproximada).toBeLessThan(larguraInicial);
    expect(Number(marcador.querySelector('circle')?.getAttribute('r'))).toBeCloseTo(tamanhoPontoInicial);

    fireEvent.click(screen.getByRole('button', { name: 'Afastar mapa' }));
    expect(Number(mapa.getAttribute('viewBox')?.split(' ')[2])).toBeGreaterThan(larguraAproximada);
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir enquadramento' }));
    expect(mapa.getAttribute('viewBox')).toBe('0 0 560 460');
    expect(screen.getByRole('button', { name: 'Brasil inteiro' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }));
    const esquerdaInicial = Number(mapa.getAttribute('viewBox')?.split(' ')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Mover mapa para esquerda' }));
    expect(Number(mapa.getAttribute('viewBox')?.split(' ')[0])).not.toBe(esquerdaInicial);
  });

  it('abre enquadrado na Paraíba inteira, deixa estados vizinhos discretos e mantém cidades distantes na borda', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Juazeirinho', 'PB'), cliente('b', 'Bia', 'Manaus', 'AM')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    const [x, y, largura, altura] = (mapa.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const pb = mapa.querySelector('[data-state-code="25"]');
    const pontosEstado = [...(pb?.getAttribute('d')?.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g) ?? [])].map((ponto) => [Number(ponto[1]), Number(ponto[2])]);

    expect(largura).toBeLessThan(560);
    expect(pontosEstado.every(([px, py]) => px > x && px < x + largura && py > y && py < y + altura)).toBe(true);
    expect(pb).toBeTruthy();
    expect(pb?.getAttribute('class')).toContain('fill-surface-card');
    expect(mapa.querySelector('[data-state-code="23"]')?.getAttribute('class')).toContain('stroke-border-subtle');
    expect(screen.getByRole('button', { name: /Manaus, AM, fora da área visível/i })).toBeTruthy();

    const viewBoxRegional = mapa.getAttribute('viewBox');
    fireEvent.click(screen.getByRole('button', { name: 'Brasil inteiro' }));
    expect(mapa.getAttribute('viewBox')).toBe('0 0 560 460');
    expect(mapa.querySelector('[data-state-code="13"]')?.getAttribute('class')).toContain('stroke-border-default');
    fireEvent.click(screen.getByRole('button', { name: /Foco regional/i }));
    expect(mapa.getAttribute('viewBox')).toBe(viewBoxRegional);
  });

  it('mantém o tamanho físico dos pontos e tooltips estável ao mudar o zoom', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana Souza', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    const marcador = screen.getByRole('button', { name: /Campina Grande, PB/i });
    const areaAlvo = marcador.parentElement!;
    const larguraInicial = Number(areaAlvo.getAttribute('width'));
    const raioInicial = Number(marcador.querySelector('circle')?.getAttribute('r'));
    fireEvent.mouseEnter(marcador);
    const tooltip = mapa.querySelector('g.pointer-events-none rect')!;
    const larguraTooltipInicial = Number(tooltip.getAttribute('width'));
    const viewBoxInicial = Number(mapa.getAttribute('viewBox')?.split(' ')[2]);

    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }));
    const proporcaoViewBox = Number(mapa.getAttribute('viewBox')?.split(' ')[2]) / viewBoxInicial;
    expect(Number(areaAlvo.getAttribute('width'))).toBeCloseTo(larguraInicial * proporcaoViewBox, 3);
    expect(Number(marcador.querySelector('circle')?.getAttribute('r'))).toBeCloseTo(raioInicial, 3);
    expect(Number(tooltip.getAttribute('width'))).toBeCloseTo(larguraTooltipInicial * proporcaoViewBox, 3);
  });

  it('anima a troca entre a Paraíba e o Brasil e termina no enquadramento completo', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    let idFrame = 0;
    const quadros = new Map<number, FrameRequestCallback>();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++idFrame;
      quadros.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { quadros.delete(id); });
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    const larguraInicial = Number(mapa.getAttribute('viewBox')?.split(' ')[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Brasil inteiro' }));
    expect(Number(mapa.getAttribute('viewBox')?.split(' ')[2])).toBe(larguraInicial);

    const avancar = (tempo: number) => {
      const proximo = quadros.entries().next().value as [number, FrameRequestCallback] | undefined;
      expect(proximo).toBeTruthy();
      quadros.delete(proximo![0]);
      act(() => proximo![1](tempo));
    };
    avancar(0);
    avancar(160);
    const larguraIntermediaria = Number(mapa.getAttribute('viewBox')?.split(' ')[2]);
    expect(larguraIntermediaria).toBeGreaterThan(larguraInicial);
    expect(larguraIntermediaria).toBeLessThan(560);
    avancar(320);
    expect(mapa.getAttribute('viewBox')).toBe('0 0 560 460');
  });

  it('desloca a câmera ao arrastar o fundo do mapa sem reposicionar os pontos', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB'), cliente('b', 'Bia', 'João Pessoa', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    vi.spyOn(mapa, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 560, height: 460, right: 560, bottom: 460, x: 0, y: 0, toJSON: () => ({}) });
    const antes = Number(mapa.getAttribute('viewBox')?.split(' ')[0]);

    class PointerEventTestDouble extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
    }
    vi.stubGlobal('PointerEvent', PointerEventTestDouble);
    fireEvent.pointerDown(mapa, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerMove(mapa, { pointerId: 1, clientX: 160, clientY: 120 });
    fireEvent.pointerUp(mapa, { pointerId: 1 });

    expect(Number(mapa.getAttribute('viewBox')?.split(' ')[0])).not.toBe(antes);
  });

  it('indica cidades fora do enquadramento e centraliza a câmera ao acioná-las', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB'), cliente('b', 'Bia', 'Manaus', 'AM')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aproximar mapa' }));
    const indicador = screen.getByRole('button', { name: /Manaus, AM, fora da área visível/i });
    fireEvent.click(indicador);

    expect(screen.queryByRole('button', { name: /Manaus, AM, fora da área visível/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Manaus, AM: 1 cliente/i })).toBeTruthy();
  });

  it('oferece filtro, tooltip e seleção visual para os pontos operacionais', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana Souza', 'Juazeirinho', 'PB'), cliente('b', 'Bruno Lima', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map([['a', situacaoCritica], ['b', situacao]])} onSelectCliente={() => {}} />);

    const juazeirinho = screen.getByRole('button', { name: /Juazeirinho, PB: 1 cliente/i });
    expect(juazeirinho.getAttribute('aria-pressed')).toBe('false');
    fireEvent.mouseEnter(juazeirinho);
    expect(screen.getByRole('status').textContent).toMatch(/Juazeirinho, PB.*Promessa vencida/i);
    fireEvent.click(juazeirinho);
    expect(juazeirinho.getAttribute('aria-pressed')).toBe('true');

    fireEvent.pointerDown(screen.getByRole('button', { name: /Filtrar marcadores do mapa: Todos/i }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Críticos (1)' }));
    expect(document.querySelector('button[aria-label^="Juazeirinho, PB"]')).toBeTruthy();
    expect(document.querySelector('button[aria-label^="Campina Grande, PB"]')).toBeNull();
  });

  it('concentra os filtros em um menu animado sem afastar a escala do mapa', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    expect(screen.getByRole('button', { name: /Filtrar marcadores do mapa: Todos/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Escala do mapa' })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole('button', { name: /Filtrar marcadores do mapa: Todos/i }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('menuitem', { name: 'Todos (1)' })).toBeTruthy();
  });

  it('centraliza todos os controles de movimento e zoom no mesmo alvo quadrado', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    for (const nome of ['Mover mapa para cima', 'Mover mapa para baixo', 'Mover mapa para esquerda', 'Mover mapa para direita', 'Afastar mapa', 'Aproximar mapa', 'Redefinir enquadramento']) {
      const controle = screen.getByRole('button', { name: nome });
      expect(controle.className).toContain('inline-flex');
      expect(controle.className).toContain('items-center');
      expect(controle.className).toContain('justify-center');
      expect(controle.className).toContain('p-0');
    }
  });

  it('consome a roda do mouse ao aplicar zoom no mapa', () => {
    render(<ClientesMapa itens={[cliente('a', 'Ana', 'Campina Grande', 'PB')]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);
    const mapa = screen.getByRole('group', { name: 'Mapa de clientes por cidade' });
    vi.spyOn(mapa, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 560, height: 460, right: 560, bottom: 460, x: 0, y: 0, toJSON: () => ({}) });
    const evento = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 280, clientY: 230 });
    fireEvent(mapa, evento);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('substitui o mapa vazio por uma ação para os cadastros sem localização', () => {
    render(<ClientesMapa itens={[cliente('c', 'Caio', null, null)]} situacoesPorCliente={new Map()} onSelectCliente={() => {}} />);

    expect(screen.queryByRole('group', { name: /Mapa de clientes por cidade/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver 1 cliente sem localização' }));
    expect(screen.getByText('Caio')).toBeTruthy();
  });
});
