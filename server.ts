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

import { autenticar, autorizar, exigirPermissao, exigirAlguma, type AuthenticatedRequest } from './middleware/auth.js';
import { supabase } from './services/supabaseClient.js';
import { requireEnv } from './src/server/env.js';
import { categoriasRouter } from './src/server/routes/categorias.js';
import { modelosMotoRouter } from './src/server/routes/modelosMoto.js';
import { formasPagamentoRouter } from './src/server/routes/formasPagamento.js';
import { estoqueRouter } from './src/server/routes/estoque.js';
import { estoqueFamiliasRouter } from './src/server/routes/estoqueFamilias.js';
import { gavetasRouter } from './src/server/routes/gavetas.js';
import { promocoesRouter } from './src/server/routes/promocoes.js';
import { vendasRouter } from './src/server/routes/vendas.js';
import { orcamentosRouter } from './src/server/routes/orcamentos.js';
import { clientesRouter } from './src/server/routes/clientes.js';
import { caixaRouter } from './src/server/routes/caixa.js';
import { caixaPendenciasRouter } from './src/server/routes/caixaPendencias.js';
import { fiadoRouter } from './src/server/routes/fiado.js';
import { enviosRouter } from './src/server/routes/envios.js';
import { uploadRouter } from './src/server/routes/upload.js';
import { usuariosRouter } from './src/server/routes/usuarios.js';
import { tarefasRouter } from './src/server/routes/tarefas.js';
import { lembretesRouter } from './src/server/routes/lembretes.js';
import { notificacoesRouter } from './src/server/routes/notificacoes.js';
import { mercadolivreRouter, mercadolivreCallbackHandler, mercadolivreWebhookHandler } from './src/server/routes/mercadolivre.js';
import { shopeeRouter, shopeeCallbackHandler } from './src/server/routes/shopee.js';
import { dashboardRouter } from './src/server/routes/dashboard.js';
import { cobrancasRouter } from './src/server/routes/cobrancas.js';
import { iniciarDetectorDePendenciasML } from './src/services/mercadolivreScheduler.js';
import { iniciarSincronizadorDeEstatisticasML } from './src/services/mercadolivreEstatisticasScheduler.js';
import { iniciarRenovacaoDeTokenShopee, iniciarSincronizadorDeEstatisticasShopee } from './src/services/shopeeScheduler.js';
import { iniciarRastreioAutomaticoDeEnvios } from './src/services/enviosScheduler.js';
import { iniciarChecagemDiariaDeAlertas } from './src/services/notificacoesScheduler.js';
import { iniciarDisparoDeLembretes } from './src/services/lembretesScheduler.js';
import { iniciarDisparoDeCobrancas } from './src/services/cobrancasScheduler.js';
import { pode } from './src/constants/permissoes.js';

dotenv.config();

