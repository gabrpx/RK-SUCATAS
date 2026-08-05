// Vínculos de anúncio do Mercado Livre desta peça (migration_025). Substitui
// o campo único que existia antes (1 link por peça) — agora dá pra vincular
// quantos anúncios forem precisos, cada um sincronizável com seu próprio
// preço no ML (ver src/features/mercadolivre/SincronizacaoModal.tsx).
//
// Salva por linha, sem form grande: adicionar já grava (POST), remover já
// grava (DELETE) — mesmo espírito de UnidadesEstoque.tsx, mas mais simples
// porque aqui não há campos além do link em si.
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { estoqueApi } from './api';
import type { Estoque, EstoqueAnuncioMl } from './types';

const inputClass =
  'flex-1 min-w-0 border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

interface EstoqueAnunciosMlEditorProps {
  item: Estoque;
  onAlterado?: (links: EstoqueAnuncioMl[]) => void;
}

export function EstoqueAnunciosMlEditor({ item, onAlterado }: EstoqueAnunciosMlEditorProps) {
  const [links, setLinks] = useState<EstoqueAnuncioMl[]>(item.links_ml ?? []);
  const [novoUrl, setNovoUrl] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Mesma sincronização de UnidadesEstoque.tsx: se o modal trocar de peça
  // sem desmontar (ex: "salvar e cadastrar próxima"), a lista tem que
  // acompanhar o item novo, não continuar mostrando os links do anterior.
  useEffect(() => {
    setLinks(item.links_ml ?? []);
  }, [item.links_ml, item.id]);

  const adicionar = async () => {
    const url = novoUrl.trim();
    if (!url) return;
    setAdicionando(true);
    setErro(null);
    try {
      const resultado = await estoqueApi.criarAnuncioMl(item.id, { url });
      if (!resultado.success) throw new Error(resultado.error);
      const novos = [...links, resultado.data];
      setLinks(novos);
      setNovoUrl('');
      onAlterado?.(novos);
    } catch (err: any) {
      setErro(err.message || 'Erro ao vincular anúncio');
    } finally {
      setAdicionando(false);
    }
  };

  const remover = async (link: EstoqueAnuncioMl) => {
    setRemovendoId(link.id);
    setErro(null);
    try {
      const resultado = await estoqueApi.excluirAnuncioMl(item.id, link.id);
      if (!resultado.success) throw new Error(resultado.error);
      const novos = links.filter((l) => l.id !== link.id);
      setLinks(novos);
      onAlterado?.(novos);
    } catch (err: any) {
      setErro(err.message || 'Erro ao remover anúncio');
    } finally {
      setRemovendoId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-2 rounded-control border border-border-subtle bg-surface-inset px-3 py-2">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-soft-fg"
              >
                <ExternalLink size={13} className="shrink-0" />
                <span className="truncate">{link.mlb_id || link.url}</span>
              </a>
              <button
                type="button"
                onClick={() => remover(link)}
                disabled={removendoId === link.id}
                title="Remover vínculo"
                className="shrink-0 size-7 flex items-center justify-center rounded-control text-danger hover:bg-surface-raised disabled:opacity-50"
              >
                {removendoId === link.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="text-xs text-danger">{erro}</p>}

      <div className="flex gap-2">
        <input
          value={novoUrl}
          onChange={(e) => setNovoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Colar link do anúncio no Mercado Livre"
          className={inputClass}
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={adicionando || !novoUrl.trim()}
          className="shrink-0 h-11 px-3 rounded-control border border-border-default text-text-secondary text-xs font-semibold hover:bg-surface-raised disabled:opacity-50 flex items-center gap-1.5"
        >
          {adicionando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Adicionar
        </button>
      </div>
    </div>
  );
}
