// Dialog empilhado sobre EstoqueFamiliaModal para registrar ou editar uma
// unidade física. Fluxo de 2 passos:
//   1. Escolher o grupo modelo/ano (fichas existentes da família) ou "Novo"
//   2. Preencher foto(s), preço, condição, apelido, avaria
// Modo criação: localiza unidade em branco via GET /:id/unidades → PATCH nela.
// Modo edição: unidadeParaEditar presente, salta passo 1 e PATCH direto.
import { useState, useCallback } from 'react';
import { ChevronLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../../components/ui/button';
import { aviso } from '../../components/ui/toast';
import { MotoCascadeSelect } from '../../components/MotoCascadeSelect';
import { useCatalogos } from '../../hooks/useCatalogos';
import { estoqueApi, uploadImagemEstoque } from './api';
import { comprimirImagem, formatarBytes } from '../../utils/comprimirImagem';
import { EstoqueUploadFotos } from './EstoqueUploadFotos';
import type { EstoqueLinha, GrupoModeloFamilia } from './familiaEstoque';
import { agruparPorModelo } from './familiaEstoque';
import type { Estoque, EstoqueInput, EstoqueUnidade } from './types';
import { DialogContent, DialogCloseButton } from '../../components/animate-ui/components/radix/dialog';

// Unidade "em branco" = criada automaticamente por sincronizar_unidades_estoque,
// ainda sem dados próprios. É essa que diferenciamos via PATCH ao registrar.
function isUnidadeEmBranco(u: {
  apelido: string | null;
  avaria: boolean;
  avaria_descricao: string | null;
  fotos: string[];
  valor: number | null;
  condicao_nota: number | null;
  vendida_em?: string | null;
}): boolean {
  return (
    u.apelido === null &&
    !u.avaria &&
    u.avaria_descricao === null &&
    u.fotos.length === 0 &&
    u.valor === null &&
    u.condicao_nota === null &&
    !u.vendida_em
  );
}

function getItensFromLinha(linha: EstoqueLinha): Estoque[] {
  return linha.tipo === 'familia' ? linha.itens : [linha.item];
}

// ─── Formulário do passo 2 ───────────────────────────────────────────────────

interface FormPasso2 {
  fotos: string[];
  preco: string;
  condicaoNota: string;
  apelido: string;
  avaria: boolean;
  avariaDescricao: string;
}

const FORM_INICIAL: FormPasso2 = {
  fotos: [],
  preco: '',
  condicaoNota: '',
  apelido: '',
  avaria: false,
  avariaDescricao: '',
};

function formDeEdicao(u: EstoqueUnidade): FormPasso2 {
  return {
    fotos: u.fotos,
    preco: u.valor !== null ? String(u.valor) : '',
    condicaoNota: u.condicao_nota !== null ? String(u.condicao_nota) : '',
    apelido: u.apelido ?? '',
    avaria: u.avaria,
    avariaDescricao: u.avaria_descricao ?? '',
  };
}

// ─── Componente principal ────────────────────────────────────────────────────

export interface RegistrarUnidadeDialogProps {
  linha: EstoqueLinha;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  /** Quando presente, o dialog abre no modo edição: pula o passo 1 e
   *  salva via PATCH diretamente na unidade informada. */
  unidadeParaEditar?: EstoqueUnidade;
}

export function RegistrarUnidadeDialog({ linha, open, onClose, onRefresh, unidadeParaEditar }: RegistrarUnidadeDialogProps) {
  const { modelos, criarNoMoto } = useCatalogos();
  const itens = getItensFromLinha(linha);
  const grupos = agruparPorModelo(itens);
  const familia = linha.tipo === 'familia' ? linha.familia : null;
  const modoEdicao = !!unidadeParaEditar;

  const [passo, setPasso] = useState<1 | 2>(modoEdicao ? 2 : 1);
  // grupo selecionado no passo 1 — null = "Novo modelo/ano"
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoModeloFamilia | null>(grupos[0] ?? null);
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [novoModeloId, setNovoModeloId] = useState('');
  const [form, setForm] = useState<FormPasso2>(modoEdicao ? formDeEdicao(unidadeParaEditar!) : FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [resumoCompressao, setResumoCompressao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleFechar = useCallback(() => {
    if (!modoEdicao) {
      setPasso(1);
      setGrupoSelecionado(grupos[0] ?? null);
      setNovoGrupo(false);
      setNovoModeloId('');
      setForm(FORM_INICIAL);
    }
    setErro(null);
    onClose();
  }, [grupos, onClose, modoEdicao]);

  const handleProximo = useCallback(() => {
    if (novoGrupo && !novoModeloId) {
      setErro('Selecione o modelo/ano do novo grupo.');
      return;
    }
    setErro(null);
    setPasso(2);
  }, [novoGrupo, novoModeloId]);

  const handleArquivos = useCallback(async (files: File[]) => {
    setEnviandoFoto(true);
    setResumoCompressao(null);
    try {
      const urls: string[] = [];
      let totalAntes = 0;
      let totalDepois = 0;
      let algumComprimido = false;
      for (const file of files) {
        const { arquivo, comprimido, bytesAntes, bytesDepois } = await comprimirImagem(file);
        totalAntes += bytesAntes;
        totalDepois += bytesDepois;
        if (comprimido) algumComprimido = true;
        const result = await uploadImagemEstoque(arquivo);
        if (result.success && result.url) urls.push(result.url);
      }
      if (urls.length > 0) setForm((f) => ({ ...f, fotos: [...f.fotos, ...urls] }));
      if (algumComprimido) {
        setResumoCompressao(`Comprimido: ${formatarBytes(totalAntes)} → ${formatarBytes(totalDepois)}`);
      }
    } finally {
      setEnviandoFoto(false);
    }
  }, []);

  const handleSalvar = useCallback(async () => {
    const preco = form.preco.trim() ? parseFloat(form.preco.replace(',', '.')) : null;

    if (!modoEdicao) {
      if (form.fotos.length === 0) { setErro('Foto é obrigatória.'); return; }
      if (preco === null || isNaN(preco) || preco < 0) { setErro('Preço inválido.'); return; }
    } else {
      if (preco !== null && (isNaN(preco) || preco < 0)) { setErro('Preço inválido.'); return; }
    }

    setSalvando(true);
    setErro(null);

    try {
      const payloadUnidade = {
        fotos: form.fotos,
        valor: preco,
        condicao_nota: form.condicaoNota ? parseInt(form.condicaoNota) : null,
        apelido: form.apelido.trim() || null,
        avaria: form.avaria,
        avaria_descricao: form.avaria && form.avariaDescricao.trim() ? form.avariaDescricao.trim() : null,
      };

      if (modoEdicao) {
        const resultPatch = await estoqueApi.atualizarUnidade(
          unidadeParaEditar!.estoque_id,
          unidadeParaEditar!.id,
          payloadUnidade,
        );
        if (!resultPatch.success) {
          setErro(resultPatch.error ?? 'Erro ao salvar unidade.');
          setSalvando(false);
          return;
        }
        aviso.sucesso('Unidade atualizada');
        onRefresh();
        handleFechar();
        return;
      }

      let fichaAlvoId: string;

      if (novoGrupo) {
        // Cria nova ficha com familia_id
        const payloadFicha: EstoqueInput = {
          nome: familia?.nome ?? itens[0]?.nome ?? 'Peça',
          categoria_id: familia?.categoria_id ?? itens[0]?.categoria_id ?? null,
          modelo_moto_id: novoModeloId || null,
          condicao: itens[0]?.condicao ?? 'original',
          condicao_nota: null,
          nota_cadastro: null,
          ano: null,
          valor: preco!,
          quantidade: 1,
          imagens: [],
          descricao: itens[0]?.descricao ?? null,
          ativo: true,
          componentes: null,
          anuncio_fb_url: null,
          familia_id: familia?.id ?? null,
          modelo_moto_compativel_ids: [],
        };
        const resultFicha = await estoqueApi.criar(payloadFicha);
        if (!resultFicha.success) {
          setErro(resultFicha.error ?? 'Erro ao criar ficha');
          setSalvando(false);
          return;
        }
        fichaAlvoId = resultFicha.data.id;
      } else {
        // Usa fichas do grupo selecionado
        const fichaGrupo = grupoSelecionado?.itens[0];
        if (!fichaGrupo) {
          setErro('Grupo inválido.');
          setSalvando(false);
          return;
        }
        fichaAlvoId = fichaGrupo.id;
      }

      // Busca unidade em branco na ficha alvo
      const resultUnidades = await estoqueApi.listarUnidades(fichaAlvoId);
      if (!resultUnidades.success) {
        setErro('Erro ao buscar unidades da ficha.');
        setSalvando(false);
        return;
      }
      const unidadeEmBranco = (resultUnidades.data ?? []).find(isUnidadeEmBranco);

      if (!unidadeEmBranco) {
        setErro(
          'Não há unidade em branco disponível nesta ficha. ' +
          'Aumente a quantidade da ficha e tente novamente.'
        );
        setSalvando(false);
        return;
      }

      // Diferencia a unidade em branco com os dados do formulário
      const resultPatch = await estoqueApi.atualizarUnidade(fichaAlvoId, unidadeEmBranco.id, payloadUnidade);

      if (!resultPatch.success) {
        setErro(resultPatch.error ?? 'Erro ao salvar unidade.');
        setSalvando(false);
        return;
      }

      aviso.sucesso('Unidade registrada');
      onRefresh();
      handleFechar();
    } catch (e: any) {
      setErro(e?.message ?? 'Erro inesperado.');
    } finally {
      setSalvando(false);
    }
  }, [form, novoGrupo, novoModeloId, grupoSelecionado, familia, itens, modoEdicao, unidadeParaEditar, onRefresh, handleFechar]);

  const titulo = modoEdicao ? 'Editar unidade' : 'Registrar unidade';
  const descricao = modoEdicao ? 'Dados da unidade física' : 'Nova unidade física para a família de peça';

  return (
    <DialogContent open={open} onClose={handleFechar} title={titulo} description={descricao}>
      <DialogCloseButton />

      {/* Cabeçalho de passo */}
      <div className="px-5 pt-5 pb-3 border-b border-border-subtle shrink-0">
        {passo === 2 && !modoEdicao && (
          <button
            type="button"
            onClick={() => { setPasso(1); setErro(null); }}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary mb-2"
          >
            <ChevronLeft size={13} />
            Voltar
          </button>
        )}
        <h2 className="text-sm font-semibold text-text-primary">
          {passo === 1 ? 'Passo 1 — Modelo/ano' : 'Passo 2 — Dados da unidade'}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          {passo === 1
            ? 'Escolha o grupo em que a nova unidade será registrada.'
            : 'Preencha foto e preço para identificar esta unidade.'}
        </p>
      </div>

      {/* Corpo */}
      <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(88dvh - 220px)' }}>
        {passo === 1 && (
          <div className="flex flex-col gap-2">
            {/* Grupos existentes */}
            {grupos.map((grupo) => {
              const label = grupo.nomeModelo + (grupo.ano ? ` · ${grupo.ano}` : '');
              const selecionado = !novoGrupo && grupoSelecionado?.modeloMotoId === grupo.modeloMotoId;
              return (
                <label
                  key={grupo.modeloMotoId ?? '__sem__'}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-control border cursor-pointer transition-colors',
                    selecionado ? 'border-accent bg-accent-soft' : 'border-border-subtle hover:bg-surface-raised'
                  )}
                >
                  <input
                    type="radio"
                    name="grupo"
                    checked={selecionado}
                    onChange={() => { setGrupoSelecionado(grupo); setNovoGrupo(false); }}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">{label}</span>
                  <span className="ml-auto text-xs text-text-muted">{grupo.itens.length} ficha(s)</span>
                </label>
              );
            })}

            {/* Opção "Novo modelo/ano" */}
            <label
              className={cn(
                'flex items-start gap-3 p-3 rounded-control border cursor-pointer transition-colors',
                novoGrupo ? 'border-accent bg-accent-soft' : 'border-border-subtle hover:bg-surface-raised'
              )}
            >
              <input
                type="radio"
                name="grupo"
                checked={novoGrupo}
                onChange={() => { setNovoGrupo(true); setGrupoSelecionado(null); }}
                className="accent-accent mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm text-text-primary">
                  <Plus size={12} />
                  Novo modelo/ano
                </div>
                {novoGrupo && (
                  <div className="mt-3">
                    <MotoCascadeSelect
                      modelos={modelos}
                      value={novoModeloId}
                      onChange={setNovoModeloId}
                      onCreate={criarNoMoto}
                      allowEmpty
                      emptyLabel="Sem modelo específico"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-4">
            {/* Fotos via upload (nunca URL digitada) */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Fotos {!modoEdicao && <span className="text-danger">*</span>}
              </label>
              <EstoqueUploadFotos
                imagens={form.fotos}
                onRemoverImagem={(url) => setForm((f) => ({ ...f, fotos: f.fotos.filter((x) => x !== url) }))}
                onArquivosSelecionados={handleArquivos}
                enviando={enviandoFoto}
                resumoCompressao={resumoCompressao}
              />
            </div>

            {/* Preço */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Preço {!modoEdicao && <span className="text-danger">*</span>}
                {modoEdicao && <span className="text-text-faint font-normal"> (vazio = herdar da ficha)</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.preco}
                  onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-control border border-border-default bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            {/* Condição (nota 1-10) */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Condição (1–10)</label>
              <select
                value={form.condicaoNota}
                onChange={(e) => setForm((f) => ({ ...f, condicaoNota: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-control border border-border-default bg-surface-inset text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">Herdar da ficha</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Apelido */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Apelido (opcional)</label>
              <input
                type="text"
                placeholder="ex: A amassada, Com trinca..."
                value={form.apelido}
                onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-control border border-border-default bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Avaria */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.avaria}
                  onChange={(e) => setForm((f) => ({ ...f, avaria: e.target.checked }))}
                  className="accent-warning"
                />
                <span className="text-sm text-text-primary">Tem avaria</span>
              </label>
              {form.avaria && (
                <textarea
                  rows={2}
                  placeholder="Descreva a avaria..."
                  value={form.avariaDescricao}
                  onChange={(e) => setForm((f) => ({ ...f, avariaDescricao: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 text-sm rounded-control border border-border-default bg-surface-inset text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                />
              )}
            </div>
          </div>
        )}

        {/* Mensagem de erro */}
        {erro && (
          <div className="mt-4 flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-sm text-danger">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle shrink-0">
        <Button variant="ghost" size="sm" onClick={handleFechar} className="h-8 text-xs">
          Cancelar
        </Button>
        {passo === 1 ? (
          <Button size="sm" onClick={handleProximo} className="h-8 text-xs">
            Próximo
          </Button>
        ) : (
          <Button size="sm" onClick={handleSalvar} disabled={salvando || enviandoFoto} className="h-8 text-xs">
            {salvando ? <Loader2 size={12} className="animate-spin" /> : null}
            {modoEdicao ? 'Salvar' : 'Registrar'}
          </Button>
        )}
      </div>
    </DialogContent>
  );
}
