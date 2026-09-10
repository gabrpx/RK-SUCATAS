// Tela de migração assistida de peças avulsas para famílias. Roda a heurística
// de similaridade (tokenizar/Jaccard) par-a-par sobre todas as peças sem
// familia_id, sugere grupos e pede confirmação manual antes de gravar qualquer
// familia_id — nenhuma fusão automática.
import { useState, useMemo, useCallback } from 'react';
import { Loader2, Check, ChevronDown, ChevronRight, AlertCircle, Merge, Package } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { aviso } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/hooks/useConfirm';
import { estoqueApi, estoqueFamiliasApi } from './api';
import { tokenizar, similaridade, CORTE_POSSIVEL } from './detectarDuplicata';
import type { Estoque } from './types';
import { DialogContent, DialogCloseButton } from '../../components/animate-ui/components/radix/dialog';

// ─── Algoritmo de agrupamento ─────────────────────────────────────────────────

interface GrupoSugerido {
  /** Id estável pra chave React */
  id: string;
  itens: Estoque[];
  nomeSugerido: string;
}

function detectarGruposSugeridos(itens: Estoque[]): GrupoSugerido[] {
  if (itens.length === 0) return [];

  // Union-Find com path compression
  const parent = new Map<string, string>(itens.map((item) => [item.id, item.id]));
  function find(id: string): string {
    const p = parent.get(id)!;
    if (p !== id) { const root = find(p); parent.set(id, root); return root; }
    return p;
  }
  function union(a: string, b: string) { parent.set(find(a), find(b)); }

  const tokens = new Map<string, string[]>(itens.map((item) => [item.id, tokenizar(item.nome)]));

  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      const a = tokens.get(itens[i].id)!;
      const b = tokens.get(itens[j].id)!;
      if (similaridade(a, b) >= CORTE_POSSIVEL) union(itens[i].id, itens[j].id);
    }
  }

  const grupos = new Map<string, Estoque[]>();
  for (const item of itens) {
    const root = find(item.id);
    const g = grupos.get(root) ?? [];
    g.push(item);
    grupos.set(root, g);
  }

  return Array.from(grupos.values())
    .filter((g) => g.length >= 2)
    .map((itensGrupo, idx) => ({
      id: `grupo-${idx}`,
      itens: itensGrupo,
      nomeSugerido: nomeComumDoGrupo(itensGrupo),
    }));
}

// Nome sugerido pro grupo: prefixo de palavras em comum entre todas as fichas
// (ex.: "TANQUE DE COMBUSTÍVEL CG 150 CARBURADA" + "...CG 150 MIX (Avaria)" +
// "...CG 150 START" → "TANQUE DE COMBUSTÍVEL CG 150"). Pegar direto o nome
// mais longo puxava pro card a peça com a descrição mais suja (com "(Avaria)",
// "MIX" etc.) — o usuário sempre pode editar o campo antes de confirmar, mas o
// padrão já deve nascer limpo. Cai pro nome mais longo só quando não há
// prefixo comum útil (grupo com menos de 2 palavras em comum).
function nomeComumDoGrupo(itens: Estoque[]): string {
  const palavrasPorItem = itens.map((item) => item.nome.trim().split(/\s+/));
  const minLen = Math.min(...palavrasPorItem.map((p) => p.length));
  const comuns: string[] = [];
  for (let i = 0; i < minLen; i++) {
    const palavra = palavrasPorItem[0][i];
    const igual = palavrasPorItem.every((p) => p[i].localeCompare(palavra, 'pt-BR', { sensitivity: 'base' }) === 0);
    if (!igual) break;
    comuns.push(palavra);
  }
  if (comuns.length >= 2) return comuns.join(' ');
  return itens.reduce((best, cur) => (cur.nome.length > best.nome.length ? cur : best)).nome;
}

// ─── Card de grupo ────────────────────────────────────────────────────────────

interface GrupoCardProps {
  grupo: GrupoSugerido;
  selecionados: Set<string>;
  nomeEditado: string;
  onToggleItem: (itemId: string) => void;
  onToggleGrupo: (selecionar: boolean) => void;
  onNomeChange: (nome: string) => void;
  expandido: boolean;
  onToggleExpandido: () => void;
}

