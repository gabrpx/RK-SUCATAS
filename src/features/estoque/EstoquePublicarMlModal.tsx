// Publicar um anúncio NOVO no Mercado Livre direto do catálogo (migration_043)
// — diferente de EstoqueAnunciosMlEditor.tsx, que só cola o link de um
// anúncio já existente. Modal secundário (tamanho xl) pra não inchar o
// modal de editar peça: quem só quer catalogar rápido nunca vê este
// formulário, ele só abre quando o toggle "Publicar automaticamente" é
// ligado. Ver docs/proposta-publicacao-mercadolivre.md, Parte 3.3.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Barcode, ChevronDown, ChevronRight, Loader2, Search, Send, Sparkles } from 'lucide-react';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { CustomDropdown } from '../../components/CustomDropdown';
import { aviso } from '../../components/ui/toast';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils';
import { estoqueApi } from './api';
import { mercadolivreApi } from '../mercadolivre/api';
import { categoriasApi } from '../../lib/catalogApi';
import type { AtributoMl, AtributoValorInput, CategoriaMlNo, CategoriaMlSugerida, ConfiguracaoAnuncioMlInput, Estoque, EstoqueAnuncioMl, TipoAnuncioMl, VariacaoMlInput } from './types';

const inputClass =
  'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function valorPreenchido(v: AtributoValorInput | undefined): boolean {
  return !!v && (!!v.value_id || !!v.value_name?.trim() || !!v.value_struct);
}

export interface AtributosClassificados {
  principais: AtributoMl[];
  secundarios: AtributoMl[];
}

export function classificarAtributos(atributos: AtributoMl[]): AtributosClassificados {
  const acionaveis = atributos.filter((a) => !a.tags?.read_only);
  const principais = acionaveis.filter((a) => !!a.tags?.required || !a.tags?.hidden);
  const secundarios = acionaveis.filter((a) => !a.tags?.required && !!a.tags?.hidden);
  return { principais, secundarios };
}

// Bullets de marketing dos cards de tipo de anúncio — dicionário fixo por
// listing_type_id, mesmo texto do site oficial. Só existem 2 ids vigentes
// hoje (gold_special/gold_pro, ver LISTING_TYPES_VIGENTES em
// mercadolivreApi.ts), diferente de atributo de categoria (que varia
// categoria a categoria e por isso é sempre dinâmico). Não deriva do campo
// `exposicao` cru (confirmado ao vivo: a API devolve "highest" pros dois
// tipos no mesmo preço, não dá pra diferenciar por ele).
const BULLETS_TIPO_ANUNCIO: Record<string, string[]> = {
  gold_special: ['Exposição alta', 'Duração ilimitada'],
  gold_pro: ['Exposição máxima', 'Duração ilimitada', 'Você oferece 10 vezes sem juros'],
};

function bulletsTipoAnuncio(listingTypeId: string): string[] {
  return BULLETS_TIPO_ANUNCIO[listingTypeId] ?? ['Duração ilimitada'];
}

