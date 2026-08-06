// Backend Express: autenticação de staff (SQLite local) + proxy pro Melhor
// Envio + CRUD de estoque/vendas/caixa/categorias/modelos_moto (Supabase).
// Nenhuma lógica de domínio mora aqui — cada área vira um router em
// src/server/routes/*, este arquivo só monta o app e aplica os middlewares.
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';

import { autenticar, autorizar, type AuthenticatedRequest } from './middleware/auth.js';
import { supabase } from './services/supabaseClient.js';
import { requireEnv } from './src/server/env.js';
import { categoriasRouter } from './src/server/routes/categorias.js';
import { modelosMotoRouter } from './src/server/routes/modelosMoto.js';
import { formasPagamentoRouter } from './src/server/routes/formasPagamento.js';
import { estoqueRouter } from './src/server/routes/estoque.js';
import { promocoesRouter } from './src/server/routes/promocoes.js';
import { vendasRouter } from './src/server/routes/vendas.js';
import { orcamentosRouter } from './src/server/routes/orcamentos.js';
import { clientesRouter } from './src/server/routes/clientes.js';
import { caixaRouter } from './src/server/routes/caixa.js';
import { fiadoRouter } from './src/server/routes/fiado.js';
import { enviosRouter } from './src/server/routes/envios.js';
import { uploadRouter } from './src/server/routes/upload.js';
import { usuariosRouter } from './src/server/routes/usuarios.js';
import { tarefasRouter } from './src/server/routes/tarefas.js';
import { mercadolivreRouter, mercadolivreCallbackHandler, mercadolivreWebhookHandler } from './src/server/routes/mercadolivre.js';
import { iniciarDetectorDePendenciasML } from './src/services/mercadolivreScheduler.js';
import { iniciarRastreioAutomaticoDeEnvios } from './src/services/enviosScheduler.js';
import { EXECUTORES_TAREFA } from './src/constants/roles.js';

dotenv.config();