async function startServer() {
  console.log('🌐 Validando variáveis de ambiente...');
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD', 'MELHOR_ENVIO_TOKEN', 'MERCADOLIVRE_APP_ID', 'MERCADOLIVRE_CLIENT_SECRET', 'MERCADOLIVRE_REDIRECT_URI', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'FIREBASE_SERVICE_ACCOUNT'].forEach((env) => {
    if (!process.env[env]) console.warn(`⚠️ Variável de ambiente [${env}] não está definida!`);
    else console.log(`✅ [${env}] está presente.`);
  });

  const JWT_SECRET = requireEnv('JWT_SECRET');
  const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);

  app.set('trust proxy', 1);

  // 'https://localhost' é a origem real do WebView no Android (Capacitor usa
  // androidScheme 'https' por padrão, sem porta) — sem ela aqui, todo fetch
  // do APK pro backend falha no CORS ("Failed to fetch") mesmo com o backend
  // no ar, porque o navegador nunca chega a entregar a resposta ao JS.
  const allowedOrigins = ['http://localhost:3000', 'http://localhost', 'https://localhost', 'capacitor://localhost', 'https://rk-sucatas.onrender.com'];
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

  // Mesma razão de ficar fora do gate de JWT, agora pro fluxo OAuth da
  // Shopee (ver shopee.ts pra como isso continua seguro: state de uso único).
  app.get('/api/shopee/callback', shopeeCallbackHandler(supabase));

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
        .select('id, username, nome_exibicao, senha_hash, roles, permissoes, ativo')
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

      // `permissoes` vai no token junto com `roles`: o gate por permissão é
      // feito no middleware a partir daí (mesmo modelo do `roles`, então
      // mudanças de permissão passam a valer no próximo login — até 7 dias, ver
      // expiresIn). `?? {}` cobre um usuário anterior à migration_047.
      const payload = { id: usuario.id, username: usuario.username, roles: usuario.roles, permissoes: usuario.permissoes ?? {} };
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
  // usuário autenticado precisa poder gerenciar as próprias subscriptions de
  // push. Substitui o antigo POST /api/usuarios/me/push-token (nunca chegou
  // a ser usado por nenhum client) — ver src/server/routes/notificacoes.ts.
  app.use('/api/notificacoes', notificacoesRouter(supabase));

  // Lista enxuta (id + nome) de quem pode receber tarefa, pro <select> de
  // responsável na tela de Tarefas — quem cria tarefa (tarefas.criar) precisa
  // disso, mas não tem acesso ao resto de /api/usuarios (admin-only). Inclui
  // todo "executor de campo" (quem pode dar baixa mas NÃO gerencia tarefas —
  // permissao tarefas.concluir sem tarefas.criar, o equivalente dos antigos
  // mandados/mecanico), qualquer outro gerente/admin (tarefas.criar — ex: um
  // admin designar tarefa pra outro admin) MAIS o próprio usuário logado, que
  // pode se autoatribuir tarefa mesmo sem ser executor (ver responsavelValido
  // em tarefas.ts). Filtra em JS por `permissoes` (não mais por cargo) pra
  // pegar também os usuários criados já no modelo novo, sem papel
  // mandados/mecanico.
  app.get('/api/usuarios/responsaveis-tarefa', exigirPermissao('tarefas.criar'), async (req: AuthenticatedRequest, res) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_exibicao, roles, permissoes')
        .eq('ativo', true)
        .order('nome_exibicao');
      if (error) throw error;
      const filtrados = (data ?? [])
        .filter((u: any) => {
          const admin = Array.isArray(u.roles) && u.roles.includes('admin');
          const ehExecutor = pode(u.permissoes, admin, 'tarefas.concluir') && !pode(u.permissoes, admin, 'tarefas.criar');
          const ehGerente = pode(u.permissoes, admin, 'tarefas.criar');
          return ehExecutor || ehGerente || u.id === req.usuario!.id;
        })
        .map((u: any) => ({ id: u.id, nome_exibicao: u.nome_exibicao }));
      res.json({ success: true, data: filtrados });
    } catch (err: any) {
      console.error('Erro ao listar usuários responsáveis por tarefa:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Lista enxuta (id + nome) de todo usuário ativo que vê Tarefas, pro <select>
  // de responsável na tela de Lembretes — diferente de responsaveis-tarefa
  // acima, aqui um lembrete pode ir pra qualquer um que veja Tarefas
  // (permissao tarefas.ver), não só executor de campo.
  app.get('/api/usuarios/ativos-resumo', exigirPermissao('tarefas.ver'), async (_req: AuthenticatedRequest, res) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome_exibicao, roles, permissoes')
        .eq('ativo', true)
        .order('nome_exibicao');
      if (error) throw error;
      const filtrados = (data ?? [])
        .filter((u: any) => pode(u.permissoes, Array.isArray(u.roles) && u.roles.includes('admin'), 'tarefas.ver'))
        .map((u: any) => ({ id: u.id, nome_exibicao: u.nome_exibicao }));
      res.json({ success: true, data: filtrados });
    } catch (err: any) {
      console.error('Erro ao listar usuários ativos:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/frete/calculate', exigirPermissao('frete.ver'), async (req, res) => {
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
  // Cada router agora faz seu próprio gate por PERMISSÃO GRANULAR por
  // rota/método (ver src/server/routes/*): GET de tabela de apoio
  // (categorias/modelos/formas-pagamento) fica aberto a qualquer usuário
  // autenticado porque é dado de referência usado por várias telas; a escrita
  // é que exige a permissão específica. `usuarios` continua admin-only no
  // mount (gestão de usuários é exclusiva do admin).
  app.use('/api/categorias', categoriasRouter(supabase));
  app.use('/api/modelos-moto', modelosMotoRouter(supabase));
  app.use('/api/formas-pagamento', formasPagamentoRouter(supabase));
  app.use('/api/estoque', estoqueRouter(supabase));
  app.use('/api/estoque-familias', estoqueFamiliasRouter(supabase));
  app.use('/api/gavetas', gavetasRouter(supabase));
  app.use('/api/promocoes', promocoesRouter(supabase));
  app.use('/api/vendas', vendasRouter(supabase));
  app.use('/api/orcamentos', orcamentosRouter(supabase));
  app.use('/api/clientes', clientesRouter(supabase));
  app.use('/api/caixa', caixaRouter(supabase));
  app.use('/api/caixa-pendencias', caixaPendenciasRouter(supabase));
  app.use('/api/cobrancas', cobrancasRouter(supabase));
  app.use('/api/fiado', fiadoRouter(supabase));
  app.use('/api/envios', enviosRouter(supabase));
  // Upload é usado por Estoque (imagem de peça/unidade/modelo) e por Vendas
  // (comprovante PIX): libera pra quem pode escrever em algum desses fluxos —
  // o vínculo real do arquivo é gated de novo na rota de domínio.
  app.use(
    '/api/upload',
    exigirAlguma('estoque.criar', 'estoque.editar', 'vendas.criar', 'vendas.editar', 'clientes.editar', 'configuracoes.gerenciar_motos'),
    uploadRouter()
  );
  app.use('/api/dashboard', dashboardRouter(supabase));
  app.use('/api/tarefas', tarefasRouter(supabase));
  app.use('/api/lembretes', lembretesRouter(supabase));
  app.use('/api/mercadolivre', mercadolivreRouter(supabase));
  app.use('/api/shopee', shopeeRouter(supabase));
  app.use('/api/usuarios', autorizar('admin'), usuariosRouter(supabase));

  // Único processo em background do sistema: só detecta pergunta/pedido novo
  // do Mercado Livre (feature 9) pra alimentar o indicador de pendências.
  // Nunca muda anúncio nem grava venda sozinho — isso só acontece por clique
  // humano (ver mercadolivreSync.ts > sincronizarAnuncio/importarPedidoComoVenda).
  iniciarDetectorDePendenciasML(supabase);
  iniciarSincronizadorDeEstatisticasML(supabase);
  // Segundo canal (Shopee) — dois jobs próprios, cadência independente do
  // ML (ver shopeeScheduler.ts): token expira em 4h contra 6h do ML.
  iniciarRenovacaoDeTokenShopee(supabase);
  iniciarSincronizadorDeEstatisticasShopee(supabase);
  iniciarRastreioAutomaticoDeEnvios(supabase);
  iniciarChecagemDiariaDeAlertas(supabase);
  iniciarDisparoDeLembretes(supabase);
  iniciarDisparoDeCobrancas(supabase);

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
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html') || filePath.endsWith('.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
