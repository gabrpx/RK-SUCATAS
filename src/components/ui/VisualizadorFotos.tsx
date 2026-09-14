// Visualizador de foto em tela cheia, com navegação por seta (desktop) ou
// pelos botões laterais (celular). Usado em qualquer galeria de mais de uma
// foto — peça (Estoque.imagens) e unidade de estoque (EstoqueUnidade.fotos).
import { useEffect } from 'react';
import { X, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';

interface VisualizadorFotosProps {
  fotos: string[];
  indice: number;
  onTrocar: (indice: number) => void;
  onFechar: () => void;
  /** Rótulo do alt/contador — "Foto" por padrão, "Unidade" pras fichas de unidade */
  legenda?: string;
}

export function VisualizadorFotos({ fotos, indice, onTrocar, onFechar, legenda = 'Foto' }: VisualizadorFotosProps) {
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
    <div
      // pointer-events-auto: o Radix Dialog põe pointer-events:none no
      // <body> inteiro enquanto aberto (só a própria Content reativa
      // localmente) — sem isso, esse overlay (outro portal direto em
      // document.body) herda o none e o toque passa reto pro Overlay do
      // Modal atrás dele, fechando ELE em vez desta foto (Fase 6, achado
      // com elementsFromPoint no navegador — ver mesmo comentário em
      // image-zoom.tsx).
      className="fixed inset-0 z-[4000] bg-overlay-scrim-strong flex items-center justify-center pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        onFechar();
      }}
      onTouchEnd={(e) => e.stopPropagation()}
      role="presentation"
      // Marca esse overlay pra quem escuta clique/toque "fora" de um
      // painel/modal ancestral não tratar isso como "fora dele", mesmo o
      // overlay ficando visualmente por cima.
      data-photo-overlay=""
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFechar();
        }}
        onTouchEnd={(e) => e.stopPropagation()}
        aria-label="Fechar"
        className="absolute top-4 right-4 size-12 rounded-full bg-overlay-control-bg text-white flex items-center justify-center hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {fotos[indice] ? (
        <img
          src={fotos[indice]}
          alt={`${legenda} ${indice + 1}`}
          className="max-w-full max-h-full object-contain"
          referrerPolicy="no-referrer"
          onClick={(e) => e.stopPropagation()}
        />
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
            className="absolute left-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-overlay-control-bg text-white flex items-center justify-center hover:bg-white/20"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 size-12 rounded-full bg-overlay-control-bg text-white flex items-center justify-center hover:bg-white/20"
          >
            <ChevronRight size={22} />
          </button>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-overlay-control-bg px-3 py-1 text-xs text-white tabular-nums">
            {indice + 1} / {fotos.length}
          </span>
        </>
      )}
    </div>
  );
}