async function startServer() {
  console.log('🌐 Validando variáveis de ambiente...');
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD', 'MELHOR_ENVIO_TOKEN', 'MERCADOLIVRE_APP_ID', 'MERCADOLIVRE_CLIENT_SECRET', 'MERCADOLIVRE_REDIRECT_URI'].forEach((env) => {
    if (!process.env[env]) console.warn(`⚠️ Variável de ambiente [${env}] não está definida!`);
    else console.log(`✅ [${env}] está presente.`);
  });

  const JWT_SECRET = requireEnv('JWT_SECRET');
  const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);

  app.set('trust proxy', 1);

  const allowedOrigins = ['http://localhost:3000', 'http://localhost', 'capacitor://localhost', 'https://rk-sucatas.onrender.com'];
  if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
        if (!isAllowed) console.log(`⚠️ Origin não permitida pelo CORS: ${origin}`);
        // Só libera o Access-Control-Allow-Origin pra quem está na lista —
        // antes disso ficava sempre true (chamava callback(null,true)
        // mesmo com isAllowed=false), então a lista de origens permitidas
        // não bloqueava nada de verdade. Requisições same-origin (o app
        // web servido por este mesmo Express) não são afetadas — CORS só
        // entra em jogo pra chamadas cross-origin.
        callback(null, isAllowed);
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

  // Bootstrap: se a tabela `usuarios` ainda estiver vazia (primeira vez que
  // esta migração roda em produção), cria o admin inicial usando a senha
  // única antiga (ADMIN_PASSWORD) como senha dele. A partir daí ADMIN_PASSWORD
  // só serve pra esse bootstrap — o login de verdade passa a ser por
  // usuário+senha individuais (tabela usuarios). Idempotente: só insere
  // quando a tabela está vazia.
  const { count: totalUsuarios, error: erroContagemUsuarios } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true });

  if (erroContagemUsuarios) {
    console.warn('⚠️ Não foi possível checar a tabela usuarios (rodou a migration_011?):', erroContagemUsuarios.message);
  } else if (totalUsuarios === 0) {
    const senhaHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const { error: erroBootstrap } = await supabase
      .from('usuarios')
      .insert({ username: 'ayrton', nome_exibicao: 'Ayrton', senha_hash: senhaHash, roles: ['admin'] });
    if (erroBootstrap) {
      console.error('❌ Falha ao criar usuário admin de bootstrap:', erroBootstrap.message);
    } else {
      console.log('👤 Bootstrap: usuário admin "ayrton" criado a partir de ADMIN_PASSWORD');
    }
  }

  // ==================== ROTAS PÚBLICAS ====================
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // Sem gate de JWT de propósito: é o Mercado Livre redirecionando o
  // navegador de volta depois do login, não uma chamada da nossa SPA — não
  // tem como vir com Authorization: Bearer junto. Ver mercadolivre.ts pra
  // como isso continua seguro (state de uso único).
  app.get('/api/mercadolivre/callback', mercadolivreCallbackHandler(supabase));

  // Mesma razão de ficar fora do gate de JWT: é o Mercado Livre chamando
  // nosso servidor direto (webhook), não a nossa SPA. Rate limit generoso —
  // é defesa contra abuso do endpoint público, não uma trava pro tráfego real
  // do ML (ver mercadolivreWebhookHandler pra como isso continua seguro sem
  // depender de assinatura: o corpo nunca é tratado como dado, só como gatilho
  // pra buscar o recurso de novo na API oficial).
  const notificationsLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post('/api/mercadolivre/notifications', notificationsLimiter, mercadolivreWebhookHandler(supabase));

  // 10 tentativas a cada 15min por IP — impede força bruta de senha sem
  // atrapalhar o uso normal (uma pessoa errando a senha algumas vezes).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios' });
      }

      const ERRO_GENERICO = 'Usuário ou senha incorretos';

      const { data: usuario, error: erroBusca } = await supabase
        .from('usuarios')
        .select('id, username, nome_exibicao, senha_hash, roles, ativo')
        .eq('username', String(username).trim().toLowerCase())
        .eq('ativo', true)
        .maybeSingle();

      if (erroBusca) throw erroBusca;
      if (!usuario) {
        return res.status(401).json({ success: false, error: ERRO_GENERICO });
      }

      const senhaConfere = bcrypt.compareSync(password, usuario.senha_hash);
      if (!senhaConfere) {
        return res.status(401).json({ success: false, error: ERRO_GENERICO });
      }

      const payload = { id: usuario.id, username: usuario.username, roles: usuario.roles };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { ...payload, nome_exibicao: usuario.nome_exibicao } });
    } catch (err: any) {
      console.error('Login Error:', err);
      res.status(500).json({ success: false, error: 'Erro interno no login' });
    }
  });

  // ==================== A PARTIR DAQUI, TUDO EXIGE JWT VÁLIDO ====================
  app.use('/api', autenticar);

  // Exceção ao gate de /api/usuarios (admin-only, montado mais abaixo): todo
  // usuário autenticado precisa poder registrar o próprio token de push.
  app.post('/api/usuarios/me/push-token', async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ success: false, error: 'Token é obrigatório' });
      const { error } = await supabase.from('usuarios').update({ push_token: token }).eq('id', req.usuario!.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('Erro ao salvar push token:', err);
      res.status(500).json({ success: false, error: 'Erro ao salvar token' });
    }
  });

  // Lista enxuta (id + nome) de quem pode receber tarefa, pro <select> de
  // responsável na tela de Tarefas — admin/equipe precisam disso pra criar
  // tarefas, mas não têm acesso ao resto de /api/usuarios (admin-only).
  // Inclui todo cargo "executor" (EXECUTORES_TAREFA: mandados + mecanico).
  app.get('/api/usuarios/responsaveis-tarefa', autorizar('admin', 'equipe'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('usuarios').select('id, nome_exibicao').overlaps('roles', EXECUTORES_TAREFA).eq('ativo', true).order('nome_exibicao');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Erro ao listar usuários responsáveis por tarefa:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/frete/calculate', autorizar('admin', 'equipe'), async (req, res) => {
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
  // estoque, categorias, modelos-moto e tarefas fazem seu próprio gate de
  // papel por rota/método (Eloisa lê estoque/categorias/motos mas não
  // escreve; tarefas varia por dono) — o resto é bloco fechado pra
  // admin+equipe, e usuarios é admin-only.
  app.use('/api/categorias', categoriasRouter(supabase));
  app.use('/api/modelos-moto', modelosMotoRouter(supabase));
  app.use('/api/formas-pagamento', autorizar('admin', 'equipe'), formasPagamentoRouter(supabase));
  app.use('/api/estoque', estoqueRouter(supabase));
  app.use('/api/promocoes', autorizar('admin', 'equipe'), promocoesRouter(supabase));
  app.use('/api/vendas', autorizar('admin', 'equipe'), vendasRouter(supabase));
  app.use('/api/orcamentos', autorizar('admin', 'equipe'), orcamentosRouter(supabase));
  app.use('/api/clientes', autorizar('admin', 'equipe'), clientesRouter(supabase));
  app.use('/api/caixa', autorizar('admin', 'equipe'), caixaRouter(supabase));
  app.use('/api/fiado', autorizar('admin', 'equipe'), fiadoRouter(supabase));
  app.use('/api/envios', autorizar('admin', 'equipe'), enviosRouter(supabase));
  app.use('/api/upload', autorizar('admin', 'equipe'), uploadRouter());
  app.use('/api/tarefas', tarefasRouter(supabase));
  app.use('/api/mercadolivre', autorizar('admin', 'equipe'), mercadolivreRouter(supabase));
  app.use('/api/usuarios', autorizar('admin'), usuariosRouter(supabase));

  // Único processo em background do sistema: só detecta pergunta/pedido novo
  // do Mercado Livre (feature 9) pra alimentar o indicador de pendências.
  // Nunca muda anúncio nem grava venda sozinho — isso só acontece por clique
  // humano (ver mercadolivreSync.ts > sincronizarAnuncio/importarPedidoComoVenda).
  iniciarDetectorDePendenciasML(supabase);
  iniciarRastreioAutomaticoDeEnvios(supabase);

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
