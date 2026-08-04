import { useEffect } from 'react';

// Contador compartilhado entre todas as instâncias do hook. Sem isso, dois
// modais abertos ao mesmo tempo (ex: detalhe + confirmação, ou busca global
// sobre um modal) brigavam pelo document.body.style.overflow: o que fechasse
// primeiro destravava o scroll mesmo com outro ainda aberto, ou restaurava um
// valor errado — deixando o site travado até dar F5.
let travas = 0;
let overflowOriginal = '';

export function useScrollLock(travado: boolean) {
  useEffect(() => {
    if (!travado) return;

    if (travas === 0) {
      overflowOriginal = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    travas++;

    return () => {
      travas--;
      if (travas === 0) {
        document.body.style.overflow = overflowOriginal;
      }
    };
  }, [travado]);
}