function GrupoCard({ grupo, selecionados, nomeEditado, onToggleItem, onToggleGrupo, onNomeChange, expandido, onToggleExpandido }: GrupoCardProps) {
  const [imgErros, setImgErros] = useState<Set<string>>(new Set());
  const nSelecionados = grupo.itens.filter((i) => selecionados.has(i.id)).length;
  const todosSelected = nSelecionados === grupo.itens.length;

  return (
    <div className="rounded-control border border-border-subtle overflow-hidden">
      {/* Cabeçalho do grupo */}
      <div className="flex items-start gap-3 p-3 bg-surface-raised">
        <button
          type="button"
          onClick={onToggleExpandido}
          className="mt-1 text-text-muted hover:text-text-secondary shrink-0"
          aria-label={expandido ? 'Recolher' : 'Expandir'}
        >
          {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={nomeEditado}
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Nome da família..."
            className="w-full text-sm font-medium text-text-primary bg-transparent border-0 border-b border-dashed border-border-subtle focus:outline-none focus:border-accent pb-0.5"
          />
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-text-muted">
              {nSelecionados} de {grupo.itens.length} peças marcadas
            </p>
            <button
              type="button"
              onClick={() => onToggleGrupo(!todosSelected)}
              className="text-xs text-accent hover:underline"
            >
              {todosSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
        </div>
      </div>

      {/* Itens do grupo */}
      {expandido && (
        <div className="divide-y divide-border-subtle">
          {grupo.itens.map((item) => {
            const checked = selecionados.has(item.id);
            const foto = item.imagens?.[0];
            const fotoFalhou = imgErros.has(item.id);
            return (
              <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-raised">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleItem(item.id)}
                  className="accent-accent"
                />
                <div className="size-8 rounded overflow-hidden shrink-0 bg-surface-raised flex items-center justify-center">
                  {foto && !fotoFalhou
                    ? <img src={foto} alt={item.nome} className="w-full h-full object-cover" onError={() => setImgErros((prev) => new Set(prev).add(item.id))} />
                    : <Package size={14} className="text-text-faint" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{item.nome}</p>
                  <p className="text-xs text-text-muted">{item.codigo} · {item.modelo_moto?.nome ?? 'Sem modelo'}</p>
                </div>
                <span className="text-xs text-text-muted shrink-0">{item.quantidade} un.</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export interface EstoqueFundirFamiliasModalProps {
  itensAvulsos: Estoque[];
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EstoqueFundirFamiliasModal({ itensAvulsos, open, onClose, onRefresh }: EstoqueFundirFamiliasModalProps) {
  const confirmar = useConfirm();
  const grupos = useMemo(() => detectarGruposSugeridos(itensAvulsos), [itensAvulsos]);

  // Por grupo: Set de itemIds selecionados (começa vazio — usuário seleciona o que quer)
  const [selecoesPorGrupo, setSelecoesPorGrupo] = useState<Map<string, Set<string>>>(() =>
    new Map(grupos.map((g) => [g.id, new Set<string>()]))
  );
  // Nome editável por grupo
  const [nomesPorGrupo, setNomesPorGrupo] = useState<Map<string, string>>(() =>
    new Map(grupos.map((g) => [g.id, g.nomeSugerido]))
  );
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(grupos.map((g) => g.id)));
  const [aplicando, setAplicando] = useState(false);
  const [concluidos, setConcluidos] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((grupoId: string, itemId: string) => {
    setSelecoesPorGrupo((prev) => {
      const next = new Map(prev);
      const sel = new Set(prev.get(grupoId) ?? []);
      sel.has(itemId) ? sel.delete(itemId) : sel.add(itemId);
      next.set(grupoId, sel);
      return next;
    });
  }, []);

  const toggleGrupo = useCallback((grupoId: string, itemIds: string[], selecionar: boolean) => {
    setSelecoesPorGrupo((prev) => {
      const next = new Map(prev);
      next.set(grupoId, selecionar ? new Set(itemIds) : new Set<string>());
      return next;
    });
  }, []);

  const toggleExpandido = useCallback((grupoId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(grupoId) ? next.delete(grupoId) : next.add(grupoId);
      return next;
    });
  }, []);

  const handleAplicar = useCallback(async () => {
    const gruposParaAplicar = grupos.filter((g) => {
      const sel = selecoesPorGrupo.get(g.id);
      return sel && sel.size >= 2 && !concluidos.has(g.id);
    });

    if (gruposParaAplicar.length === 0) {
      aviso.atencao('Nenhum grupo com 2+ peças selecionadas para fundir.');
      return;
    }

    const ok = await confirmar({
      title: `Criar ${gruposParaAplicar.length} família(s) e vincular as peças marcadas?`,
      description: 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Criar famílias',
    });
    if (!ok) return;

    setAplicando(true);
    let erros = 0;
    const novosConcluidos = new Set(concluidos);

    for (const grupo of gruposParaAplicar) {
      const nome = nomesPorGrupo.get(grupo.id)?.trim();
      if (!nome) { erros++; continue; }

      const sel = selecoesPorGrupo.get(grupo.id);
      const itemIds: string[] = sel ? [...sel] : [];
      const primeiroItem = grupo.itens.find((i) => itemIds.includes(i.id));

      // Cria a família
      const resultFamilia = await estoqueFamiliasApi.criar({
        nome,
        categoria_id: primeiroItem?.categoria_id ?? null,
        descricao: null,
        imagem_url: primeiroItem?.imagens[0] ?? null,
      });

      if (!resultFamilia.success) { erros++; continue; }
      const familiaId = resultFamilia.data.id;

      // Vincula cada item selecionado
      let erroGrupo = false;
      for (const itemId of itemIds) {
        const result = await estoqueApi.atualizar(itemId, { familia_id: familiaId });
        if (!result.success) erroGrupo = true;
      }

      if (erroGrupo) erros++;
      else novosConcluidos.add(grupo.id);
    }

    setAplicando(false);
    setConcluidos(novosConcluidos);

    if (erros > 0) aviso.atencao(`${erros} grupo(s) com erro — verifique e tente de novo.`);
    else aviso.sucesso('Famílias criadas com sucesso');
    onRefresh();
  }, [grupos, selecoesPorGrupo, nomesPorGrupo, concluidos, onRefresh, confirmar]);

  const gruposPendentes = grupos.filter((g) => !concluidos.has(g.id));

  return (
    <DialogContent open={open} onClose={onClose} title="Fundir famílias" description="Sugestões de agrupamento de peças similares">
      <DialogCloseButton />

      <div className="px-5 pt-5 pb-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <Merge size={16} className="text-accent" />
          <h2 className="text-base font-semibold text-text-primary">Fundir peças em famílias</h2>
        </div>
        <p className="text-xs text-text-muted mt-1">
          {gruposPendentes.length === 0
            ? 'Todas as sugestões foram aplicadas.'
            : `${gruposPendentes.length} grupo(s) sugerido(s) com base em nomes similares. Marque as peças e confirme para criar as famílias.`}
        </p>
      </div>

      <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3" style={{ maxHeight: 'calc(88dvh - 200px)' }}>
        {grupos.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-text-muted">Nenhuma sugestão de fusão encontrada.</p>
            <p className="text-xs text-text-faint mt-1">Todas as peças avulsas têm nomes suficientemente distintos.</p>
          </div>
        )}

        {grupos.map((grupo) => {
          const concluido = concluidos.has(grupo.id);
          return (
            <div key={grupo.id} className={concluido ? 'opacity-50 pointer-events-none' : ''}>
              {concluido && (
                <div className="flex items-center gap-1.5 text-xs text-positive mb-1">
                  <Check size={12} />
                  Família criada
                </div>
              )}
              <GrupoCard
                grupo={grupo}
                selecionados={selecoesPorGrupo.get(grupo.id) ?? new Set<string>()}
                nomeEditado={nomesPorGrupo.get(grupo.id) ?? grupo.nomeSugerido}
                onToggleItem={(itemId) => toggleItem(grupo.id, itemId)}
                onToggleGrupo={(sel) => toggleGrupo(grupo.id, grupo.itens.map((i) => i.id), sel)}
                onNomeChange={(nome) => setNomesPorGrupo((prev) => new Map(prev).set(grupo.id, nome))}
                expandido={expandidos.has(grupo.id)}
                onToggleExpandido={() => toggleExpandido(grupo.id)}
              />
            </div>
          );
        })}

        {gruposPendentes.length > 0 && (
          <div className="flex items-start gap-2 rounded-control bg-warning-bg px-3 py-2.5 text-xs text-warning">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>Cada grupo precisa de pelo menos 2 peças marcadas para ser criado. Revise antes de confirmar.</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">Fechar</Button>
        {gruposPendentes.length > 0 && (
          <Button size="sm" onClick={handleAplicar} disabled={aplicando} className="h-8 text-xs">
            {aplicando ? <Loader2 size={12} className="animate-spin" /> : <Merge size={12} />}
            Criar famílias
          </Button>
        )}
      </div>
    </DialogContent>
  );
}
