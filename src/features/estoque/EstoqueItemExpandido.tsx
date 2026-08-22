// Painel de detalhe inline de uma peça — avaria por unidade, categoria
// completa, fotos e links de anúncio, sem sair da lista. Todo clique aqui
// dentro para a propagação: a linha/card por trás continua abrindo o
// DetailModal (onSelectItem) só quando clicado fora deste painel.
//
// Shopee (links_shopee) não entra aqui: esta branch foi criada a partir do
// histórico commitado, e a integração com Shopee ainda vive só como mudanças
// não commitadas no checkout principal — o campo não existe em `Estoque`
// (types.ts) nesta branch. Só ML + Facebook por enquanto.
import { Fragment } from 'react';
import { AlertTriangle, ExternalLink, Package } from 'lucide-react';
import { ImageZoom } from '../../components/ui/image-zoom';
import { getAncestorChain } from '../categorias/categoriaTree';
import type { Categoria } from '../../types/catalog';
import type { Estoque } from './types';

interface EstoqueItemExpandidoProps {
  item: Estoque;
  categorias: Categoria[];
}

export function EstoqueItemExpandido({ item, categorias }: EstoqueItemExpandidoProps) {
  const caminhoCategoria = item.categoria_id ? getAncestorChain(item.categoria_id, categorias).map((c) => c.nome).join(' › ') : null;
  const unidadesComAvaria = (item.unidades ?? []).filter((u) => u.avaria);
  const semAnuncio = !item.links_ml?.length && !item.anuncio_fb_url;

  return (
    <div onClick={(e) => e.stopPropagation()} className="grid gap-4 p-4 bg-surface-inset rounded-control sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Categoria completa</p>
          <p className="text-xs text-text-secondary">{caminhoCategoria ?? 'Sem categoria'}</p>
        </div>

        {unidadesComAvaria.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Avarias</p>
            <ul className="space-y-1.5">
              {unidadesComAvaria.map((u) => (
                <li key={u.id} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    {u.apelido ? `${u.apelido}: ` : ''}
                    {u.avaria_descricao || 'Sem descrição'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Anúncios</p>
          <div className="flex flex-col gap-1">
            {(item.links_ml ?? []).map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent-soft-fg hover:underline">
                <ExternalLink size={11} /> Mercado Livre{link.status_ml ? ` — ${link.status_ml}` : ''}
              </a>
            ))}
            {item.anuncio_fb_url && (
              <a href={item.anuncio_fb_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent-soft-fg hover:underline">
                <ExternalLink size={11} /> Facebook
              </a>
            )}
            {semAnuncio && <p className="text-xs text-text-faint">Nenhum anúncio vinculado.</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Fotos ({item.imagens.length})</p>
        {/* Cada foto abre em tela cheia no clique (ImageZoom). O Fragment é
            quem carrega a key: ImageZoom tipa só as próprias props, mesmo
            padrão já usado com o MotoCard em EstoqueByMoto. */}
        {item.imagens.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.imagens.map((url, i) => (
              <Fragment key={url}>
                <ImageZoom
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className="size-16 rounded-control border border-border-default"
                  referrerPolicy="no-referrer"
                />
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-faint">
            <Package size={14} /> Sem fotos
          </div>
        )}
      </div>
    </div>
  );
}
