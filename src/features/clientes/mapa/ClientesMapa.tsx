import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Crosshair, ListFilter, MapPinOff, Minus, Plus, RotateCcw } from 'lucide-react';
import { CIDADE_ORIGEM_LOJA, ESTADO_ORIGEM_LOJA, NOME_LOJA } from '../../../constants/loja';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import estados from './brasil-estados.geo.json';
import centroides from './municipios-centroides.json';
import { agruparClientesPorCidade, normalizarChaveCidade, tomDaSituacao } from './mapaModel';
import type { GrupoCidadeClientes } from './mapaModel';
import type { ClienteOperacaoListaItem, SituacaoCliente, SituacaoClienteNivel } from '../operacaoTypes';

interface ClientesMapaProps {
  itens: ClienteOperacaoListaItem[];
  situacoesPorCliente: ReadonlyMap<string, SituacaoCliente>;
  onSelectCliente: (clienteId: string) => void;
}

type Posicao = [number, number];
type Geometria = { type: 'Polygon'; coordinates: Posicao[][] } | { type: 'MultiPolygon'; coordinates: Posicao[][][] };
type Feature = { properties: { codarea: string | number }; geometry: Geometria | null };
type FiltroMapa = 'todos' | 'critico' | 'atencao' | 'informativo';
type VisaoMapa = 'foco' | 'brasil';
type GrupoComCoordenada = GrupoCidadeClientes & { coordenada: { longitude: number; latitude: number } };
type Marcador = GrupoComCoordenada & { x: number; y: number };
type Viewport = { x: number; y: number; largura: number; altura: number };
type MarcadorNaBorda = Marcador & { indicadorX: number; indicadorY: number; seta: '↑' | '→' | '↓' | '←' };
const FEATURES_ESTADOS = estados.features as unknown as Feature[];

const TAMANHO = { largura: 560, altura: 460, margem: 24 };
const TOM_MARCADOR = {
  danger: 'fill-danger stroke-danger-bg',
  warning: 'fill-warning stroke-warning-bg',
  accent: 'fill-accent stroke-accent-soft-bg',
  muted: 'fill-text-faint stroke-surface-card',
} as const;

const FILTROS: Array<{ chave: FiltroMapa; rotulo: string; nivel?: SituacaoClienteNivel }> = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'critico', rotulo: 'Críticos', nivel: 'critico' },
  { chave: 'atencao', rotulo: 'Atenção', nivel: 'atencao' },
  { chave: 'informativo', rotulo: 'Acompanhar', nivel: 'informativo' },
];

const CLASSE_CONTROLE_MAPA = 'inline-flex size-9 items-center justify-center rounded-control border border-border-default bg-surface-card p-0 text-text-secondary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';

function todosOsPontos(geometria: Geometria | null): Posicao[] {
  if (!geometria) return [];
  return geometria.type === 'Polygon' ? geometria.coordinates.flat() : geometria.coordinates.flat(2);
}

const limites = FEATURES_ESTADOS.flatMap((feature) => todosOsPontos(feature.geometry)).reduce((atual, [longitude, latitude]) => ({
  minLongitude: Math.min(atual.minLongitude, longitude),
  maxLongitude: Math.max(atual.maxLongitude, longitude),
  minLatitude: Math.min(atual.minLatitude, latitude),
  maxLatitude: Math.max(atual.maxLatitude, latitude),
}), { minLongitude: Infinity, maxLongitude: -Infinity, minLatitude: Infinity, maxLatitude: -Infinity });

function projetar(longitude: number, latitude: number): Posicao {
  const larguraInterna = TAMANHO.largura - TAMANHO.margem * 2;
  const alturaInterna = TAMANHO.altura - TAMANHO.margem * 2;
  return [
    TAMANHO.margem + ((longitude - limites.minLongitude) / (limites.maxLongitude - limites.minLongitude)) * larguraInterna,
    TAMANHO.margem + ((limites.maxLatitude - latitude) / (limites.maxLatitude - limites.minLatitude)) * alturaInterna,
  ];
}

