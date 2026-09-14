import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {CapacitorUpdater} from '@capgo/capacitor-updater';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
