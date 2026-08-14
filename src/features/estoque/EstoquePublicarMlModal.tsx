// Publicar um anúncio NOVO no Mercado Livre direto do catálogo (migration_043)
// — diferente de EstoqueAnunciosMlEditor.tsx, que só cola o link de um
// anúncio já existente. Modal secundário (tamanho xl) pra não inchar o
// modal de editar peça: quem só quer catalogar rápido nunca vê este
// formulário, ele só abre quando o toggle "Publicar automaticamente" é
// ligado. Ver docs/proposta-publicacao-mercadolivre.md, Parte 3.3.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Barcode, Camera, Check, ChevronDown, ChevronRight, Loader2, RefreshCw, Search, Send, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { CustomDropdown } from '../../components/CustomDropdown';
import { aviso } from '../../components/ui/toast';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils';
import { comprimirImagem } from '../../utils/comprimirImagem';
import { removerFundoImagem } from '../../utils/removerFundoImagem';
import { estoqueApi, uploadImagemEstoque } from './api';
import { mercadolivreApi } from '../mercadolivre/api';
import { categoriasApi } from '../../lib/catalogApi';
import { derivarAutopreenchimentoAtributos } from './autopreencherAtributosMl';
import { DESCRICAO_PADRAO_ANUNCIO } from './descricaoPadraoMl';
import type { AtributoMl, AtributoValorInput, CategoriaMlNo, CategoriaMlSugerida, ConfiguracaoAnuncioMlInput, Estoque, EstoqueAnuncioMl, ProdutoCatalogoMl, TipoAnuncioMl, VariacaoMlInput } from './types';
import type { ModeloMoto } from '../../types/catalog';

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
  modelos: ModeloMoto[];
  onPublicado: (links: EstoqueAnuncioMl[]) => void;
}

