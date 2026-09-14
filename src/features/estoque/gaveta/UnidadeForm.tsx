// Form inline "NOVA UNIDADE" do mockup T03-adicionar-unidade.png: preço
// (obrigatório, destacado com borda accent) + nome opcional, nota de
// condição, avaria + descrição condicional e até 5 fotos. Reaproveita o
// mesmo serviço de upload (uploadImagemEstoque/comprimirImagem) e o mesmo
// CondicaoNotaPicker já usados em UnidadesEstoque.tsx — só a casca do form é
// nova (inline, não modal, porque aqui a unidade vive dentro da variante).
//
// Nota: o mockup desenha uma linha "COMPATIBILIDADE (ANO)" com dois anos,
// mas EstoqueUnidadeInput (Tasks 2/4) não tem esses campos — ficaria só
// visual, sem persistir. Deixado de fora até o schema ganhar esses campos;
// ver task-9-report.md.
import { useState } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '../../../utils';
import { Checkbox } from '../../../components/ui/checkbox';
import { Button } from '../../../components/ui/button';
import { estoqueApi, uploadImagemEstoque } from '../api';
import { comprimirImagem } from '../../../utils/comprimirImagem';
import { CondicaoNotaPicker } from '../CondicaoNotaPicker';
import { CurrencyInput } from './CurrencyInput';
import type { EstoqueUnidade, EstoqueUnidadeInput } from '../types';

const MAX_FOTOS = 5;

interface UnidadeFormProps {
  estoqueId: string;
  /** Nome derivado da variação do modelo; o funcionário pode editar ou apagar. */
  nomeSugerido?: string | null;
  /** Presente = editando ficha existente; ausente = nova unidade */
  unidade?: EstoqueUnidade;
  onSalvar: (unidade: EstoqueUnidade) => void;
  onCancelar: () => void;
  /**
   * Só faz sentido ao criar: salva e mantém o form aberto e limpo para
   * cadastrar a próxima unidade em sequência, sem fechar/reabrir.
   */
  onSalvarEContinuar?: (unidade: EstoqueUnidade) => void;
}

function formVazio(unidade?: EstoqueUnidade, nomeSugerido?: string | null): EstoqueUnidadeInput {
  return {
    nome: unidade?.nome ?? nomeSugerido ?? '',
    condicao_nota: unidade?.condicao_nota ?? null,
    avaria: unidade?.avaria ?? false,
    avaria_descricao: unidade?.avaria_descricao ?? '',
    descricao: unidade?.descricao ?? '',
    fotos: unidade?.fotos ?? [],
    valor: unidade?.valor ?? null,
  };
}

