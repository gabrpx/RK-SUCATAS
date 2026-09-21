// Backend Express: autenticação de staff (SQLite local) + proxy pro Melhor
// Envio + CRUD de estoque/vendas/caixa/categorias/modelos_moto (Supabase).
// Nenhuma lógica de domínio mora aqui — cada área vira um router em
// src/server/routes/*, este arquivo só monta o app e aplica os middlewares.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import axios from 'axios';

import { autenticar } from './middleware/auth.js';
import { supabase } from './services/supabaseClient.js';
import { requireEnv } from './src/server/env.js';
import { categoriasRouter } from './src/server/routes/categorias.js';
import { modelosMotoRouter } from './src/server/routes/modelosMoto.js';
import { formasPagamentoRouter } from './src/server/routes/formasPagamento.js';
import { estoqueRouter } from './src/server/routes/estoque.js';
import { vendasRouter } from './src/server/routes/vendas.js';
import { orcamentosRouter } from './src/server/routes/orcamentos.js';
import { caixaRouter } from './src/server/routes/caixa.js';
import { uploadRouter } from './src/server/routes/upload.js';
import { tarefasRouter } from './src/server/routes/tarefas.js';
import { lembretesRouter } from './src/server/routes/lembretes.js';

dotenv.config();

async function startServer() {
  console.log('🌐 Validando variáveis de ambiente...');
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD', 'MELHOR_ENVIO_TOKEN'].forEach((env) => {
    if (!process.env[env]) console.warn(`⚠️ Variável de ambiente [${env}] não está definida!`);
    else console.log(`✅ [${env}] está presente.`);
  });

  const JWT_SECRET = requireEnv('JWT_SECRET');
  const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);

  app.set('trust proxy', 1);

  const allowedOrigins = ['http://localhost:3000', 'http://localhost', 'capacitor://localhost', 'https://rk-sucatas-987595911324.southamerica-east1.run.app'];
  if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
        if (!isAllowed) console.log(`⚠️ Origin não permitida pelo CORS: ${origin}`);
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api', (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // ==================== ROTAS PÚBLICAS ====================
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { password } = req.body || {};
      if (!password) {
        return res.status(400).json({ success: false, error: 'Senha é obrigatória' });
      }

      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Senha incorreta' });
      }

      const token = jwt.sign({ id: 0, username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { id: 0, username: 'admin', role: 'admin' } });
    } catch (err: any) {
      console.error('Login Error:', err);
      res.status(500).json({ success: false, error: 'Erro interno no login' });
    }
  });

  // ==================== A PARTIR DAQUI, TUDO EXIGE JWT VÁLIDO ====================
  app.use('/api', autenticar);

  app.post('/api/frete/calculate', async (req, res) => {
    try {
      const { cep_origem, cep_destino, peso, largura, altura, comprimento } = req.body || {};
      const token = process.env.MELHOR_ENVIO_TOKEN;

      const response = await axios.post(
        'https://melhorenvio.com.br/api/v2/me/shipment/calculate',
        {
          from: { postal_code: cep_origem },
          to: { postal_code: cep_destino },
          products: [
            {
              id: 'sucata1',
              weight: parseFloat(peso),
              width: parseFloat(largura),
              height: parseFloat(altura),
              length: parseFloat(comprimento),
              insurance_value: 0,
              quantity: 1,
            },
          ],
          options: { insurance_value: 0, receipt: false, own_hand: false },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'RK Sucatas (contato@rksucatas.com.br)',
          },
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error('Erro ao calcular frete:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  // ==================== ROTAS DE DOMÍNIO (Supabase) ====================
  app.use('/api/categorias', categoriasRouter(supabase));
  app.use('/api/modelos-moto', modelosMotoRouter(supabase));
  app.use('/api/formas-pagamento', formasPagamentoRouter(supabase));
  app.use('/api/estoque', estoqueRouter(supabase));
  app.use('/api/vendas', vendasRouter(supabase));
  app.use('/api/orcamentos', orcamentosRouter(supabase));
  app.use('/api/caixa', caixaRouter(supabase));
  app.use('/api/upload', uploadRouter());
  app.get('/api/usuarios/responsaveis-tarefa', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_exibicao')
        .eq('ativo', true)
        .order('nome_exibicao', { ascending: true });
      if (error) throw error;
      res.json({ success: true, data: data ?? [] });
    } catch (error: any) {
      console.error('Erro ao listar responsáveis de tarefas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.use('/api/tarefas', tarefasRouter(supabase));
  app.use('/api/lembretes', lembretesRouter(supabase));

  // Error handler genérico pra API
  app.use('/api', (err: any, _req: any, res: any, _next: any) => {
    console.error('❌ Erro na API:', err);
    res.status(err.status || 500).json({ success: false, error: err.message || 'Erro interno no servidor' });
  });

  // Catch-all pra rota de API não encontrada (evita devolver HTML do Vite)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `Rota API não encontrada: ${req.method} ${req.url}` });
  });

  // Frontend: Vite em dev, estático em produção
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT} [PID:${process.pid}]`);
    console.log(`🔗 APP_URL: ${process.env.APP_URL || 'Não definida (usando localhost)'}`);
  });

  const shutdown = () => {
    console.log('🛑 Encerrando servidor...');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
