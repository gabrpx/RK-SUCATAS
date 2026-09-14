// Lista de anúncios da Shopee desta peça (migration_045) — companheiro mais
// simples de EstoqueAnunciosMlEditor.tsx: SÓ leitura + "atualizar
// estatísticas agora", sem colar/editar/remover link à mão. Diferente do
// Mercado Livre, a Shopee nunca teve um fluxo de "colar link já existente" —
// todo anúncio nasce pelo formulário de publicação (POST /publicar-shopee),
// então não existe estado "legado" nem CRUD manual aqui.
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { estoqueApi } from './api';
import type { Estoque, EstoqueAnuncioShopee } from './types';

function EstatisticaLink({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-text-primary leading-tight">{valor}</p>
      <p className="text-[10px] uppercase tracking-wider text-text-faint">{rotulo}</p>
    </div>
  );
}

// "Atualizado há Xmin" — texto discreto pra deixar claro que o número vem do
// scheduler em background (shopeeScheduler.ts), não de uma chamada ao vivo
// no momento em que o modal abriu.
function textoAtualizadoHa(atualizadoEm: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(atualizadoEm).getTime()) / 60000));
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos}min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.round(horas / 24)}d`;
}

interface EstoqueAnunciosShopeeListaProps {
  item: Estoque;
  onAlterado?: (links: EstoqueAnuncioShopee[]) => void;
}

export function EstoqueAnunciosShopeeLista({ item, onAlterado }: EstoqueAnunciosShopeeListaProps) {
  const [links, setLinks] = useState<EstoqueAnuncioShopee[]>(item.links_shopee ?? []);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLinks(item.links_shopee ?? []);
  }, [item.links_shopee, item.id]);

  const atualizarEstatisticas = async (link: EstoqueAnuncioShopee) => {
    setAtualizandoId(link.id);
    setErro(null);
    try {
      const resultado = await estoqueApi.buscarEstatisticasAnuncioShopee(item.id, link.id);
      if (!resultado.success) throw new Error(resultado.error);
      const novos = links.map((l) => (l.id === link.id ? { ...l, estatisticas: resultado.data } : l));
      setLinks(novos);
      onAlterado?.(novos);
    } catch (err: any) {
      setErro(err.message || 'Erro ao atualizar estatísticas');
    } finally {
      setAtualizandoId(null);
    }
  };

  if (links.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.id} className="rounded-control border border-border-subtle bg-surface-inset px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
              {link.url ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-soft-fg">
                  <ExternalLink size={13} className="shrink-0" />
                  <span className="truncate">{link.item_id}</span>
                </a>
              ) : (
                <span className="min-w-0 flex-1 text-sm text-text-secondary truncate">{link.item_id}</span>
              )}
              {link.status_shopee && <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-faint">{link.status_shopee}</span>}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
              {link.estatisticas ? (
                <div className="flex-1 min-w-0 flex items-center gap-4 overflow-x-auto">
                  <EstatisticaLink valor={String(link.estatisticas.visitas_total ?? '—')} rotulo="Visitas" />
                  <EstatisticaLink valor={String(link.estatisticas.vendas_totais ?? '—')} rotulo="Vendas" />
                  <span className="text-[10px] text-text-faint shrink-0">atualizado {textoAtualizadoHa(link.estatisticas.atualizado_em)}</span>
                </div>
              ) : (
                <p className="flex-1 text-xs text-text-faint">Estatísticas ainda não sincronizadas.</p>
              )}
              <button
                type="button"
                onClick={() => atualizarEstatisticas(link)}
                disabled={atualizandoId === link.id}
                title="Atualizar estatísticas agora"
                className="shrink-0 size-7 flex items-center justify-center rounded-control text-text-faint hover:bg-surface-raised hover:text-text-secondary disabled:opacity-50"
              >
                {atualizandoId === link.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {erro && <p className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
