// Comprovantes de PIX de UMA venda. Upload sempre soma à lista — nunca
// existe "substituir", nem no backend nem aqui (ver migration_036). Exclusão
// é soft-delete e só aparece pra quem pode excluir (admin — decisão de
// produto: nunca perder um comprovante por engano de quem só recebe pagamento
// no balcão).
import { useEffect, useState } from 'react';
import { Receipt, Upload, Loader2, FileText, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '../../utils';
import { comprovantesApi, anexarComprovantePix } from './api';
import { comprovanteEhPdf, formatarTamanhoArquivo } from './types';
import type { ComprovantePix } from './types';

interface ComprovanteListItemProps {
  comprovante: ComprovantePix;
  podeExcluir?: boolean;
  onExcluir?: (comprovante: ComprovantePix) => void;
  /** Legenda extra — usado na ficha do cliente pra indicar de qual venda o comprovante veio */
  legenda?: string;
}

export function ComprovanteListItem({ comprovante, podeExcluir, onExcluir, legenda }: ComprovanteListItemProps) {
  const ehPdf = comprovanteEhPdf(comprovante);
  return (
    <div className="flex items-center gap-3 rounded-control border border-border-subtle bg-surface-inset p-3">
      <a
        href={comprovante.url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'shrink-0 size-12 rounded-control overflow-hidden border border-border-default flex items-center justify-center bg-surface-page',
          !comprovante.url && 'pointer-events-none opacity-50'
        )}
        title={comprovante.url ? 'Abrir comprovante' : 'Link indisponível'}
      >
        {ehPdf ? <FileText size={20} className="text-text-muted" /> : <img src={comprovante.url ?? ''} alt={comprovante.nome_arquivo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">{comprovante.nome_arquivo}</p>
        <p className="text-xs text-text-faint">
          {legenda ? `${legenda} · ` : ''}
          {new Date(comprovante.criado_em).toLocaleDateString('pt-BR')} · {formatarTamanhoArquivo(comprovante.tamanho_bytes)}
          {comprovante.autor && ` · ${comprovante.autor.nome_exibicao}`}
        </p>
      </div>
      {comprovante.url && (
        <a
          href={comprovante.url}
          target="_blank"
          rel="noreferrer"
          title="Abrir comprovante"
          className="shrink-0 size-8 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary"
        >
          <ExternalLink size={14} />
        </a>
      )}
      {podeExcluir && (
        <button
          type="button"
          onClick={() => onExcluir?.(comprovante)}
          title="Excluir comprovante"
          className="shrink-0 size-8 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

interface ComprovantesPixVendaProps {
  vendaId: string;
  podeExcluir?: boolean;
  readOnly?: boolean;
}

export function ComprovantesPixVenda({ vendaId, podeExcluir = false, readOnly = false }: ComprovantesPixVendaProps) {
  const [comprovantes, setComprovantes] = useState<ComprovantePix[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    comprovantesApi
      .listarPorVenda(vendaId)
      .then((resultado) => {
        if (ativo && resultado.success) setComprovantes(resultado.data);
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar os comprovantes');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [vendaId]);

  const enviarArquivos = async (files: FileList) => {
    setEnviando(true);
    setErro(null);
    try {
      const novos: ComprovantePix[] = [];
      for (const file of Array.from(files)) {
        const resultado = await anexarComprovantePix(vendaId, file);
        if (!resultado.success) throw new Error(resultado.error || 'Falha ao anexar comprovante');
        novos.push(resultado.data);
      }
      setComprovantes((prev) => [...novos, ...prev]);
    } catch (err: any) {
      setErro(err.message || 'Erro ao anexar comprovante');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async (comprovante: ComprovantePix) => {
    try {
      const resultado = await comprovantesApi.remover(vendaId, comprovante.id);
      if (!resultado.success) throw new Error(resultado.error);
      setComprovantes((prev) => prev.filter((c) => c.id !== comprovante.id));
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir comprovante');
    }
  };

  return (
    <div className="rounded-card border border-border-subtle bg-surface-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted flex items-center gap-2">
          <Receipt size={13} className="text-text-faint" />
          Comprovantes de PIX
        </h4>
        {!readOnly && (
          <label className="shrink-0 h-8 px-3 rounded-control border border-border-default text-text-secondary text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-raised hover:text-text-primary flex items-center gap-1.5 cursor-pointer">
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {enviando ? 'Enviando...' : 'Anexar'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              className="hidden"
              disabled={enviando}
              onChange={(e) => {
                if (e.target.files?.length) enviarArquivos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {erro && <p className="text-xs text-danger">{erro}</p>}

      {carregando ? (
        <p className="text-xs text-text-faint">Carregando...</p>
      ) : comprovantes.length === 0 ? (
        <p className="text-xs text-text-faint">Nenhum comprovante anexado ainda.</p>
      ) : (
        <div className="space-y-2">
          {comprovantes.map((c) => (
            <div key={c.id}>
              <ComprovanteListItem comprovante={c} podeExcluir={podeExcluir} onExcluir={excluir} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
