import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    base: './', // Necessário para o Capacitor carregar corretamente os assets
    build: {
      outDir: 'dist',
    },
    // removerFundoImagem.worker.ts faz import() dinâmico de @imgly/background-removal,
    // o que exige code-splitting dentro do worker — só o formato 'es' suporta isso
    // (o padrão 'iife' do Vite quebra o build de produção nesse caso).
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
