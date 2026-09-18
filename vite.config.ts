/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    base: './', // Necessário para o Capacitor carregar corretamente os assets
    cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
    build: {
      outDir: 'dist',
    },
    // removerFundoImagem.worker.ts faz import() dinâmico de @imgly/background-removal,
    // o que exige code-splitting dentro do worker — só o formato 'es' suporta isso
    // (o padrão 'iife' do Vite quebra o build de produção nesse caso).
    worker: {
      format: 'es' as const,
    },
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // O novo sistema usa uma porta própria para não ser confundido com o
      // preview legado, que historicamente roda em 4173.
      port: Number(process.env.VITE_PORT || 3001),
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: Number(process.env.VITE_PREVIEW_PORT || 3001),
      strictPort: true,
    },
    test: {
      // Worktrees de outros agentes ficam dentro do repositório, mas não fazem
      // parte da suíte deste checkout. Sem este filtro o Vitest executa os
      // mesmos testes várias vezes e mistura dependências/estado entre árvores.
      exclude: ['**/node_modules/**', '**/.worktrees/**', '**/dist/**'],
      // A suíte de UI pode ficar mais lenta quando todos os arquivos rodam em
      // paralelo; isso evita falso negativo sem mascarar travas reais.
      testTimeout: 10000,
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
