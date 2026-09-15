// Painel de detalhe inline de uma peça — avaria por unidade, categoria
// completa, fotos e links de anúncio, sem sair da lista. Todo clique aqui
// dentro para a propagação: a linha/card por trás continua abrindo o
// DetailModal (onSelectItem) só quando clicado fora deste painel.
//
// Shopee (links_shopee) não entra aqui: esta branch foi criada a partir do
// histórico commitado, e a integração com Shopee ainda vive só como mudanças
// não commitadas no checkout principal — o campo não existe em `Estoque`
// (types.ts) nesta branch. Só ML + Facebook por enquanto.
import { Fragment, useState } from 'react';
import { AlertTriangle, ExternalLink, Package } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../components/animate-ui/components/animate/tabs';
import { ImageZoom } from '../../components/ui/image-zoom';
import { getAncestorChain } from '../categorias/categoriaTree';
import { UnidadeDetailDialog } from './gaveta/UnidadeDetailDialog';
import { UnidadeForm } from './gaveta/UnidadeForm';
import { UnidadeRow } from './gaveta/UnidadeRow';
import type { Categoria } from '../../types/catalog';
import type { Estoque, EstoqueUnidade } from './types';

interface EstoqueItemExpandidoProps {
  item: Estoque;
  categorias: Categoria[];
  onAtualizar?: () => void | Promise<void>;
}

type AbaDetalhe = 'resumo' | 'unidades' | 'anuncios';

export function EstoqueItemExpandido({ item, categorias, onAtualizar }: EstoqueItemExpandidoProps) {
  const [aba, setAba] = useState<AbaDetalhe>('resumo');
  const [unidadeEmFicha, setUnidadeEmFicha] = useState<EstoqueUnidade | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<EstoqueUnidade | null>(null);
  const caminhoCategoria = item.categoria_id ? getAncestorChain(item.categoria_id, categorias).map((c) => c.nome).join(' › ') : null;
  const unidadesComAvaria = (item.unidades ?? []).filter((u) => u.avaria);
  const unidadesDisponiveis = (item.unidades ?? []).filter((u) => !u.vendida_em);
  const unidadesVendidas = (item.unidades ?? []).filter((u) => u.vendida_em);
  const semAnuncio = !item.links_ml?.length && !item.anuncio_fb_url;

  const salvarEdicao = async () => {
    setUnidadeEditando(null);
    await onAtualizar?.();
  };

  return (
    <div onClick={(e) => e.stopPropagation()} className="space-y-4 rounded-control bg-surface-inset p-4">
      <Tabs value={aba} onValueChange={(valor) => setAba(valor as AbaDetalhe)}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="unidades">Unidades ({unidadesDisponiveis.length})</TabsTrigger>
          <TabsTrigger value="anuncios">Anúncios</TabsTrigger>
        </TabsList>
      </Tabs>

      {aba === 'resumo' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Categoria completa</p>
              <p className="text-xs text-text-secondary">{caminhoCategoria ?? 'Sem categoria'}</p>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Fichas</p>
              <p className="text-xs text-text-secondary">
                {unidadesDisponiveis.length} {unidadesDisponiveis.length === 1 ? 'disponível' : 'disponíveis'}
                {unidadesVendidas.length > 0 && ` · ${unidadesVendidas.length} vendida${unidadesVendidas.length === 1 ? '' : 's'}`}
              </p>
            </div>

            {unidadesComAvaria.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Avarias</p>
                <ul className="space-y-1.5">
                  {unidadesComAvaria.map((u) => (
                    <li key={u.id} className="flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>
                        {u.nome ? `${u.nome}: ` : ''}
                        {u.avaria_descricao || 'Sem descrição'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Fotos de referência da peça ({item.imagens.length})</p>
            {item.imagens.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {item.imagens.map((url, i) => (
                  <Fragment key={url}>
                    <ImageZoom
                      src={url}
                      alt={`Foto de referência ${i + 1}`}
                      className="size-16 rounded-control border border-border-default"
                      referrerPolicy="no-referrer"
                    />
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-text-faint">
                <Package size={14} /> Sem fotos de referência
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'unidades' && (
        <div className="space-y-3">
          {unidadesDisponiveis.length > 0 ? (
            <div className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-default bg-surface-card">
              {unidadesDisponiveis.map((unidade, indice) => (
                <UnidadeRow
                  key={unidade.id}
                  unidade={unidade}
                  numero={indice + 1}
                  nomePadrao={item.nome}
                  valorPadrao={item.valor}
                  notaPadrao={item.condicao_nota}
                  variante={item}
                  onAbrirFicha={setUnidadeEmFicha}
                />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">Nenhuma ficha disponível.</p>
          )}

          {unidadesVendidas.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Unidades vendidas ({unidadesVendidas.length})</p>
              <div className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-subtle opacity-70">
                {unidadesVendidas.map((unidade, indice) => (
                  <UnidadeRow
                    key={unidade.id}
                    unidade={unidade}
                    numero={unidadesDisponiveis.length + indice + 1}
                    nomePadrao={item.nome}
                    valorPadrao={item.valor}
                    notaPadrao={item.condicao_nota}
                    variante={item}
                    onAbrirFicha={setUnidadeEmFicha}
                  />
                ))}
              </div>
            </div>
          )}

          {unidadeEditando && (
            <UnidadeForm
              estoqueId={item.id}
              unidade={unidadeEditando}
              onSalvar={salvarEdicao}
              onCancelar={() => setUnidadeEditando(null)}
            />
          )}
        </div>
      )}

      {aba === 'anuncios' && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Anúncios</p>
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
      )}

      <UnidadeDetailDialog
        aberto={Boolean(unidadeEmFicha)}
        unidade={unidadeEmFicha}
        numero={unidadesDisponiveis.findIndex((unidade) => unidade.id === unidadeEmFicha?.id) + 1}
        variante={item}
        onFechar={() => setUnidadeEmFicha(null)}
        onEditar={(unidade) => {
          setUnidadeEmFicha(null);
          setUnidadeEditando(unidade);
        }}
      />
    </div>
  );
}