export function EstoquePublicarMlModal({ aberto, onFechar, item, modelos, onPublicado }: EstoquePublicarMlModalProps) {
  // --- Categoria -----------------------------------------------------------
  const [buscaCategoria, setBuscaCategoria] = useState(item.nome);
  const buscaCategoriaDebounced = useDebounce(buscaCategoria, 400);
  const [sugestoes, setSugestoes] = useState<CategoriaMlSugerida[]>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<CategoriaMlSugerida | null>(null);
  // Padronizar categoria (Fase 4): ON quando a categoria em uso é a mesma já
  // memorizada como padrão pra esta categoria interna (auto-selecionada
  // abaixo, ou escolhida manualmente e ela bate por coincidência) — OFF
  // quando o usuário troca pra outra categoria manualmente, pra nunca
  // sobrescrever o padrão compartilhado sem intenção clara (trocar de volta
  // exige 1 clique a mais, e é o preço certo por ser uma mudança global).
  const [padronizarCategoria, setPadronizarCategoria] = useState(false);

  // Escolhe categoria (predição OU navegação em árvore) — único ponto de
  // entrada, pra manter padronizarCategoria sempre consistente com a
  // categoria realmente selecionada.
  function escolherCategoria(categoria: CategoriaMlSugerida) {
    setCategoriaSelecionada(categoria);
    setPadronizarCategoria(categoria.id === item.categoria?.mercadolivre_categoria_id_padrao);
  }

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
        escolherCategoria({ id: no.id, nome: no.nome, caminho: novaTrilha.map((n) => n.nome).join(' > '), atributosSugeridos: [] });
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
        // Marca/Número de peça/Tipo de veículo: dados que o sistema já tem
        // no cadastro (árvore de motos), mais confiáveis que o preditor do
        // Mercado Livre pra esses 3 campos específicos — por isso sobrepõe a
        // sugestão do preditor quando os dois preenchem o mesmo atributo.
        // Editável, não é uma trava (mesmo espírito do preditor acima).
        Object.assign(iniciais, derivarAutopreenchimentoAtributos(res.data, item, modelos));
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

  // --- Vínculo com produto de catálogo (categorias catalog_required) --------
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoCatalogoMl[]>([]);
  const [buscandoCatalogo, setBuscandoCatalogo] = useState(false);
  const [produtoCatalogoSelecionado, setProdutoCatalogoSelecionado] = useState<ProdutoCatalogoMl | null>(null);
  const [naoEhCatalogo, setNaoEhCatalogo] = useState(false);
  const [erroCatalogo, setErroCatalogo] = useState(false);

  useEffect(() => {
    setProdutoCatalogoSelecionado(null);
    setNaoEhCatalogo(false);
    setProdutosCatalogo([]);
    setErroCatalogo(false);
    if (!categoriaSelecionada || !exigeCatalogo) return;
    let cancelado = false;
    setBuscandoCatalogo(true);
    mercadolivreApi
      .buscarProdutosCatalogo(buscaCategoria.trim())
      .then((res) => {
        if (!cancelado && res.success && res.data) setProdutosCatalogo(res.data);
      })
      .catch(() => {
        if (!cancelado) setErroCatalogo(true);
      })
      .finally(() => {
        if (!cancelado) setBuscandoCatalogo(false);
      });
    return () => {
      cancelado = true;
    };
  }, [categoriaSelecionada, exigeCatalogo]);

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

  // --- Título e descrição do anúncio -----------------------------------------
  // Campos PRÓPRIOS do anúncio, nunca o nome/descrição do cadastro da peça:
  // o nome interno é otimizado pra busca rápida no catálogo, não pra
  // converter comprador no Mercado Livre. Pré-preenchidos a partir da peça
  // (ponto de partida útil), mas editar aqui nunca grava de volta em
  // item.nome/item.descricao.
  const [tituloAnuncio, setTituloAnuncio] = useState(item.nome.slice(0, 60));
  // Descrição do anúncio nasce SEMPRE do texto institucional, nunca de
  // item.descricao — a descrição interna é nota de catalogação, escrita pra
  // quem trabalha no estoque, não pra converter comprador.
  const [descricaoAnuncio, setDescricaoAnuncio] = useState(DESCRICAO_PADRAO_ANUNCIO);

  // --- Remoção de fundo das fotos (opcional) ----------------------------------
  // 100% client-side (@imgly/background-removal, WASM — ver
  // src/utils/removerFundoImagem.ts pro porquê de não precisar de rota nova
  // no backend nem de env var). fotosProcessadas guarda só as trocas
  // APROVADAS pelo usuário (urlOriginal -> urlNova): "usar no anúncio" troca
  // a entrada correspondente em fotosSelecionadas, nunca em item.imagens —
  // só o botão explícito "Substituir fotos do estoque" grava no cadastro.
  // Mesmo teto do pool de workers em removerFundoImagem.ts — não faz sentido
  // deixar clicar numa 3ª foto se o pool só processa 2 ao mesmo tempo mesmo.
  const MAX_REMOCOES_SIMULTANEAS = 2;
  const [processandoFundoUrls, setProcessandoFundoUrls] = useState<Set<string>>(new Set());
  const [previewsFundo, setPreviewsFundo] = useState<{ originalUrl: string; antesSrc: string; depoisBlob: Blob; depoisPreviewUrl: string }[]>([]);
  const [fotosProcessadas, setFotosProcessadas] = useState<Record<string, string>>({});
  const [aprovandoFundoUrl, setAprovandoFundoUrl] = useState<string | null>(null);
  const [substituindoFotosEstoque, setSubstituindoFotosEstoque] = useState(false);
  // Os dois inputs de retry (câmera/galeria) são compartilhados por todas as
  // prévias — só uma tentativa de retry acontece por vez, então basta lembrar
  // pra qual foto (originalUrl) o próximo arquivo escolhido se destina.
  const [retryAlvoUrl, setRetryAlvoUrl] = useState<string | null>(null);
  const inputRetryCameraRef = useRef<HTMLInputElement>(null);
  const inputRetryGaleriaRef = useRef<HTMLInputElement>(null);

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

  // EstoqueView.tsx troca a prop `item` sem desmontar este modal (o usuário
  // pode publicar a peça A, fechar e abrir a peça B no mesmo fluxo) — sem
  // isso, todo estado abaixo (derivado de `item` só no useState inicial, ou
  // acumulado durante a edição) ficava "preso" na peça anterior e o anúncio
  // de B saía com fotos/título/categoria/atributos de A.
  useEffect(() => {
    setFotosSelecionadas(item.imagens ?? []);
    setTituloAnuncio(item.nome.slice(0, 60));
    setDescricaoAnuncio(DESCRICAO_PADRAO_ANUNCIO);
    setBuscaCategoria(item.nome);
    setCategoriaSelecionada(null);
    setPadronizarCategoria(false);
    setSugestoes([]);
    setModoNavegacaoCategoria(false);
    setTrilhaNavegacao([]);
    setOpcoesNavegacao([]);
    setValoresAtributos({});
    setValoresPorUnidade({});
    setUsarVariacoes(true);
    setFotosProcessadas({});
    setPreviewsFundo([]);
    setProcessandoFundoUrls(new Set());
    setAprovandoFundoUrl(null);
    setSubstituindoFotosEstoque(false);
    setRetryAlvoUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Padronizar categoria (Fase 4): quando esta categoria interna já tem uma
  // categoria do Mercado Livre memorizada (toggle ativado numa peça
  // anterior), pré-seleciona ela — pula a busca preditiva/navegação manual
  // pra próxima peça do mesmo tipo. Busca/navegação continuam disponíveis
  // caso o usuário queira trocar só pra esta peça específica.
  useEffect(() => {
    const categoriaPadraoId = item.categoria?.mercadolivre_categoria_id_padrao;
    if (!aberto || !categoriaPadraoId) return;
    let cancelado = false;
    mercadolivreApi
      .buscarDetalheCategoria(categoriaPadraoId)
      .then((res) => {
        if (cancelado || !res.success || !res.data) return;
        setCategoriaSelecionada(res.data);
        setPadronizarCategoria(true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [aberto, item.id, item.categoria?.mercadolivre_categoria_id_padrao]);

  const atributoVariacaoEscolhido = atributosVariacao.find((a) => a.id === atributoVariacaoId) ?? null;
  const variacaoDisponivel = unidadesElegiveis.length >= 2 && atributosVariacao.length > 0;
  const unidadesComValor = unidadesElegiveis.filter((u) => valorPreenchido(valoresPorUnidade[u.id]));

  function revogarSeBlob(url: string) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  function descartarPreviewFundo(originalUrl: string) {
    setPreviewsFundo((atual) => {
      const preview = atual.find((p) => p.originalUrl === originalUrl);
      if (preview) {
        revogarSeBlob(preview.antesSrc);
        revogarSeBlob(preview.depoisPreviewUrl);
      }
      return atual.filter((p) => p.originalUrl !== originalUrl);
    });
  }

  // Dispara pro pool de workers (removerFundoImagem.ts) — até
  // MAX_REMOCOES_SIMULTANEAS chamadas concorrentes rodam em paralelo sem
  // travar a UI; o que passar disso espera na fila do próprio pool.
  async function iniciarRemocaoFundo(originalUrl: string, fonte: File | string) {
    descartarPreviewFundo(originalUrl); // nova tentativa substitui a prévia anterior desta mesma foto
    setProcessandoFundoUrls((atual) => new Set(atual).add(originalUrl));
    try {
      const resultado = await removerFundoImagem(fonte);
      if (!resultado.sucesso || !resultado.blob) {
        aviso.falha(null, 'Não foi possível remover o fundo desta foto');
        return;
      }
      const novaPreview = {
        originalUrl,
        antesSrc: typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte),
        depoisBlob: resultado.blob,
        depoisPreviewUrl: URL.createObjectURL(resultado.blob),
      };
      setPreviewsFundo((atual) => [...atual.filter((p) => p.originalUrl !== originalUrl), novaPreview]);
    } finally {
      setProcessandoFundoUrls((atual) => {
        const proximo = new Set(atual);
        proximo.delete(originalUrl);
        return proximo;
      });
    }
  }

  // "Tirar outra foto" reaproveita a mesma peça (retryAlvoUrl, setado pelo
  // botão de retry da prévia específica) que estava sendo retocada — o
  // usuário está tentando de novo, não anexando uma foto nova solta.
  // Comprime antes de remover o fundo (mesmo pipeline de EstoqueView.tsx pro
  // upload normal de fotos).
  async function tentarNovaFoto(files: FileList | null) {
    const arquivo = files?.[0];
    if (!arquivo || !retryAlvoUrl) return;
    const { arquivo: comprimido } = await comprimirImagem(arquivo);
    await iniciarRemocaoFundo(retryAlvoUrl, comprimido);
  }

  async function aprovarPreviewFundo(originalUrl: string) {
    const preview = previewsFundo.find((p) => p.originalUrl === originalUrl);
    if (!preview) return;
    setAprovandoFundoUrl(originalUrl);
    try {
      const arquivo = new File([preview.depoisBlob], 'fundo-removido.jpg', { type: 'image/jpeg' });
      const resultado = await uploadImagemEstoque(arquivo);
      if (!resultado.success || !resultado.url) {
        aviso.falha(null, 'Não foi possível salvar a foto sem fundo');
        return;
      }
      const novaUrl = resultado.url;
      setFotosSelecionadas((prev) => prev.map((u) => (u === originalUrl ? novaUrl : u)));
      setFotosProcessadas((prev) => ({ ...prev, [originalUrl]: novaUrl }));
      descartarPreviewFundo(originalUrl);
      aviso.sucesso('Foto sem fundo aplicada ao anúncio');
    } catch (err) {
      aviso.falha(err, 'Não foi possível salvar a foto sem fundo');
    } finally {
      setAprovandoFundoUrl(null);
    }
  }

  // Opt-in e separado de propósito: troca em item.imagens só as fotos que já
  // foram aprovadas acima, preservando as demais (mesmo as que o usuário
  // desmarcou da seleção do anúncio) — nunca perde foto do cadastro da peça.
  async function substituirFotosDoEstoque() {
    setSubstituindoFotosEstoque(true);
    try {
      const novasImagens = item.imagens.map((u) => fotosProcessadas[u] ?? u);
      const resultado = await estoqueApi.atualizarParcial(item.id, { imagens: novasImagens });
      if (!resultado.success) throw new Error(resultado.error);
      aviso.sucesso('Fotos do estoque substituídas pelas versões sem fundo');
    } catch (err) {
      aviso.falha(err, 'Não foi possível substituir as fotos do estoque');
    } finally {
      setSubstituindoFotosEstoque(false);
    }
  }

  // --- Publicar ---------------------------------------------------------------
  const [publicando, setPublicando] = useState(false);

  const catalogoResolvido = !exigeCatalogo || !!produtoCatalogoSelecionado || naoEhCatalogo;
  const podePublicar =
    !!categoriaSelecionada &&
    !!listingTypeId &&
    fotosSelecionadas.length > 0 &&
    atributosObrigatoriosFaltando.length === 0 &&
    catalogoResolvido &&
    precoBase > 0 &&
    !!tituloAnuncio.trim() &&
    !!descricaoAnuncio.trim();

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
        catalogo_produto_id: produtoCatalogoSelecionado?.id,
        titulo_anuncio: tituloAnuncio.trim(),
        descricao_anuncio: descricaoAnuncio.trim(),
      };

      const resultado = await estoqueApi.publicarMl(item.id, payload);
      if (!resultado.success) throw new Error(resultado.error);

      // Só memoriza a categoria como padrão da categoria interna se o
      // usuário ativou o toggle "Padronizar categoria" explicitamente —
      // deixou de ser automático-e-silencioso (Fase 4). Best-effort: nunca
      // bloqueia o fluxo principal se falhar.
      if (item.categoria_id && padronizarCategoria) {
        categoriasApi.memorizarCategoriaMlPadrao(item.categoria_id, categoriaSelecionada.id).catch(() => {});
      }

      const avisos = [resultado.data?.avisoFallback, resultado.data?.avisoFotos].filter((a): a is string => !!a);
      if (avisos.length > 0) {
        aviso.atencao('Anúncio publicado — com um ajuste', { descricao: avisos.join(' ') });
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
                      onClick={() => escolherCategoria(s)}
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

        {categoriaSelecionada && item.categoria_id && (
          <div className="flex items-center justify-between gap-3 rounded-control border border-border-default px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm text-text-primary">Padronizar esta categoria do Mercado Livre</p>
              <p className="text-[11px] text-text-faint mt-0.5 truncate">
                Próximas peças de "{item.categoria?.nome ?? 'mesma categoria'}" já vêm com {categoriaSelecionada.nome} pré-selecionada.
              </p>
            </div>
            <Switch checked={padronizarCategoria} onCheckedChange={setPadronizarCategoria} />
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
            {exigeCatalogo && !naoEhCatalogo && (
              <div className="rounded-control border border-border-default bg-surface-inset p-3 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-text-muted">
                    Esta categoria pede um produto do catálogo do Mercado Livre. Escolha o que mais parece com a peça, ou avise que não é nenhum deles.
                  </p>
                </div>

                {buscandoCatalogo && (
                  <p className="text-xs text-text-faint flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Buscando produtos parecidos...
                  </p>
                )}

                {!buscandoCatalogo && produtosCatalogo.length > 0 && (
                  <div className="space-y-1.5">
                    {produtosCatalogo.map((p) => {
                      const ativo = produtoCatalogoSelecionado?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setProdutoCatalogoSelecionado(p);
                            setUsarVariacoes(false);
                          }}
                          className={cn(
                            'w-full text-left flex items-center gap-2.5 rounded-control border px-3.5 py-2.5 transition-colors',
                            ativo ? 'border-accent bg-accent-soft-bg' : 'border-border-default hover:bg-surface-raised'
                          )}
                        >
                          {p.foto ? (
                            <img src={p.foto} alt="" className="size-9 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="size-9 rounded bg-surface-raised shrink-0" />
                          )}
                          <span className={cn('text-sm truncate', ativo ? 'text-accent-soft-fg font-medium' : 'text-text-primary')}>{p.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!buscandoCatalogo && erroCatalogo && (
                  <p className="text-xs text-negative">Não foi possível buscar no catálogo — tente selecionar a categoria de novo.</p>
                )}

                {!buscandoCatalogo && !erroCatalogo && produtosCatalogo.length === 0 && (
                  <p className="text-xs text-text-faint">Nenhum produto parecido encontrado no catálogo.</p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNaoEhCatalogo(true);
                    setProdutoCatalogoSelecionado(null);
                  }}
                  className="text-xs font-medium text-accent-soft-fg hover:underline"
                >
                  Não é o que eu vendo — publicar sem vincular ao catálogo
                </button>
              </div>
            )}

            {exigeCatalogo && naoEhCatalogo && (
              <div className="rounded-control border border-border-default bg-surface-inset p-3 flex items-center justify-between gap-2.5">
                <p className="text-xs text-text-muted">Publicando sem vínculo ao catálogo — igual a qualquer outro anúncio.</p>
                <button type="button" onClick={() => setNaoEhCatalogo(false)} className="text-xs font-medium text-accent-soft-fg hover:underline shrink-0">
                  Desfazer
                </button>
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

          <ModalSection
            titulo="Título e descrição do anúncio"
            descricao="Só o que o comprador vê no Mercado Livre — não altera o nome nem a descrição da peça no cadastro do estoque."
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn(labelClass, 'mb-0')}>Título do anúncio *</label>
                <span className={cn('text-[11px] font-medium', tituloAnuncio.length >= 60 ? 'text-negative' : 'text-text-faint')}>
                  {tituloAnuncio.length}/60
                </span>
              </div>
              <input
                value={tituloAnuncio}
                onChange={(e) => setTituloAnuncio(e.target.value.slice(0, 60))}
                maxLength={60}
                placeholder="Título do anúncio"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn(labelClass, 'mb-0')}>Descrição do anúncio *</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDescricaoAnuncio((atual) => (atual === DESCRICAO_PADRAO_ANUNCIO ? '' : DESCRICAO_PADRAO_ANUNCIO))}
                >
                  {descricaoAnuncio === DESCRICAO_PADRAO_ANUNCIO ? 'Limpar' : 'Restaurar padrão'}
                </Button>
              </div>
              <textarea
                value={descricaoAnuncio}
                onChange={(e) => setDescricaoAnuncio(e.target.value)}
                rows={5}
                placeholder="Descrição do anúncio"
                className={cn(inputClass, 'resize-y')}
              />
            </div>
          </ModalSection>

          <ModalSection titulo="Fotos" descricao="Reaproveitadas das fotos já cadastradas na peça. Dá pra remover o fundo de qualquer uma antes de publicar.">
            {fotosSelecionadas.length === 0 && item.imagens.length === 0 && <p className="text-xs text-text-faint">Esta peça ainda não tem fotos cadastradas.</p>}
            <div className="flex flex-wrap gap-2">
              {item.imagens.map((url) => {
                const selecionada = fotosSelecionadas.includes(url);
                const urlExibida = fotosProcessadas[url] ?? url;
                const processandoEsta = processandoFundoUrls.has(url);
                return (
                  <div key={url} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setFotosSelecionadas((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
                      }
                      className={cn('relative size-20 rounded-control overflow-hidden border-2 transition-all', selecionada ? 'border-accent' : 'border-border-default opacity-40')}
                    >
                      <img src={urlExibida} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {fotosProcessadas[url] && (
                        <span className="absolute top-0.5 left-0.5 rounded bg-positive-bg/90 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-positive">
                          Sem fundo
                        </span>
                      )}
                    </button>
                    {/* Botão irmão do toggle de seleção acima, não filho — <button> dentro de
                        <button> é inválido; os dois ficam sobrepostos via position absolute
                        dentro do mesmo wrapper relative. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        iniciarRemocaoFundo(url, url);
                      }}
                      disabled={processandoEsta || processandoFundoUrls.size >= MAX_REMOCOES_SIMULTANEAS}
                      title="Remover fundo"
                      className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center size-6 rounded-full border border-border-default bg-surface-page text-text-muted transition-colors hover:border-accent hover:text-accent-soft-fg disabled:opacity-50"
                    >
                      {processandoEsta ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {previewsFundo.map((preview) => (
              <div key={preview.originalUrl} className="rounded-control border border-border-default bg-surface-inset p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Prévia sem fundo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-text-faint mb-1">Antes</p>
                    <img src={preview.antesSrc} alt="" className="w-full aspect-square object-cover rounded-control border border-border-subtle" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-[11px] text-text-faint mb-1">Depois</p>
                    <img src={preview.depoisPreviewUrl} alt="" className="w-full aspect-square object-cover rounded-control border border-border-subtle bg-white" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => aprovarPreviewFundo(preview.originalUrl)} disabled={aprovandoFundoUrl === preview.originalUrl}>
                    {aprovandoFundoUrl === preview.originalUrl ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Usar esta versão no anúncio
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setRetryAlvoUrl(preview.originalUrl); inputRetryGaleriaRef.current?.click(); }}>
                    <Upload size={13} /> Tirar outra (galeria)
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="md:hidden" onClick={() => { setRetryAlvoUrl(preview.originalUrl); inputRetryCameraRef.current?.click(); }}>
                    <Camera size={13} /> Câmera
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => descartarPreviewFundo(preview.originalUrl)}>
                    <X size={13} /> Descartar
                  </Button>
                </div>
              </div>
            ))}

            {/* Compartilhados por todas as prévias acima — só uma tentativa de
                retry acontece por vez (retryAlvoUrl guarda pra qual foto). */}
            <input
              ref={inputRetryCameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                tentarNovaFoto(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={inputRetryGaleriaRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                tentarNovaFoto(e.target.files);
                e.target.value = '';
              }}
            />

            {Object.keys(fotosProcessadas).length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-inset px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    {Object.keys(fotosProcessadas).length} {Object.keys(fotosProcessadas).length === 1 ? 'foto aprovada' : 'fotos aprovadas'} sem fundo
                  </p>
                  <p className="text-[11px] text-text-faint mt-0.5">Só afeta este anúncio. Pra também trocar as fotos da peça no estoque, use o botão ao lado.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={substituirFotosDoEstoque} disabled={substituindoFotosEstoque} className="shrink-0">
                  {substituindoFotosEstoque ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Substituir fotos do estoque
                </Button>
              </div>
            )}
          </ModalSection>

          {unidadesElegiveis.length >= 2 && (
            <ModalSection
              titulo="Variações"
              descricao={
                produtoCatalogoSelecionado
                  ? 'Produto de catálogo não aceita variações — o anúncio sai com o preço base único.'
                  : variacaoDisponivel
                  ? 'Cada ficha de unidade com preço próprio vira uma variação do anúncio.'
                  : 'Esta categoria não tem um atributo de variação no Mercado Livre — o anúncio sai com o preço base único.'
              }
            >
              {produtoCatalogoSelecionado ? (
                <p className="text-xs text-text-faint">
                  Clique em "Não é o que eu vendo" acima se precisar publicar esta peça com variações por ficha.
                </p>
              ) : variacaoDisponivel ? (
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