// Um campo por atributo, componente decidido por value_type — mesma ideia
// de CategoriaCascadeSelect gerar UI a partir de dados vindos do banco, só
// que aqui a "árvore" é a lista de atributos da categoria escolhida.
function CampoAtributo({ atributo, valor, onChange }: { atributo: AtributoMl; valor: AtributoValorInput | undefined; onChange: (v: AtributoValorInput) => void }) {
  const obrigatorio = !!atributo.tags?.required;

  if (atributo.value_type === 'list' && atributo.values) {
    return (
      <CustomDropdown
        variant="form"
        options={atributo.values.map((v) => ({ value: v.id, label: v.name }))}
        value={valor?.value_id ?? ''}
        onChange={(id) => {
          const nome = atributo.values?.find((v) => v.id === id)?.name;
          onChange({ id: atributo.id, value_id: id, value_name: nome });
        }}
        placeholder={obrigatorio ? 'Selecione...' : 'Selecione (opcional)'}
      />
    );
  }

  if (atributo.value_type === 'boolean') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(['Sim', 'Não'] as const).map((rotulo) => {
          const ativo = valor?.value_name === rotulo;
          return (
            <button
              key={rotulo}
              type="button"
              onClick={() => onChange({ id: atributo.id, value_name: rotulo })}
              className={cn(
                'py-2.5 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                ativo ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
              )}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
    );
  }

  if (atributo.value_type === 'number' || atributo.value_type === 'number_unit') {
    return (
      <input
        type="number"
        inputMode="decimal"
        value={valor?.value_struct?.number ?? ''}
        onChange={(e) => {
          const numero = Number(e.target.value);
          if (!Number.isFinite(numero)) return;
          onChange({ id: atributo.id, value_struct: { number: numero, unit: valor?.value_struct?.unit ?? '' } });
        }}
        placeholder={obrigatorio ? 'Obrigatório' : 'Opcional'}
        className={inputClass}
      />
    );
  }

  return (
    <input
      value={valor?.value_name ?? ''}
      onChange={(e) => onChange({ id: atributo.id, value_name: e.target.value })}
      placeholder={obrigatorio ? 'Obrigatório' : 'Opcional'}
      className={inputClass}
    />
  );
}

interface EstoquePublicarMlModalProps {
  aberto: boolean;
  onFechar: () => void;
  item: Estoque;
  onPublicado: (links: EstoqueAnuncioMl[]) => void;
}

export function EstoquePublicarMlModal({ aberto, onFechar, item, onPublicado }: EstoquePublicarMlModalProps) {
  // --- Categoria -----------------------------------------------------------
  const [buscaCategoria, setBuscaCategoria] = useState(item.nome);
  const buscaCategoriaDebounced = useDebounce(buscaCategoria, 400);
  const [sugestoes, setSugestoes] = useState<CategoriaMlSugerida[]>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<CategoriaMlSugerida | null>(null);

  useEffect(() => {
    if (!aberto || buscaCategoriaDebounced.trim().length < 3) return;
    let cancelado = false;
    setBuscandoSugestoes(true);
    mercadolivreApi
      .sugerirCategoria(buscaCategoriaDebounced.trim())
      .then((res) => {
        if (!cancelado && res.success && res.data) setSugestoes(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setBuscandoSugestoes(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto, buscaCategoriaDebounced]);

  // --- Categoria: navegação manual em árvore ---------------------------------
  // Segundo caminho pra achar a categoria (equivalente ao "É de outra
  // categoria" do site oficial), pra quando o preditor acima erra o domínio
  // (ex: peça avulsa caindo em "Motos transacionais"). Cache dos níveis já
  // visitados em Map local — não rebusca um nível na mesma sessão do modal.
  const [modoNavegacaoCategoria, setModoNavegacaoCategoria] = useState(false);
  const [trilhaNavegacao, setTrilhaNavegacao] = useState<CategoriaMlNo[]>([]);
  const [opcoesNavegacao, setOpcoesNavegacao] = useState<CategoriaMlNo[]>([]);
  const [carregandoNavegacao, setCarregandoNavegacao] = useState(false);
  const cacheNavegacaoRef = useRef<Map<string, CategoriaMlNo[]>>(new Map());

  async function buscarNivelCategoria(categoriaId?: string): Promise<CategoriaMlNo[]> {
    const chave = categoriaId ?? '';
    const emCache = cacheNavegacaoRef.current.get(chave);
    if (emCache) return emCache;
    const res = await mercadolivreApi.buscarSubcategorias(categoriaId);
    const filhos = res.success && res.data ? res.data : [];
    cacheNavegacaoRef.current.set(chave, filhos);
    return filhos;
  }

  async function irParaNivelNavegacao(indice: number) {
    const novaTrilha = indice < 0 ? [] : trilhaNavegacao.slice(0, indice + 1);
    setCarregandoNavegacao(true);
    try {
      const filhos = await buscarNivelCategoria(novaTrilha[novaTrilha.length - 1]?.id);
      setTrilhaNavegacao(novaTrilha);
      setOpcoesNavegacao(filhos);
    } catch {
      aviso.falha(null, 'Não foi possível carregar as categorias');
    } finally {
      setCarregandoNavegacao(false);
    }
  }

  function abrirNavegacaoCategoria() {
    setModoNavegacaoCategoria(true);
    irParaNivelNavegacao(-1);
  }

  function voltarAPesquisarCategoria() {
    setModoNavegacaoCategoria(false);
    setTrilhaNavegacao([]);
    setOpcoesNavegacao([]);
  }

  async function selecionarNoNavegacao(no: CategoriaMlNo) {
    const novaTrilha = [...trilhaNavegacao, no];
    setCarregandoNavegacao(true);
    try {
      const filhos = await buscarNivelCategoria(no.id);
      if (filhos.length === 0) {
        // Lista vazia = categoria-folha, é aqui que a seleção fecha — mesmo
        // formato de CategoriaMlSugerida usado pela busca preditiva, então o
        // carregamento de atributos abaixo funciona sem nenhuma mudança.
        setCategoriaSelecionada({ id: no.id, nome: no.nome, caminho: novaTrilha.map((n) => n.nome).join(' > '), atributosSugeridos: [] });
        voltarAPesquisarCategoria();
      } else {
        setTrilhaNavegacao(novaTrilha);
        setOpcoesNavegacao(filhos);
      }
    } catch {
      aviso.falha(null, 'Não foi possível carregar as subcategorias');
    } finally {
      setCarregandoNavegacao(false);
    }
  }

  // --- Atributos da categoria escolhida --------------------------------------
  // Diagnóstico (peça de teste real "Lanterna traseira CB 300R"): o
  // formulário abaixo já era gerado 100% a partir de
  // GET /categories/{id}/attributes da categoria REALMENTE escolhida — o
  // motivo de aparecerem campos de moto inteira (Tipo de moto, Marca,
  // Cilindrada...) pra uma peça de iluminação nunca foi este trecho, foi o
  // preditor sugerir a categoria errada (domínio "Motos transacionais") sem
  // ter como corrigir manualmente. A navegação em árvore da Fase A resolveu
  // isso na raiz — escolhendo a categoria-folha certa (Lanternas), os
  // atributos que chegam aqui já fazem sentido pra uma lanterna.
  //
  // Segundo diagnóstico (mesma peça, categoria-folha já correta): a API
  // continua devolvendo, pra QUALQUER categoria, uma dezena de atributos
  // fiscais/logísticos universais (Voltagem, IVA para revenda, IEPS, dados de
  // embalagem, alimentos e bebidas, medicamentos...) junto dos específicos da
  // peça — confirmado batendo direto em GET /categories/{id}/attributes (sem
  // token, é público) pra "Faróis Traseiros" (MLB22645, carro) e "Carenagem"
  // (MLB46593, moto): nos dois casos a maioria dos atributos vem com
  // tags.hidden=true, exatamente os que o usuário reportou. Isso não é a
  // categoria errada — é o schema completo da categoria, e cabe ao
  // formulário decidir o que mostrar. classificarAtributos() abaixo faz essa
  // divisão pelas próprias tags que a API devolve (nunca por nome fixo).
  const [atributos, setAtributos] = useState<AtributoMl[]>([]);
  const [carregandoAtributos, setCarregandoAtributos] = useState(false);
  const [valoresAtributos, setValoresAtributos] = useState<Record<string, AtributoValorInput>>({});

  useEffect(() => {
    if (!categoriaSelecionada) {
      setAtributos([]);
      return;
    }
    let cancelado = false;
    setCarregandoAtributos(true);
    mercadolivreApi
      .buscarAtributosCategoria(categoriaSelecionada.id)
      .then((res) => {
        if (cancelado || !res.success || !res.data) return;
        setAtributos(res.data);
        // Pré-preenche com o que o preditor já sugeriu (marca/modelo, etc.) —
        // editável, não é uma trava.
        const iniciais: Record<string, AtributoValorInput> = {};
        for (const sugestao of categoriaSelecionada.atributosSugeridos) {
          iniciais[sugestao.id] = { id: sugestao.id, value_id: sugestao.valueId ?? undefined, value_name: sugestao.valueName ?? undefined };
        }
        // SELLER_SKU é o id padrão do Mercado Livre pro SKU do vendedor (ver
        // docs/proposta-publicacao-mercadolivre.md, 1.4) — pré-preenche com o
        // código interno da peça, que já existe e já identifica ela no
        // catálogo. Editável, não é uma trava.
        if (res.data.some((a) => a.id === 'SELLER_SKU')) {
          iniciais.SELLER_SKU = { id: 'SELLER_SKU', value_name: item.codigo };
        }
        setValoresAtributos(iniciais);
      })
      .catch(() => aviso.falha(null, 'Não foi possível carregar os atributos desta categoria'))
      .finally(() => {
        if (!cancelado) setCarregandoAtributos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [categoriaSelecionada]);

  const atributosObrigatoriosFaltando = useMemo(
    () => atributos.filter((a) => a.tags?.required && !valorPreenchido(valoresAtributos[a.id])),
    [atributos, valoresAtributos]
  );
  const exigeCatalogo = useMemo(() => atributos.some((a) => a.tags?.catalog_required), [atributos]);

  // SELLER_SKU sai do grid genérico e ganha linha própria (destaque visual,
  // já pré-preenchido acima) — o restante é dividido em principais/secundários
  // por classificarAtributos (baseado em tags.hidden/read_only da própria API,
  // nunca por nome fixo) e ordenado dentro de cada grupo com obrigatórios
  // primeiro, preservando a ordem que a API devolveu.
  const atributoSku = useMemo(() => atributos.find((a) => a.id === 'SELLER_SKU') ?? null, [atributos]);
  const ordenarObrigatoriosPrimeiro = (lista: AtributoMl[]) => [...lista.filter((a) => a.tags?.required), ...lista.filter((a) => !a.tags?.required)];
  const atributosPrincipaisOrdenados = useMemo(() => {
    const { principais } = classificarAtributos(atributos.filter((a) => a.id !== 'SELLER_SKU'));
    return ordenarObrigatoriosPrimeiro(principais);
  }, [atributos]);
  const atributosSecundariosOrdenados = useMemo(() => {
    const { secundarios } = classificarAtributos(atributos.filter((a) => a.id !== 'SELLER_SKU'));
    return ordenarObrigatoriosPrimeiro(secundarios);
  }, [atributos]);
  const [mostrarAtributosSecundarios, setMostrarAtributosSecundarios] = useState(false);

  // --- Preço e tipo de anúncio ----------------------------------------------
  const [precoBase, setPrecoBase] = useState<number>(item.valor);
  const [margemPercentual, setMargemPercentual] = useState<number | null>(null);
  const [tiposAnuncio, setTiposAnuncio] = useState<TipoAnuncioMl[]>([]);
  const [listingTypeId, setListingTypeId] = useState('');
  const precoBaseDebounced = useDebounce(precoBase, 400);

  useEffect(() => {
    if (!aberto) return;
    mercadolivreApi
      .buscarConfiguracao()
      .then((res) => {
        if (res.success && res.data) setMargemPercentual(res.data.margemPercentual);
      })
      .catch(() => {});
  }, [aberto]);

  const precoComMargem = margemPercentual != null ? arredondarCentavos(precoBaseDebounced * (1 + margemPercentual / 100)) : precoBaseDebounced;

  useEffect(() => {
    if (!aberto || precoComMargem <= 0) return;
    mercadolivreApi
      .buscarTiposAnuncio(precoComMargem)
      .then((res) => {
        if (!res.success || !res.data) return;
        setTiposAnuncio(res.data);
        setListingTypeId((atual) => (res.data!.some((t) => t.id === atual) ? atual : res.data![0]?.id ?? ''));
      })
      .catch(() => {});
  }, [aberto, precoComMargem]);

  // --- Condição, fotos --------------------------------------------------------
  const [condicaoMl, setCondicaoMl] = useState<'new' | 'used'>('used');
  const [fotosSelecionadas, setFotosSelecionadas] = useState<string[]>(item.imagens ?? []);

  // --- Variações (fichas de unidade com preço próprio) -----------------------
  const unidadesElegiveis = useMemo(() => (item.unidades ?? []).filter((u) => u.valor != null), [item.unidades]);
  const atributosVariacao = useMemo(() => atributos.filter((a) => a.tags?.allow_variations), [atributos]);
  const [usarVariacoes, setUsarVariacoes] = useState(true);
  const [atributoVariacaoId, setAtributoVariacaoId] = useState('');
  const [valoresPorUnidade, setValoresPorUnidade] = useState<Record<string, AtributoValorInput>>({});

  useEffect(() => {
    if (atributosVariacao.length === 0) {
      setAtributoVariacaoId('');
      return;
    }
    setAtributoVariacaoId((atual) => (atributosVariacao.some((a) => a.id === atual) ? atual : atributosVariacao[0].id));
  }, [atributosVariacao]);

  const atributoVariacaoEscolhido = atributosVariacao.find((a) => a.id === atributoVariacaoId) ?? null;
  const variacaoDisponivel = unidadesElegiveis.length >= 2 && atributosVariacao.length > 0;
  const unidadesComValor = unidadesElegiveis.filter((u) => valorPreenchido(valoresPorUnidade[u.id]));

  // --- Publicar ---------------------------------------------------------------
  const [publicando, setPublicando] = useState(false);

  const podePublicar =
    !!categoriaSelecionada && !!listingTypeId && fotosSelecionadas.length > 0 && atributosObrigatoriosFaltando.length === 0 && !exigeCatalogo && precoBase > 0;

  async function publicar() {
    if (!categoriaSelecionada) return;
    setPublicando(true);
    try {
      const variacoes: VariacaoMlInput[] =
        usarVariacoes && atributoVariacaoEscolhido && unidadesComValor.length >= 2
          ? unidadesComValor.map((u) => ({ unidade_id: u.id, atributos: [valoresPorUnidade[u.id]] }))
          : [];

      const payload: ConfiguracaoAnuncioMlInput = {
        categoria_ml_id: categoriaSelecionada.id,
        condicao_ml: condicaoMl,
        listing_type_id: listingTypeId,
        atributos: Object.values(valoresAtributos),
        fotos: fotosSelecionadas,
        preco_efetivo_sistema: precoBase,
        variacoes: variacoes.length > 0 ? variacoes : undefined,
      };

      const resultado = await estoqueApi.publicarMl(item.id, payload);
      if (!resultado.success) throw new Error(resultado.error);

      // Best-effort: memoriza a categoria escolhida pra pré-preencher a
      // próxima peça desta mesma categoria interna. Nunca bloqueia o fluxo
      // principal se falhar.
      if (item.categoria_id) {
        categoriasApi.memorizarCategoriaMlPadrao(item.categoria_id, categoriaSelecionada.id).catch(() => {});
      }

      if (resultado.data?.avisoFallback) {
        aviso.atencao('Anúncio publicado — com um ajuste', { descricao: resultado.data.avisoFallback });
      } else {
        aviso.sucesso('Anúncio publicado no Mercado Livre!');
      }

      const linksAtualizados = await estoqueApi.listarAnunciosMl(item.id);
      if (linksAtualizados.success) onPublicado(linksAtualizados.data);
      onFechar();
    } catch (err) {
      aviso.falha(err, 'Não foi possível publicar o anúncio');
    } finally {
      setPublicando(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Publicar no Mercado Livre" subtitulo={item.nome} icone={Send} tamanho="xl"
      rodape={
        <Button variant="default" size="lg" className="w-full" disabled={!podePublicar || publicando} onClick={publicar}>
          {publicando ? <Loader2 size={18} className="animate-spin" /> : <Send size={15} />}
          Publicar anúncio
        </Button>
      }
    >
      <ModalSection titulo="Categoria" descricao={modoNavegacaoCategoria ? undefined : 'Sugerida automaticamente a partir do nome da peça — pode trocar por qualquer termo de busca.'}>
        {!modoNavegacaoCategoria ? (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input value={buscaCategoria} onChange={(e) => setBuscaCategoria(e.target.value)} placeholder="Buscar categoria..." className={cn(inputClass, 'pl-9')} />
            </div>

            {buscandoSugestoes && (
              <p className="text-xs text-text-faint flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Buscando sugestões...
              </p>
            )}

            {/* Categoria escolhida pela navegação em árvore não costuma estar
                nesta lista de sugestões — sem isso a escolha ficaria invisível
                assim que a árvore fecha. */}
            {categoriaSelecionada && !sugestoes.some((s) => s.id === categoriaSelecionada.id) && (
              <div className="flex items-center gap-2 rounded-control border border-accent bg-accent-soft-bg px-3.5 py-2.5">
                <Sparkles size={13} className="shrink-0 text-accent-soft-fg" />
                <div className="min-w-0">
                  <p className="text-sm truncate text-accent-soft-fg font-medium">{categoriaSelecionada.nome}</p>
                  {categoriaSelecionada.caminho && <p className="text-[11px] text-text-faint truncate">{categoriaSelecionada.caminho}</p>}
                </div>
              </div>
            )}

            {sugestoes.length > 0 && (
              <div className="space-y-1.5">
                {sugestoes.map((s) => {
                  const ativa = categoriaSelecionada?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCategoriaSelecionada(s)}
                      className={cn(
                        'w-full text-left flex items-center gap-2 rounded-control border px-3.5 py-2.5 transition-colors',
                        ativa ? 'border-accent bg-accent-soft-bg' : 'border-border-default hover:bg-surface-raised'
                      )}
                    >
                      <Sparkles size={13} className={cn('shrink-0', ativa ? 'text-accent-soft-fg' : 'text-text-faint')} />
                      <div className="min-w-0">
                        <p className={cn('text-sm truncate', ativa ? 'text-accent-soft-fg font-medium' : 'text-text-primary')}>{s.nome}</p>
                        {s.caminho && <p className="text-[11px] text-text-faint truncate">{s.caminho}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={abrirNavegacaoCategoria} className="text-xs font-medium text-accent-soft-fg hover:underline">
              Não encontrou? Ver todas as categorias
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={voltarAPesquisarCategoria} className="text-xs font-medium text-accent-soft-fg hover:underline">
              ← Voltar a pesquisar
            </button>

            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-faint">
              <button type="button" onClick={() => irParaNivelNavegacao(-1)} className="hover:text-accent-soft-fg hover:underline">
                Início
              </button>
              {trilhaNavegacao.map((no, indice) => (
                <span key={no.id} className="flex items-center gap-1">
                  <span aria-hidden="true">›</span>
                  <button type="button" onClick={() => irParaNivelNavegacao(indice)} className="hover:text-accent-soft-fg hover:underline">
                    {no.nome}
                  </button>
                </span>
              ))}
            </div>

            <p className="text-sm font-medium text-text-primary">Qual opção descreve a peça?</p>

            {carregandoNavegacao ? (
              <p className="text-xs text-text-faint flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Carregando...
              </p>
            ) : opcoesNavegacao.length > 0 ? (
              <div className="space-y-1.5">
                {opcoesNavegacao.map((no) => (
                  <button
                    key={no.id}
                    type="button"
                    onClick={() => selecionarNoNavegacao(no)}
                    className="w-full text-left flex items-center justify-between gap-2 rounded-control border border-border-default px-3.5 py-2.5 hover:border-accent hover:bg-accent-soft-bg transition-colors"
                  >
                    <span className="text-sm text-text-primary truncate">{no.nome}</span>
                    <ChevronRight size={14} className="shrink-0 text-text-faint" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-faint">Nenhuma subcategoria encontrada.</p>
            )}
          </div>
        )}
      </ModalSection>

      {categoriaSelecionada && (
        <>
          <ModalSection titulo="Condição no anúncio" descricao="Independente da condição interna (original/paralela) — é o que o comprador vê.">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { valor: 'used' as const, rotulo: 'Usado' },
                  { valor: 'new' as const, rotulo: 'Novo' },
                ] as const
              ).map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => setCondicaoMl(opcao.valor)}
                  className={cn(
                    'py-3 rounded-control font-semibold text-xs uppercase tracking-widest border transition-all',
                    condicaoMl === opcao.valor ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
                  )}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </ModalSection>

          <ModalSection titulo="Preço e tipo de anúncio">
            <div>
              <label className={labelClass}>Preço base (sem margem)</label>
              <input
                type="number"
                inputMode="decimal"
                value={precoBase}
                onChange={(e) => setPrecoBase(Number(e.target.value) || 0)}
                className={cn(inputClass, 'md:max-w-xs')}
              />
              <p className="text-[11px] text-text-faint mt-1.5">
                = {formatarMoeda(precoComMargem)} no anúncio{margemPercentual != null ? ` (já com a margem de ${margemPercentual}%)` : ''}
              </p>
            </div>

            <div>
              <label className={labelClass}>Tipo de anúncio</label>
              {tiposAnuncio.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tiposAnuncio.map((t) => {
                    const selecionado = listingTypeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setListingTypeId(t.id)}
                        className={cn(
                          'text-left rounded-card border p-4 transition-colors flex flex-col gap-3',
                          selecionado ? 'border-accent bg-accent-soft-bg' : 'border-border-default hover:bg-surface-raised'
                        )}
                      >
                        <p className={cn('text-sm font-medium', selecionado ? 'text-accent-soft-fg' : 'text-text-primary')}>{t.nome}</p>
                        <ul className="space-y-1">
                          {bulletsTipoAnuncio(t.id).map((bullet) => (
                            <li key={bullet} className="text-xs text-text-faint">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto pt-1">
                          <p className={cn('text-lg font-semibold', selecionado ? 'text-accent-soft-fg' : 'text-text-primary')}>{formatarMoeda(t.taxaVendaValor)}</p>
                          <p className="text-[11px] text-text-faint">Tarifa de venda</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-faint py-2.5">Informe um preço válido pra ver os tipos disponíveis.</p>
              )}
            </div>
          </ModalSection>

          <ModalSection titulo="Atributos da categoria" descricao="Gerado a partir do que o Mercado Livre exige pra esta categoria específica.">
            {exigeCatalogo && (
              <div className="rounded-control border border-warning/30 bg-warning-bg/40 p-3 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Esta categoria exige vincular a um produto do catálogo do Mercado Livre — este formulário ainda não suporta isso. Publique pelo site do
                  Mercado Livre e cole o link abaixo em "Anúncios no Mercado Livre".
                </p>
              </div>
            )}
            {carregandoAtributos ? (
              <p className="text-xs text-text-faint flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Carregando atributos...
              </p>
            ) : (
              <>
                {atributoSku && (
                  <div className="rounded-control border border-positive/30 bg-positive-bg/40 p-3 flex items-center gap-3">
                    <Barcode size={16} className="text-positive shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-positive">{atributoSku.name} · preenchido automaticamente</p>
                      <input
                        value={valoresAtributos.SELLER_SKU?.value_name ?? ''}
                        onChange={(e) => setValoresAtributos((prev) => ({ ...prev, SELLER_SKU: { id: 'SELLER_SKU', value_name: e.target.value } }))}
                        className={cn(inputClass, 'font-mono mt-1')}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {atributosPrincipaisOrdenados.map((a) => (
                    <div key={a.id}>
                      <label className={labelClass}>
                        {a.name}
                        {a.tags?.required ? ' *' : ''}
                      </label>
                      <CampoAtributo
                        atributo={a}
                        valor={valoresAtributos[a.id]}
                        onChange={(v) => setValoresAtributos((prev) => ({ ...prev, [a.id]: v }))}
                      />
                    </div>
                  ))}
                </div>

                {atributosSecundariosOrdenados.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setMostrarAtributosSecundarios((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-accent-soft-fg hover:underline"
                    >
                      <ChevronDown size={13} className={cn('transition-transform', mostrarAtributosSecundarios && 'rotate-180')} />
                      {mostrarAtributosSecundarios ? 'Ocultar campos extras' : `Mostrar mais campos (${atributosSecundariosOrdenados.length})`}
                    </button>

                    {mostrarAtributosSecundarios && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {atributosSecundariosOrdenados.map((a) => (
                          <div key={a.id}>
                            <label className={labelClass}>{a.name}</label>
                            <CampoAtributo
                              atributo={a}
                              valor={valoresAtributos[a.id]}
                              onChange={(v) => setValoresAtributos((prev) => ({ ...prev, [a.id]: v }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </ModalSection>

          <ModalSection titulo="Fotos" descricao="Reaproveitadas das fotos já cadastradas na peça.">
            {fotosSelecionadas.length === 0 && item.imagens.length === 0 && <p className="text-xs text-text-faint">Esta peça ainda não tem fotos cadastradas.</p>}
            <div className="flex flex-wrap gap-2">
              {item.imagens.map((url) => {
                const selecionada = fotosSelecionadas.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() =>
                      setFotosSelecionadas((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
                    }
                    className={cn('relative size-20 rounded-control overflow-hidden border-2 transition-all', selecionada ? 'border-accent' : 'border-border-default opacity-40')}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </ModalSection>

          {unidadesElegiveis.length >= 2 && (
            <ModalSection
              titulo="Variações"
              descricao={
                variacaoDisponivel
                  ? 'Cada ficha de unidade com preço próprio vira uma variação do anúncio.'
                  : 'Esta categoria não tem um atributo de variação no Mercado Livre — o anúncio sai com o preço base único.'
              }
            >
              {variacaoDisponivel ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className={cn(labelClass, 'mb-0')}>Publicar como variações</label>
                    <button
                      type="button"
                      onClick={() => setUsarVariacoes((v) => !v)}
                      className={cn('text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-control border', usarVariacoes ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted')}
                    >
                      {usarVariacoes ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>

                  {usarVariacoes && (
                    <>
                      <div>
                        <label className={labelClass}>Atributo que diferencia as fichas</label>
                        <CustomDropdown
                          variant="form"
                          options={atributosVariacao.map((a) => ({ value: a.id, label: a.name }))}
                          value={atributoVariacaoId}
                          onChange={setAtributoVariacaoId}
                        />
                      </div>

                      <div className="space-y-2">
                        {unidadesElegiveis.map((u) => (
                          <div key={u.id} className="flex items-center gap-3 rounded-control border border-border-subtle bg-surface-inset px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-text-primary truncate">{u.apelido || 'Sem apelido'}</p>
                              <p className="text-[11px] text-text-faint">{formatarMoeda(u.valor ?? item.valor)}</p>
                            </div>
                            <div className="w-40 shrink-0">
                              {atributoVariacaoEscolhido && (
                                <CampoAtributo
                                  atributo={atributoVariacaoEscolhido}
                                  valor={valoresPorUnidade[u.id]}
                                  onChange={(v) => setValoresPorUnidade((prev) => ({ ...prev, [u.id]: v }))}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {unidadesComValor.length < 2 && (
                        <p className="text-[11px] text-text-faint">Escolha o valor de pelo menos 2 fichas pra virar variação de verdade — senão o anúncio sai simples.</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-faint">
                  {unidadesElegiveis.map((u) => u.apelido || formatarMoeda(u.valor ?? 0)).join(', ')}
                </p>
              )}
            </ModalSection>
          )}
        </>
      )}
    </Modal>
  );
}
