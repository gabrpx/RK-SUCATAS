import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {CapacitorUpdater} from '@capgo/capacitor-updater';
import App from './App.tsx';
import { EstoquePreview } from './features/estoque-preview/EstoquePreview.tsx';
import { ehRotaEstoquePreview } from './features/estoque-preview/previewRoute.ts';
import { VendasPreview } from './features/vendas-preview/VendasPreview.tsx';
import { ehRotaVendasPreview } from './features/vendas-preview/previewRoute.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Estoque segue isolado; Vendas consulta clientes e motos por endpoints de leitura autorizados. */}
    {ehRotaVendasPreview(window.location.pathname) ? <VendasPreview /> : ehRotaEstoquePreview(window.location.pathname) ? <EstoquePreview /> : <App />}
  </StrictMode>,
);

// Confirma pro Capgo que o bundle atual carregou e rodou com sucesso — sem
// isso o CapacitorUpdater trata a atualização como suspeita e reverte pra
// anterior no próximo start (mecanismo de auto-rollback), e o CI nem
// consegue publicar bundle novo (bloqueia com "notifyAppReady() is
// missing"). Só existe em runtime nativo, por isso o gate.
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().catch((err) => console.error('Erro ao notificar CapacitorUpdater que o app está pronto:', err));
}
