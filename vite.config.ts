/// <reference types="vitest/config" />
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
    test: {
      // 'node' de propósito, NÃO 'jsdom': todo teste de DOM deste repo declara
      // o próprio `// @vitest-environment jsdom` no topo do arquivo. Ligar jsdom
      // global aqui não ajudaria nenhum deles e ainda jogaria os ~10 testes de
      // servidor/serviço (rotas, mercadolivre*, workers) dentro de um ambiente
      // de browser — onde código que checa `typeof window !== 'undefined'`
      // (o adapter do axios, por exemplo) pega o caminho errado silenciosamente.
      environment: 'node',
      // setupFiles roda em qualquer environment; o polyfill de ResizeObserver
      // lá dentro é guardado por `typeof === 'undefined'`, então é inócuo no node.
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