export function UnidadeForm({ estoqueId, unidade, nomeSugerido, onSalvar, onCancelar, onSalvarEContinuar }: UnidadeFormProps) {
  const [form, setForm] = useState<EstoqueUnidadeInput>(() => formVazio(unidade, nomeSugerido));
  const [salvando, setSalvando] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const precoValido = form.valor !== null && form.valor !== undefined && form.valor > 0;
  const fotosCheias = form.fotos.length >= MAX_FOTOS;

  const enviarFotos = async (files: FileList) => {
    setEnviandoFotos(true);
    setErro(null);
    try {
      const espaco = Math.max(0, MAX_FOTOS - form.fotos.length);
      const novas: string[] = [];
      for (const file of Array.from(files).slice(0, espaco)) {
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

  const salvar = async (continuar = false) => {
    if (!precoValido) return;
    setSalvando(true);
    setErro(null);
    const payload: EstoqueUnidadeInput = {
      ...form,
      nome: form.nome?.trim() || null,
      avaria_descricao: form.avaria ? form.avaria_descricao?.trim() || null : null,
      descricao: form.descricao?.trim() || null,
    };
    try {
      const resultado = unidade
        ? await estoqueApi.atualizarUnidade(estoqueId, unidade.id, payload)
        : await estoqueApi.criarUnidade(estoqueId, payload);
      if (!resultado.success) throw new Error(resultado.error);
      if (continuar && onSalvarEContinuar) {
        onSalvarEContinuar(resultado.data);
        setForm(formVazio()); // limpa e mantém aberto para a próxima
      } else {
        onSalvar(resultado.data);
      }
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar unidade');
    } finally {
      setSalvando(false);
    }
  };

  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';
  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

  return (
    <div className="rounded-card border border-accent bg-surface-card p-4 space-y-4">
      <h5 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
        {unidade ? 'Editar unidade' : 'Nova unidade'}
      </h5>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="unidade-preco">
            Preço
          </label>
          <CurrencyInput
            id="unidade-preco"
            value={form.valor}
            onChange={(v) => setForm((f) => ({ ...f, valor: v }))}
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="unidade-nome">
            Nome {nomeSugerido && !unidade ? '(sugerido)' : '(opcional)'}
          </label>
          <input
            id="unidade-nome"
            value={form.nome ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder={nomeSugerido && !unidade ? nomeSugerido : 'Ex: A do risco'}
            className={cn(inputClass, 'h-11 sm:h-9')}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="unidade-descricao">
          Descrição (opcional)
        </label>
        <textarea
          id="unidade-descricao"
          value={form.descricao ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          rows={2}
          placeholder="Observação geral sobre esta unidade"
          className={cn(inputClass, 'resize-none')}
        />
      </div>

      <CondicaoNotaPicker
        valor={form.condicao_nota}
        onChange={(n) => setForm((f) => ({ ...f, condicao_nota: n }))}
        label="Nota de condição desta unidade"
        textoLimpar="Usar a nota da peça"
      />

      <label className="flex items-center gap-3 cursor-pointer h-11 sm:h-auto">
        <Checkbox
          checked={form.avaria}
          onCheckedChange={(checked) => setForm((f) => ({ ...f, avaria: checked === true }))}
        />
        <span className="text-sm text-text-secondary">Avaria</span>
      </label>

      {form.avaria && (
        <div>
          <label className={labelClass} htmlFor="unidade-avaria-descricao">
            Descreva o defeito
          </label>
          <textarea
            id="unidade-avaria-descricao"
            value={form.avaria_descricao ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, avaria_descricao: e.target.value }))}
            rows={2}
            placeholder="Ex: lateral amassada, sem o bico injetor"
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Anexar fotos (opcional) — até {MAX_FOTOS} fotos</label>

        {form.fotos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.fotos.map((foto, i) => (
              <div key={foto} className="relative size-16 rounded-control overflow-hidden border border-border-default">
                <img src={foto} alt={`Foto da unidade ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, fotos: f.fotos.filter((u) => u !== foto) }))}
                  title="Remover foto"
                  className="absolute top-0.5 right-0.5 size-5 rounded-full bg-overlay-scrim text-white flex items-center justify-center hover:bg-danger"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!fotosCheias && (
          <div className="flex gap-2">
            <label className="md:hidden flex-1 flex items-center justify-center gap-2 py-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg transition-colors">
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
            <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg transition-colors">
              {enviandoFotos ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {enviandoFotos ? 'Enviando...' : 'Toque para adicionar'}
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
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="accent-cta"
            size="mobile"
            className="flex-1 sm:h-9 sm:text-sm"
            onClick={() => salvar(false)}
            disabled={!precoValido || salvando || enviandoFotos}
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
          </Button>
          <Button type="button" variant="ghost" size="mobile" className="flex-1 sm:h-9 sm:text-sm" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
        </div>
        {!unidade && onSalvarEContinuar && (
          <Button
            type="button"
            variant="outline"
            size="mobile"
            className="w-full sm:h-9 sm:text-sm"
            onClick={() => salvar(true)}
            disabled={!precoValido || salvando || enviandoFotos}
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar e adicionar próxima unidade'}
          </Button>
        )}
      </div>
    </div>
  );
}