function caminho(geometria: Geometria | null): string {
  if (!geometria) return '';
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  return poligonos.flatMap((poligono) => poligono).map((anel) => anel.map(([longitude, latitude], indice) => {
    const [x, y] = projetar(longitude, latitude);
    return `${indice === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z').join(' ');
}

const CODIGO_PARAIBA = '25';
const CAMINHOS_ESTADOS = FEATURES_ESTADOS.map((feature) => ({
  codigo: String(feature.properties.codarea),
  d: caminho(feature.geometry),
}));

function pluralizar(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`;
}

function posicionarMarcadores(grupos: GrupoComCoordenada[]): Marcador[] {
  return grupos.map((grupo) => {
    const [x, y] = projetar(grupo.coordenada.longitude, grupo.coordenada.latitude);
    return { ...grupo, x, y };
  });
}

function viewportFoco(): Viewport {
  const paraiba = FEATURES_ESTADOS.find((feature) => String(feature.properties.codarea) === CODIGO_PARAIBA);
  const pontos = paraiba ? todosOsPontos(paraiba.geometry).map(([longitude, latitude]) => projetar(longitude, latitude)) : [];
  if (pontos.length === 0) return { x: 0, y: 0, largura: TAMANHO.largura, altura: TAMANHO.altura };
  const margem = 14;
  const xs = pontos.map(([x]) => x);
  const ys = pontos.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const largura = Math.min(TAMANHO.largura, Math.max(...xs) - minX + margem * 2);
  const altura = Math.min(TAMANHO.altura, Math.max(...ys) - minY + margem * 2);
  return {
    x: Math.max(0, Math.min(TAMANHO.largura - largura, minX - margem)),
    y: Math.max(0, Math.min(TAMANHO.altura - altura, minY - margem)),
    largura,
    altura,
  };
}

const VIEWPORT_PARAIBA = viewportFoco();
const VIEWPORT_BRASIL: Viewport = { x: 0, y: 0, largura: TAMANHO.largura, altura: TAMANHO.altura };

function serializarViewport(viewport: Viewport): string {
  return `${viewport.x} ${viewport.y} ${viewport.largura} ${viewport.altura}`;
}

function marcadoresNaBorda(marcadores: Marcador[], viewport: Viewport, escalaZoom: number): MarcadorNaBorda[] {
  const centroX = viewport.x + viewport.largura / 2;
  const centroY = viewport.y + viewport.altura / 2;
  const margem = 18 / escalaZoom;
  const esquerda = viewport.x + margem;
  const direita = viewport.x + viewport.largura - margem;
  const topo = viewport.y + margem;
  const base = viewport.y + viewport.altura - margem;

  return marcadores.flatMap((marcador) => {
    if (marcador.x >= esquerda && marcador.x <= direita && marcador.y >= topo && marcador.y <= base) return [];
    const dx = marcador.x - centroX;
    const dy = marcador.y - centroY;
    const fatorX = dx > 0 ? (direita - centroX) / dx : dx < 0 ? (esquerda - centroX) / dx : Infinity;
    const fatorY = dy > 0 ? (base - centroY) / dy : dy < 0 ? (topo - centroY) / dy : Infinity;
    const fator = Math.min(fatorX > 0 ? fatorX : Infinity, fatorY > 0 ? fatorY : Infinity, 1);
    const seta = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? '→' : '←') : (dy >= 0 ? '↓' : '↑');
    return [{ ...marcador, indicadorX: centroX + dx * fator, indicadorY: centroY + dy * fator, seta }];
  });
}

export function ClientesMapa({ itens, situacoesPorCliente, onSelectCliente }: ClientesMapaProps) {
  const [chaveAtiva, setChaveAtiva] = useState<string | null>(null);
  const [chaveEmFoco, setChaveEmFoco] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroMapa>('todos');
  const [visao, setVisao] = useState<VisaoMapa>('foco');
  const [camera, setCamera] = useState<Viewport | null>(null);
  const quadroAnimacao = useRef<number | null>(null);
  const mapaRef = useRef<SVGSVGElement>(null);
  const arraste = useRef<{ pointerId: number; x: number; y: number; camera: Viewport; larguraTela: number; alturaTela: number } | null>(null);
  const [mostrarSemLocalizacao, setMostrarSemLocalizacao] = useState(false);
  const distribuicao = useMemo(() => agruparClientesPorCidade(itens, situacoesPorCliente), [itens, situacoesPorCliente]);
  const gruposComCoordenada: GrupoComCoordenada[] = distribuicao.grupos.flatMap((grupo) => {
    const coordenada = centroides[grupo.chave as keyof typeof centroides];
    return coordenada ? [{ ...grupo, coordenada }] : [];
  });
  const gruposSemCoordenada = distribuicao.grupos.filter((grupo) => !centroides[grupo.chave as keyof typeof centroides]);
  const semLocalizacao = [...distribuicao.semLocalizacao, ...gruposSemCoordenada.flatMap((grupo) => grupo.clientes)];
  const gruposFiltrados = gruposComCoordenada.filter((grupo) => filtro === 'todos' || grupo.situacao.nivel === filtro);
  const marcadores = posicionarMarcadores(gruposFiltrados);
  const viewportBase = visao === 'foco' ? VIEWPORT_PARAIBA : VIEWPORT_BRASIL;
  const viewportAtual = camera ?? viewportBase;
  const escalaZoom = TAMANHO.largura / viewportAtual.largura;
  const margemMarcador = 18 / escalaZoom;
  const marcadoresNaVisao = marcadores.filter((marcador) => marcador.x >= viewportAtual.x + margemMarcador && marcador.x <= viewportAtual.x + viewportAtual.largura - margemMarcador && marcador.y >= viewportAtual.y + margemMarcador && marcador.y <= viewportAtual.y + viewportAtual.altura - margemMarcador);
  const marcadoresForaDaVisao = marcadoresNaBorda(marcadores, viewportAtual, escalaZoom);
  const grupoAtivo = gruposComCoordenada.find((grupo) => grupo.chave === chaveAtiva) ?? null;
  const grupoTooltip = gruposComCoordenada.find((grupo) => grupo.chave === chaveEmFoco) ?? grupoAtivo;
  const chaveLoja = normalizarChaveCidade(CIDADE_ORIGEM_LOJA, ESTADO_ORIGEM_LOJA);
  const coordenadaLoja = chaveLoja ? centroides[chaveLoja as keyof typeof centroides] : null;
  const totalNoRadar = gruposComCoordenada.reduce((total, grupo) => total + grupo.clientes.length, 0);
  const tooltipMarcador = marcadores.find((marcador) => marcador.chave === grupoTooltip?.chave);
  const tooltipLargura = Math.max(0, Math.min(128 / escalaZoom, viewportAtual.largura - 12 / escalaZoom));
  const tooltipMargem = 6 / escalaZoom;
  const tooltipDeslocamentoY = 49 / escalaZoom;
  const tooltipX = tooltipMarcador ? Math.max(viewportAtual.x + tooltipLargura / 2 + tooltipMargem, Math.min(viewportAtual.x + viewportAtual.largura - tooltipLargura / 2 - tooltipMargem, tooltipMarcador.x)) : 0;
  const tooltipY = tooltipMarcador ? Math.max(viewportAtual.y + tooltipDeslocamentoY, Math.min(viewportAtual.y + viewportAtual.altura - 7 / escalaZoom, tooltipMarcador.y)) : 0;

  const selecionarMarcador = (chave: string) => {
    setChaveAtiva(chave);
    setChaveEmFoco(chave);
  };

  const aplicarZoom = (fator: number, centroX = viewportAtual.x + viewportAtual.largura / 2, centroY = viewportAtual.y + viewportAtual.altura / 2) => {
    const largura = Math.max(70, Math.min(TAMANHO.largura, viewportAtual.largura * fator));
    const altura = Math.max(70, Math.min(TAMANHO.altura, viewportAtual.altura * fator));
    const proporcaoX = (centroX - viewportAtual.x) / viewportAtual.largura;
    const proporcaoY = (centroY - viewportAtual.y) / viewportAtual.altura;
    setCamera({
      largura,
      altura,
      x: Math.max(0, Math.min(TAMANHO.largura - largura, centroX - proporcaoX * largura)),
      y: Math.max(0, Math.min(TAMANHO.altura - altura, centroY - proporcaoY * altura)),
    });
  };

  const moverCamera = (horizontal: -1 | 0 | 1, vertical: -1 | 0 | 1) => setCamera({
    ...viewportAtual,
    x: Math.max(0, Math.min(TAMANHO.largura - viewportAtual.largura, viewportAtual.x + horizontal * viewportAtual.largura * 0.2)),
    y: Math.max(0, Math.min(TAMANHO.altura - viewportAtual.altura, viewportAtual.y + vertical * viewportAtual.altura * 0.2)),
  });

  const trocarVisao = (proximaVisao: VisaoMapa) => {
    if (quadroAnimacao.current !== null) cancelAnimationFrame(quadroAnimacao.current);
    const origem = viewportAtual;
    const destino = proximaVisao === 'foco' ? VIEWPORT_PARAIBA : VIEWPORT_BRASIL;
    setVisao(proximaVisao);
    const movimentoReduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (movimentoReduzido) {
      setCamera(null);
      return;
    }

    let inicio: number | null = null;
    const duracao = 320;
    setCamera(origem);
    const animar = (agora: number) => {
      if (inicio === null) inicio = agora;
      const progresso = Math.min(1, (agora - inicio) / duracao);
      const easing = progresso < 0.5 ? 4 * progresso ** 3 : 1 - ((-2 * progresso + 2) ** 3) / 2;
      setCamera({
        x: origem.x + (destino.x - origem.x) * easing,
        y: origem.y + (destino.y - origem.y) * easing,
        largura: origem.largura + (destino.largura - origem.largura) * easing,
        altura: origem.altura + (destino.altura - origem.altura) * easing,
      });
      if (progresso < 1) quadroAnimacao.current = requestAnimationFrame(animar);
      else {
        quadroAnimacao.current = null;
        setCamera(null);
      }
    };
    quadroAnimacao.current = requestAnimationFrame(animar);
  };

  useEffect(() => () => {
    if (quadroAnimacao.current !== null) cancelAnimationFrame(quadroAnimacao.current);
  }, []);

  const centralizarMarcador = (marcador: Marcador) => {
    selecionarMarcador(marcador.chave);
    setCamera({
      ...viewportAtual,
      x: Math.max(0, Math.min(TAMANHO.largura - viewportAtual.largura, marcador.x - viewportAtual.largura / 2)),
      y: Math.max(0, Math.min(TAMANHO.altura - viewportAtual.altura, marcador.y - viewportAtual.altura / 2)),
    });
  };

  const iniciarArrasteBase = (alvo: Element, clientX: number, clientY: number, pointerId: number, larguraTela: number, alturaTela: number) => {
    if (alvo.closest('button')) return;
    arraste.current = { pointerId, x: clientX, y: clientY, camera: viewportAtual, larguraTela, alturaTela };
  };

  const iniciarArraste = (evento: ReactPointerEvent<SVGSVGElement>) => {
    const retangulo = evento.currentTarget.getBoundingClientRect();
    iniciarArrasteBase(evento.target as Element, evento.clientX, evento.clientY, evento.pointerId, retangulo.width, retangulo.height);
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
  };

  const moverMapaBase = (clientX: number, clientY: number, pointerId: number) => {
    const inicio = arraste.current;
    if (!inicio || inicio.pointerId !== pointerId) return;
    const x = inicio.camera.x - (clientX - inicio.x) * inicio.camera.largura / Math.max(1, inicio.larguraTela);
    const y = inicio.camera.y - (clientY - inicio.y) * inicio.camera.altura / Math.max(1, inicio.alturaTela);
    setCamera({ ...inicio.camera, x: Math.max(0, Math.min(TAMANHO.largura - inicio.camera.largura, x)), y: Math.max(0, Math.min(TAMANHO.altura - inicio.camera.altura, y)) });
  };

  const moverMapa = (evento: ReactPointerEvent<SVGSVGElement>) => moverMapaBase(evento.clientX, evento.clientY, evento.pointerId);

  const abrirCliente = (clienteId: string) => onSelectCliente(clienteId);
  const aplicarFiltro = (proximoFiltro: FiltroMapa) => {
    setFiltro(proximoFiltro);
    setCamera(null);
    setChaveAtiva(null);
    setChaveEmFoco(null);
  };

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const zoomComRoda = (evento: WheelEvent) => {
      evento.preventDefault();
      const retangulo = mapa.getBoundingClientRect();
      const fator = evento.deltaY < 0 ? 0.85 : 1.18;
      aplicarZoom(fator, viewportAtual.x + (evento.clientX - retangulo.left) / Math.max(1, retangulo.width) * viewportAtual.largura, viewportAtual.y + (evento.clientY - retangulo.top) / Math.max(1, retangulo.height) * viewportAtual.altura);
    };
    mapa.addEventListener('wheel', zoomComRoda, { passive: false });
    return () => mapa.removeEventListener('wheel', zoomComRoda);
  }, [viewportAtual]);
  const filtroSelecionado = FILTROS.find((item) => item.chave === filtro)!;
  const mapaExpandido = Boolean(grupoAtivo || mostrarSemLocalizacao);

  return (
    <section aria-labelledby="mapa-clientes-title" className={`overflow-hidden rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)] ${mapaExpandido ? 'lg:h-auto' : 'lg:flex lg:h-[512px] lg:flex-col'}`}>
      <div className="border-b border-border-default px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mapa-clientes-title" className="text-lg font-semibold tracking-tight text-text-primary">Clientes por cidade</h2>
          <p className="shrink-0 text-xs text-text-muted">{gruposComCoordenada.length} cidades · {totalNoRadar} clientes</p>
        </div>
      </div>

      {gruposComCoordenada.length > 0 ? <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-3 sm:px-5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Filtrar marcadores do mapa: ${filtroSelecionado.rotulo}`} className="inline-flex min-h-9 items-center gap-2 rounded-control border border-border-default bg-surface-card px-2.5 text-xs font-medium text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
                <ListFilter aria-hidden="true" size={14} />
                <span>Filtros</span>
                <span className="text-text-muted">{filtroSelecionado.rotulo}</span>
                <ChevronDown aria-hidden="true" size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 !border-slate-200 !bg-white !text-slate-900 !shadow-lg !backdrop-blur-none">
              <DropdownMenuLabel className="!text-slate-500">Filtrar marcadores</DropdownMenuLabel>
              <DropdownMenuSeparator className="!bg-slate-200" />
              {FILTROS.map((item) => {
                const total = item.nivel ? gruposComCoordenada.filter((grupo) => grupo.situacao.nivel === item.nivel).length : gruposComCoordenada.length;
                return <DropdownMenuItem key={item.chave} className="justify-between !text-slate-700 data-[highlighted]:!bg-slate-100 data-[highlighted]:!text-slate-900 [&_svg]:!text-slate-600" onSelect={() => aplicarFiltro(item.chave)}><span>{item.rotulo} ({total})</span>{filtro === item.chave ? <Check aria-hidden="true" size={15} /> : null}</DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="inline-flex shrink-0 rounded-control border border-border-subtle bg-surface-inset p-0.5 text-xs" role="group" aria-label="Escala do mapa">
            <button type="button" aria-pressed={visao === 'foco'} onClick={() => trocarVisao('foco')} className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-2.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${visao === 'foco' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}><Crosshair aria-hidden="true" className="mr-1 inline-block" size={13} />Foco regional</button>
            <button type="button" aria-pressed={visao === 'brasil'} onClick={() => trocarVisao('brasil')} className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-2.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${visao === 'brasil' ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>Brasil inteiro</button>
          </div>
        </div>

        <div className="p-3 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div role="group" aria-label="Mover mapa sem arrastar" className="flex items-center gap-1">
              <button type="button" aria-label="Mover mapa para cima" onClick={() => moverCamera(0, -1)} className={CLASSE_CONTROLE_MAPA}><ArrowUp aria-hidden="true" size={15} /></button>
              <button type="button" aria-label="Mover mapa para baixo" onClick={() => moverCamera(0, 1)} className={CLASSE_CONTROLE_MAPA}><ArrowDown aria-hidden="true" size={15} /></button>
              <button type="button" aria-label="Mover mapa para esquerda" onClick={() => moverCamera(-1, 0)} className={CLASSE_CONTROLE_MAPA}><ArrowLeft aria-hidden="true" size={15} /></button>
              <button type="button" aria-label="Mover mapa para direita" onClick={() => moverCamera(1, 0)} className={CLASSE_CONTROLE_MAPA}><ArrowRight aria-hidden="true" size={15} /></button>
            </div>
            <div role="group" aria-label="Controles de zoom do mapa" className="flex items-center gap-1">
              <button type="button" aria-label="Afastar mapa" onClick={() => aplicarZoom(1.35)} className={CLASSE_CONTROLE_MAPA}><Minus aria-hidden="true" size={15} /></button>
              <button type="button" aria-label="Aproximar mapa" onClick={() => aplicarZoom(0.74)} className={CLASSE_CONTROLE_MAPA}><Plus aria-hidden="true" size={15} /></button>
              <button type="button" aria-label="Redefinir enquadramento" onClick={() => trocarVisao('brasil')} className={CLASSE_CONTROLE_MAPA}><RotateCcw aria-hidden="true" size={14} /></button>
            </div>
          </div>
          {marcadores.length > 0 ? <svg ref={mapaRef} viewBox={serializarViewport(viewportAtual)} onPointerDown={iniciarArraste} onPointerMove={moverMapa} onPointerUp={(evento) => { if (arraste.current?.pointerId === evento.pointerId) arraste.current = null; }} onPointerCancel={() => { arraste.current = null; }} role="group" aria-label="Mapa de clientes por cidade" className="h-auto w-full touch-none cursor-grab rounded-control bg-surface-inset active:cursor-grabbing lg:min-h-0 lg:flex-1" preserveAspectRatio="xMidYMid meet">
            <title>Mapa de clientes agrupados por cidade</title>
            <g aria-hidden="true">
              {CAMINHOS_ESTADOS.map(({ codigo, d }) => <path key={codigo} data-state-code={codigo} d={d} className={visao === 'brasil' || codigo === CODIGO_PARAIBA ? 'fill-surface-card stroke-border-default' : 'fill-surface-inset stroke-border-subtle'} strokeWidth={visao === 'brasil' || codigo === CODIGO_PARAIBA ? '0.8' : '0.5'} />)}
            </g>
            {coordenadaLoja ? (() => {
              const [x, y] = projetar(coordenadaLoja.longitude, coordenadaLoja.latitude);
              return <g aria-label={`${NOME_LOJA} em ${CIDADE_ORIGEM_LOJA}, ${ESTADO_ORIGEM_LOJA}`}><circle cx={x} cy={y} r={5.5 / escalaZoom} className="fill-positive stroke-surface-card" strokeWidth={2 / escalaZoom} /><path d={`M${x - 2.5 / escalaZoom} ${y}h${5 / escalaZoom}M${x} ${y - 2.5 / escalaZoom}v${5 / escalaZoom}`} className="stroke-surface-card" strokeWidth={1.25 / escalaZoom} strokeLinecap="round" /></g>;
            })() : null}
            {marcadoresNaVisao.map((marcador) => {
              const tom = tomDaSituacao(marcador.situacao.nivel);
              const raio = Math.min(9, 4 + Math.sqrt(marcador.clientes.length) * 1.5);
              const tamanhoAlvo = 32 / escalaZoom;
              const rotulo = `${marcador.cidade}, ${marcador.estado}: ${pluralizar(marcador.clientes.length, 'cliente', 'clientes')}. Maior urgência: ${marcador.situacao.rotulo}.`;
              const selecionado = chaveAtiva === marcador.chave;
              return <foreignObject key={marcador.chave} x={marcador.x - tamanhoAlvo / 2} y={marcador.y - tamanhoAlvo / 2} width={tamanhoAlvo} height={tamanhoAlvo}>
                <button type="button" aria-label={rotulo} aria-pressed={selecionado} aria-controls="mapa-detalhe-cidade" onMouseEnter={() => setChaveEmFoco(marcador.chave)} onMouseLeave={() => setChaveEmFoco(chaveAtiva)} onFocus={() => setChaveEmFoco(marcador.chave)} onBlur={() => setChaveEmFoco(chaveAtiva)} onKeyDown={(evento) => { if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); selecionarMarcador(marcador.chave); } }} onClick={() => selecionarMarcador(marcador.chave)} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  <svg aria-hidden="true" viewBox="0 0 32 32" className="size-full overflow-visible">
                    {selecionado ? <circle cx="16" cy="16" r={raio + 1.5} className="fill-accent/15 stroke-accent" strokeWidth="1.2" /> : null}
                    <circle cx="16" cy="16" r={raio} className={TOM_MARCADOR[tom]} strokeWidth="1.5" />
                    {marcador.clientes.length > 1 ? <text x="16" y="19.3" textAnchor="middle" className="fill-surface-card text-[9px] font-bold">{marcador.clientes.length}</text> : null}
                  </svg>
                </button>
              </foreignObject>;
            })}
            {marcadoresForaDaVisao.map((marcador) => {
              const tamanhoAlvo = 32 / escalaZoom;
              return <foreignObject key={`borda-${marcador.chave}`} x={marcador.indicadorX - tamanhoAlvo / 2} y={marcador.indicadorY - tamanhoAlvo / 2} width={tamanhoAlvo} height={tamanhoAlvo}>
              <button type="button" aria-label={`${marcador.cidade}, ${marcador.estado}, fora da área visível. Ir até o ponto.`} onClick={() => centralizarMarcador(marcador)} className="flex size-full cursor-pointer items-center justify-center rounded-full bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                <svg aria-hidden="true" viewBox="0 0 32 32" className="size-full overflow-visible"><circle cx="16" cy="16" r="6" className="fill-accent stroke-surface-card" strokeWidth="2" /><text x="16" y="20" textAnchor="middle" className="fill-accent-foreground text-[11px] font-bold">{marcador.seta}</text></svg>
              </button>
            </foreignObject>;
            })}
            {tooltipMarcador ? <g className="pointer-events-none" aria-hidden="true">
              <rect x={tooltipX - tooltipLargura / 2} y={tooltipY - tooltipDeslocamentoY} width={tooltipLargura} height={28 / escalaZoom} rx={5 / escalaZoom} className="fill-text-primary" />
              <text x={tooltipX} y={tooltipY - 37 / escalaZoom} textAnchor="middle" fontSize={8 / escalaZoom} className="fill-surface-card font-semibold">{tooltipMarcador.cidade}, {tooltipMarcador.estado}</text>
              <text x={tooltipX} y={tooltipY - 27 / escalaZoom} textAnchor="middle" fontSize={7 / escalaZoom} className="fill-surface-inset">{pluralizar(tooltipMarcador.clientes.length, 'cliente', 'clientes')} · {tooltipMarcador.situacao.rotulo}</text>
            </g> : null}
          </svg> : <div className="rounded-control border border-dashed border-border-default bg-surface-inset px-4 py-10 text-center"><p className="text-sm font-semibold text-text-primary">Nenhuma cidade corresponde a este filtro</p><button type="button" onClick={() => setFiltro('todos')} className="mt-2 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Mostrar todos os municípios</button></div>}
          <p id="mapa-tooltip-texto" role="status" className="sr-only">{grupoTooltip ? `${grupoTooltip.cidade}, ${grupoTooltip.estado}: ${pluralizar(grupoTooltip.clientes.length, 'cliente', 'clientes')}. ${grupoTooltip.situacao.rotulo}.` : ''}</p>
          <ul aria-label="Legenda do mapa" className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-text-muted sm:flex sm:flex-wrap">
            <li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-danger" />Crítica</li><li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-warning" />Atenção</li><li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-accent" />Acompanhar</li><li className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full bg-positive" />{NOME_LOJA}</li>
          </ul>
        </div>
      </div> : null}

      {gruposComCoordenada.length === 0 && semLocalizacao.length > 0 ? <div className="px-5 py-9 text-center"><MapPinOff aria-hidden="true" className="mx-auto text-text-faint" size={24} /><p className="mt-3 text-sm font-semibold text-text-primary">Falta localização para posicionar estes clientes</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-text-muted">Complete cidade e UF no cadastro para transformar esta lista em cobertura geográfica.</p><button type="button" onClick={() => setMostrarSemLocalizacao((atual) => !atual)} className="mt-4 min-h-10 rounded-control border border-border-default bg-surface-card px-3 text-sm font-medium text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{mostrarSemLocalizacao ? 'Ocultar cadastros sem localização' : `Ver ${pluralizar(semLocalizacao.length, 'cliente sem localização', 'clientes sem localização')}`}</button></div> : null}

      {grupoAtivo ? <section id="mapa-detalhe-cidade" aria-label={`Clientes em ${grupoAtivo.cidade}, ${grupoAtivo.estado}`} className="border-t border-border-default px-4 py-4 sm:px-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-text-primary">{grupoAtivo.cidade}, {grupoAtivo.estado}</p><p className="mt-0.5 text-xs text-text-muted">{pluralizar(grupoAtivo.clientes.length, 'cliente', 'clientes')} neste município</p></div><span className="rounded-full bg-surface-inset px-2 py-1 text-xs font-medium text-text-secondary">{grupoAtivo.situacao.rotulo}</span></div><ul className="mt-3 divide-y divide-border-subtle rounded-control border border-border-subtle">{grupoAtivo.clientes.map((cliente) => <li key={cliente.id}><button type="button" onClick={() => abrirCliente(cliente.id)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"><span className="truncate font-medium text-text-primary">{cliente.nome}</span><span className="shrink-0 text-xs text-text-muted">Abrir</span></button></li>)}</ul></section> : null}

      {semLocalizacao.length > 0 && gruposComCoordenada.length > 0 ? <div className="border-t border-border-default bg-surface-inset px-4 py-3 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-text-muted"><span className="flex items-center gap-2"><MapPinOff aria-hidden="true" className="shrink-0 text-text-faint" size={15} />{pluralizar(semLocalizacao.length, 'cliente sem cidade registrada', 'clientes sem cidade registrada')}.</span><button type="button" onClick={() => setMostrarSemLocalizacao((atual) => !atual)} className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{mostrarSemLocalizacao ? 'Ocultar cadastros' : 'Ver cadastros'}</button></div></div> : null}
      {mostrarSemLocalizacao ? <div className="border-t border-border-default px-4 py-3 sm:px-5"><ul className="divide-y divide-border-subtle rounded-control border border-border-subtle">{semLocalizacao.map((cliente) => <li key={cliente.id}><button type="button" onClick={() => abrirCliente(cliente.id)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"><span className="truncate font-medium text-text-primary">{cliente.nome}</span><span className="shrink-0 text-xs text-text-muted">Completar cadastro</span></button></li>)}</ul></div> : null}
      {gruposComCoordenada.length === 0 && semLocalizacao.length === 0 ? <div className="px-5 py-8 text-center"><MapPinOff aria-hidden="true" className="mx-auto text-text-faint" size={22} /><p className="mt-2 text-sm font-semibold text-text-primary">Ainda não há cidades para exibir</p><p className="mt-1 text-xs text-text-muted">Os clientes aparecerão aqui quando o cadastro tiver cidade e UF.</p></div> : null}
    </section>
  );
}
