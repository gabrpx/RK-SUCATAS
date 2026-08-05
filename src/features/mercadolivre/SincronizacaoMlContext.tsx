// Ponto único pra abrir a lista de revisão de sincronização (SincronizacaoModal)
// de qualquer aba, mesmo depois de trocar de tela. App.tsx só mantém a aba
// ATIVA montada (ternário de tab) — se este modal vivesse como estado local
// dentro de VendasView, o toast "Sincronizar agora" pararia de funcionar
// assim que a pessoa trocasse de aba antes de clicar. É o mesmo problema que
// <Toaster /> já resolve em App.tsx (montado como irmão de <AppContent />,
// "fora do AppContent pra sobreviver à troca de aba") — mesma solução aqui.
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { SincronizacaoModal } from './SincronizacaoModal';

interface SincronizacaoMlContextValue {
  /** focoEstoqueIds: rola até esses itens ao abrir, mas não pré-marca — a
   * seleção continua sendo sempre um clique explícito do usuário. */
  abrir: (focoEstoqueIds?: string[]) => void;
}

const SincronizacaoMlContext = createContext<SincronizacaoMlContextValue | null>(null);

export function useSincronizacaoMl(): SincronizacaoMlContextValue {
  const ctx = useContext(SincronizacaoMlContext);
  if (!ctx) throw new Error('useSincronizacaoMl precisa ser usado dentro de <SincronizacaoMlProvider>');
  return ctx;
}

export function SincronizacaoMlProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [focoEstoqueIds, setFocoEstoqueIds] = useState<string[] | undefined>(undefined);

  const abrir = useCallback((ids?: string[]) => {
    setFocoEstoqueIds(ids);
    setAberto(true);
  }, []);

  const fechar = useCallback(() => setAberto(false), []);

  return (
    <SincronizacaoMlContext.Provider value={{ abrir }}>
      {children}
      <SincronizacaoModal aberto={aberto} focoEstoqueIds={focoEstoqueIds} onFechar={fechar} />
    </SincronizacaoMlContext.Provider>
  );
}
