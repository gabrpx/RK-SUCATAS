import { useEffect, useRef, useState } from "react";
import { InventoryDrawer } from "./InventoryDrawer";
import type { ResultadoBuscaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

function formatarPreco(preco: number | null) {
  return preco === null ? "Preço a definir" : preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function status(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return "Vendida";
  if (unidade.estado === "arquivada") return "Arquivada";
  if (unidade.estado === "reservada") return "Reservada";
  if (unidade.estado === "organizar" || !unidade.endereco) return "Para organizar";
  return "Disponível";
}

export function InventoryPieceSummaryDrawer({
  resultado,
  onClose,
  onOpenUnit,
}: {
  resultado: ResultadoBuscaEstoque | null;
  onClose: () => void;
  onOpenUnit: (unidade: UnidadeEstoque) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const unidadesOrdenadas = resultado
    ? [...resultado.unidades].sort((a, b) => ({ A: 0, B: 1, C: 2 })[a.grau] - ({ A: 0, B: 1, C: 2 })[b.grau])
    : [];

  useEffect(() => {
    const element = scroller.current;
    if (!element || !resultado) return;
    const atualizarFade = () => {
      const maximo = element.scrollHeight - element.clientHeight;
      setFade({ top: element.scrollTop > 2, bottom: maximo > 2 && element.scrollTop < maximo - 2 });
    };
    atualizarFade();
    window.addEventListener("resize", atualizarFade);
    return () => window.removeEventListener("resize", atualizarFade);
  }, [resultado, unidadesOrdenadas.length]);

  if (!resultado) return null;

  return (
    <InventoryDrawer isOpen onClose={onClose} title={`Unidades de ${resultado.peca.codigoLegado}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{resultado.categoria.nome} · {resultado.peca.codigoLegado}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{resultado.peca.nome}</h2>
          <p className="mt-1 text-xs text-text-muted">{resultado.peca.compatibilidades.join(" · ") || "Moto não informada"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">{unidadesOrdenadas.length} {unidadesOrdenadas.length === 1 ? "unidade" : "unidades"}</span>
      </div>

      {unidadesOrdenadas.length ? (
        <div className="relative">
          <div
            ref={scroller}
            role="list"
            aria-label={`Todas as unidades de ${resultado.peca.nome}, da melhor condição para a pior`}
            onScroll={(event) => {
              const element = event.currentTarget;
              const maximo = element.scrollHeight - element.clientHeight;
              setFade({ top: element.scrollTop > 2, bottom: maximo > 2 && element.scrollTop < maximo - 2 });
            }}
            className="max-h-[calc(100dvh-12rem)] space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {unidadesOrdenadas.map((unidade) => {
              const fotoPropria = unidade.fotos?.find(Boolean) ?? unidade.fotoUrl;
              const foto = fotoPropria || resultado.peca.fotos?.find(Boolean);
              const usandoFotoReferencia = !fotoPropria && Boolean(foto);
              return <div key={unidade.id} role="listitem">
                <button
                  type="button"
                  onClick={() => onOpenUnit(unidade)}
                  aria-label={`Abrir ${unidade.sku}, Grau ${unidade.grau}, ${formatarPreco(unidade.preco)}, ${status(unidade)}`}
                  className="flex min-h-24 w-full cursor-pointer items-center gap-3 rounded-control border border-border-default bg-surface-card p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                <div className="relative grid w-20 aspect-[4/3] shrink-0 place-items-center overflow-hidden rounded-control border border-border-default bg-surface-inset text-center text-[10px] font-medium text-text-faint">
                  {foto ? <img src={foto} alt={usandoFotoReferencia ? `Foto de referência de ${unidade.sku}` : `Foto de ${unidade.sku}`} className="size-full object-contain" /> : "Sem foto"}
                  {usandoFotoReferencia && <span title="Foto geral da peça, não uma foto própria da unidade" className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-surface-card/95 px-1 py-0.5 text-[8px] font-bold leading-none text-text-secondary shadow-sm">Ref.</span>}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="text-sm text-text-primary">{unidade.sku}</strong>
                    <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-secondary">Grau {unidade.grau}</span>
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-text-primary">{formatarPreco(unidade.preco)}</span>
                  <span className="mt-1 block truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · {unidade.origem ?? "Origem não identificada"}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{status(unidade)}</span>
                </span>
                </button>
              </div>;
            })}
          </div>
          {fade.top && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-8 bg-gradient-to-b from-surface-card via-surface-card/80 to-transparent" />}
          {fade.bottom && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-8 bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent" />}
        </div>
      ) : (
        <p className="rounded-control border border-dashed border-border-default p-4 text-sm text-text-muted">Esta peça ainda não tem unidades físicas.</p>
      )}
    </InventoryDrawer>
  );
}
