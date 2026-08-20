// Publicar um anúncio NOVO na Shopee direto do catálogo (migration_045) —
// companheiro de EstoquePublicarMlModal.tsx, segundo canal de venda. Modal
// secundário (tamanho xl) pra não inchar o modal de editar peça: só abre
// quando o toggle "Publicar automaticamente na Shopee" é ligado. Ver
// docs/proposta-publicacao-shopee.md.
//
// Mais simples que o modal do Mercado Livre de propósito, refletindo
// diferenças reais da API da Shopee (não são simplificações arbitrárias):
// - Sem preditor de categoria confirmado → navegação em árvore é o ÚNICO
//   caminho (o ML tem busca com sugestão como caminho principal).
// - Sem vínculo de produto de catálogo (catalog_required não existe do lado
//   da Shopee nesta pesquisa).
// - Sem remoção de fundo integrada — não fazia parte do escopo desta fase.
// - Variação usa só o apelido da ficha como rótulo (Shopee representa
//   variação como texto livre por "model", não atributo estruturado como
//   COLOR/SIZE do Mercado Livre) — não precisa de um seletor de atributo.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Loader2, Send } from 'lucide-react';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { CustomDropdown } from '../../components/CustomDropdown';
import { aviso } from '../../components/ui/toast';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils';
import { estoqueApi } from './api';
import { shopeeApi } from '../shopee/api';
import { DESCRICAO_PADRAO_ANUNCIO_SHOPEE } from './descricaoPadraoShopee';
import type { ConfiguracaoAnuncioShopeeInput, Estoque, EstoqueAnuncioShopee, VariacaoShopeeInput } from './types';
import type { AtributoShopee, CanalLogisticaShopee, CategoriaShopeeNo } from '../shopee/types';

const inputClass =
  'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

type ValorAtributoShopee = { value_id?: number; original_value_name?: string };

function valorPreenchido(v: ValorAtributoShopee | undefined): boolean {
  return !!v && (v.value_id != null || !!v.original_value_name?.trim());
}

// Um campo por atributo — lista de valores conhecidos vira select, sem
// valores conhecidos vira texto livre (a Shopee não expõe um "tipo" de
// campo tão confiável quanto o value_type do Mercado Livre, ver
// shopeeApi.ts::buscarAtributosCategoriaShopee).
function CampoAtributoShopee({ atributo, valor, onChange }: { atributo: AtributoShopee; valor: ValorAtributoShopee | undefined; onChange: (v: ValorAtributoShopee) => void }) {
  if (atributo.values && atributo.values.length > 0) {
    return (
      <CustomDropdown
        variant="form"
        options={atributo.values.map((v) => ({ value: String(v.valueId), label: v.originalValueName }))}
        value={valor?.value_id != null ? String(valor.value_id) : ''}
        onChange={(id) => {
          const opcao = atributo.values?.find((v) => String(v.valueId) === id);
          onChange({ value_id: opcao?.valueId, original_value_name: opcao?.originalValueName });
        }}
        placeholder={atributo.isMandatory ? 'Selecione...' : 'Selecione (opcional)'}
      />
    );
  }

  return (
    <input
      value={valor?.original_value_name ?? ''}
      onChange={(e) => onChange({ original_value_name: e.target.value })}
      placeholder={atributo.isMandatory ? 'Obrigatório' : 'Opcional'}
      className={inputClass}
    />
  );
}

interface EstoquePublicarShopeeModalProps {
  aberto: boolean;
  onFechar: () => void;
  item: Estoque;
  onPublicado: (links: EstoqueAnuncioShopee[]) => void;
}

