// Área de avarias do modal de detalhes: 5 TBI de 160 continuam sendo UMA
// linha no estoque, mas a unidade amassada e a que veio sem bico injetor
// ganham ficha própria — com foto do defeito e, se for o caso, preço menor.
//
// Só existe ficha pra unidade que tem algo diferente. Peça com 5 unidades e 2
// avariadas tem 2 fichas; as outras três não precisam de registro nenhum.
import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Pencil, Trash2, Camera, Upload, X, Loader2, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils';
import { Modal } from '../../components/ui/Modal';
import { estoqueApi, uploadImagemEstoque } from './api';
import { comprimirImagem } from './comprimirImagem';
import { unidadesExcedentes } from './valorEstoque';
import type { Estoque, EstoqueUnidade, EstoqueUnidadeInput } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const FORM_VAZIO: EstoqueUnidadeInput = { apelido: '', avaria: true, avaria_descricao: '', fotos: [], valor: null };

interface UnidadesAvariaProps {
  item: Estoque;
  /** Papel 'estoque_leitura' só consulta — sem sinalizar nem editar */
  readOnly?: boolean;
  /** Dispara o refresh da lista global depois de mexer nas fichas */
  onAlterado?: () => void;
}

export function UnidadesAvaria({ item, readOnly = false, onAlterado }: UnidadesAvariaProps) {
  const [unidades, setUnidades] = useState<EstoqueUnidade[]>(item.unidades ?? []);
  const [editando, setEditando] = useState<EstoqueUnidade | 'nova' | null>(null);
  const [form, setForm] = useState<EstoqueUnidadeInput>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<EstoqueUnidade | null>(null);
  // Foto aberta em tela cheia: [urls, índice]
  const [visualizando, setVisualizando] = useState<{ fotos: string[]; indice: number } | null>(null);

  useEffect(() => {
    setUnidades(item.unidades ?? []);
  }, [item.unidades, item.id]);

  const comAvaria = unidades.filter((u) => u.avaria).length;
  const semObservacao = Math.max(0, item.quantidade - unidades.length);
  const excedentes = unidadesExcedentes({ ...item, unidades });

  const abrirNova = () => {
    setForm(FORM_VAZIO);
    setErro(null);
    setEditando('nova');
  };

  const abrirEdicao = (unidade: EstoqueUnidade) => {
    setForm({
      apelido: unidade.apelido ?? '',
      avaria: unidade.avaria,
      avaria_descricao: unidade.avaria_descricao ?? '',
      fotos: unidade.fotos ?? [],
      valor: unidade.valor,
    });
    setErro(null);
    setEditando(unidade);
  };

  const enviarFotos = async (files: FileList) => {
    setEnviandoFotos(true);
    setErro(null);
    try {
      const novas: string[] = [];
      for (const file of Array.from(files)) {
        const { arquivo } = await comprimirImagem(file);
        const resultado = await uploadImagemEstoque(arquivo);
        if (!resultado.success || !resultado.url) throw new Error(resultado.error || 'Falha ao enviar foto');
        novas.push(resultado.url);
      }
      setForm((f) => ({ ...f, fotos: [...f.fotos, ...novas] }));
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar foto');
    } finally {
      setEnviandoFotos(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    const payload: EstoqueUnidadeInput = {
      ...form,
      apelido: form.apelido?.trim() || null,
      avaria_descricao: form.avaria_descricao?.trim() || null,
    };
    try {
      if (editando === 'nova') {
        const resultado = await estoqueApi.criarUnidade(item.id, payload);
        if (!resultado.success) throw new Error(resultado.error);
        setUnidades((prev) => [...prev, resultado.data]);
      } else if (editando) {
        const resultado = await estoqueApi.atualizarUnidade(item.id, editando.id, payload);
        if (!resultado.success) throw new Error(resultado.error);
        setUnidades((prev) => prev.map((u) => (u.id === editando.id ? resultado.data : u)));
      }
      setEditando(null);
      onAlterado?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar unidade');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    try {
      const resultado = await estoqueApi.excluirUnidade(item.id, excluindo.id);
      if (!resultado.success) throw new Error(resultado.error);
      setUnidades((prev) => prev.filter((u) => u.id !== excluindo.id));
      setExcluindo(null);
      onAlterado?.();
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir unidade');
      setExcluindo(null);
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted flex items-center gap-2">
            <AlertTriangle size={13} className={comAvaria > 0 ? 'text-warning' : 'text-text-faint'} />
            Unidades e avarias
          </h4>
          <p className="text-xs text-text-faint mt-1">
            {item.quantidade} {item.quantidade === 1 ? 'unidade' : 'unidades'}
            {comAvaria > 0 && <span className="text-warning"> · {comAvaria} com avaria</span>}
            {semObservacao > 0 && ` · ${semObservacao} sem observação`}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={abrirNova}
            className="shrink-0 h-9 px-3 rounded-control border border-border-default text-text-secondary text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-raised hover:text-text-primary flex items-center gap-1.5"
          >
            <Plus size={14} /> Sinalizar
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {/* Fichas sobrando depois de vender unidades: o sistema não sabe qual
          das unidades saiu, então quem cataloga precisa apagar a que foi. */}
      {excedentes > 0 && (
        <div className="rounded-control border border-warning/25 bg-warning-bg/40 p-3">
          <p className="text-xs text-warning font-medium">
            {excedentes} ficha(s) a mais do que unidades em estoque — provavelmente alguma dessas já foi vendida. Apague a que saiu ou ajuste a quantidade.
          </p>
        </div>
      )}

      {unidades.length === 0 ? (
        <p className="text-xs text-text-faint">
          {readOnly
            ? 'Nenhuma unidade sinalizada — todas em estado normal.'
            : 'Nenhuma unidade sinalizada. Use "Sinalizar" quando uma unidade tiver avaria, faltar alguma parte ou precisar de preço diferente.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {unidades.map((unidade, indice) => (
            <li key={unidade.id} className="rounded-control border border-border-subtle bg-surface-inset p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{unidade.apelido || `Unidade ${indice + 1}`}</span>
                    {unidade.avaria && (
                      <span className="inline-flex items-center rounded-badge bg-warning-bg px-2 py-0.5 text-[11px] font-medium leading-none text-warning">Avaria</span>
                    )}
                    {unidade.valor !== null && unidade.valor !== undefined && (
                      <span className="inline-flex items-center rounded-badge bg-accent-soft-bg px-2 py-0.5 text-[11px] font-medium leading-none text-accent-soft-fg">
                        {formatCurrency(unidade.valor)}
                      </span>
                    )}
                  </div>
                  {unidade.avaria_descricao && <p className="text-xs text-text-secondary mt-1.5 whitespace-pre-line">{unidade.avaria_descricao}</p>}

                  {unidade.fotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {unidade.fotos.map((foto, i) => (
                        <button
                          key={foto}
                          type="button"
                          onClick={() => setVisualizando({ fotos: unidade.fotos, indice: i })}
                          className="size-14 rounded-control overflow-hidden border border-border-default bg-surface-page hover:opacity-80 transition-opacity"
                        >
                          <img src={foto} alt={`Avaria ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(unidade)}
                      title="Editar unidade"
                      className="size-8 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcluindo(unidade)}
                      title="Excluir ficha"
                      className="size-8 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* -------------------------------------------------- form da unidade */}
      {editando && (
        <Modal
          aberto={!!editando}
          onFechar={() => setEditando(null)}
          titulo={editando === 'nova' ? 'Sinalizar unidade' : 'Editar unidade'}
          subtitulo={item.nome}
          icone={AlertTriangle}
          tamanho="md"
          rodape={
            <button
              onClick={salvar}
              disabled={salvando || enviandoFotos}
              className="w-full h-12 rounded-control bg-accent text-white font-semibold text-xs uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 size={18} className="animate-spin" /> : 'Salvar unidade'}
            </button>
          }
        >
          <div className="space-y-4">
            {erro && <p className="text-sm text-danger">{erro}</p>}

            <div>
              <label className={labelClass}>Como chamar essa unidade</label>
              <input
                value={form.apelido ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))}
                placeholder="Ex: A amassada, Sem bico injetor"
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.avaria}
                onChange={(e) => setForm((f) => ({ ...f, avaria: e.target.checked }))}
                className="size-4 accent-[var(--warning)] shrink-0"
              />
              <span className="text-sm text-text-secondary">Esta unidade tem avaria</span>
            </label>

            <div>
              <label className={labelClass}>O que essa unidade tem</label>
              <textarea
                value={form.avaria_descricao ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, avaria_descricao: e.target.value }))}
                rows={3}
                placeholder="Ex: lateral amassada, sem o bico injetor, rosca espanada"
                className={cn(inputClass, 'resize-none')}
              />
            </div>

            <div>
              <label className={labelClass}>Preço só desta unidade</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.valor ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder={`Vazio = preço normal (${formatCurrency(item.valor)})`}
                className={inputClass}
              />
              <p className="text-xs text-text-faint mt-1.5">
                Deixe vazio pra essa unidade valer o mesmo que as outras. Preenchido, ela entra no total do estoque por esse valor.
              </p>
            </div>

            <div>
              <label className={labelClass}>Fotos da avaria</label>
              <p className="text-xs text-text-faint mb-2">Separadas da foto do produto — mostram o defeito, não a peça boa.</p>

              {form.fotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.fotos.map((foto, i) => (
                    <div key={foto} className="relative size-20 rounded-control overflow-hidden border border-border-default">
                      <img src={foto} alt={`Avaria ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, fotos: f.fotos.filter((u) => u !== foto) }))}
                        title="Remover foto"
                        className="absolute top-1 right-1 size-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-danger"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {/* Câmera direto no celular; galeria em qualquer lugar. Aceita
                    várias fotos de uma vez — avaria costuma render 2 ou 3 ângulos. */}
                <label className="md:hidden flex-1 flex items-center justify-center gap-2 py-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider border-border-default text-text-muted hover:border-warning/50 hover:text-warning transition-colors">
                  <Camera size={14} /> Câmera
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) enviarFotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider border-border-default text-text-muted hover:border-warning/50 hover:text-warning transition-colors">
                  {enviandoFotos ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {enviandoFotos ? 'Enviando...' : 'Galeria'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) enviarFotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------ confirmar exclusão */}
      {excluindo && (
        <Modal
          aberto={!!excluindo}
          onFechar={() => setExcluindo(null)}
          titulo="Excluir ficha da unidade?"
          icone={Trash2}
          tamanho="sm"
          rodape={
            <div className="flex gap-3">
              <button
                onClick={() => setExcluindo(null)}
                className="flex-1 h-11 rounded-control border border-border-default font-medium text-sm text-text-secondary hover:bg-surface-raised"
              >
                Cancelar
              </button>
              <button onClick={confirmarExclusao} className="flex-1 h-11 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90">
                Excluir
              </button>
            </div>
          }
        >
          <p className="text-sm text-text-secondary">
            A ficha de <span className="text-text-primary font-medium">{excluindo.apelido || 'unidade sem apelido'}</span> e suas fotos serão apagadas. A
            quantidade em estoque não muda — se essa unidade foi vendida, registre a venda normalmente.
          </p>
        </Modal>
      )}

      {/* --------------------------------------------- foto em tela cheia */}
      {visualizando && (
        <VisualizadorFotos
          fotos={visualizando.fotos}
          indice={visualizando.indice}
          onTrocar={(indice) => setVisualizando((v) => (v ? { ...v, indice } : v))}
          onFechar={() => setVisualizando(null)}
        />
      )}
    </div>
  );
}

// Visualizador simples de foto em tela cheia. Existe porque avaria só se
// entende vendo de perto — miniatura de 56px não resolve. Navega por seta no
// desktop e por toque nas laterais no celular.
function VisualizadorFotos({
  fotos,
  indice,
  onTrocar,
  onFechar,
}: {
  fotos: string[];
  indice: number;
  onTrocar: (indice: number) => void;
  onFechar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowRight') onTrocar((indice + 1) % fotos.length);
      if (e.key === 'ArrowLeft') onTrocar((indice - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [indice, fotos.length, onTrocar, onFechar]);

  return (
    <div className="fixed inset-0 z-[4000] bg-black/95 flex items-center justify-center" onClick={onFechar} role="presentation">
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {fotos[indice] ? (
        <img src={fotos[indice]} alt={`Avaria ${indice + 1}`} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} />
      ) : (
        <ImageOff size={48} className="text-white/30" />
      )}

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrocar((indice - 1 + fotos.length) % fotos.length);
            }}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrocar((indice + 1) % fotos.length);
            }}
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            <ChevronRight size={22} />
          </button>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white tabular-nums">
            {indice + 1} / {fotos.length}
          </span>
        </>
      )}
    </div>
  );
}
