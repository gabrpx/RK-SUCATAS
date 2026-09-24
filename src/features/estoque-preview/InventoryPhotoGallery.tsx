import { useEffect, useRef, useState } from "react";

interface InventoryPhotoGalleryProps {
  fotos: string[];
  sku: string;
  origem: "unidade" | "produto";
}

export function InventoryPhotoGallery({ fotos, sku, origem }: InventoryPhotoGalleryProps) {
  const trilho = useRef<HTMLDivElement>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const [fade, setFade] = useState({ esquerda: false, direita: false });
  const titulo = origem === "unidade" ? "Fotos da unidade" : "Fotos do produto";

  function atualizarIndice() {
    const elemento = trilho.current;
    if (!elemento) return;
    const slides = Array.from(elemento.children) as HTMLElement[];
    if (!slides.length) return;
    const inicio = slides[0].offsetLeft;
    const maisProximo = slides.reduce((melhor, slide, indice) =>
      Math.abs(slide.offsetLeft - inicio - elemento.scrollLeft) < Math.abs(slides[melhor].offsetLeft - inicio - elemento.scrollLeft) ? indice : melhor, 0);
    setIndiceAtivo(maisProximo);
    const maximo = elemento.scrollWidth - elemento.clientWidth;
    setFade({ esquerda: elemento.scrollLeft > 2, direita: maximo > 2 && elemento.scrollLeft < maximo - 2 });
  }

  useEffect(() => {
    atualizarIndice();
    window.addEventListener("resize", atualizarIndice);
    return () => window.removeEventListener("resize", atualizarIndice);
  }, [fotos.length]);

  function irPara(indice: number) {
    const elemento = trilho.current;
    const slides = elemento ? Array.from(elemento.children) as HTMLElement[] : [];
    const slide = slides[indice];
    if (elemento && slide) elemento.scrollTo({ left: slide.offsetLeft - slides[0].offsetLeft, behavior: "smooth" });
  }

  if (!fotos.length) return <div className="mt-4 grid aspect-[4/3] place-items-center rounded-control border border-dashed border-border-default bg-surface-inset text-sm font-semibold text-text-muted">Ainda sem foto</div>;

  return <div className="relative mt-4">
    <div
      ref={trilho}
      aria-label={titulo}
      tabIndex={0}
      onScroll={atualizarIndice}
      onWheel={(event) => {
        const elemento = event.currentTarget;
        const maximo = elemento.scrollWidth - elemento.clientWidth;
        const rolagemVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
        const noInicio = elemento.scrollLeft <= 1;
        const noFim = elemento.scrollLeft >= maximo - 1;
        if (rolagemVertical && maximo > 1 && !((event.deltaY < 0 && noInicio) || (event.deltaY > 0 && noFim))) {
          event.preventDefault();
          elemento.scrollLeft += event.deltaY;
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          irPara(Math.max(0, Math.min(fotos.length - 1, indiceAtivo + (event.key === "ArrowRight" ? 1 : -1))));
        }
      }}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >{fotos.map((foto, indice) => <div key={`${foto}-${indice}`} className="w-[86%] shrink-0 snap-start overflow-hidden rounded-control border border-border-default bg-surface-inset">
        <div className="aspect-[4/3] w-full"><img src={foto} alt={`${titulo}, foto ${indice + 1}, unidade ${sku}`} className="h-full w-full object-contain" /></div>
      </div>)}</div>
    {fade.esquerda && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-12 rounded-l-control bg-gradient-to-r from-surface-card/95 to-transparent" />}
    {fade.direita && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-12 rounded-r-control bg-gradient-to-l from-surface-card/95 to-transparent" />}
    {fotos.length > 1 && <div className="mt-2 flex min-h-4 items-center justify-center gap-1.5" aria-label={`Indicadores de ${titulo.toLocaleLowerCase("pt-BR")}`}>
      {fotos.map((foto, indice) => <button key={`${foto}-indicador-${indice}`} type="button" aria-label={`Mostrar foto ${indice + 1} de ${fotos.length}`} aria-current={indiceAtivo === indice ? "true" : undefined} onClick={() => irPara(indice)} className="group grid size-4 cursor-pointer place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"><span className={`h-1.5 rounded-full transition-all duration-200 ${indiceAtivo === indice ? "w-4 bg-accent" : "w-1.5 bg-border-strong group-hover:bg-accent/60"}`} /></button>)}
    </div>}
  </div>;
}