export function EstoquePublicarShopeeModal({ aberto, onFechar, item, onPublicado }: EstoquePublicarShopeeModalProps) {
  // --- Categoria: navegação manual em árvore (sem preditor confirmado) -------
  const [trilhaNavegacao, setTrilhaNavegacao] = useState<CategoriaShopeeNo[]>([]);
  const [opcoesNavegacao, setOpcoesNavegacao] = useState<CategoriaShopeeNo[]>([]);
  const [carregandoNavegacao, setCarregandoNavegacao] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<CategoriaShopeeNo | null>(null);
  const [atributosCategoria, setAtributosCategoria] = useState<AtributoShopee[]>([]);
  const [valoresAtributos, setValoresAtributos] = useState<Record<number, ValorAtributoShopee>>({});

  useEffect(() => {
    if (!aberto) return;
    setCarregandoNavegacao(true);
    shopeeApi
      .buscarCategoriasRaiz()
      .then((res) => {
        if (res.success && res.data) setOpcoesNavegacao(res.data);
      })
      .catch(() => aviso.falha(null, 'Não foi possível carregar as categorias da Shopee'))
      .finally(() => setCarregandoNavegacao(false));
  }, [aberto]);

  async function irParaNivelNavegacao(indice: number) {
    setCarregandoNavegacao(true);
    try {
      if (indice < 0) {
        const res = await shopeeApi.buscarCategoriasRaiz();
        setTrilhaNavegacao([]);
        setOpcoesNavegacao(res.success && res.data ? res.data : []);
        return;
      }
      const novaTrilha = trilhaNavegacao.slice(0, indice + 1);
      const pai = novaTrilha[novaTrilha.length - 1];
      const res = await shopeeApi.buscarCategoria(pai.categoryId);
      setTrilhaNavegacao(novaTrilha);
      setOpcoesNavegacao(res.success && res.data ? res.data.filhos : []);
    } catch {
      aviso.falha(null, 'Não foi possível carregar as categorias');
    } finally {
      setCarregandoNavegacao(false);
    }
  }

  async function selecionarNoNavegacao(no: CategoriaShopeeNo) {
    const novaTrilha = [...trilhaNavegacao, no];
    setCarregandoNavegacao(true);
    try {
      const res = await shopeeApi.buscarCategoria(no.categoryId);
      if (!res.success || !res.data) throw new Error(res.error);

      if (res.data.filhos.length === 0) {
        // Categoria-folha: seleção fecha aqui, atributos já vêm prontos na
        // mesma resposta (GET /shopee/categorias/:id devolve os dois juntos).
        setCategoriaSelecionada(no);
        setAtributosCategoria(res.data.atributos);
        setValoresAtributos({});
      } else {
        setTrilhaNavegacao(novaTrilha);
        setOpcoesNavegacao(res.data.filhos);
      }
    } catch {
      aviso.falha(null, 'Não foi possível carregar as subcategorias');
    } finally {
      setCarregandoNavegacao(false);
    }
  }

  const atributosObrigatoriosFaltando = useMemo(
    () => atributosCategoria.filter((a) => a.isMandatory && !valorPreenchido(valoresAtributos[a.attributeId])),
    [atributosCategoria, valoresAtributos]
  );

  // --- Canal de logística — obrigatório já na criação do item ----------------
  const [canaisLogistica, setCanaisLogistica] = useState<CanalLogisticaShopee[]>([]);
  const [logisticsChannelId, setLogisticsChannelId] = useState<number | null>(null);
  const [carregandoCanais, setCarregandoCanais] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCarregandoCanais(true);
    shopeeApi
      .buscarCanaisLogistica()
      .then((res) => {
        if (!res.success || !res.data) return;
        setCanaisLogistica(res.data.canais);
        setLogisticsChannelId(res.data.sugerido?.logisticsChannelId ?? null);
      })
      .catch(() => aviso.falha(null, 'Não foi possível carregar os canais de logística da Shopee'))
      .finally(() => setCarregandoCanais(false));
  }, [aberto]);

  // --- Peso, preço -------------------------------------------------------------
  const [pesoKg, setPesoKg] = useState<number>(0);
  const [precoBase, setPrecoBase] = useState<number>(item.valor);
  const [margemPercentual, setMargemPercentual] = useState<number | null>(null);
  const precoBaseDebounced = useDebounce(precoBase, 400);
  const precoComMargem = margemPercentual != null ? arredondarCentavos(precoBaseDebounced * (1 + margemPercentual / 100)) : precoBaseDebounced;

  useEffect(() => {
    if (!aberto) return;
    shopeeApi
      .buscarConfiguracao()
      .then((res) => {
        if (res.success && res.data) setMargemPercentual(res.data.margemPercentual);
      })
      .catch(() => {});
  }, [aberto]);

  // --- Fotos ---------------------------------------------------------------
  const [fotosSelecionadas, setFotosSelecionadas] = useState<string[]>(item.imagens ?? []);

  // --- Título e descrição do anúncio -----------------------------------------
  const [tituloAnuncio, setTituloAnuncio] = useState(item.nome.slice(0, 120));
  const [descricaoAnuncio, setDescricaoAnuncio] = useState(DESCRICAO_PADRAO_ANUNCIO_SHOPEE);

  // --- Variações (fichas de unidade com preço próprio) -----------------------
  const unidadesElegiveis = useMemo(() => (item.unidades ?? []).filter((u) => u.valor != null), [item.unidades]);
  const [usarVariacoes, setUsarVariacoes] = useState(true);

  // Reseta tudo quando a peça muda (modal reaproveitado entre peças) — mesmo
  // raciocínio do useEffect equivalente em EstoquePublicarMlModal.tsx.
  useEffect(() => {
    setFotosSelecionadas(item.imagens ?? []);
    setTituloAnuncio(item.nome.slice(0, 120));
    setDescricaoAnuncio(DESCRICAO_PADRAO_ANUNCIO_SHOPEE);
    setPrecoBase(item.valor);
    setPesoKg(0);
    setCategoriaSelecionada(null);
    setAtributosCategoria([]);
    setValoresAtributos({});
    setTrilhaNavegacao([]);
    setUsarVariacoes(true);
  }, [item.id]);

  // --- Publicar ---------------------------------------------------------------
  const [publicando, setPublicando] = useState(false);

  const podePublicar =
    !!categoriaSelecionada &&
    !!logisticsChannelId &&
    pesoKg > 0 &&
    fotosSelecionadas.length > 0 &&
    atributosObrigatoriosFaltando.length === 0 &&
    precoBase > 0 &&
    !!tituloAnuncio.trim() &&
    !!descricaoAnuncio.trim();

  async function publicar() {
    if (!categoriaSelecionada || !logisticsChannelId) return;
    setPublicando(true);
    try {
      const variacoes: VariacaoShopeeInput[] = usarVariacoes && unidadesElegiveis.length >= 2 ? unidadesElegiveis.map((u) => ({ unidade_id: u.id })) : [];

      const payload: ConfiguracaoAnuncioShopeeInput = {
        categoria_shopee_id: categoriaSelecionada.categoryId,
        logistics_channel_id: logisticsChannelId,
        atributos: (Object.entries(valoresAtributos) as [string, ValorAtributoShopee][])
          .filter(([, v]) => valorPreenchido(v))
          .map(([attributeId, v]) => ({
            attribute_id: Number(attributeId),
            attribute_value_list: [{ value_id: v.value_id, original_value_name: v.original_value_name }],
          })),
        peso_kg: pesoKg,
        preco_efetivo_sistema: precoBase,
        variacoes: variacoes.length > 0 ? variacoes : undefined,
        titulo_anuncio: tituloAnuncio.trim(),
        descricao_anuncio: descricaoAnuncio.trim(),
      };

      const resultado = await estoqueApi.publicarShopee(item.id, payload);
      if (!resultado.success) throw new Error(resultado.error);

      if (resultado.data?.avisoFotos) {
        aviso.atencao('Anúncio publicado — com um ajuste', { descricao: resultado.data.avisoFotos });
      } else {
        aviso.sucesso('Anúncio publicado na Shopee!');
      }

      const linksAtualizados = await estoqueApi.listarAnunciosShopee(item.id);
      if (linksAtualizados.success && linksAtualizados.data) onPublicado(linksAtualizados.data);
      onFechar();
    } catch (err) {
      aviso.falha(err, 'Não foi possível publicar o anúncio na Shopee');
    } finally {
      setPublicando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Publicar na Shopee"
      subtitulo={item.nome}
      icone={Send}
      tamanho="xl"
      rodape={
        <Button variant="default" size="lg" className="w-full" disabled={!podePublicar || publicando} onClick={publicar}>
          {publicando ? <Loader2 size={18} className="animate-spin" /> : <Send size={15} />}
          Publicar anúncio
        </Button>
      }
    >
      <ModalSection titulo="Categoria" descricao="A Shopee não tem sugestão automática de categoria — navegue pela árvore até a categoria-folha certa.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-faint">
            <button type="button" onClick={() => irParaNivelNavegacao(-1)} className="hover:text-accent-soft-fg hover:underline">
              Início
            </button>
            {trilhaNavegacao.map((no, indice) => (
              <span key={no.categoryId} className="flex items-center gap-1">
                <span aria-hidden="true">›</span>
                <button type="button" onClick={() => irParaNivelNavegacao(indice)} className="hover:text-accent-soft-fg hover:underline">
                  {no.categoryName}
                </button>
              </span>
            ))}
          </div>

          {categoriaSelecionada && (
            <div className="flex items-center gap-2 rounded-control border border-accent bg-accent-soft-bg px-3.5 py-2.5">
              <span className="text-sm truncate text-accent-soft-fg font-medium">{categoriaSelecionada.categoryName}</span>
            </div>
          )}

          <p className="text-sm font-medium text-text-primary">Qual opção descreve a peça?</p>

          {carregandoNavegacao ? (
            <p className="text-xs text-text-faint flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Carregando...
            </p>
          ) : opcoesNavegacao.length > 0 ? (
            <div className="space-y-1.5">
              {opcoesNavegacao.map((no) => (
                <button
                  key={no.categoryId}
                  type="button"
                  onClick={() => selecionarNoNavegacao(no)}
                  className="w-full text-left flex items-center justify-between gap-2 rounded-control border border-border-default px-3.5 py-2.5 hover:border-accent hover:bg-accent-soft-bg transition-colors"
                >
                  <span className="text-sm text-text-primary truncate">{no.categoryName}</span>
                  <ChevronRight size={14} className="shrink-0 text-text-faint" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-faint">Nenhuma subcategoria encontrada.</p>
          )}
        </div>
      </ModalSection>

      {categoriaSelecionada && (
        <>
          <ModalSection titulo="Frete" descricao="A Shopee exige um canal de logística já na criação do anúncio.">
            {carregandoCanais ? (
              <p className="text-xs text-text-faint flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Carregando canais...
              </p>
            ) : canaisLogistica.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-control border border-warning/30 bg-warning-bg/40 p-3">
                <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted">Nenhum canal de logística habilitado nesta loja da Shopee — habilite ao menos um antes de publicar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {canaisLogistica.map((c) => {
                  const selecionado = logisticsChannelId === c.logisticsChannelId;
                  return (
                    <button
                      key={c.logisticsChannelId}
                      type="button"
                      onClick={() => setLogisticsChannelId(c.logisticsChannelId)}
                      className={cn(
                        'text-left rounded-card border p-3.5 transition-colors',
                        selecionado ? 'border-accent bg-accent-soft-bg' : 'border-border-default hover:bg-surface-raised'
                      )}
                    >
                      <p className={cn('text-sm', selecionado ? 'text-accent-soft-fg font-medium' : 'text-text-primary')}>{c.logisticsChannelName}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </ModalSection>

          <ModalSection titulo="Peso e preço">
            <div>
              <label className={labelClass}>Peso da peça (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                value={pesoKg || ''}
                onChange={(e) => setPesoKg(Number(e.target.value) || 0)}
                placeholder="Ex: 0.8"
                className={cn(inputClass, 'md:max-w-xs')}
              />
              <p className="text-[11px] text-text-faint mt-1.5">Obrigatório pela Shopee — não existe campo de peso no cadastro da peça.</p>
            </div>

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
          </ModalSection>

          {atributosCategoria.length > 0 && (
            <ModalSection titulo="Atributos da categoria" descricao="Gerado a partir do que a Shopee exige pra esta categoria específica.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {atributosCategoria.map((a) => (
                  <div key={a.attributeId}>
                    <label className={labelClass}>
                      {a.name}
                      {a.isMandatory ? ' *' : ''}
                    </label>
                    <CampoAtributoShopee atributo={a} valor={valoresAtributos[a.attributeId]} onChange={(v) => setValoresAtributos((prev) => ({ ...prev, [a.attributeId]: v }))} />
                  </div>
                ))}
              </div>
            </ModalSection>
          )}

          <ModalSection
            titulo="Título e descrição do anúncio"
            descricao="Só o que o comprador vê na Shopee — não altera o nome nem a descrição da peça no cadastro do estoque."
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn(labelClass, 'mb-0')}>Título do anúncio *</label>
                <span className={cn('text-[11px] font-medium', tituloAnuncio.length >= 120 ? 'text-negative' : 'text-text-faint')}>{tituloAnuncio.length}/120</span>
              </div>
              <input value={tituloAnuncio} onChange={(e) => setTituloAnuncio(e.target.value.slice(0, 120))} maxLength={120} placeholder="Título do anúncio" className={inputClass} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={cn(labelClass, 'mb-0')}>Descrição do anúncio *</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDescricaoAnuncio((atual) => (atual === DESCRICAO_PADRAO_ANUNCIO_SHOPEE ? '' : DESCRICAO_PADRAO_ANUNCIO_SHOPEE))}
                >
                  {descricaoAnuncio === DESCRICAO_PADRAO_ANUNCIO_SHOPEE ? 'Limpar' : 'Restaurar padrão'}
                </Button>
              </div>
              <textarea value={descricaoAnuncio} onChange={(e) => setDescricaoAnuncio(e.target.value)} rows={5} placeholder="Descrição do anúncio" className={cn(inputClass, 'resize-y')} />
            </div>
          </ModalSection>

          <ModalSection titulo="Fotos" descricao="Reaproveitadas das fotos já cadastradas na peça. O envio pra Shopee acontece no ato de publicar (upload binário, a Shopee não aceita link).">
            {item.imagens.length === 0 && <p className="text-xs text-text-faint">Esta peça ainda não tem fotos cadastradas.</p>}
            <div className="flex flex-wrap gap-2">
              {item.imagens.map((url) => {
                const selecionada = fotosSelecionadas.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setFotosSelecionadas((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))}
                    className={cn('size-20 rounded-control overflow-hidden border-2 transition-all', selecionada ? 'border-accent' : 'border-border-default opacity-40')}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </ModalSection>

          {unidadesElegiveis.length >= 2 && (
            <ModalSection titulo="Variações" descricao="Cada ficha de unidade com preço próprio vira uma variação do anúncio (rótulo = apelido da ficha).">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className={cn(labelClass, 'mb-0')}>Publicar como variações</label>
                  <button
                    type="button"
                    onClick={() => setUsarVariacoes((v) => !v)}
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-control border',
                      usarVariacoes ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
                    )}
                  >
                    {usarVariacoes ? 'Ativado' : 'Desativado'}
                  </button>
                </div>

                {usarVariacoes && (
                  <div className="space-y-2">
                    {unidadesElegiveis.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-inset px-3 py-2.5">
                        <p className="text-sm text-text-primary truncate">{u.apelido || 'Sem apelido'}</p>
                        <p className="text-[11px] text-text-faint shrink-0">{formatarMoeda(u.valor ?? item.valor)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ModalSection>
          )}
        </>
      )}
    </Modal>
  );
}
