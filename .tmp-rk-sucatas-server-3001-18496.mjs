// server.ts
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv3 from "dotenv";
import { createServer } from "http";
import jwt2 from "jsonwebtoken";
import bcrypt2 from "bcryptjs";
import axios6 from "axios";

// middleware/auth.ts
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// src/server/env.ts
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Vari\xE1vel de ambiente obrigat\xF3ria ausente: ${name}`);
  }
  return value;
}

// src/constants/permissoes.ts
var CATALOGO_PERMISSOES = [
  {
    chave: "dashboard",
    rotulo: "Dashboard",
    descricao: "Painel geral com vis\xE3o do neg\xF3cio.",
    acoes: [
      { chave: "ver", rotulo: "Ver o painel", descricao: "Abrir o Dashboard (alertas, listas, tarefas pendentes)." },
      {
        chave: "ver_valores",
        rotulo: "Ver os valores",
        descricao: "Ver os cards de estat\xEDstica com dinheiro (estoque, vendas, sa\xEDdas, ticket) e os gr\xE1ficos."
      },
      {
        chave: "ver_visao_dono",
        rotulo: "Ver a Vis\xE3o do Dono",
        descricao: 'Ver a se\xE7\xE3o "Vis\xE3o completa do neg\xF3cio" (faturamento, desempenho, caixa e vendas detalhados) \u2014 hoje s\xF3 admin.'
      }
    ]
  },
  {
    chave: "estoque",
    rotulo: "Estoque",
    descricao: "Cat\xE1logo de pe\xE7as, unidades e an\xFAncios.",
    acoes: [
      { chave: "ver", rotulo: "Ver o estoque", descricao: "Consultar pe\xE7as, fichas de unidade e an\xFAncios vinculados." },
      { chave: "criar", rotulo: "Cadastrar pe\xE7as", descricao: "Adicionar novas pe\xE7as ao estoque." },
      { chave: "editar", rotulo: "Editar pe\xE7as", descricao: "Alterar dados, fichas de unidade, quantidade e categoria (inclusive em lote)." },
      { chave: "deletar", rotulo: "Excluir pe\xE7as", descricao: "Apagar pe\xE7as (uma ou em lote)." },
      { chave: "anunciar_ml", rotulo: "Anunciar no Mercado Livre", descricao: "Publicar, vincular e republicar an\xFAncios da pe\xE7a no Mercado Livre." },
      { chave: "anunciar_shopee", rotulo: "Anunciar na Shopee", descricao: "Publicar e republicar an\xFAncios da pe\xE7a na Shopee." }
    ]
  },
  {
    chave: "frete",
    rotulo: "Frete",
    descricao: "Cota\xE7\xE3o e rastreamento de envios.",
    acoes: [
      { chave: "ver", rotulo: "Ver frete", descricao: "Calcular cota\xE7\xE3o e consultar os envios registrados." },
      { chave: "criar", rotulo: "Registrar envio", descricao: "Registrar um novo envio." },
      { chave: "editar", rotulo: "Editar/rastrear envio", descricao: "Alterar dados e atualizar o rastreio de um envio." },
      { chave: "deletar", rotulo: "Excluir envio", descricao: "Apagar um envio registrado." }
    ]
  },
  {
    chave: "mercadolivre",
    rotulo: "Mercado Livre",
    descricao: "Integra\xE7\xE3o com a conta do Mercado Livre.",
    acoes: [
      { chave: "ver", rotulo: "Ver Mercado Livre", descricao: "Ver status da conta, perguntas, pedidos, an\xFAncios \xF3rf\xE3os/duplicados e pend\xEAncias." },
      { chave: "conectar", rotulo: "Conectar/desconectar conta", descricao: "Vincular ou desvincular a conta e ajustar a margem de repasse." },
      { chave: "sincronizar", rotulo: "Sincronizar an\xFAncios", descricao: "Aplicar pre\xE7o/estoque atuais nos an\xFAncios selecionados." },
      { chave: "importar_pedidos", rotulo: "Importar pedidos", descricao: "Importar um pedido do Mercado Livre como venda." },
      { chave: "responder_perguntas", rotulo: "Responder perguntas", descricao: "Responder perguntas de clientes nos an\xFAncios." },
      { chave: "pausar_anuncio", rotulo: "Pausar an\xFAncios", descricao: "Pausar an\xFAncios \xF3rf\xE3os ou duplicados." }
    ]
  },
  {
    chave: "vendas",
    rotulo: "Vendas",
    descricao: "Registro e gest\xE3o de vendas.",
    acoes: [
      { chave: "ver", rotulo: "Ver vendas", descricao: "Consultar as vendas registradas." },
      { chave: "criar", rotulo: "Registrar venda", descricao: "Registrar uma nova venda (baixa de estoque + caixa)." },
      { chave: "editar", rotulo: "Editar venda", descricao: "Alterar forma de pagamento, cliente e observa\xE7\xF5es e anexar comprovantes." },
      { chave: "cancelar", rotulo: "Cancelar venda", descricao: "Cancelar uma venda (estorna estoque e caixa)." },
      { chave: "cancelar_fiado", rotulo: "Cancelar venda fiado quitada", descricao: "Cancelar em cascata uma venda fiado j\xE1 recebida (reverte os recebimentos)." },
      { chave: "excluir_comprovante", rotulo: "Excluir comprovante PIX", descricao: "Remover um comprovante de PIX anexado a uma venda." }
    ]
  },
  {
    chave: "orcamentos",
    rotulo: "Or\xE7amentos",
    descricao: "Or\xE7amentos e convers\xE3o em venda.",
    acoes: [
      { chave: "ver", rotulo: "Ver or\xE7amentos", descricao: "Consultar os or\xE7amentos." },
      { chave: "criar", rotulo: "Criar or\xE7amento", descricao: "Montar um novo or\xE7amento." },
      { chave: "editar", rotulo: "Editar or\xE7amento", descricao: "Alterar dados e itens de um or\xE7amento em aberto." },
      { chave: "vender", rotulo: "Vender or\xE7amento", descricao: "Converter itens (ou tudo) do or\xE7amento em venda." },
      { chave: "cancelar", rotulo: "Cancelar or\xE7amento", descricao: "Marcar um or\xE7amento em aberto como cancelado." },
      { chave: "excluir", rotulo: "Excluir or\xE7amento", descricao: "Apagar um or\xE7amento definitivamente." }
    ]
  },
  {
    chave: "clientes",
    rotulo: "Clientes",
    descricao: "Cadastro e ficha dos clientes.",
    acoes: [
      { chave: "ver", rotulo: "Ver clientes", descricao: "Consultar a lista e a ficha dos clientes." },
      { chave: "criar", rotulo: "Cadastrar cliente", descricao: "Adicionar um novo cliente." },
      { chave: "editar", rotulo: "Editar cliente", descricao: "Alterar cadastro, notas, motos, pedidos e visitas." },
      {
        chave: "administrar",
        rotulo: "Administrar clientes",
        descricao: "Corrigir origem hist\xF3rica, bloquear, desbloquear, desativar, reativar e administrar sin\xF4nimos."
      }
    ]
  },
  {
    chave: "caixa",
    rotulo: "Caixa",
    descricao: "Livro de caixa, fiado e pend\xEAncias.",
    acoes: [
      { chave: "ver", rotulo: "Ver o caixa", descricao: "Consultar lan\xE7amentos, recebimentos de fiado e pend\xEAncias." },
      { chave: "criar", rotulo: "Lan\xE7ar no caixa", descricao: "Registrar uma entrada ou sa\xEDda manual." },
      { chave: "editar", rotulo: "Editar lan\xE7amento", descricao: "Alterar um lan\xE7amento de caixa." },
      { chave: "excluir", rotulo: "Excluir lan\xE7amento", descricao: "Apagar um lan\xE7amento manual de caixa." },
      { chave: "receber_fiado", rotulo: "Receber fiado", descricao: "Registrar e reverter recebimentos de vendas fiado." },
      { chave: "gerenciar_pendencias", rotulo: "Gerenciar pend\xEAncias", descricao: "Criar pend\xEAncias e registrar/reverter seus recebimentos." }
    ]
  },
  {
    chave: "tarefas",
    rotulo: "Tarefas",
    descricao: "Tarefas de campo e lembretes.",
    acoes: [
      { chave: "ver", rotulo: "Ver tarefas", descricao: "Ver as tarefas (e usar os lembretes). Quem n\xE3o pode criar v\xEA s\xF3 as pr\xF3prias." },
      { chave: "criar", rotulo: "Criar e atribuir tarefas", descricao: "Criar tarefas e atribuir a outra pessoa (tamb\xE9m d\xE1 a vis\xE3o de todas as tarefas)." },
      { chave: "editar", rotulo: "Editar tarefas", descricao: "Alterar tarefas que pode gerenciar." },
      { chave: "excluir", rotulo: "Excluir tarefas", descricao: "Apagar tarefas que pode gerenciar." },
      { chave: "concluir", rotulo: "Concluir tarefas", descricao: "Dar baixa, reabrir e marcar itens do checklist." }
    ]
  },
  {
    chave: "configuracoes",
    rotulo: "Configura\xE7\xF5es",
    descricao: "Tabelas de apoio do sistema.",
    acoes: [
      { chave: "ver", rotulo: "Ver configura\xE7\xF5es", descricao: "Abrir a tela de Configura\xE7\xF5es." },
      { chave: "gerenciar_categorias", rotulo: "Gerenciar categorias", descricao: "Criar, renomear, mover e excluir categorias de pe\xE7a." },
      { chave: "gerenciar_motos", rotulo: "Gerenciar motos", descricao: "Criar, renomear, reordenar e excluir modelos de moto." },
      { chave: "gerenciar_pagamento", rotulo: "Gerenciar formas de pagamento", descricao: "Criar, renomear, excluir e marcar/desmarcar como fiado." },
      { chave: "gerenciar_promocoes", rotulo: "Gerenciar promo\xE7\xF5es", descricao: "Criar, editar e excluir promo\xE7\xF5es." }
    ]
  },
  {
    chave: "patchnotes",
    rotulo: "Novidades",
    descricao: "Changelog do produto.",
    acoes: [{ chave: "ver", rotulo: "Ver novidades", descricao: "Ler o hist\xF3rico de novidades do sistema." }]
  },
  {
    chave: "notificacoes",
    rotulo: "Notifica\xE7\xF5es",
    descricao: "Prefer\xEAncias de notifica\xE7\xE3o por push.",
    acoes: [{ chave: "ver", rotulo: "Ver notifica\xE7\xF5es", descricao: "Gerenciar as pr\xF3prias inscri\xE7\xF5es de notifica\xE7\xE3o por push." }]
  }
];
var TELAS_VALIDAS = CATALOGO_PERMISSOES.map((t) => t.chave);
var CHAVES_VALIDAS = CATALOGO_PERMISSOES.flatMap((t) => t.acoes.map((a) => `${t.chave}.${a.chave}`));
function sanitizarPermissoes(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const entrada = raw;
  for (const tela of CATALOGO_PERMISSOES) {
    const mapaRaw = entrada[tela.chave];
    if (!mapaRaw || typeof mapaRaw !== "object") continue;
    const acoesRaw = mapaRaw;
    for (const a of tela.acoes) {
      if (acoesRaw[a.chave] === true) (out[tela.chave] ??= {})[a.chave] = true;
    }
  }
  return out;
}
function pode(permissoes, isAdmin, chave) {
  if (isAdmin) return true;
  if (!permissoes) return false;
  const ponto = chave.indexOf(".");
  if (ponto <= 0) return false;
  const tela = chave.slice(0, ponto);
  const acao = chave.slice(ponto + 1);
  const mapa = permissoes[tela];
  if (!mapa) return false;
  const podeVer = mapa.ver === true;
  if (acao === "ver") return podeVer;
  return podeVer && mapa[acao] === true;
}

// middleware/auth.ts
dotenv.config();
var JWT_SECRET = requireEnv("JWT_SECRET");
var ENDERECOS_LOOPBACK = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
function autenticar(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const roles = Array.isArray(decoded.roles) ? decoded.roles : decoded.role ? [decoded.role] : [];
      const permissoes = decoded.permissoes && typeof decoded.permissoes === "object" ? decoded.permissoes : {};
      req.usuario = { id: decoded.id, username: decoded.username, roles, permissoes };
      return next();
    } catch {
      return res.status(401).json({ success: false, error: "Token inv\xE1lido ou expirado" });
    }
  }
  if (process.env.NODE_ENV !== "production" && ENDERECOS_LOOPBACK.includes(req.socket.remoteAddress || "")) {
    req.usuario = { id: "00000000-0000-0000-0000-000000000000", username: "localhost", roles: ["admin"], permissoes: {} };
    return next();
  }
  return res.status(401).json({ success: false, error: "Token ausente" });
}
function autorizar(...rolesPermitidas) {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.roles.some((r) => rolesPermitidas.includes(r))) {
      return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
    }
    next();
  };
}
function ehAdmin(usuario) {
  return !!usuario?.roles.includes("admin");
}
function temPermissao(usuario, chave) {
  if (!usuario) return false;
  return pode(usuario.permissoes, ehAdmin(usuario), chave);
}
function exigirPermissao(chave) {
  return (req, res, next) => {
    if (!temPermissao(req.usuario, chave)) {
      return res.status(403).json({ success: false, error: "Acesso negado: voc\xEA n\xE3o tem permiss\xE3o para esta a\xE7\xE3o" });
    }
    next();
  };
}
function exigirAlguma(...chaves) {
  return (req, res, next) => {
    if (!chaves.some((chave) => temPermissao(req.usuario, chave))) {
      return res.status(403).json({ success: false, error: "Acesso negado: voc\xEA n\xE3o tem permiss\xE3o para esta a\xE7\xE3o" });
    }
    next();
  };
}

// services/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import dotenv2 from "dotenv";
dotenv2.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });
var supabaseUrl = requireEnv("SUPABASE_URL");
var supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
var supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// src/server/routes/categorias.ts
import { Router } from "express";

// src/server/dbErrors.ts
function mensagemErroExclusao(error, usadoEm) {
  if (error?.code === "23503") {
    return `N\xE3o \xE9 poss\xEDvel excluir: ainda existe(m) ${usadoEm} usando este item.`;
  }
  return error?.message || "Erro ao excluir";
}

// src/features/categorias/categoriaTree.ts
function getDescendantIds(id, categorias) {
  const filhosPorPai = /* @__PURE__ */ new Map();
  categorias.forEach((c) => {
    const lista = filhosPorPai.get(c.parent_id) ?? [];
    lista.push(c.id);
    filhosPorPai.set(c.parent_id, lista);
  });
  const resultado = [id];
  const pilha = [id];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    const filhos = filhosPorPai.get(atual) ?? [];
    filhos.forEach((filhoId) => {
      resultado.push(filhoId);
      pilha.push(filhoId);
    });
  }
  return resultado;
}
function getAncestorChain(id, categorias) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const cadeia = [];
  let atual = porId.get(id);
  while (atual) {
    cadeia.unshift(atual);
    atual = atual.parent_id ? porId.get(atual.parent_id) : void 0;
  }
  return cadeia;
}
function ehDescendenteOuIgual(id, possivelDescendenteId, categorias) {
  return getDescendantIds(id, categorias).includes(possivelDescendenteId);
}

// src/server/routes/categorias.ts
var MSG_NOME_DUPLICADO = "J\xE1 existe uma categoria com esse nome neste n\xEDvel.";
var MSG_PAI_INVALIDO = "Categoria pai inv\xE1lida.";
var ESCRITA = exigirPermissao("configuracoes.gerenciar_categorias");
function categoriasRouter(supabase2) {
  const router = Router();
  async function listarTodas() {
    const { data, error } = await supabase2.from("categorias").select("id, nome, parent_id, ordem");
    if (error) throw error;
    return data || [];
  }
  router.get("/", async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("categorias").select("*").order("ordem");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", ESCRITA, async (req, res) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
      const parent_id = req.body?.parent_id || null;
      let query = supabase2.from("categorias").select("id", { count: "exact", head: true });
      query = parent_id ? query.eq("parent_id", parent_id) : query.is("parent_id", null);
      const { count: totalIrmaos } = await query;
      const { data, error } = await supabase2.from("categorias").insert([{ nome, parent_id, ordem: totalIrmaos ?? 0 }]).select().single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO });
        if (error.code === "23503") return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.put("/:id", ESCRITA, async (req, res) => {
    try {
      const { id } = req.params;
      const atualizacao = {};
      if (req.body?.nome !== void 0) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
        atualizacao.nome = nome;
      }
      if (req.body?.parent_id !== void 0) {
        const novoParentId = req.body.parent_id || null;
        if (novoParentId) {
          const categorias = await listarTodas();
          if (ehDescendenteOuIgual(id, novoParentId, categorias)) {
            return res.status(400).json({
              success: false,
              error: "N\xE3o \xE9 poss\xEDvel mover uma categoria para dentro dela mesma ou de uma subcategoria dela."
            });
          }
        }
        atualizacao.parent_id = novoParentId;
      }
      if (req.body?.mercadolivre_categoria_id_padrao !== void 0) {
        atualizacao.mercadolivre_categoria_id_padrao = req.body.mercadolivre_categoria_id_padrao || null;
      }
      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: "Nada para atualizar" });
      }
      let { data, error } = await supabase2.from("categorias").update(atualizacao).eq("id", id).select().single();
      if (error && (error.code === "42703" || error.code === "PGRST204") && "mercadolivre_categoria_id_padrao" in atualizacao) {
        console.warn("\u26A0\uFE0F Coluna categorias.mercadolivre_categoria_id_padrao ausente \u2014 rode supabase/migration_043_mercadolivre_publicacao.sql. Salvando o restante sem ela.");
        const { mercadolivre_categoria_id_padrao, ...semColunaNova } = atualizacao;
        ({ data, error } = await supabase2.from("categorias").update(semColunaNova).eq("id", id).select().single());
      }
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO });
        if (error.code === "23503") return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/reordenar", ESCRITA, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ success: false, error: "Lista de ids vazia" });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase2.from("categorias").update({ ordem: i }).eq("id", ids[i]);
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", ESCRITA, async (req, res) => {
    try {
      const { id } = req.params;
      const categorias = await listarTodas();
      const idsDaSubarvore = getDescendantIds(id, categorias);
      const { count, error: erroContagem } = await supabase2.from("estoque").select("id", { count: "exact", head: true }).in("categoria_id", idsDaSubarvore);
      if (erroContagem) throw erroContagem;
      if (count && count > 0) {
        return res.status(409).json({
          success: false,
          error: `N\xE3o \xE9 poss\xEDvel excluir: existem ${count} pe\xE7a(s) usando esta categoria ou suas subcategorias.`
        });
      }
      const { error } = await supabase2.from("categorias").delete().in("id", idsDaSubarvore);
      if (error) {
        return res.status(error.code === "23503" ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, "pe\xE7as") });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/modelosMoto.ts
import { Router as Router2 } from "express";

// src/features/motos/motoTree.ts
function getDescendantIds2(id, modelos) {
  const filhosPorPai = /* @__PURE__ */ new Map();
  modelos.forEach((m) => {
    const lista = filhosPorPai.get(m.parent_id) ?? [];
    lista.push(m.id);
    filhosPorPai.set(m.parent_id, lista);
  });
  const resultado = [id];
  const pilha = [id];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    const filhos = filhosPorPai.get(atual) ?? [];
    filhos.forEach((filhoId) => {
      resultado.push(filhoId);
      pilha.push(filhoId);
    });
  }
  return resultado;
}
function ehDescendenteOuIgual2(id, possivelDescendenteId, modelos) {
  return getDescendantIds2(id, modelos).includes(possivelDescendenteId);
}

// src/server/routes/modelosMoto.ts
var MSG_NOME_DUPLICADO2 = "J\xE1 existe um modelo com esse nome neste n\xEDvel.";
var MSG_PAI_INVALIDO2 = "Modelo pai inv\xE1lido.";
var ESCRITA2 = exigirAlguma("configuracoes.gerenciar_motos", "estoque.criar", "estoque.editar", "vendas.criar", "orcamentos.criar");
function modelosMotoRouter(supabase2) {
  const router = Router2();
  async function listarTodos() {
    const { data, error } = await supabase2.from("modelos_moto").select("id, nome, parent_id, ordem, ano");
    if (error) throw error;
    return data || [];
  }
  async function acharOuCriarNo(nome, parentId) {
    const nomeAlvo = nome.trim();
    let query = supabase2.from("modelos_moto").select("*");
    query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
    const { data: irmaos, error: erroBusca } = await query;
    if (erroBusca) throw erroBusca;
    const existente = (irmaos || []).find((m) => m.nome.trim().toLowerCase() === nomeAlvo.toLowerCase());
    if (existente) return existente;
    const totalIrmaos = (irmaos || []).length;
    const { data: criado, error: erroCriar } = await supabase2.from("modelos_moto").insert([{ nome: nomeAlvo, parent_id: parentId, ordem: totalIrmaos }]).select().single();
    if (erroCriar) throw erroCriar;
    return criado;
  }
  router.get("/", async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("modelos_moto").select("*").order("ordem");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", ESCRITA2, async (req, res) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
      const parent_id = req.body?.parent_id || null;
      const ano = req.body?.ano ? String(req.body.ano).trim() : null;
      const imagem_url = req.body?.imagem_url ? String(req.body.imagem_url).trim() : null;
      let query = supabase2.from("modelos_moto").select("id", { count: "exact", head: true });
      query = parent_id ? query.eq("parent_id", parent_id) : query.is("parent_id", null);
      const { count: totalIrmaos } = await query;
      const { data, error } = await supabase2.from("modelos_moto").insert([{ nome, parent_id, ano, imagem_url, ordem: totalIrmaos ?? 0 }]).select().single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO2 });
        if (error.code === "23503") return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO2 });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/rapido", ESCRITA2, async (req, res) => {
    try {
      const marcaNome = String(req.body?.marca || "").trim();
      const cilindradaNome = req.body?.cilindrada ? String(req.body.cilindrada).trim() : "";
      const nome = String(req.body?.nome || "").trim();
      const ano = req.body?.ano ? String(req.body.ano).trim() : null;
      const imagem_url = req.body?.imagem_url ? String(req.body.imagem_url).trim() : null;
      if (!marcaNome) return res.status(400).json({ success: false, error: "Marca \xE9 obrigat\xF3ria" });
      if (!nome) return res.status(400).json({ success: false, error: "Nome do modelo \xE9 obrigat\xF3rio" });
      const marca = await acharOuCriarNo(marcaNome, null);
      const cilindrada = cilindradaNome ? await acharOuCriarNo(cilindradaNome, marca.id) : null;
      const parentDaMoto = cilindrada ? cilindrada.id : marca.id;
      const totalIrmaos = await supabase2.from("modelos_moto").select("id", { count: "exact", head: true }).eq("parent_id", parentDaMoto);
      const { data: moto, error } = await supabase2.from("modelos_moto").insert([{ nome, parent_id: parentDaMoto, ano, imagem_url, ordem: totalIrmaos.count ?? 0 }]).select().single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO2 });
        throw error;
      }
      res.json({ success: true, data: { marca, cilindrada, moto } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.put("/:id", ESCRITA2, async (req, res) => {
    try {
      const { id } = req.params;
      const atualizacao = {};
      if (req.body?.nome !== void 0) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
        atualizacao.nome = nome;
      }
      if (req.body?.ano !== void 0) {
        atualizacao.ano = req.body.ano ? String(req.body.ano).trim() : null;
      }
      if (req.body?.imagem_url !== void 0) {
        atualizacao.imagem_url = req.body.imagem_url ? String(req.body.imagem_url).trim() : null;
      }
      if (req.body?.parent_id !== void 0) {
        const novoParentId = req.body.parent_id || null;
        if (novoParentId) {
          const modelos = await listarTodos();
          if (ehDescendenteOuIgual2(id, novoParentId, modelos)) {
            return res.status(400).json({
              success: false,
              error: "N\xE3o \xE9 poss\xEDvel mover um modelo para dentro dele mesmo ou de um sub-n\xEDvel dele."
            });
          }
        }
        atualizacao.parent_id = novoParentId;
      }
      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: "Nada para atualizar" });
      }
      const { data, error } = await supabase2.from("modelos_moto").update(atualizacao).eq("id", id).select().single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO2 });
        if (error.code === "23503") return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO2 });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/reordenar", ESCRITA2, async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ success: false, error: "Lista de ids vazia" });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase2.from("modelos_moto").update({ ordem: i }).eq("id", ids[i]);
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", ESCRITA2, async (req, res) => {
    try {
      const { id } = req.params;
      const modelos = await listarTodos();
      const idsDaSubarvore = getDescendantIds2(id, modelos);
      const [{ count: countEstoque, error: erroEstoque }, { count: countVendas, error: erroVendas }, { count: countCompativel, error: erroCompativel }] = await Promise.all([
        supabase2.from("estoque").select("id", { count: "exact", head: true }).in("modelo_moto_id", idsDaSubarvore),
        supabase2.from("vendas").select("id", { count: "exact", head: true }).in("modelo_moto_id", idsDaSubarvore),
        // migration_019: modelo também pode estar em uso só como "também serve
        // em" de alguma peça, sem ser o modelo_moto_id principal dela.
        supabase2.from("estoque_modelos_compativeis").select("estoque_id", { count: "exact", head: true }).in("modelo_moto_id", idsDaSubarvore)
      ]);
      if (erroEstoque) throw erroEstoque;
      if (erroVendas) throw erroVendas;
      if (erroCompativel && erroCompativel.code !== "42P01" && erroCompativel.code !== "PGRST205") throw erroCompativel;
      const total = (countEstoque || 0) + (countVendas || 0) + (countCompativel || 0);
      if (total > 0) {
        const sufixoCompativel = countCompativel ? ` (${countCompativel} delas s\xF3 como "tamb\xE9m serve em")` : "";
        return res.status(409).json({
          success: false,
          error: `N\xE3o \xE9 poss\xEDvel excluir: existem ${(countEstoque || 0) + (countCompativel || 0)} pe\xE7a(s)${sufixoCompativel} e ${countVendas || 0} venda(s) usando este modelo ou seus sub-n\xEDveis.`
        });
      }
      const { error } = await supabase2.from("modelos_moto").delete().in("id", idsDaSubarvore);
      if (error) {
        return res.status(error.code === "23503" ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, "pe\xE7as ou vendas") });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/formasPagamento.ts
import { Router as Router3 } from "express";
function formasPagamentoRouter(supabase2) {
  const router = Router3();
  router.get("/", async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("formas_pagamento").select("*").order("nome");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("configuracoes.gerenciar_pagamento"), async (req, res) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
      const natureza = req.body?.natureza === "fiado" ? "fiado" : "avista";
      const { data, error } = await supabase2.from("formas_pagamento").insert([{ nome, natureza }]).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.put("/:id", exigirPermissao("configuracoes.gerenciar_pagamento"), async (req, res) => {
    try {
      const payload = {};
      if (req.body?.nome !== void 0) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
        payload.nome = nome;
      }
      if (req.body?.natureza === "fiado" || req.body?.natureza === "avista") {
        payload.natureza = req.body.natureza;
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: "Nada para atualizar" });
      }
      const { data, error } = await supabase2.from("formas_pagamento").update(payload).eq("id", req.params.id).select().single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("configuracoes.gerenciar_pagamento"), async (req, res) => {
    try {
      const { error } = await supabase2.from("formas_pagamento").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/estoque.ts
import { Router as Router5 } from "express";
import { gzipSync } from "node:zlib";

// src/services/storageService.ts
var BUCKET = "estoque";
function nomeUnico(nomeOriginal) {
  const extensao = nomeOriginal.includes(".") ? nomeOriginal.split(".").pop() : "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
}
async function uploadImagem(buffer, nomeOriginal, mimeType) {
  const path2 = nomeUnico(nomeOriginal);
  const { data, error } = await supabase.storage.from(BUCKET).upload(path2, buffer, {
    contentType: mimeType,
    upsert: false
  });
  if (error) throw error;
  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}
async function excluirImagemPorUrl(url) {
  if (!url || !url.includes(`/${BUCKET}/`)) return;
  const path2 = url.split(`/${BUCKET}/`)[1]?.split("?")[0];
  if (!path2) return;
  await supabase.storage.from(BUCKET).remove([path2]);
}
var BUCKET_COMPROVANTES = "comprovantes";
function nomeUnicoComprovante(nomeOriginal) {
  const extensao = nomeOriginal.includes(".") ? nomeOriginal.split(".").pop() : "bin";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
}
async function uploadComprovantePix(buffer, nomeOriginal, mimeType) {
  const path2 = nomeUnicoComprovante(nomeOriginal);
  const { data, error } = await supabase.storage.from(BUCKET_COMPROVANTES).upload(path2, buffer, {
    contentType: mimeType,
    upsert: false
  });
  if (error) throw error;
  return data.path;
}
async function gerarUrlAssinadaComprovante(path2, expiresInSegundos = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET_COMPROVANTES).createSignedUrl(path2, expiresInSegundos);
  if (error) {
    console.error("Erro ao gerar URL assinada de comprovante:", error.message);
    return null;
  }
  return data.signedUrl;
}

// src/features/estoque/categoriaMotor.ts
function normalizar(texto2) {
  return (texto2 || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function categoriaExigeNota(categoriaId, categorias) {
  if (!categoriaId) return false;
  return getAncestorChain(categoriaId, categorias).some((c) => normalizar(c.nome) === "motor completo");
}

// src/features/promocoes/calculo.ts
var ESPECIFICIDADE_PROMOCAO = { peca: 0, modelo_moto: 1, categoria: 2, global: 3 };
function calcularValorPromocional(valorOriginal, promo) {
  const bruto = promo.tipo_desconto === "percentual" ? valorOriginal * (1 - Number(promo.valor) / 100) : valorOriginal - Number(promo.valor);
  return Math.max(0, Math.round(bruto * 100) / 100);
}
async function anexarPromocoes(supabase2, itens) {
  if (itens.length === 0) return itens;
  const agora = (/* @__PURE__ */ new Date()).toISOString();
  const { data: promocoesData, error } = await supabase2.from("promocoes").select("*").eq("ativo", true).lte("data_inicio", agora);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("\u26A0\uFE0F Tabela promocoes ausente \u2014 rode supabase/migration_018_promocoes.sql pra habilitar promo\xE7\xF5es.");
    } else {
      console.error("Erro ao buscar promo\xE7\xF5es:", error);
    }
    return itens.map((item) => ({ ...item, promocao_ativa: null }));
  }
  const vigentes = (promocoesData ?? []).filter((p) => !p.data_fim || p.data_fim >= agora);
  if (vigentes.length === 0) return itens.map((item) => ({ ...item, promocao_ativa: null }));
  const precisaCategorias = vigentes.some((p) => p.escopo === "categoria");
  const precisaModelos = vigentes.some((p) => p.escopo === "modelo_moto");
  const [categorias, modelos] = await Promise.all([
    precisaCategorias ? supabase2.from("categorias").select("id, parent_id").then((r) => r.data ?? []) : Promise.resolve([]),
    precisaModelos ? supabase2.from("modelos_moto").select("id, parent_id").then((r) => r.data ?? []) : Promise.resolve([])
  ]);
  const idsCobertosPorPromocao = /* @__PURE__ */ new Map();
  vigentes.forEach((p) => {
    if (p.escopo === "modelo_moto" && p.alvo_id) idsCobertosPorPromocao.set(p.id, new Set(getDescendantIds2(p.alvo_id, modelos)));
    if (p.escopo === "categoria" && p.alvo_id) idsCobertosPorPromocao.set(p.id, new Set(getDescendantIds(p.alvo_id, categorias)));
  });
  const encontrarMelhorPromocao = (item) => {
    let melhor = null;
    for (const p of vigentes) {
      const bate = p.escopo === "peca" ? p.alvo_id === item.id : p.escopo === "modelo_moto" ? !!item.modelo_moto_id && !!idsCobertosPorPromocao.get(p.id)?.has(item.modelo_moto_id) : p.escopo === "categoria" ? !!item.categoria_id && !!idsCobertosPorPromocao.get(p.id)?.has(item.categoria_id) : true;
      if (!bate) continue;
      if (!melhor || ESPECIFICIDADE_PROMOCAO[p.escopo] < ESPECIFICIDADE_PROMOCAO[melhor.escopo] || ESPECIFICIDADE_PROMOCAO[p.escopo] === ESPECIFICIDADE_PROMOCAO[melhor.escopo] && p.criado_em > melhor.criado_em) {
        melhor = p;
      }
    }
    return melhor;
  };
  return itens.map((item) => {
    const promo = encontrarMelhorPromocao(item);
    if (!promo) return { ...item, promocao_ativa: null };
    const valor_original = Number(item.valor) || 0;
    return {
      ...item,
      promocao_ativa: {
        id: promo.id,
        escopo: promo.escopo,
        tipo_desconto: promo.tipo_desconto,
        valor: promo.valor,
        valor_original,
        valor_promocional: calcularValorPromocional(valor_original, promo),
        data_fim: promo.data_fim,
        descricao: promo.descricao
      }
    };
  });
}

// src/services/mercadolivreApi.ts
import axios from "axios";
var ML_API_URL = "https://api.mercadolibre.com";
var TABELA_CONEXAO = "mercadolivre_conexao";
async function trocarTokens(supabase2, params) {
  const { data } = await axios.post(`${ML_API_URL}/oauth/token`, null, {
    params: {
      client_id: requireEnv("MERCADOLIVRE_APP_ID"),
      client_secret: requireEnv("MERCADOLIVRE_CLIENT_SECRET"),
      ...params
    },
    headers: { Accept: "application/json" }
  });
  const expiraEm = new Date(Date.now() + data.expires_in * 1e3).toISOString();
  const { error } = await supabase2.from(TABELA_CONEXAO).upsert(
    {
      ml_user_id: String(data.user_id),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expira_em: expiraEm,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "ml_user_id" }
  );
  if (error) throw error;
  return { mlUserId: String(data.user_id), accessToken: data.access_token };
}
async function obterConexaoAtual(supabase2) {
  const { data: conexao } = await supabase2.from(TABELA_CONEXAO).select("*").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  if (!conexao) return null;
  const faltamMs = new Date(conexao.expira_em).getTime() - Date.now();
  if (faltamMs > 5 * 60 * 1e3) return { mlUserId: conexao.ml_user_id, accessToken: conexao.access_token };
  return trocarTokens(supabase2, { grant_type: "refresh_token", refresh_token: conexao.refresh_token });
}
async function obterAccessTokenValido(supabase2) {
  const conexao = await obterConexaoAtual(supabase2);
  return conexao?.accessToken ?? null;
}
var MARGEM_PADRAO = 30;
async function obterMargemSincronizacao(supabase2) {
  const { data, error } = await supabase2.from(TABELA_CONEXAO).select("margem_sincronizacao_percentual").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") return MARGEM_PADRAO;
    throw error;
  }
  return data?.margem_sincronizacao_percentual != null ? Number(data.margem_sincronizacao_percentual) : MARGEM_PADRAO;
}
async function atualizarMargemSincronizacao(supabase2, margemPercentual) {
  const { error, count } = await supabase2.from(TABELA_CONEXAO).update({ margem_sincronizacao_percentual: margemPercentual }, { count: "exact" }).not("ml_user_id", "is", null);
  if (error) throw error;
  if (!count) throw new Error("Conecte a conta do Mercado Livre antes de configurar a margem.");
}
var MLB_ID_REGEX = /MLB-?(\d{6,12})/i;
function extrairMlbId(url) {
  if (!url) return null;
  const match = url.match(MLB_ID_REGEX);
  return match ? `MLB${match[1]}` : null;
}
function dividirEmLotes(lista, tamanho) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}
async function buscarItensPorIds(token, ids) {
  if (ids.length === 0) return [];
  const resultados = [];
  for (const lote of dividirEmLotes(ids, 20)) {
    const { data } = await axios.get(`${ML_API_URL}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ids: lote.join(",") }
    });
    for (const entrada of data ?? []) {
      if (entrada.code === 200 && entrada.body) resultados.push(entrada.body);
    }
  }
  return resultados;
}
async function atualizarItemML(token, mlbId, atualizacao) {
  await axios.put(`${ML_API_URL}/items/${mlbId}`, atualizacao, { headers: { Authorization: `Bearer ${token}` } });
}
async function buscarItensAtivosVendedor(token, mlUserId) {
  const ids = [];
  const limit = 50;
  let offset = 0;
  while (true) {
    const { data } = await axios.get(`${ML_API_URL}/users/${mlUserId}/items/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { status: "active", offset, limit }
    });
    const pagina = data?.results ?? [];
    ids.push(...pagina);
    const total = data?.paging?.total ?? ids.length;
    offset += limit;
    if (pagina.length === 0 || offset >= total) break;
  }
  return ids;
}
async function buscarPedidosRecentes(token, mlUserId, desde) {
  const { data } = await axios.get(`${ML_API_URL}/orders/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      seller: mlUserId,
      "order.status": "paid",
      "order.date_created.from": desde.toISOString(),
      sort: "date_desc"
    }
  });
  return data?.results ?? [];
}
async function buscarPedido(token, orderId) {
  try {
    const { data } = await axios.get(`${ML_API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data ?? null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}
function encontrarItemPedido(pedido, mlItemId) {
  return pedido.order_items.find((linha) => linha.item.id === mlItemId) ?? null;
}
function calcularValorRecebido(valorTotal, saleFee, custoEnvio, descontoVendedor = 0) {
  if (saleFee == null || custoEnvio == null) return null;
  return Math.round((valorTotal - saleFee - custoEnvio - Math.max(0, descontoVendedor)) * 100) / 100;
}
function calcularDescontoVendedor(linha) {
  return Math.round((linha?.discounts ?? []).reduce((total, desconto) => total + (Number(desconto.amounts?.seller) || 0), 0) * 100) / 100;
}
function alocarCustoEnvio(pedido, custoEnvioTotal, mlItemId) {
  const linha = encontrarItemPedido(pedido, mlItemId);
  if (!linha) return 0;
  const totalPedido = pedido.order_items.reduce((soma, i) => soma + i.quantity * i.unit_price, 0);
  if (totalPedido <= 0) return 0;
  const fracao = linha.quantity * linha.unit_price / totalPedido;
  return Math.round(custoEnvioTotal * fracao * 100) / 100;
}
async function buscarCustoEnvioVendedor(token, shippingId) {
  try {
    const { data } = await axios.get(`${ML_API_URL}/shipments/${shippingId}/costs`, {
      // O contrato atual do ML documenta os custos por remetente na vista
      // nova. Sem este header, alguns envios não devolvem `senders[].cost`,
      // e o sistema perde justamente o valor cobrado do vendedor.
      headers: { Authorization: `Bearer ${token}`, "x-format-new": "true" }
    });
    const senders = data?.senders;
    if (!Array.isArray(senders) || senders.length === 0) return null;
    return senders.reduce((soma, s) => soma + (Number(s.cost) || 0), 0);
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}
async function buscarEnvio(token, shippingId) {
  const { data } = await axios.get(`${ML_API_URL}/shipments/${shippingId}`, {
    headers: { Authorization: `Bearer ${token}`, "x-format-new": "true" }
  });
  const ra = data.receiver_address;
  const contactFname = ra?.contact?.fname?.trim() ?? "";
  const contactLname = ra?.contact?.lname?.trim() ?? "";
  const contactFullName = [contactFname, contactLname].filter(Boolean).join(" ") || null;
  const receiverName = ra?.receiver_name?.trim() || contactFullName || null;
  return {
    id: data.id,
    status: data.status,
    substatus: data.substatus ?? null,
    trackingNumber: data.tracking_number ?? null,
    cost: data.shipping_option?.cost ?? data.declared_value ?? null,
    receiverName
  };
}
async function buscarPerguntas(token, mlUserId, status = "UNANSWERED") {
  try {
    const { data } = await axios.get(`${ML_API_URL}/questions/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { seller_id: mlUserId, status, api_version: 4 }
    });
    return data?.questions ?? data?.results ?? [];
  } catch (err) {
    if (err.response?.status === 404) return [];
    throw err;
  }
}
async function responderPergunta(token, questionId, texto2) {
  await axios.post(`${ML_API_URL}/answers`, { question_id: questionId, text: texto2 }, { headers: { Authorization: `Bearer ${token}` } });
}
var SITE_ID = "MLB";
async function predizerCategoria(token, titulo) {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/domain_discovery/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: titulo, limit: 4 }
  });
  return data ?? [];
}
async function buscarAtributosCategoriaML(token, categoriaId) {
  const { data } = await axios.get(`${ML_API_URL}/categories/${categoriaId}/attributes`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data ?? [];
}
async function buscarProdutosCatalogoML(token, titulo) {
  const { data } = await axios.get(`${ML_API_URL}/products/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { status: "active", site_id: SITE_ID, listing_strategy: "catalog_required", q: titulo }
  });
  return data?.results ?? [];
}
var LISTING_TYPES_VIGENTES = ["gold_special", "gold_pro"];
async function buscarTiposAnuncioML(token, preco) {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/listing_prices`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { price: preco }
  });
  return (data ?? []).filter((tipo) => LISTING_TYPES_VIGENTES.includes(tipo.listing_type_id));
}
async function criarItemML(token, payload) {
  const { data } = await axios.post(`${ML_API_URL}/items`, payload, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
async function atualizarDescricaoML(token, itemId, texto2) {
  await axios.post(`${ML_API_URL}/items/${itemId}/description`, { plain_text: texto2 }, { headers: { Authorization: `Bearer ${token}` } });
}
async function buscarVisitasItem(token, itemIds) {
  if (itemIds.length === 0) return {};
  const totais = {};
  for (const id of itemIds) {
    const { data } = await axios.get(`${ML_API_URL}/visits/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ids: id }
    });
    Object.assign(totais, data ?? {});
  }
  return totais;
}
async function buscarVisitasUltimosDias(token, itemId, dias) {
  const { data } = await axios.get(`${ML_API_URL}/items/${itemId}/visits/time_window`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { last: dias, unit: "day" }
  });
  return data?.total_visits ?? 0;
}
async function buscarCategoriaML(token, categoriaId) {
  const { data } = await axios.get(`${ML_API_URL}/categories/${categoriaId}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
async function buscarCategoriasRaizML(token) {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/categories`, { headers: { Authorization: `Bearer ${token}` } });
  return data ?? [];
}
function resolverNomeComprador(buyer, receiverName) {
  if (!buyer) return null;
  const primeiroNome = buyer.first_name?.trim();
  const sobrenome = buyer.last_name?.trim();
  const nomesDisponiveis = [primeiroNome, sobrenome].filter(Boolean);
  if (nomesDisponiveis.length > 0) return nomesDisponiveis.join(" ");
  if (receiverName?.trim()) return receiverName.trim();
  if (buyer.nickname?.trim()) return buyer.nickname.trim();
  return null;
}

// src/services/mercadolivrePublicacao.ts
var CODIGOS_MIGRATION_AUSENTE = ["42703", "42P01", "PGRST205"];
function ehErroDeMigrationAusente(error) {
  return !!error && CODIGOS_MIGRATION_AUSENTE.includes(error.code);
}
function arredondarCentavos(valor) {
  return Math.round(valor * 100) / 100;
}
async function sugerirCategoria(token, titulo) {
  const predicoes = await predizerCategoria(token, titulo);
  return predicoes.map((p) => ({
    id: p.category_id,
    nome: p.category_name,
    caminho: p.domain_name ?? null,
    atributosSugeridos: p.attributes.map((a) => ({ id: a.id, valueId: a.value_id, valueName: a.value_name }))
  }));
}
async function listarFilhosCategoria(token, categoriaId) {
  if (!categoriaId) {
    const raiz = await buscarCategoriasRaizML(token);
    return raiz.map((c) => ({ id: c.id, nome: c.name }));
  }
  const categoria = await buscarCategoriaML(token, categoriaId);
  return (categoria.children_categories ?? []).map((c) => ({ id: c.id, nome: c.name }));
}
async function buscarDetalheCategoria(token, categoriaId) {
  const categoria = await buscarCategoriaML(token, categoriaId);
  return {
    id: categoria.id,
    nome: categoria.name,
    caminho: categoria.path_from_root.length > 0 ? categoria.path_from_root.map((c) => c.name).join(" > ") : null,
    atributosSugeridos: []
  };
}
var CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
async function buscarAtributosCategoriaComCache(supabase2, token, categoriaId) {
  const { data: cache, error } = await supabase2.from("mercadolivre_categorias_cache").select("*").eq("categoria_ml_id", categoriaId).maybeSingle();
  if (error && !ehErroDeMigrationAusente(error)) throw error;
  const vencido = !!cache && Date.now() - new Date(cache.atualizado_em).getTime() > CACHE_TTL_MS;
  if (cache && !vencido) return cache.atributos;
  const [atributos, categoria] = await Promise.all([buscarAtributosCategoriaML(token, categoriaId), buscarCategoriaML(token, categoriaId)]);
  const { error: erroCache } = await supabase2.from("mercadolivre_categorias_cache").upsert(
    {
      categoria_ml_id: categoriaId,
      nome_ml: categoria.name,
      caminho: categoria.path_from_root.map((c) => c.name).join(" > "),
      atributos,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "categoria_ml_id" }
  );
  if (erroCache && !ehErroDeMigrationAusente(erroCache)) console.error("Erro ao gravar cache de categoria do Mercado Livre:", erroCache);
  return atributos;
}
async function buscarProdutosCatalogo(token, titulo) {
  const produtos = await buscarProdutosCatalogoML(token, titulo);
  return produtos.map((p) => ({ id: p.id, nome: p.name, foto: p.pictures?.[0]?.url ?? null }));
}
async function buscarTiposAnuncioDisponiveis(token, preco) {
  const tipos = await buscarTiposAnuncioML(token, preco);
  return tipos.map((t) => ({
    id: t.listing_type_id,
    nome: t.listing_type_name,
    taxaVendaPercentual: preco > 0 ? t.sale_fee_amount / preco * 100 : 0,
    taxaVendaValor: t.sale_fee_amount,
    exposicao: t.listing_exposure
  }));
}
function extrairMensagemErroMl(data) {
  if (!data) return null;
  const causas = Array.isArray(data.cause) ? data.cause.map((c) => c?.message).filter((m) => typeof m === "string" && m.length > 0) : [];
  if (causas.length > 0) return causas.join("; ");
  return typeof data.message === "string" && data.message.length > 0 ? data.message : null;
}
function calcularPrecoComMargem(precoEfetivo, margemPercentual) {
  return arredondarCentavos(precoEfetivo * (1 + margemPercentual / 100));
}
function mapearAtributo({ id, value_id, value_name, value_struct }) {
  return { id, value_id, value_name, value_struct };
}
function montarPayloadPublicacao(item, unidades, config, margemPercentual) {
  const precoEfetivoPeca = config.precoEfetivoSistema ?? item.valor;
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));
  const base = {
    title: (config.tituloAnuncio || item.nome).slice(0, 60),
    category_id: config.categoriaMlId,
    currency_id: "BRL",
    buying_mode: "buy_it_now",
    condition: config.condicaoMl,
    listing_type_id: config.listingTypeId,
    attributes: config.atributos.map(mapearAtributo),
    // "me2" (Mercado Envios Fulfillment) exige contrato/elegibilidade que a
    // loja não tem e várias categorias de autopeças nem aceitam (confirmado
    // ao vivo em GET /categories/{id}: settings.shipping_options não inclui
    // "me2") — mandar esse modo faz o Mercado Livre recusar a criação do
    // item inteiro com "body.required_fields". "not_specified" ("a combinar")
    // é aceito por qualquer conta/categoria e já reflete o fluxo real: o
    // frete é calculado à parte, na venda, via Melhor Envio (ver
    // src/features/frete), nunca no ato da publicação do anúncio.
    shipping: { mode: "not_specified" }
  };
  if (config.catalogoProdutoId) {
    base.catalog_product_id = config.catalogoProdutoId;
    base.catalog_listing = true;
  }
  const variacoesValidas = config.catalogoProdutoId ? [] : (config.variacoes ?? []).filter((v) => v.atributos.length > 0 && unidadesPorId.has(v.unidadeId));
  if (variacoesValidas.length < 2) {
    return {
      usaVariacoes: false,
      ordemUnidades: [],
      payload: {
        ...base,
        price: calcularPrecoComMargem(precoEfetivoPeca, margemPercentual),
        available_quantity: item.quantidade,
        pictures: config.fotos.map((source) => ({ source }))
      }
    };
  }
  const fotosDasVariacoes = variacoesValidas.flatMap((v) => unidadesPorId.get(v.unidadeId).fotos);
  const todasAsFotos = Array.from(/* @__PURE__ */ new Set([...config.fotos, ...fotosDasVariacoes]));
  return {
    usaVariacoes: true,
    ordemUnidades: variacoesValidas.map((v) => v.unidadeId),
    payload: {
      ...base,
      pictures: todasAsFotos.map((source) => ({ source })),
      variations: variacoesValidas.map((v) => {
        const unidade = unidadesPorId.get(v.unidadeId);
        const precoEfetivoVariacao = v.precoEfetivoSistema ?? unidade.valor ?? precoEfetivoPeca;
        return {
          attribute_combinations: v.atributos.map(mapearAtributo),
          available_quantity: 1,
          price: calcularPrecoComMargem(precoEfetivoVariacao, margemPercentual),
          picture_ids: unidade.fotos.length > 0 ? unidade.fotos : config.fotos
        };
      })
    }
  };
}
function pareceErroPrecoPorVariacao(error) {
  const corpo = JSON.stringify(error?.response?.data ?? "").toLowerCase();
  return corpo.includes("variat") && (corpo.includes("price") || corpo.includes("precio") || corpo.includes("preco"));
}
function pareceErroFamilyNameAusente(error) {
  const mensagem = extrairMensagemErroMl(error?.response?.data) ?? "";
  return mensagem.toLowerCase().includes("family_name");
}
async function gravarResultadoPublicacao(supabase2, token, estoqueId, config, criado, descricaoTexto, ordemUnidades, origemUnidadeId) {
  try {
    await atualizarDescricaoML(token, criado.id, descricaoTexto);
  } catch (err) {
    console.error(`An\xFAncio ${criado.id} publicado sem descri\xE7\xE3o (POST /items/${criado.id}/description falhou):`, err.response?.data || err.message);
  }
  const { data: link, error } = await supabase2.from("estoque_anuncios_ml").insert({
    estoque_id: estoqueId,
    url: criado.permalink,
    mlb_id: criado.id,
    publicado_via_sistema: true,
    ml_category_id: config.categoriaMlId,
    listing_type_id: config.listingTypeId,
    condicao_ml: config.condicaoMl,
    status_ml: criado.status ?? null,
    // Metadado leve só pro caso de fallback (anúncio separado por ficha) —
    // não é uma "variação" real do ML, mas registra de qual ficha ele veio.
    atributos_ml: origemUnidadeId ? { origem_unidade_id: origemUnidadeId } : config.catalogoProdutoId ? { catalog_product_id: config.catalogoProdutoId } : null,
    publicado_em: (/* @__PURE__ */ new Date()).toISOString()
  }).select("id").single();
  if (error) throw error;
  if (ordemUnidades.length > 0) {
    const variacoesResposta = criado.variations ?? [];
    const linhas = ordemUnidades.map((unidadeId, indice) => {
      const variacao = variacoesResposta[indice];
      return {
        link_id: link.id,
        unidade_id: unidadeId,
        ml_variation_id: variacao?.id != null ? String(variacao.id) : "",
        preco: variacao?.price ?? null,
        quantidade: variacao?.available_quantity ?? 1
      };
    }).filter((linha) => linha.ml_variation_id);
    if (linhas.length > 0) {
      const { error: erroVariacoes } = await supabase2.from("estoque_anuncios_ml_variacoes").insert(linhas);
      if (erroVariacoes && !ehErroDeMigrationAusente(erroVariacoes)) throw erroVariacoes;
    }
  }
  sincronizarEstatisticas(supabase2, token, [link.id]).catch((err) => {
    console.error(`Erro ao buscar estat\xEDsticas iniciais do an\xFAncio ${criado.id}:`, err.response?.data || err.message);
  });
  return link.id;
}
function detectarFotosNaoAnexadas(fotosEnviadas, criado) {
  const enviadas = fotosEnviadas.length;
  if (enviadas === 0) return null;
  const anexadas = criado.pictures?.length ?? 0;
  if (anexadas >= enviadas) return null;
  const faltando = enviadas - anexadas;
  return `${faltando} de ${enviadas} ${enviadas === 1 ? "foto n\xE3o entrou" : "fotos n\xE3o entraram"} no an\xFAncio (o Mercado Livre pode ter rejeitado alguma sem avisar) \u2014 confira e tente adicionar de novo se precisar.`;
}
function montarPayloadComFamilyName(payload, nomeFamilia) {
  const { title, ...resto } = payload;
  return { ...resto, family_name: nomeFamilia };
}
var contaUsaUserProductsPorUsuario = /* @__PURE__ */ new Map();
async function detectarContaUsaUserProducts(token, mlUserId) {
  if (!mlUserId) return null;
  const cacheado = contaUsaUserProductsPorUsuario.get(mlUserId);
  if (cacheado !== void 0) return cacheado;
  try {
    const ids = await buscarItensAtivosVendedor(token, mlUserId);
    if (ids.length === 0) return null;
    const [item] = await buscarItensPorIds(token, [ids[0]]);
    if (!item) return null;
    const migrada = item.user_product_id != null;
    contaUsaUserProductsPorUsuario.set(mlUserId, migrada);
    return migrada;
  } catch (err) {
    console.error("N\xE3o foi poss\xEDvel detectar o modelo da conta do Mercado Livre \u2014 publicando no formato cl\xE1ssico:", err.response?.data || err.message);
    return null;
  }
}
async function criarItemMlNoModeloDaConta(token, payload, contaMigrada, mlUserId) {
  if (contaMigrada === true) {
    return criarItemML(token, montarPayloadComFamilyName(payload, payload.title));
  }
  try {
    return await criarItemML(token, payload);
  } catch (err) {
    if (!pareceErroFamilyNameAusente(err)) throw err;
    if (mlUserId) contaUsaUserProductsPorUsuario.set(mlUserId, true);
    console.warn("Mercado Livre exigiu family_name (conta migrada pro modelo de User Products) \u2014 N\xC3O reenviando pra n\xE3o duplicar o an\xFAncio.", err.response?.data || err.message);
    throw new Error(
      "O Mercado Livre exigiu family_name (conta migrada pro modelo de User Products). O an\xFAncio PODE ter sido criado mesmo com esse erro \u2014 confira sua conta no Mercado Livre antes de tentar de novo. A pr\xF3xima tentativa j\xE1 sai no formato certo."
    );
  }
}
async function publicarAnuncio(supabase2, token, estoqueId, config) {
  const { data: item, error: erroItem } = await supabase2.from("estoque").select("id, nome, valor, quantidade, descricao").eq("id", estoqueId).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error("Pe\xE7a n\xE3o encontrada.");
  const unidadeIds = (config.variacoes ?? []).map((v) => v.unidadeId);
  let unidades = [];
  if (unidadeIds.length > 0) {
    const { data, error } = await supabase2.from("estoque_unidades").select("id, valor, fotos").in("id", unidadeIds);
    if (error) throw error;
    unidades = (data ?? []).map((u) => ({ id: u.id, valor: u.valor != null ? Number(u.valor) : null, fotos: u.fotos ?? [] }));
  }
  const conexao = await obterConexaoAtual(supabase2);
  const mlUserId = conexao?.mlUserId ?? null;
  const contaMigrada = await detectarContaUsaUserProducts(token, mlUserId);
  const margemPercentual = await obterMargemSincronizacao(supabase2);
  const descricaoTexto = config.descricaoAnuncio?.trim() || (item.descricao || "").trim() || item.nome;
  const montado = montarPayloadPublicacao(item, unidades, config, margemPercentual);
  try {
    const criado = await criarItemMlNoModeloDaConta(token, montado.payload, contaMigrada, mlUserId);
    await gravarResultadoPublicacao(supabase2, token, estoqueId, config, criado, descricaoTexto, montado.usaVariacoes ? montado.ordemUnidades : []);
    return {
      caminho: montado.usaVariacoes ? "variacoes" : "simples",
      avisoFallback: null,
      avisoFotos: detectarFotosNaoAnexadas(montado.payload.pictures.map((p) => p.source), criado),
      links: [{ linkId: criado.id, mlbId: criado.id, url: criado.permalink }]
    };
  } catch (err) {
    if (!montado.usaVariacoes || !pareceErroPrecoPorVariacao(err)) throw err;
    console.warn("Pre\xE7o por varia\xE7\xE3o recusado pelo Mercado Livre \u2014 publicando em an\xFAncios separados por ficha.", err.response?.data || err.message);
  }
  const configSemVariacoes = { ...config, variacoes: void 0 };
  const payloadBase = montarPayloadPublicacao(item, [], configSemVariacoes, margemPercentual);
  const criadoBase = await criarItemMlNoModeloDaConta(token, payloadBase.payload, contaMigrada, mlUserId);
  await gravarResultadoPublicacao(supabase2, token, estoqueId, config, criadoBase, descricaoTexto, []);
  const links = [{ linkId: criadoBase.id, mlbId: criadoBase.id, url: criadoBase.permalink }];
  const avisosFotos = [];
  const avisoFotosBase = detectarFotosNaoAnexadas(payloadBase.payload.pictures.map((p) => p.source), criadoBase);
  if (avisoFotosBase) avisosFotos.push(avisoFotosBase);
  for (const unidade of unidades) {
    if (unidade.valor == null) continue;
    const configUnidade = {
      ...config,
      precoEfetivoSistema: unidade.valor,
      // União, não substituição: a ficha com foto própria SOMA à seleção do
      // modal em vez de descartá-la. Antes, uma ficha com 1 foto fazia o
      // anúncio dela sair só com essa foto, jogando fora as demais fotos
      // escolhidas pro anúncio — nenhum anúncio pode sair com menos fotos do
      // que o usuário selecionou.
      fotos: Array.from(/* @__PURE__ */ new Set([...config.fotos, ...unidade.fotos])),
      variacoes: void 0
    };
    const payloadUnidade = montarPayloadPublicacao(item, [], configUnidade, margemPercentual);
    const criadoUnidade = await criarItemMlNoModeloDaConta(token, payloadUnidade.payload, contaMigrada, mlUserId);
    await gravarResultadoPublicacao(supabase2, token, estoqueId, config, criadoUnidade, descricaoTexto, [], unidade.id);
    links.push({ linkId: criadoUnidade.id, mlbId: criadoUnidade.id, url: criadoUnidade.permalink });
    const avisoFotosUnidade = detectarFotosNaoAnexadas(payloadUnidade.payload.pictures.map((p) => p.source), criadoUnidade);
    if (avisoFotosUnidade) avisosFotos.push(avisoFotosUnidade);
  }
  return {
    caminho: "itens_separados",
    avisoFallback: "O Mercado Livre ainda n\xE3o libera pre\xE7o diferente por varia\xE7\xE3o pra esta conta/categoria \u2014 foi publicado 1 an\xFAncio por ficha em vez de um an\xFAncio s\xF3 com varia\xE7\xF5es.",
    avisoFotos: avisosFotos.length > 0 ? avisosFotos.join(" ") : null,
    links
  };
}
async function sincronizarEstatisticas(supabase2, token, linkIds) {
  if (linkIds.length === 0) return;
  const { data: links, error } = await supabase2.from("estoque_anuncios_ml").select("id, mlb_id").in("id", linkIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) return;
    throw error;
  }
  if (!links || links.length === 0) return;
  const mlbIds = links.map((l) => l.mlb_id);
  const conexao = await obterConexaoAtual(supabase2);
  const [itensMl, visitasTotais, perguntas] = await Promise.all([
    buscarItensPorIds(token, mlbIds),
    buscarVisitasItem(token, mlbIds),
    conexao ? buscarPerguntas(token, conexao.mlUserId, "UNANSWERED").catch(() => []) : Promise.resolve([])
  ]);
  const mapaItens = new Map(itensMl.map((item) => [item.id, item]));
  const perguntasPorItem = /* @__PURE__ */ new Map();
  for (const p of perguntas) perguntasPorItem.set(p.item_id, (perguntasPorItem.get(p.item_id) ?? 0) + 1);
  const linhas = await Promise.all(
    links.map(async (link) => {
      const itemMl = mapaItens.get(link.mlb_id);
      const visitasUltimos15 = await buscarVisitasUltimosDias(token, link.mlb_id, 15).catch(() => null);
      return {
        link_id: link.id,
        visitas_total: visitasTotais[link.mlb_id] ?? null,
        visitas_ultimos_15_dias: visitasUltimos15,
        perguntas_abertas: perguntasPorItem.get(link.mlb_id) ?? 0,
        vendas_totais: itemMl?.sold_quantity ?? null,
        // health vem 0-1 (ou null, pra categorias sem esse indicador) — guardamos
        // em % (0-100) pra bater com o numeric(5,2) de saude_anuncio.
        saude_anuncio: itemMl?.health != null ? Number(itemMl.health) * 100 : null,
        status_ml: itemMl?.status ?? null,
        atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
      };
    })
  );
  const { error: erroUpsert } = await supabase2.from("estoque_anuncios_ml_estatisticas").upsert(linhas, { onConflict: "link_id" });
  if (erroUpsert && !ehErroDeMigrationAusente(erroUpsert)) throw erroUpsert;
}

// src/features/estoque/detectarDuplicata.ts
function tokenizar(texto2) {
  return (texto2 || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2").trim().split(/\s+/).filter(Boolean);
}
function similaridade(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersecao = 0;
  setA.forEach((t) => {
    if (setB.has(t)) intersecao += 1;
  });
  const uniao = setA.size + setB.size - intersecao;
  return uniao === 0 ? 0 : intersecao / uniao;
}
var CORTE_POSSIVEL = 0.6;

// src/services/pushNotificationService.ts
import webpush from "web-push";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
var vapidConfigurado = false;
function garantirVapidConfigurado() {
  if (vapidConfigurado) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigurado = true;
  return true;
}
var firebaseConfigurado = false;
function garantirFirebaseConfigurado() {
  if (firebaseConfigurado) return true;
  const { FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return false;
  try {
    const credenciais = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) {
      initializeApp({ credential: cert(credenciais) });
    }
    firebaseConfigurado = true;
    return true;
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT inv\xE1lido (n\xE3o \xE9 um JSON de service account v\xE1lido):", err?.message || err);
    return false;
  }
}
async function enviarParaUmaSubscription(supabase2, sub, payload) {
  try {
    if (sub.tipo === "web") {
      if (!garantirVapidConfigurado()) {
        console.warn("\u26A0\uFE0F Push Web pulado: configure VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no .env.");
        return;
      }
      if (!sub.endpoint || !sub.p256dh || !sub.auth_key) return;
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return;
    }
    if (!garantirFirebaseConfigurado()) {
      console.warn("\u26A0\uFE0F Push FCM pulado: configure FIREBASE_SERVICE_ACCOUNT no .env.");
      return;
    }
    if (!sub.fcm_token) return;
    await getMessaging().send({
      token: sub.fcm_token,
      notification: { title: payload.titulo, body: payload.corpo },
      data: { url: payload.url || "/" }
    });
  } catch (err) {
    const statusCode = err?.statusCode;
    const firebaseCode = err?.code;
    const tokenMorto = statusCode === 404 || statusCode === 410 || firebaseCode === "messaging/registration-token-not-registered" || firebaseCode === "messaging/invalid-registration-token" || firebaseCode === "messaging/invalid-argument";
    if (tokenMorto) {
      await supabase2.from("push_subscriptions").delete().eq("id", sub.id);
    } else {
      console.error(`Erro ao enviar push (subscription ${sub.id}):`, err?.message || err);
    }
  }
}
async function notificarUsuario(supabase2, usuarioId, payload) {
  const { data: subs, error } = await supabase2.from("push_subscriptions").select("id, tipo, endpoint, p256dh, auth_key, fcm_token").eq("usuario_id", usuarioId).eq("ativo", true);
  if (error) {
    console.error("Erro ao buscar push_subscriptions:", error.message);
    return;
  }
  if (!subs || subs.length === 0) return;
  await Promise.all(subs.map((sub) => enviarParaUmaSubscription(supabase2, sub, payload)));
}
async function notificarUsuarios(supabase2, usuarioIds, payload) {
  const idsUnicos = Array.from(new Set(usuarioIds));
  await Promise.all(idsUnicos.map((id) => notificarUsuario(supabase2, id, payload)));
}

// src/services/destinatariosNotificacao.ts
async function buscarDestinatariosEquipe(supabase2) {
  const { data, error } = await supabase2.from("usuarios").select("id, roles").eq("ativo", true).or("roles.ov.{admin,equipe}");
  if (error) throw error;
  return (data ?? []).map((u) => u.id);
}

// src/services/mercadolivreSync.ts
var CODIGOS_MIGRATION_AUSENTE2 = ["42703", "42P01", "PGRST204", "PGRST205"];
function ehErroDeMigrationAusente2(error) {
  return !!error && CODIGOS_MIGRATION_AUSENTE2.includes(error.code);
}
var SELECT_ESTOQUE_SYNC = "id, nome, valor, quantidade, categoria_id, modelo_moto_id";
function linkDoItemLegado(item) {
  const mlbId = extrairMlbId(item.anuncio_ml_url);
  if (!mlbId) return null;
  return {
    linkId: `legado:${item.id}`,
    estoqueId: item.id,
    estoqueNome: item.nome,
    estoqueValor: Number(item.valor) || 0,
    estoqueQuantidade: Number(item.quantidade) || 0,
    estoqueCategoriaId: item.categoria_id,
    estoqueModeloMotoId: item.modelo_moto_id,
    mlbId,
    url: item.anuncio_ml_url
  };
}
async function buscarLinksParaSincronizar(supabase2, filtroLinkIds) {
  const { data, error } = await supabase2.from("estoque_anuncios_ml").select(`id, url, mlb_id, estoque:estoque(${SELECT_ESTOQUE_SYNC})`);
  let links;
  if (error) {
    if (!ehErroDeMigrationAusente2(error)) throw error;
    const { data: itens, error: erroLegado } = await supabase2.from("estoque").select(`${SELECT_ESTOQUE_SYNC}, anuncio_ml_url`).not("anuncio_ml_url", "is", null);
    if (erroLegado) throw erroLegado;
    links = (itens ?? []).map(linkDoItemLegado).filter((l) => l !== null);
  } else {
    links = (data ?? []).filter((link) => !!link.estoque).map((link) => ({
      linkId: link.id,
      estoqueId: link.estoque.id,
      estoqueNome: link.estoque.nome,
      estoqueValor: Number(link.estoque.valor) || 0,
      estoqueQuantidade: Number(link.estoque.quantidade) || 0,
      estoqueCategoriaId: link.estoque.categoria_id,
      estoqueModeloMotoId: link.estoque.modelo_moto_id,
      mlbId: link.mlb_id,
      url: link.url
    }));
  }
  if (!filtroLinkIds) return links;
  const filtro = new Set(filtroLinkIds);
  return links.filter((l) => filtro.has(l.linkId));
}
function arredondarCentavos2(valor) {
  return Math.round(valor * 100) / 100;
}
async function calcularAnunciosParaSincronizar(supabase2, token, filtroLinkIds) {
  const [links, margemPercentual] = await Promise.all([buscarLinksParaSincronizar(supabase2, filtroLinkIds), obterMargemSincronizacao(supabase2)]);
  if (links.length === 0) return { margemPercentual, anuncios: [] };
  const itensUnicos = /* @__PURE__ */ new Map();
  for (const link of links) if (!itensUnicos.has(link.estoqueId)) itensUnicos.set(link.estoqueId, link);
  const comPromocao = await anexarPromocoes(
    supabase2,
    Array.from(itensUnicos.values()).map((l) => ({ id: l.estoqueId, valor: l.estoqueValor, quantidade: l.estoqueQuantidade, categoria_id: l.estoqueCategoriaId, modelo_moto_id: l.estoqueModeloMotoId }))
  );
  const precoEfetivoPorItem = /* @__PURE__ */ new Map();
  for (const item of comPromocao) precoEfetivoPorItem.set(item.id, item.promocao_ativa?.valor_promocional ?? (Number(item.valor) || 0));
  const itensMl = await buscarItensPorIds(token, links.map((l) => l.mlbId));
  const mapaMl = /* @__PURE__ */ new Map();
  for (const item of itensMl) mapaMl.set(item.id, item);
  const anuncios = links.map((link) => {
    const itemMl = mapaMl.get(link.mlbId);
    const disponivelNoMl = !!itemMl;
    const fechado = disponivelNoMl && itemMl.status === "closed";
    const precoEfetivoSistema = precoEfetivoPorItem.get(link.estoqueId) ?? link.estoqueValor;
    const precoNovoSistema = arredondarCentavos2(precoEfetivoSistema * (1 + margemPercentual / 100));
    const quantidadeNovaSistema = link.estoqueQuantidade;
    const statusNovoSistema = quantidadeNovaSistema > 0 ? "active" : "paused";
    const precoAtualMl = disponivelNoMl ? Number(itemMl.price) : null;
    const quantidadeAtualMl = disponivelNoMl ? Number(itemMl.available_quantity) : null;
    const statusAtualMl = disponivelNoMl ? itemMl.status : null;
    const mudaPreco = disponivelNoMl && Math.round(precoNovoSistema * 100) !== Math.round((precoAtualMl ?? 0) * 100);
    const mudaQuantidade = disponivelNoMl && quantidadeAtualMl !== quantidadeNovaSistema;
    const mudaStatus = disponivelNoMl && !fechado && statusAtualMl !== statusNovoSistema;
    return {
      linkId: link.linkId,
      estoqueId: link.estoqueId,
      estoqueNome: link.estoqueNome,
      mlbId: link.mlbId,
      url: link.url,
      disponivelNoMl,
      fechado,
      precoAtualMl,
      quantidadeAtualMl,
      statusAtualMl,
      precoEfetivoSistema,
      margemAplicada: margemPercentual,
      precoNovoSistema,
      quantidadeNovaSistema,
      statusNovoSistema,
      mudaPreco,
      mudaQuantidade,
      mudaStatus,
      semAlteracao: disponivelNoMl && !mudaPreco && !mudaQuantidade && !mudaStatus
    };
  });
  return { margemPercentual, anuncios };
}
async function buscarPreviewSincronizacao(supabase2, token) {
  return calcularAnunciosParaSincronizar(supabase2, token);
}
async function aplicarSincronizacao(supabase2, token, linkIds) {
  const { anuncios } = await calcularAnunciosParaSincronizar(supabase2, token, linkIds);
  const resultado = { processados: 0, sincronizados: 0, semAlteracao: 0, indisponiveis: 0, erros: [] };
  for (const anuncio of anuncios) {
    resultado.processados++;
    if (!anuncio.disponivelNoMl) {
      resultado.indisponiveis++;
      continue;
    }
    if (anuncio.semAlteracao) {
      resultado.semAlteracao++;
      continue;
    }
    try {
      const atualizacao = {};
      if (anuncio.mudaPreco) atualizacao.price = anuncio.precoNovoSistema;
      if (anuncio.mudaQuantidade) atualizacao.available_quantity = anuncio.quantidadeNovaSistema;
      if (anuncio.mudaStatus) atualizacao.status = anuncio.statusNovoSistema;
      if (Object.keys(atualizacao).length > 0) await atualizarItemML(token, anuncio.mlbId, atualizacao);
      resultado.sincronizados++;
    } catch (err) {
      resultado.erros.push({ linkId: anuncio.linkId, estoqueNome: anuncio.estoqueNome, mlbId: anuncio.mlbId, error: err.response?.data?.message || err.message });
    }
  }
  return resultado;
}
var SELECT_ESTOQUE_RESUMO = "id, nome, valor, quantidade, condicao, ano, modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(nome)";
function resumirEstoqueML(item) {
  return {
    id: item.id,
    nome: item.nome,
    valor: Number(item.valor) || 0,
    quantidade: Number(item.quantidade) || 0,
    condicao: item.condicao,
    ano: item.ano ?? null,
    modeloMotoNome: item.modelo_moto?.nome ?? null
  };
}
async function construirMapaEstoquePorMlb(supabase2) {
  const { data, error } = await supabase2.from("estoque_anuncios_ml").select(`mlb_id, estoque:estoque(${SELECT_ESTOQUE_RESUMO})`);
  const mapa = /* @__PURE__ */ new Map();
  if (error) {
    if (!ehErroDeMigrationAusente2(error)) throw error;
    const { data: itens } = await supabase2.from("estoque").select(`${SELECT_ESTOQUE_RESUMO}, anuncio_ml_url`).not("anuncio_ml_url", "is", null);
    for (const item of itens ?? []) {
      const mlbId = extrairMlbId(item.anuncio_ml_url);
      if (!mlbId) continue;
      mapa.set(mlbId, resumirEstoqueML(item));
    }
    return mapa;
  }
  for (const link of data ?? []) {
    if (!link.estoque) continue;
    mapa.set(link.mlb_id, resumirEstoqueML(link.estoque));
  }
  return mapa;
}
async function buscarCustosEnvioPorPedidos(token, pedidos) {
  const mapa = /* @__PURE__ */ new Map();
  for (const pedido of pedidos) {
    const shippingId = pedido.shipping?.id;
    if (shippingId == null) continue;
    mapa.set(String(pedido.id), await buscarCustoEnvioVendedor(token, String(shippingId)));
  }
  return mapa;
}
async function buscarInfoComplementarPorPedidos(token, pedidos) {
  const mapa = /* @__PURE__ */ new Map();
  for (const pedido of pedidos) {
    let receiverName = null;
    const shippingId = pedido.shipping?.id;
    if (shippingId != null) {
      try {
        const envio = await buscarEnvio(token, String(shippingId));
        receiverName = envio.receiverName;
      } catch {
        receiverName = null;
      }
    }
    let buyerCompleto = null;
    if (!pedido.buyer?.first_name && !pedido.buyer?.last_name) {
      try {
        const pedidoCompleto = await buscarPedido(token, String(pedido.id));
        buyerCompleto = pedidoCompleto?.buyer ?? null;
      } catch {
        buyerCompleto = null;
      }
    }
    mapa.set(String(pedido.id), { receiverName, buyerCompleto });
  }
  return mapa;
}
async function buscarVendasJaImportadas(supabase2, mlOrderIds) {
  if (mlOrderIds.length === 0) return /* @__PURE__ */ new Set();
  const { data, error } = await supabase2.from("vendas").select("ml_order_id, ml_item_id").in("ml_order_id", mlOrderIds);
  if (error) {
    if (ehErroDeMigrationAusente2(error)) {
      throw new Error("Rode a migration_022 antes de importar pedidos do Mercado Livre.");
    }
    throw error;
  }
  return new Set((data ?? []).map((v) => `${v.ml_order_id}::${v.ml_item_id}`));
}
async function buscarPreviewPedidos(supabase2, token, mlUserId, dias) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1e3);
  const [pedidos, mapaEstoque] = await Promise.all([buscarPedidosRecentes(token, mlUserId, desde), construirMapaEstoquePorMlb(supabase2)]);
  if (pedidos.length === 0) return [];
  const [jaImportados, custosEnvioPorPedido, infoComplementar] = await Promise.all([
    buscarVendasJaImportadas(supabase2, pedidos.map((p) => String(p.id))),
    buscarCustosEnvioPorPedidos(token, pedidos),
    buscarInfoComplementarPorPedidos(token, pedidos)
  ]);
  return pedidos.map((pedido) => {
    const custoEnvioTotal = custosEnvioPorPedido.has(String(pedido.id)) ? custosEnvioPorPedido.get(String(pedido.id)) : 0;
    const info = infoComplementar.get(String(pedido.id));
    const receiverName = info?.receiverName ?? null;
    const buyerParaResolver = info?.buyerCompleto ?? pedido.buyer;
    return {
      mlOrderId: String(pedido.id),
      dataCriacao: pedido.date_created,
      comprador: resolverNomeComprador(buyerParaResolver, receiverName),
      compradorMlId: pedido.buyer?.id ?? null,
      shippingId: pedido.shipping?.id ? String(pedido.shipping.id) : null,
      itens: pedido.order_items.map((linha) => {
        const chave = `${pedido.id}::${linha.item.id}`;
        const match = mapaEstoque.get(linha.item.id);
        return {
          mlItemId: linha.item.id,
          titulo: linha.item.title,
          quantidade: linha.quantity,
          valorUnitario: linha.unit_price,
          status: jaImportados.has(chave) ? "ja_importado" : match ? "encontrado" : "nao_encontrado",
          estoqueIdSugerido: match?.id ?? null,
          estoqueNomeSugerido: match?.nome ?? null,
          taxaMl: linha.sale_fee ?? null,
          custoEnvio: custoEnvioTotal == null ? null : alocarCustoEnvio(pedido, custoEnvioTotal, linha.item.id),
          descontoVendedor: calcularDescontoVendedor(linha)
        };
      })
    };
  });
}
async function importarPedidoComoVenda(supabase2, params) {
  const { data: existente, error: erroDedup } = await supabase2.from("vendas").select("id").eq("ml_order_id", params.mlOrderId).eq("ml_item_id", params.mlItemId).maybeSingle();
  if (erroDedup) {
    if (ehErroDeMigrationAusente2(erroDedup)) throw new Error("Rode a migration_022 antes de importar pedidos do Mercado Livre.");
    throw erroDedup;
  }
  if (existente) return null;
  const valorRecebido = calcularValorRecebido(params.quantidade * params.valorUnitario, params.mlSaleFee, params.mlCustoEnvio, params.mlDescontoVendedor);
  if (valorRecebido == null) {
    throw new Error("O Mercado Livre ainda n\xE3o confirmou o valor l\xEDquido desta venda (taxa ou frete pendente). Atualize os pedidos e tente novamente.");
  }
  const { data: venda, error } = await supabase2.rpc("registrar_venda", {
    p_estoque_id: params.estoqueId,
    p_quantidade: params.quantidade,
    p_valor_unitario: params.valorUnitario,
    p_forma_pagamento_id: params.formaPagamentoId,
    p_modelo_moto_id: null,
    p_cliente_nome: params.clienteNome,
    p_observacoes: `Importado do Mercado Livre \u2014 pedido ${params.mlOrderId}`,
    p_data: params.data,
    p_cliente_id: params.clienteId || null,
    p_unidade_id: params.unidadeId || null,
    p_componente: null,
    p_nome_item: null,
    p_valor_recebido: valorRecebido
  });
  if (error) throw error;
  const { error: erroUpdate } = await supabase2.from("vendas").update({ canal: "mercado_livre", ml_order_id: params.mlOrderId, ml_item_id: params.mlItemId, ml_shipping_id: params.mlShippingId }).eq("id", venda.id);
  if (erroUpdate) throw Object.assign(new Error(erroUpdate.message ?? String(erroUpdate)), { naoRetentar: true, causa: erroUpdate });
  return venda;
}
async function importarPedidosEmLote(supabase2, itens) {
  const resultado = { sucesso: 0, pulados: 0, falhas: [] };
  for (const item of itens) {
    try {
      const venda = await importarPedidoComoVenda(supabase2, item);
      if (venda) resultado.sucesso++;
      else resultado.pulados++;
    } catch (err) {
      resultado.falhas.push({ mlOrderId: item.mlOrderId, mlItemId: item.mlItemId, error: err.message });
    }
  }
  return resultado;
}
async function corrigirTaxaVendasMlImportadas(supabase2, token) {
  const resultado = { sucesso: 0, pulados: 0, falhas: [] };
  const { data: vendasMl, error } = await supabase2.from("vendas").select("id, valor_total, ml_order_id, ml_item_id").eq("canal", "mercado_livre");
  if (error) throw error;
  if (!vendasMl || vendasMl.length === 0) return resultado;
  const { data: caixaRows, error: erroCaixa } = await supabase2.from("caixa").select("id, valor, venda_id").in("venda_id", vendasMl.map((v) => v.id));
  if (erroCaixa) throw erroCaixa;
  const caixaPorVenda = new Map((caixaRows ?? []).map((c) => [c.venda_id, c]));
  for (const venda of vendasMl) {
    const caixaEntry = caixaPorVenda.get(venda.id);
    if (!caixaEntry) {
      resultado.pulados++;
      continue;
    }
    try {
      const pedido = await buscarPedido(token, venda.ml_order_id);
      if (!pedido) {
        resultado.falhas.push({ mlOrderId: venda.ml_order_id, mlItemId: venda.ml_item_id, error: "Pedido n\xE3o encontrado ou inacess\xEDvel na API do Mercado Livre" });
        continue;
      }
      const linha = encontrarItemPedido(pedido, venda.ml_item_id);
      const custoEnvioTotal = pedido.shipping?.id ? await buscarCustoEnvioVendedor(token, String(pedido.shipping.id)) : 0;
      const custoEnvioAlocado = custoEnvioTotal == null ? null : alocarCustoEnvio(pedido, custoEnvioTotal, venda.ml_item_id);
      const valorPedido = linha ? Number(linha.unit_price) * Number(linha.quantity) : null;
      const valorRecebido = valorPedido != null && Number.isFinite(valorPedido) && valorPedido > 0 ? calcularValorRecebido(valorPedido, linha?.sale_fee, custoEnvioAlocado, calcularDescontoVendedor(linha)) : null;
      if (valorRecebido == null) {
        resultado.falhas.push({ mlOrderId: venda.ml_order_id, mlItemId: venda.ml_item_id, error: "A API do Mercado Livre n\xE3o devolveu a taxa ou o custo de envio deste item" });
        continue;
      }
      if (Math.abs(Number(caixaEntry.valor) - valorRecebido) < 5e-3) {
        resultado.pulados++;
        continue;
      }
      const { error: erroUpdate } = await supabase2.from("caixa").update({ valor: valorRecebido }).eq("id", caixaEntry.id);
      if (erroUpdate) throw erroUpdate;
      resultado.sucesso++;
    } catch (err) {
      resultado.falhas.push({ mlOrderId: venda.ml_order_id, mlItemId: venda.ml_item_id, error: err.message });
    }
  }
  return resultado;
}
async function buscarEnvioDoPedido(supabase2, token, mlOrderId) {
  const { data: venda, error } = await supabase2.from("vendas").select("ml_shipping_id").eq("ml_order_id", mlOrderId).limit(1).maybeSingle();
  if (error) {
    if (ehErroDeMigrationAusente2(error)) throw new Error("Rode a migration_022 antes de consultar envios do Mercado Livre.");
    throw error;
  }
  if (!venda?.ml_shipping_id) return null;
  return buscarEnvio(token, venda.ml_shipping_id);
}
function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}
function montarRascunhoResposta(item) {
  const condicaoTexto = item.condicao === "original" ? "original" : "paralela";
  const modeloTexto = item.modeloMotoNome ? ` pra ${item.modeloMotoNome}${item.ano ? ` (${item.ano})` : ""}` : "";
  const disponibilidade = item.quantidade > 0 ? `Temos ${item.quantidade} unidade(s) em estoque.` : "No momento est\xE1 em falta, mas pode chegar em breve.";
  return `Ol\xE1! Essa pe\xE7a \xE9 ${condicaoTexto}${modeloTexto}, no valor de ${formatarMoeda(item.valor)}. ${disponibilidade}`;
}
async function buscarPerguntasComRascunho(supabase2, token, mlUserId) {
  const [perguntas, mapaEstoque] = await Promise.all([buscarPerguntas(token, mlUserId, "UNANSWERED"), construirMapaEstoquePorMlb(supabase2)]);
  return perguntas.map((pergunta) => {
    const item = mapaEstoque.get(pergunta.item_id);
    return {
      id: pergunta.id,
      itemId: pergunta.item_id,
      texto: pergunta.text,
      dataCriacao: pergunta.date_created,
      rascunhoResposta: item ? montarRascunhoResposta(item) : null
    };
  });
}
async function buscarCandidatosSugestao(supabase2) {
  const { data } = await supabase2.from("estoque").select("id, nome").eq("ativo", true);
  return (data ?? []).map((item) => ({ id: item.id, nome: item.nome, tokens: tokenizar(item.nome) }));
}
function sugerirEstoquePorTitulo(titulo, candidatos) {
  const tokensAnuncio = tokenizar(titulo);
  if (tokensAnuncio.length === 0) return null;
  let melhor = null;
  for (const candidato of candidatos) {
    const score = similaridade(tokensAnuncio, candidato.tokens);
    if (score < CORTE_POSSIVEL) continue;
    if (!melhor || score > melhor.similaridade) melhor = { estoqueId: candidato.id, nome: candidato.nome, similaridade: score };
  }
  return melhor;
}
async function listarAnunciosOrfaos(supabase2, token, mlUserId) {
  const [idsAtivos, mapaEstoque] = await Promise.all([buscarItensAtivosVendedor(token, mlUserId), construirMapaEstoquePorMlb(supabase2)]);
  if (idsAtivos.length === 0) return [];
  const idsOrfaos = idsAtivos.filter((id) => !mapaEstoque.has(id));
  if (idsOrfaos.length === 0) return [];
  const [detalhes, candidatos] = await Promise.all([buscarItensPorIds(token, idsOrfaos), buscarCandidatosSugestao(supabase2)]);
  return detalhes.map((item) => ({
    mlbId: item.id,
    titulo: item.title,
    preco: item.price,
    permalink: item.permalink,
    thumbnail: item.thumbnail ?? null,
    quantidadeDisponivel: item.available_quantity,
    sugestao: sugerirEstoquePorTitulo(item.title, candidatos)
  }));
}
var LIMITE_ITENS_DUPLICATAS = 500;
async function listarAnunciosDuplicados(supabase2, token, mlUserId) {
  const [idsAtivos, mapaEstoque] = await Promise.all([buscarItensAtivosVendedor(token, mlUserId), construirMapaEstoquePorMlb(supabase2)]);
  if (idsAtivos.length === 0) return [];
  if (idsAtivos.length > LIMITE_ITENS_DUPLICATAS) {
    throw new Error(`Cat\xE1logo com ${idsAtivos.length} an\xFAncios ativos \u2014 a checagem de duplicatas s\xF3 roda at\xE9 ${LIMITE_ITENS_DUPLICATAS} de uma vez.`);
  }
  const detalhes = await buscarItensPorIds(token, idsAtivos);
  const tokensPorIndice = detalhes.map((item) => tokenizar(item.title));
  const pai = detalhes.map((_, i) => i);
  function encontrar(i) {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  }
  function unir(a, b) {
    const raizA = encontrar(a);
    const raizB = encontrar(b);
    if (raizA !== raizB) pai[raizB] = raizA;
  }
  const paresValidos = [];
  for (let i = 0; i < detalhes.length; i++) {
    for (let j = i + 1; j < detalhes.length; j++) {
      const score = similaridade(tokensPorIndice[i], tokensPorIndice[j]);
      if (score < CORTE_POSSIVEL) continue;
      unir(i, j);
      paresValidos.push({ i, score });
    }
  }
  const indicesPorRaiz = /* @__PURE__ */ new Map();
  for (let i = 0; i < detalhes.length; i++) {
    const raiz = encontrar(i);
    const grupo = indicesPorRaiz.get(raiz) ?? [];
    grupo.push(i);
    indicesPorRaiz.set(raiz, grupo);
  }
  const minimoPorRaiz = /* @__PURE__ */ new Map();
  for (const { i, score } of paresValidos) {
    const raiz = encontrar(i);
    const atual = minimoPorRaiz.get(raiz);
    if (atual === void 0 || score < atual) minimoPorRaiz.set(raiz, score);
  }
  const grupos = [];
  for (const [raiz, indices] of indicesPorRaiz) {
    if (indices.length < 2) continue;
    const itens = indices.map((idx) => {
      const item = detalhes[idx];
      return {
        mlbId: item.id,
        titulo: item.title,
        preco: item.price,
        permalink: item.permalink,
        thumbnail: item.thumbnail ?? null,
        quantidadeDisponivel: item.available_quantity,
        status: item.status,
        vinculado: mapaEstoque.has(item.id)
      };
    });
    grupos.push({ grupoId: detalhes[indices[0]].id, itens, similaridadeMinima: minimoPorRaiz.get(raiz) ?? CORTE_POSSIVEL });
  }
  return grupos.sort((a, b) => b.similaridadeMinima - a.similaridadeMinima);
}
async function pausarAnuncio(token, mlbId) {
  return atualizarItemML(token, mlbId, { status: "paused" });
}
async function contarPendencias(supabase2, token, mlUserId) {
  const [perguntas, pedidos] = await Promise.all([buscarPerguntas(token, mlUserId, "UNANSWERED"), buscarPreviewPedidos(supabase2, token, mlUserId, 30)]);
  const pedidosPendentes = pedidos.filter((p) => p.itens.some((i) => i.status !== "ja_importado"));
  return { perguntasSemResposta: perguntas.length, pedidosNovos: pedidosPendentes.length };
}
async function verificarNotificacoesPendentes(supabase2) {
  const conexao = await obterConexaoAtual(supabase2);
  if (!conexao) return;
  const doisDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3);
  const [pedidos, perguntas] = await Promise.all([
    buscarPedidosRecentes(conexao.accessToken, conexao.mlUserId, doisDiasAtras).catch((err) => {
      console.error("Erro ao verificar pedidos pendentes do Mercado Livre:", err.response?.data || err.message);
      return [];
    }),
    buscarPerguntas(conexao.accessToken, conexao.mlUserId, "UNANSWERED").catch((err) => {
      console.error("Erro ao verificar perguntas pendentes do Mercado Livre:", err.response?.data || err.message);
      return [];
    })
  ]);
  const linhas = [
    ...pedidos.map((p) => ({ topic: "orders_v2", resource: `/orders/${p.id}`, ml_user_id: conexao.mlUserId, origem: "polling" })),
    ...perguntas.map((q) => ({ topic: "questions", resource: `/questions/${q.id}`, ml_user_id: conexao.mlUserId, origem: "polling" }))
  ];
  if (linhas.length === 0) return;
  const { error } = await supabase2.from("mercadolivre_notificacoes").upsert(linhas, { onConflict: "topic,resource", ignoreDuplicates: true });
  if (error && !ehErroDeMigrationAusente2(error)) {
    console.error("Erro ao registrar notifica\xE7\xF5es pendentes do Mercado Livre:", error);
  }
}
var MAX_TENTATIVAS_PEDIDO = 5;
var PEDIDOS_POR_CICLO = 20;
var STATUS_TERMINAIS_PEDIDO = ["cancelled", "invalid"];
var DIAS_ESPERA_PAGAMENTO = 7;
async function obterFormaPagamentoMercadoLivre(supabase2) {
  const { data, error } = await supabase2.from("formas_pagamento").select("id").eq("nome", "MERCADO LIVRE").maybeSingle();
  if (error) {
    if (ehErroDeMigrationAusente2(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}
function extrairOrderId(resource) {
  return resource.match(/\/orders\/(\d+)/)?.[1] ?? null;
}
function ehErroDeEstoqueInsuficiente(mensagem) {
  return /estoque insuficiente/i.test(mensagem);
}
async function resolverUnidadesPorVariacao(supabase2, variationIds) {
  const mapa = /* @__PURE__ */ new Map();
  if (variationIds.length === 0) return mapa;
  const { data, error } = await supabase2.from("estoque_anuncios_ml_variacoes").select("ml_variation_id, unidade_id").in("ml_variation_id", variationIds);
  if (error) {
    if (ehErroDeMigrationAusente2(error)) return mapa;
    throw error;
  }
  for (const linha of data ?? []) {
    if (linha.unidade_id) mapa.set(String(linha.ml_variation_id), linha.unidade_id);
  }
  return mapa;
}
async function processarPedidosPendentes(supabase2) {
  const resultado = { importados: 0, itensImportados: [], semMatch: [], ignorados: 0, aguardandoPagamento: 0, falhas: 0, abandonados: [] };
  const conexao = await obterConexaoAtual(supabase2);
  if (!conexao) return resultado;
  const { data: pendentes, error: erroFila } = await supabase2.from("mercadolivre_notificacoes").select("id, topic, resource, tentativas, recebido_em").eq("topic", "orders_v2").is("processado_em", null).order("recebido_em", { ascending: true }).limit(PEDIDOS_POR_CICLO);
  if (erroFila) {
    if (ehErroDeMigrationAusente2(erroFila)) {
      console.warn("\u26A0\uFE0F Fila de pedidos do Mercado Livre indispon\xEDvel \u2014 rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importa\xE7\xE3o autom\xE1tica desligada at\xE9 l\xE1.");
      return resultado;
    }
    throw erroFila;
  }
  if (!pendentes || pendentes.length === 0) return resultado;
  const formaPagamentoId = await obterFormaPagamentoMercadoLivre(supabase2);
  if (!formaPagamentoId) {
    console.warn('\u26A0\uFE0F Forma de pagamento "MERCADO LIVRE" n\xE3o encontrada \u2014 rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importa\xE7\xE3o autom\xE1tica desligada at\xE9 l\xE1.');
    return resultado;
  }
  const mapaEstoque = await construirMapaEstoquePorMlb(supabase2);
  const estoqueIdsVendidos = /* @__PURE__ */ new Set();
  for (const linha of pendentes) {
    try {
      const orderId = extrairOrderId(linha.resource);
      if (!orderId) {
        resultado.ignorados++;
        await marcarProcessado(supabase2, linha.id, null);
        continue;
      }
      const pedido = await buscarPedido(conexao.accessToken, orderId);
      if (!pedido) {
        resultado.ignorados++;
        await marcarProcessado(supabase2, linha.id, null);
        continue;
      }
      if (pedido.status !== "paid") {
        if (STATUS_TERMINAIS_PEDIDO.includes(pedido.status)) {
          resultado.ignorados++;
          await marcarProcessado(supabase2, linha.id, null);
          continue;
        }
        const esperandoDesde = linha.recebido_em ? new Date(linha.recebido_em).getTime() : Date.now();
        if (Date.now() - esperandoDesde > DIAS_ESPERA_PAGAMENTO * 24 * 60 * 60 * 1e3) {
          resultado.ignorados++;
          await marcarProcessado(supabase2, linha.id, `Pedido nunca foi pago em ${DIAS_ESPERA_PAGAMENTO} dias (status "${pedido.status}") \u2014 descartado da fila.`);
          continue;
        }
        resultado.aguardandoPagamento++;
        continue;
      }
      const variationIds = (pedido.order_items ?? []).map((i) => i.item?.variation_id != null ? String(i.item.variation_id) : null).filter((id) => !!id);
      const unidadesPorVariacao = await resolverUnidadesPorVariacao(supabase2, variationIds);
      let receiverName = null;
      let custoEnvioTotal = 0;
      if (pedido.shipping?.id) {
        const shippingId = String(pedido.shipping.id);
        [custoEnvioTotal, receiverName] = await Promise.all([
          buscarCustoEnvioVendedor(conexao.accessToken, shippingId),
          Promise.resolve(buscarEnvio(conexao.accessToken, shippingId)).then((e) => e?.receiverName ?? null).catch(() => null)
        ]);
      }
      const vezesPorItemId = /* @__PURE__ */ new Map();
      for (const i of pedido.order_items ?? []) vezesPorItemId.set(i.item.id, (vezesPorItemId.get(i.item.id) ?? 0) + 1);
      const jaVistosNoPedido = /* @__PURE__ */ new Set();
      for (const itemPedido of pedido.order_items ?? []) {
        if (jaVistosNoPedido.has(itemPedido.item.id)) {
          resultado.semMatch.push({
            mlOrderId: orderId,
            titulo: itemPedido.item.title,
            motivo: `Pedido ${orderId} tem ${vezesPorItemId.get(itemPedido.item.id)} unidades do mesmo an\xFAncio ("${itemPedido.item.title}") \u2014 s\xF3 a primeira foi registrada, registre as outras na m\xE3o.`
          });
          continue;
        }
        jaVistosNoPedido.add(itemPedido.item.id);
        const peca = mapaEstoque.get(itemPedido.item.id);
        if (!peca) {
          resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          continue;
        }
        try {
          const venda = await importarPedidoComoVenda(supabase2, {
            estoqueId: peca.id,
            quantidade: itemPedido.quantity,
            valorUnitario: itemPedido.unit_price,
            formaPagamentoId,
            clienteNome: resolverNomeComprador(pedido.buyer, receiverName),
            data: pedido.date_created ?? null,
            mlOrderId: orderId,
            mlItemId: itemPedido.item.id,
            mlShippingId: pedido.shipping?.id ? String(pedido.shipping.id) : null,
            unidadeId: itemPedido.item.variation_id != null ? unidadesPorVariacao.get(String(itemPedido.item.variation_id)) ?? null : null,
            mlSaleFee: itemPedido.sale_fee ?? null,
            mlCustoEnvio: custoEnvioTotal == null ? null : alocarCustoEnvio(pedido, custoEnvioTotal, itemPedido.item.id),
            mlDescontoVendedor: calcularDescontoVendedor(itemPedido),
            clienteNomeAlternativo: receiverName
          });
          if (venda) {
            resultado.importados++;
            resultado.itensImportados.push({ estoqueNome: peca.nome, mlOrderId: orderId });
            estoqueIdsVendidos.add(peca.id);
          }
        } catch (err) {
          if (ehErroDeEstoqueInsuficiente(err.message ?? "")) {
            resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          } else {
            throw err;
          }
        }
      }
      await marcarProcessado(supabase2, linha.id, null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        console.error(`\u26A0\uFE0F Fila de pedidos do ML parada: token sem autoriza\xE7\xE3o (HTTP ${status}). Reconecte a conta do Mercado Livre.`);
        break;
      }
      resultado.falhas++;
      const tentativas = (linha.tentativas ?? 0) + 1;
      const mensagem = err?.response?.data?.message || err?.message || "erro desconhecido";
      if (err?.naoRetentar) {
        resultado.abandonados.push({ mlOrderId: extrairOrderId(linha.resource) ?? linha.resource, erro: mensagem });
        await marcarProcessado(supabase2, linha.id, mensagem, tentativas);
      } else if (tentativas >= MAX_TENTATIVAS_PEDIDO) {
        resultado.abandonados.push({ mlOrderId: extrairOrderId(linha.resource) ?? linha.resource, erro: mensagem });
        await marcarProcessado(supabase2, linha.id, mensagem, tentativas);
      } else {
        const { error: erroTentativas } = await supabase2.from("mercadolivre_notificacoes").update({ tentativas, erro: mensagem }).eq("id", linha.id);
        if (erroTentativas && !ehErroDeMigrationAusente2(erroTentativas)) {
          console.error("Erro ao gravar tentativas da notifica\xE7\xE3o do ML (linha pode reprocessar sem fim):", erroTentativas);
        }
      }
    }
  }
  await avisarResultadoDaFila(supabase2, resultado);
  await avisarAnunciosDesatualizados(supabase2, Array.from(estoqueIdsVendidos));
  return resultado;
}
async function avisarResultadoDaFila(supabase2, resultado) {
  if (resultado.importados === 0 && resultado.semMatch.length === 0 && resultado.abandonados.length === 0) return;
  try {
    const destinatarios = await buscarDestinatariosEquipe(supabase2);
    if (destinatarios.length === 0) return;
    if (resultado.importados > 0) {
      const nomes = Array.from(new Set(resultado.itensImportados.map((i) => i.estoqueNome)));
      const corpo = resultado.importados === 1 ? `${nomes[0]} \u2014 baixa dada no estoque.` : `${resultado.importados} pe\xE7as vendidas (${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? "..." : ""}) \u2014 baixa dada no estoque.`;
      await notificarUsuarios(supabase2, destinatarios, { titulo: "Venda no Mercado Livre", corpo, url: "/mercadolivre" });
    }
    if (resultado.semMatch.length > 0) {
      const corpo = resultado.semMatch.length === 1 ? resultado.semMatch[0].motivo ?? `"${resultado.semMatch[0].titulo}" (pedido ${resultado.semMatch[0].mlOrderId}) n\xE3o casou com nenhuma pe\xE7a do estoque \u2014 registre a venda na m\xE3o.` : `${resultado.semMatch.length} itens vendidos precisam ser registrados na m\xE3o \u2014 confira a lista na aba do Mercado Livre.`;
      await notificarUsuarios(supabase2, destinatarios, { titulo: "Pedido do ML precisa de voc\xEA", corpo, url: "/mercadolivre" });
    }
    if (resultado.abandonados.length > 0) {
      const corpo = resultado.abandonados.length === 1 ? `Pedido ${resultado.abandonados[0].mlOrderId} n\xE3o p\xF4de ser importado (${resultado.abandonados[0].erro}) \u2014 abra o Mercado Livre e registre a venda na m\xE3o.` : `${resultado.abandonados.length} pedidos do Mercado Livre n\xE3o puderam ser importados (${resultado.abandonados.map((a) => a.mlOrderId).slice(0, 3).join(", ")}) \u2014 registre as vendas na m\xE3o.`;
      await notificarUsuarios(supabase2, destinatarios, { titulo: "Pedido do ML n\xE3o foi importado", corpo, url: "/mercadolivre" });
    }
  } catch (err) {
    console.error("Erro ao notificar resultado da fila de pedidos do ML:", err?.message || err);
  }
}
async function avisarAnunciosDesatualizados(supabase2, estoqueIds) {
  if (estoqueIds.length === 0) return;
  try {
    const { data: links, error } = await supabase2.from("estoque_anuncios_ml").select("estoque_id").in("estoque_id", estoqueIds);
    let afetadas;
    if (error) {
      if (!ehErroDeMigrationAusente2(error)) throw error;
      const { data: itens, error: erroLegado } = await supabase2.from("estoque").select("id, anuncio_ml_url").in("id", estoqueIds).not("anuncio_ml_url", "is", null);
      if (erroLegado) throw erroLegado;
      afetadas = new Set((itens ?? []).filter((i) => !!extrairMlbId(i.anuncio_ml_url)).map((i) => i.id));
    } else {
      afetadas = new Set((links ?? []).map((l) => l.estoque_id));
    }
    if (afetadas.size === 0) return;
    const destinatarios = await buscarDestinatariosEquipe(supabase2);
    if (destinatarios.length === 0) return;
    const corpo = afetadas.size === 1 ? "1 an\xFAncio no Mercado Livre est\xE1 com quantidade desatualizada. Revise e aplique." : `${afetadas.size} an\xFAncios no Mercado Livre est\xE3o com quantidade desatualizada. Revise e aplique.`;
    await notificarUsuarios(supabase2, destinatarios, { titulo: "An\xFAncio precisa de ajuste", corpo, url: "/mercadolivre" });
  } catch (err) {
    console.error("Erro ao avisar sobre an\xFAncios desatualizados:", err?.message || err);
  }
}
async function marcarProcessado(supabase2, id, erro, tentativas) {
  const payload = { processado_em: (/* @__PURE__ */ new Date()).toISOString(), erro };
  if (tentativas !== void 0) payload.tentativas = tentativas;
  const { error } = await supabase2.from("mercadolivre_notificacoes").update(payload).eq("id", id);
  if (error && !ehErroDeMigrationAusente2(error)) console.error("Erro ao marcar notifica\xE7\xE3o do ML como processada:", error);
}

// src/services/shopeeApi.ts
import axios2 from "axios";
import crypto from "crypto";
var SHOPEE_API_URL = process.env.SHOPEE_API_URL || "https://partner.shopeemobile.com";
var TABELA_CONEXAO2 = "shopee_conexao";
function assinarRequisicaoShopee(path2, timestamp, accessToken, shopId) {
  const partnerId = requireEnv("SHOPEE_PARTNER_ID");
  const partnerKey = requireEnv("SHOPEE_PARTNER_KEY");
  const base = accessToken && shopId ? `${partnerId}${path2}${timestamp}${accessToken}${shopId}` : `${partnerId}${path2}${timestamp}`;
  return crypto.createHmac("sha256", partnerKey).update(base).digest("hex");
}
async function chamarApiShopee(method, path2, opts = {}) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const sign = assinarRequisicaoShopee(path2, timestamp, opts.accessToken, opts.shopId);
  const params = {
    partner_id: requireEnv("SHOPEE_PARTNER_ID"),
    timestamp,
    sign,
    ...opts.params
  };
  if (opts.accessToken) params.access_token = opts.accessToken;
  if (opts.shopId) params.shop_id = opts.shopId;
  const { data } = await axios2.request({ method, url: `${SHOPEE_API_URL}${path2}`, params, data: opts.data });
  return data;
}
function gerarUrlAutorizacaoShopee(state) {
  const path2 = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1e3);
  const sign = assinarRequisicaoShopee(path2, timestamp);
  const url = new URL(`${SHOPEE_API_URL}${path2}`);
  url.searchParams.set("partner_id", requireEnv("SHOPEE_PARTNER_ID"));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  url.searchParams.set("redirect", requireEnv("SHOPEE_REDIRECT_URI"));
  url.searchParams.set("state", state);
  return url.toString();
}
async function persistirConexao(supabase2, shopId, data) {
  if (data?.error) throw new Error(data.message ?? `Erro de autentica\xE7\xE3o na Shopee: ${data.error}`);
  const expiraEm = new Date(Date.now() + data.expire_in * 1e3).toISOString();
  const { error } = await supabase2.from(TABELA_CONEXAO2).upsert(
    {
      shop_id: shopId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expira_em: expiraEm,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "shop_id" }
  );
  if (error) throw error;
  return { shopId, accessToken: data.access_token };
}
async function trocarCodigoPorTokenShopee(supabase2, code, shopId) {
  const data = await chamarApiShopee("post", "/api/v2/auth/token/get", {
    data: { code, shop_id: Number(shopId), partner_id: Number(requireEnv("SHOPEE_PARTNER_ID")) }
  });
  return persistirConexao(supabase2, shopId, data);
}
async function renovarTokenShopee(supabase2, refreshToken, shopId) {
  const data = await chamarApiShopee("post", "/api/v2/auth/access_token/get", {
    data: { refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(requireEnv("SHOPEE_PARTNER_ID")) }
  });
  return persistirConexao(supabase2, shopId, data);
}
async function obterConexaoAtualShopee(supabase2) {
  const { data: conexao } = await supabase2.from(TABELA_CONEXAO2).select("*").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  if (!conexao) return null;
  const faltamMs = new Date(conexao.expira_em).getTime() - Date.now();
  if (faltamMs > 10 * 60 * 1e3) return { shopId: conexao.shop_id, accessToken: conexao.access_token };
  return renovarTokenShopee(supabase2, conexao.refresh_token, conexao.shop_id);
}
var MARGEM_PADRAO_SHOPEE = 30;
async function obterMargemSincronizacaoShopee(supabase2) {
  const { data, error } = await supabase2.from(TABELA_CONEXAO2).select("margem_sincronizacao_percentual").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205" || error.code === "42P01") return MARGEM_PADRAO_SHOPEE;
    throw error;
  }
  return data?.margem_sincronizacao_percentual != null ? Number(data.margem_sincronizacao_percentual) : MARGEM_PADRAO_SHOPEE;
}
async function atualizarMargemSincronizacaoShopee(supabase2, margemPercentual) {
  const { error, count } = await supabase2.from(TABELA_CONEXAO2).update({ margem_sincronizacao_percentual: margemPercentual }, { count: "exact" }).not("shop_id", "is", null);
  if (error) throw error;
  if (!count) throw new Error("Conecte a loja da Shopee antes de configurar a margem.");
}
async function buscarArvoreCategoriasShopee(accessToken, shopId) {
  const data = await chamarApiShopee("get", "/api/v2/product/get_category", { accessToken, shopId, params: { language: "pt-br" } });
  return (data?.response?.category_list ?? []).map((c) => ({
    categoryId: c.category_id,
    categoryName: c.category_name,
    hasChildren: c.has_children,
    parentCategoryId: c.parent_category_id
  }));
}
async function buscarCategoriasRaizShopee(accessToken, shopId) {
  const todas = await buscarArvoreCategoriasShopee(accessToken, shopId);
  return todas.filter((c) => c.parentCategoryId === 0);
}
async function buscarCategoriaShopee(accessToken, shopId, categoriaId) {
  const todas = await buscarArvoreCategoriasShopee(accessToken, shopId);
  return { categoria: todas.find((c) => c.categoryId === categoriaId) ?? null, filhos: todas.filter((c) => c.parentCategoryId === categoriaId) };
}
async function buscarAtributosCategoriaShopee(accessToken, shopId, categoriaId) {
  const params = { category_id: categoriaId, language: "pt-br" };
  let data = await chamarApiShopee("get", "/api/v2/product/category/attribute/get", { accessToken, shopId, params });
  if (data?.error) {
    data = await chamarApiShopee("get", "/api/v2/product/get_attribute_tree", { accessToken, shopId, params });
  }
  if (data?.error) throw new Error(data.message ?? `Erro ao buscar atributos da categoria ${categoriaId} na Shopee: ${data.error}`);
  return (data?.response?.attribute_list ?? []).map((a) => ({
    attributeId: a.attribute_id,
    name: a.original_attribute_name ?? a.display_attribute_name,
    isMandatory: !!a.is_mandatory,
    inputType: a.input_validation_type ?? "TEXT_FIELD",
    values: a.attribute_value_list?.map((v) => ({ valueId: v.value_id, originalValueName: v.original_value_name }))
  }));
}
async function buscarCanaisLogisticaShopee(accessToken, shopId) {
  const data = await chamarApiShopee("get", "/api/v2/logistics/get_channel_list", { accessToken, shopId });
  return (data?.response?.logistics_channel_list ?? []).map((c) => ({
    logisticsChannelId: c.logistics_channel_id,
    logisticsChannelName: c.logistics_channel_name,
    enabled: !!c.enabled
  }));
}
async function uploadImagemShopee(accessToken, shopId, buffer, nomeArquivo) {
  const path2 = "/api/v2/media_space/upload_image";
  const timestamp = Math.floor(Date.now() / 1e3);
  const sign = assinarRequisicaoShopee(path2, timestamp, accessToken, shopId);
  const form = new FormData();
  form.append("image", new Blob([buffer]), nomeArquivo);
  const { data } = await axios2.post(`${SHOPEE_API_URL}${path2}`, form, {
    params: { partner_id: requireEnv("SHOPEE_PARTNER_ID"), timestamp, sign, access_token: accessToken, shop_id: shopId }
  });
  if (data?.error) throw new Error(data.message ?? `Erro ao enviar imagem pra Shopee: ${data.error}`);
  const imageId = data?.response?.image_info?.image_id;
  if (!imageId) throw new Error("Shopee n\xE3o devolveu image_id no upload.");
  return imageId;
}
async function criarItemShopee(accessToken, shopId, payload) {
  const data = await chamarApiShopee("post", "/api/v2/product/add_item", { accessToken, shopId, data: payload });
  if (data?.error) throw new Error(data.message ?? `Erro ao criar item na Shopee: ${data.error}`);
  return data.response;
}
async function inicializarVariacoesShopee(accessToken, shopId, itemId, tierVariation, modelList) {
  const data = await chamarApiShopee("post", "/api/v2/product/init_tier_variation", {
    accessToken,
    shopId,
    data: { item_id: Number(itemId), tier_variation: tierVariation, model: modelList }
  });
  if (data?.error) throw new Error(data.message ?? `Erro ao inicializar varia\xE7\xF5es na Shopee: ${data.error}`);
  return data.response;
}
async function atualizarPrecoItemShopee(accessToken, shopId, itemId, priceList) {
  const data = await chamarApiShopee("post", "/api/v2/product/update_price", { accessToken, shopId, data: { item_id: Number(itemId), price_list: priceList } });
  if (data?.error) throw new Error(data.message ?? `Erro ao atualizar pre\xE7o na Shopee: ${data.error}`);
}
async function atualizarEstoqueItemShopee(accessToken, shopId, itemId, stockList) {
  const data = await chamarApiShopee("post", "/api/v2/product/update_stock", { accessToken, shopId, data: { item_id: Number(itemId), stock_list: stockList } });
  if (data?.error) throw new Error(data.message ?? `Erro ao atualizar estoque na Shopee: ${data.error}`);
}
async function buscarEstatisticasItemShopee(accessToken, shopId, itemIds) {
  if (itemIds.length === 0) return {};
  const data = await chamarApiShopee("get", "/api/v2/product/get_item_base_info", {
    accessToken,
    shopId,
    params: { item_id_list: itemIds.join(",") }
  });
  if (data?.error) throw new Error(data.message ?? `Erro ao buscar estat\xEDsticas de itens na Shopee: ${data.error}`);
  const resultado = {};
  for (const item of data?.response?.item_list ?? []) {
    resultado[String(item.item_id)] = {
      visitasTotal: item.item_status_stat?.view_count ?? null,
      vendasTotais: item.sales ?? null,
      statusShopee: item.item_status ?? null
    };
  }
  return resultado;
}

// src/services/shopeePublicacao.ts
import axios3 from "axios";
var CODIGOS_MIGRATION_AUSENTE3 = ["42703", "42P01", "PGRST205", "PGRST204"];
function ehErroDeMigrationAusente3(error) {
  return !!error && CODIGOS_MIGRATION_AUSENTE3.includes(error.code);
}
function arredondarCentavos3(valor) {
  return Math.round(valor * 100) / 100;
}
function calcularPrecoComMargem2(precoEfetivo, margemPercentual) {
  return arredondarCentavos3(precoEfetivo * (1 + margemPercentual / 100));
}
var CACHE_TTL_MS2 = 7 * 24 * 60 * 60 * 1e3;
async function buscarAtributosCategoriaComCache2(supabase2, accessToken, shopId, categoriaId) {
  const chave = String(categoriaId);
  const { data: cache, error } = await supabase2.from("shopee_categorias_cache").select("*").eq("categoria_shopee_id", chave).maybeSingle();
  if (error && !ehErroDeMigrationAusente3(error)) throw error;
  const vencido = !!cache && Date.now() - new Date(cache.atualizado_em).getTime() > CACHE_TTL_MS2;
  if (cache && !vencido) return cache.atributos;
  const [atributos, detalheCategoria] = await Promise.all([buscarAtributosCategoriaShopee(accessToken, shopId, categoriaId), buscarCategoriaShopee(accessToken, shopId, categoriaId)]);
  const { error: erroCache } = await supabase2.from("shopee_categorias_cache").upsert(
    {
      categoria_shopee_id: chave,
      nome_shopee: detalheCategoria.categoria?.categoryName ?? chave,
      caminho: detalheCategoria.categoria?.categoryName ?? null,
      atributos,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "categoria_shopee_id" }
  );
  if (erroCache && !ehErroDeMigrationAusente3(erroCache)) console.error("Erro ao gravar cache de categoria da Shopee:", erroCache);
  return atributos;
}
async function buscarCanalLogisticaPadrao(accessToken, shopId) {
  const canais = (await buscarCanaisLogisticaShopee(accessToken, shopId)).filter((c) => c.enabled);
  return { canais, sugerido: canais.length === 1 ? canais[0] : null };
}
function montarPayloadPublicacaoShopee(item, unidades, config, imageIds, margemPercentual) {
  const precoEfetivoPeca = config.precoEfetivoSistema ?? item.valor;
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));
  const payloadItem = {
    item_name: (config.tituloAnuncio || item.nome).slice(0, 120),
    description: (config.descricaoAnuncio || item.descricao || item.nome).slice(0, 3e3),
    category_id: config.categoriaShopeeId,
    weight: config.pesoKg,
    // NÃO CONFIRMADO NO SANDBOX (ver comentário de inicializarVariacoesShopee
    // em shopeeApi.ts pro mesmo tipo de ressalva): logistics_info é o formato
    // mais citado pra API v2 da Shopee, mas não foi testado contra a API
    // real por este agente.
    logistics_info: [{ logistic_id: config.logisticsChannelId, enabled: true }],
    image: { image_id_list: imageIds },
    attribute_list: config.atributos
  };
  const variacoesValidas = (config.variacoes ?? []).filter((v) => unidadesPorId.has(v.unidadeId));
  if (variacoesValidas.length < 2) {
    return {
      usaVariacoes: false,
      ordemUnidades: [],
      payloadItem: { ...payloadItem, original_price: calcularPrecoComMargem2(precoEfetivoPeca, margemPercentual), normal_stock: item.quantidade }
    };
  }
  const opcoes = variacoesValidas.map((v, indice) => unidadesPorId.get(v.unidadeId).nome?.trim() || `Unidade ${indice + 1}`);
  return {
    usaVariacoes: true,
    ordemUnidades: variacoesValidas.map((v) => v.unidadeId),
    payloadItem,
    tierVariation: [{ name: "Unidade", option_list: opcoes.map((option) => ({ option })) }],
    modelList: variacoesValidas.map((v, indice) => {
      const unidade = unidadesPorId.get(v.unidadeId);
      const precoEfetivoVariacao = v.precoEfetivoSistema ?? unidade.valor ?? precoEfetivoPeca;
      return { tier_index: [indice], normal_stock: 1, original_price: calcularPrecoComMargem2(precoEfetivoVariacao, margemPercentual) };
    })
  };
}
async function uploadFotosParaShopee(accessToken, shopId, urls) {
  const imageIds = [];
  const falhas = [];
  for (const url of urls) {
    try {
      const { data } = await axios3.get(url, { responseType: "arraybuffer" });
      const nomeArquivo = url.split("/").pop()?.split("?")[0] || "foto.jpg";
      const imageId = await uploadImagemShopee(accessToken, shopId, Buffer.from(data), nomeArquivo);
      imageIds.push(imageId);
    } catch (err) {
      console.error(`Falha ao enviar foto pra Shopee (${url}):`, err.response?.data || err.message);
      falhas.push(url);
    }
  }
  return { imageIds, falhas };
}
async function publicarAnuncioShopee(supabase2, accessToken, shopId, estoqueId, config) {
  if (!config.logisticsChannelId) throw new Error("Escolha um canal de log\xEDstica antes de publicar na Shopee.");
  const { data: item, error: erroItem } = await supabase2.from("estoque").select("id, nome, valor, quantidade, descricao, imagens").eq("id", estoqueId).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error("Pe\xE7a n\xE3o encontrada.");
  const unidadeIds = (config.variacoes ?? []).map((v) => v.unidadeId);
  let unidades = [];
  let fotosDasUnidades = [];
  if (unidadeIds.length > 0) {
    const { data, error } = await supabase2.from("estoque_unidades").select("id, nome, valor, fotos").in("id", unidadeIds);
    if (error) throw error;
    unidades = (data ?? []).map((u) => ({ id: u.id, nome: u.nome ?? null, valor: u.valor != null ? Number(u.valor) : null }));
    fotosDasUnidades = (data ?? []).flatMap((u) => u.fotos ?? []);
  }
  const margemPercentual = await obterMargemSincronizacaoShopee(supabase2);
  const urlsFotos = Array.from(/* @__PURE__ */ new Set([...item.imagens ?? [], ...fotosDasUnidades]));
  const { imageIds, falhas: fotosFalhas } = await uploadFotosParaShopee(accessToken, shopId, urlsFotos);
  if (urlsFotos.length > 0 && imageIds.length === 0) {
    throw new Error("Nenhuma foto p\xF4de ser enviada pra Shopee \u2014 publica\xE7\xE3o cancelada (a Shopee exige ao menos 1 imagem no an\xFAncio).");
  }
  const montado = montarPayloadPublicacaoShopee(item, unidades, config, imageIds, margemPercentual);
  const criado = await criarItemShopee(accessToken, shopId, montado.payloadItem);
  const itemId = String(criado.item_id);
  let respostaVariacoes = null;
  if (montado.usaVariacoes) {
    respostaVariacoes = await inicializarVariacoesShopee(accessToken, shopId, itemId, montado.tierVariation, montado.modelList);
  }
  const { data: link, error: erroLink } = await supabase2.from("estoque_anuncios_shopee").insert({
    estoque_id: estoqueId,
    shop_id: shopId,
    item_id: itemId,
    category_id: String(config.categoriaShopeeId),
    status_shopee: criado.item_status ?? null,
    atributos_shopee: config.atributos,
    publicado_em: (/* @__PURE__ */ new Date()).toISOString()
  }).select("id").single();
  if (erroLink) throw erroLink;
  if (montado.usaVariacoes) {
    const modelsResposta = respostaVariacoes?.model ?? respostaVariacoes?.model_list ?? [];
    const linhas = montado.ordemUnidades.map((unidadeId, indice) => {
      const model = modelsResposta[indice];
      return {
        link_id: link.id,
        unidade_id: unidadeId,
        model_id: model?.model_id != null ? String(model.model_id) : "",
        preco: montado.modelList[indice].original_price,
        quantidade: montado.modelList[indice].normal_stock
      };
    }).filter((linha) => linha.model_id);
    if (linhas.length > 0) {
      const { error: erroVariacoes } = await supabase2.from("estoque_anuncios_shopee_variacoes").insert(linhas);
      if (erroVariacoes && !ehErroDeMigrationAusente3(erroVariacoes)) throw erroVariacoes;
    }
  }
  sincronizarEstatisticasShopee(supabase2, accessToken, shopId, [link.id]).catch((err) => {
    console.error(`Erro ao buscar estat\xEDsticas iniciais do an\xFAncio Shopee ${itemId}:`, err.response?.data || err.message);
  });
  return {
    linkId: link.id,
    itemId,
    usaVariacoes: montado.usaVariacoes,
    avisoFotos: fotosFalhas.length > 0 ? `${fotosFalhas.length} foto(s) n\xE3o puderam ser enviadas pra Shopee e ficaram de fora do an\xFAncio.` : null
  };
}
async function republicarAnuncioShopee(supabase2, accessToken, shopId, linkId) {
  const { data: link, error: erroLink } = await supabase2.from("estoque_anuncios_shopee").select("id, item_id, estoque_id").eq("id", linkId).maybeSingle();
  if (erroLink) throw erroLink;
  if (!link) throw new Error("An\xFAncio n\xE3o encontrado.");
  const { data: item, error: erroItem } = await supabase2.from("estoque").select("valor, quantidade").eq("id", link.estoque_id).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error("Pe\xE7a n\xE3o encontrada.");
  const margemPercentual = await obterMargemSincronizacaoShopee(supabase2);
  const { data: variacoes, error: erroVariacoes } = await supabase2.from("estoque_anuncios_shopee_variacoes").select("model_id, unidade_id").eq("link_id", linkId);
  if (erroVariacoes && !ehErroDeMigrationAusente3(erroVariacoes)) throw erroVariacoes;
  if (!variacoes || variacoes.length === 0) {
    const preco = calcularPrecoComMargem2(Number(item.valor), margemPercentual);
    await atualizarPrecoItemShopee(accessToken, shopId, link.item_id, [{ original_price: preco }]);
    await atualizarEstoqueItemShopee(accessToken, shopId, link.item_id, [{ seller_stock: [{ stock: item.quantidade }] }]);
    return { linkId: link.id, itemId: link.item_id };
  }
  const unidadeIds = variacoes.map((v) => v.unidade_id).filter(Boolean);
  const { data: unidades, error: erroUnidades } = await supabase2.from("estoque_unidades").select("id, valor").in("id", unidadeIds);
  if (erroUnidades) throw erroUnidades;
  const valorPorUnidade = new Map((unidades ?? []).map((u) => [u.id, u.valor != null ? Number(u.valor) : null]));
  const priceList = variacoes.filter((v) => v.model_id).map((v) => ({
    model_id: Number(v.model_id),
    original_price: calcularPrecoComMargem2(valorPorUnidade.get(v.unidade_id) ?? Number(item.valor), margemPercentual)
  }));
  await atualizarPrecoItemShopee(accessToken, shopId, link.item_id, priceList);
  await atualizarEstoqueItemShopee(
    accessToken,
    shopId,
    link.item_id,
    priceList.map((p) => ({ model_id: p.model_id, seller_stock: [{ stock: 1 }] }))
  );
  return { linkId: link.id, itemId: link.item_id };
}
async function sincronizarEstatisticasShopee(supabase2, accessToken, shopId, linkIds) {
  if (linkIds.length === 0) return;
  const { data: links, error } = await supabase2.from("estoque_anuncios_shopee").select("id, item_id").in("id", linkIds);
  if (error) {
    if (ehErroDeMigrationAusente3(error)) return;
    throw error;
  }
  if (!links || links.length === 0) return;
  const itemIds = links.map((l) => l.item_id);
  const estatisticas = await buscarEstatisticasItemShopee(accessToken, shopId, itemIds);
  const linhas = links.map((link) => {
    const stat = estatisticas[link.item_id];
    return {
      link_id: link.id,
      visitas_total: stat?.visitasTotal ?? null,
      vendas_totais: stat?.vendasTotais ?? null,
      status_shopee: stat?.statusShopee ?? null,
      atualizado_em: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  const { error: erroUpsert } = await supabase2.from("estoque_anuncios_shopee_estatisticas").upsert(linhas, { onConflict: "link_id" });
  if (erroUpsert && !ehErroDeMigrationAusente3(erroUpsert)) throw erroUpsert;
}

// src/server/fotosUnidade.ts
function fotosEfetivasDaUnidade(unidade, _imagensLegadas) {
  const proprias = Array.isArray(unidade?.fotos) ? unidade.fotos.map(String).filter(Boolean) : [];
  return proprias;
}

// src/server/routes/estoqueOrganizacao.ts
import { Router as Router4 } from "express";
import { EventEmitter } from "node:events";
import multer from "multer";
var VER = exigirPermissao("estoque.ver");
var EDITAR = exigirPermissao("estoque.editar");
var CRIAR = exigirPermissao("estoque.criar");
var CRIAR_OU_EDITAR = exigirAlguma("estoque.criar", "estoque.editar");
var JANELA_FICHA_NOVA_MS = 15 * 60 * 1e3;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validarLocalInput(value) {
  const campos = [
    ["codigo", "c\xF3digo"],
    ["deposito", "dep\xF3sito"],
    ["zona", "zona"],
    ["prateleira", "prateleira"],
    ["secao", "se\xE7\xE3o"]
  ];
  for (const [campo, rotulo] of campos) {
    if (typeof value[campo] !== "string" || !value[campo].trim()) return `Informe ${rotulo} do local.`;
    if (value[campo].trim().length > 32) return `${rotulo} deve ter at\xE9 32 caracteres.`;
  }
  if (value.descricao != null && (typeof value.descricao !== "string" || value.descricao.length > 240)) {
    return "Descri\xE7\xE3o deve ter at\xE9 240 caracteres.";
  }
  return null;
}
var RESERVA_MAX_DIAS = 30;
var DIA_MS = 864e5;
var FOLGA_RELOGIO_MS = 6e4;
function vencimentoReserva(dias, agora = Date.now()) {
  return new Date(agora + dias * DIA_MS - (dias === RESERVA_MAX_DIAS ? FOLGA_RELOGIO_MS : 0)).toISOString();
}
function validarReservaInput(body, agora = Date.now()) {
  const valor = body ?? {};
  const clienteBruto = valor.cliente_id;
  if (clienteBruto != null && (typeof clienteBruto !== "string" || !UUID.test(clienteBruto))) {
    return { erro: "Cliente inv\xE1lido." };
  }
  const clienteId = typeof clienteBruto === "string" ? clienteBruto : null;
  const responsavelBruto = valor.responsavel;
  if (responsavelBruto != null && typeof responsavelBruto !== "string") return { erro: "Nome do respons\xE1vel inv\xE1lido." };
  const responsavel = typeof responsavelBruto === "string" && responsavelBruto.trim() ? responsavelBruto.trim() : null;
  if (!clienteId && (!responsavel || responsavel.length < 2)) {
    return { erro: "Escolha um cliente cadastrado ou informe o nome de quem reservou." };
  }
  if (responsavel && (responsavel.length < 2 || responsavel.length > 120)) {
    return { erro: "O nome de quem reservou deve ter de 2 a 120 caracteres." };
  }
  const dias = valor.dias;
  if (typeof dias !== "number" || !Number.isInteger(dias) || dias < 1 || dias > RESERVA_MAX_DIAS) {
    return { erro: `O prazo da reserva deve ser de 1 a ${RESERVA_MAX_DIAS} dias.` };
  }
  const valorSinal = valor.valor_sinal;
  if (typeof valorSinal !== "number" || !Number.isFinite(valorSinal) || valorSinal <= 0) {
    return { erro: "Informe o valor do sinal pago (m\xEDnimo de 20% do pre\xE7o)." };
  }
  const forma = valor.forma_pagamento_id;
  if (typeof forma !== "string" || !UUID.test(forma)) return { erro: "Informe a forma de pagamento do sinal." };
  return { dados: { responsavel, clienteId, reservadaAte: vencimentoReserva(dias, agora), valorSinal: Math.round(valorSinal * 100) / 100, formaPagamentoId: forma } };
}
function validarAtualizacaoLocal(body) {
  const valor = body ?? {};
  const dados = {};
  if (valor.codigo !== void 0) {
    if (typeof valor.codigo !== "string" || valor.codigo.trim().length < 2 || valor.codigo.trim().length > 32) return { erro: "O c\xF3digo deve ter de 2 a 32 caracteres." };
    dados.codigo = valor.codigo.trim().toUpperCase();
  }
  if (valor.descricao !== void 0) {
    if (valor.descricao !== null && (typeof valor.descricao !== "string" || valor.descricao.length > 240)) return { erro: "Descri\xE7\xE3o deve ter at\xE9 240 caracteres." };
    dados.descricao = typeof valor.descricao === "string" ? valor.descricao.trim() || null : null;
  }
  if (valor.ativo !== void 0) {
    if (typeof valor.ativo !== "boolean") return { erro: "Estado do local inv\xE1lido." };
    dados.ativo = valor.ativo;
  }
  if (!Object.keys(dados).length) return { erro: "Nenhuma altera\xE7\xE3o informada." };
  return { dados };
}
var MAX_FOTOS_UNIDADE = 10;
function validarUnidadePayload(body, modo) {
  const valor = body ?? {};
  const dados = {};
  if (valor.valor !== void 0 || modo === "criar") {
    const preco = valor.valor;
    if (preco == null || preco === "") dados.valor = null;
    else if (typeof preco !== "number" || !Number.isFinite(preco) || preco <= 0) return { erro: "Informe um pre\xE7o de venda maior que zero." };
    else dados.valor = Math.round(preco * 100) / 100;
  }
  if (valor.condicao_nota !== void 0) {
    const nota = valor.condicao_nota;
    if (nota === null) dados.condicao_nota = null;
    else if (typeof nota !== "number" || !Number.isInteger(nota) || nota < 1 || nota > 10) return { erro: "Nota da condi\xE7\xE3o deve ficar entre 1 e 10." };
    else dados.condicao_nota = nota;
  }
  if (valor.fotos !== void 0) {
    const fotos = valor.fotos;
    if (!Array.isArray(fotos) || fotos.length > MAX_FOTOS_UNIDADE || fotos.some((url) => typeof url !== "string" || !/^https?:\/\//.test(url))) {
      return { erro: `Envie at\xE9 ${MAX_FOTOS_UNIDADE} fotos por unidade.` };
    }
    dados.fotos = fotos;
  }
  if (valor.endereco_id !== void 0) {
    const endereco = valor.endereco_id;
    if (endereco !== null && (typeof endereco !== "string" || !UUID.test(endereco))) return { erro: "Escolha um local cadastrado." };
    dados.endereco_id = endereco;
  }
  if (valor.origem_identificacao !== void 0) {
    const origem = valor.origem_identificacao;
    if (origem !== null && (typeof origem !== "string" || origem.length > 240)) return { erro: "Origem deve ter at\xE9 240 caracteres." };
    dados.origem_identificacao = typeof origem === "string" ? origem.trim() || null : null;
  }
  if (!Object.keys(dados).length) return { erro: "Nenhuma altera\xE7\xE3o informada." };
  return { dados };
}
function brl(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function grauDaNota(nota) {
  if (typeof nota !== "number") return "sem nota";
  return nota >= 8 ? "A" : nota >= 5 ? "B" : "C";
}
function descreverEdicao(detalhe) {
  const partes = [];
  const mudanca = (campo) => detalhe[campo] ?? null;
  const valor = mudanca("valor");
  if (valor) partes.push(`Pre\xE7o ${valor.de == null ? "herdado" : brl(Number(valor.de))} \u2192 ${valor.para == null ? "herdado" : brl(Number(valor.para))}`);
  const nota = mudanca("condicao_nota");
  if (nota) partes.push(`Condi\xE7\xE3o ${grauDaNota(nota.de)} \u2192 ${grauDaNota(nota.para)}`);
  const origem = mudanca("origem");
  if (origem) partes.push(origem.para ? `Origem: ${String(origem.para)}` : "Origem removida");
  const fotos = mudanca("fotos");
  if (fotos) partes.push(`Fotos: ${Number(fotos.de ?? 0)} \u2192 ${Number(fotos.para ?? 0)}`);
  return partes.length ? partes.join(" \xB7 ") : null;
}
function montarHistoricoUnidade(unidade, reservas, eventos, agora = Date.now()) {
  const lista = [];
  if (unidade.criado_em) lista.push({ tipo: "cadastrada", em: unidade.criado_em, titulo: "Ficha criada", detalhe: null, autor: null });
  for (const reserva of reservas) {
    lista.push({
      tipo: "reservada",
      em: reserva.criada_em,
      titulo: `Reservada para ${reserva.responsavel}`,
      detalhe: reserva.valor_sinal != null ? `Sinal de ${brl(Number(reserva.valor_sinal))}` : "Sem sinal registrado (anterior \xE0 regra de 20%)",
      autor: reserva.criada_por_nome ?? null
    });
    if (reserva.liberada_em) {
      const expirada = reserva.motivo_liberacao === "Expirada";
      lista.push({ tipo: expirada ? "reserva_vencida" : "reserva_liberada", em: reserva.liberada_em, titulo: expirada ? "Reserva vencida" : "Reserva liberada", detalhe: reserva.motivo_liberacao, autor: expirada ? null : reserva.liberada_por_nome ?? null });
    } else if (Date.parse(reserva.reservada_ate) <= agora) {
      lista.push({ tipo: "reserva_vencida", em: reserva.reservada_ate, titulo: "Reserva vencida", detalhe: "Prazo encerrado sem libera\xE7\xE3o manual", autor: null });
    }
  }
  if (eventos) {
    for (const evento of eventos) {
      const detalhe = evento.detalhe ?? {};
      if (evento.tipo === "endereco_alterado") {
        const de = typeof detalhe.de === "string" ? detalhe.de : null;
        const para = typeof detalhe.para === "string" ? detalhe.para : null;
        lista.push({ tipo: "endereco", em: evento.criado_em, titulo: para ? `Guardada em ${para}` : "Endere\xE7o removido", detalhe: de ? `Antes: ${de}` : null, autor: evento.usuario_nome });
      } else if (evento.tipo === "arquivada") {
        lista.push({ tipo: "arquivada", em: evento.criado_em, titulo: "Arquivada", detalhe: typeof detalhe.motivo === "string" ? detalhe.motivo : null, autor: evento.usuario_nome });
      } else if (evento.tipo === "restaurada") {
        lista.push({ tipo: "restaurada", em: evento.criado_em, titulo: "Restaurada ao estoque ativo", detalhe: null, autor: evento.usuario_nome });
      } else if (evento.tipo === "editada") {
        lista.push({ tipo: "editada", em: evento.criado_em, titulo: "Ficha editada", detalhe: descreverEdicao(detalhe), autor: evento.usuario_nome });
      } else if (evento.tipo === "baixa_automatica") {
        const item = typeof detalhe.nome_item === "string" ? detalhe.nome_item : "a pe\xE7a";
        lista.push({ tipo: "baixa_automatica", em: evento.criado_em, titulo: "Baixa autom\xE1tica \u2014 conferir", detalhe: `Venda de ${item} registrada sem escolher a unidade; o sistema baixou esta.`, autor: null });
      } else if (evento.tipo === "baixa_conferida") {
        lista.push({ tipo: "baixa_conferida", em: evento.criado_em, titulo: "Baixa conferida", detalhe: "Equipe confirmou que foi esta unidade que saiu.", autor: evento.usuario_nome });
      } else if (evento.tipo === "baixa_corrigida") {
        const devolvida = detalhe.papel === "devolvida";
        lista.push({ tipo: "baixa_corrigida", em: evento.criado_em, titulo: devolvida ? "Baixa corrigida: voltou ao estoque" : "Baixa corrigida: esta foi a vendida", detalhe: devolvida ? "A venda era de outra unidade da mesma pe\xE7a." : "Trocada na confer\xEAncia da baixa autom\xE1tica.", autor: evento.usuario_nome });
      } else if (evento.tipo === "baixa_excedente") {
        lista.push({ tipo: "baixa_excedente", em: evento.criado_em, titulo: "Baixada: j\xE1 tinha sa\xEDdo", detalhe: "Ficha que sobrou de uma venda antiga registrada sem unidade.", autor: evento.usuario_nome });
      } else if (evento.tipo === "baixa_desfeita") {
        lista.push({ tipo: "baixa_desfeita", em: evento.criado_em, titulo: "Venda cancelada: unidade devolvida", detalhe: null, autor: null });
      }
    }
    if (unidade.organizada_em && !eventos.some((evento) => evento.tipo === "endereco_alterado")) {
      lista.push({ tipo: "endereco", em: unidade.organizada_em, titulo: "Endere\xE7o definido", detalhe: "Definido no cadastro", autor: null });
    }
  } else {
    if (unidade.organizada_em) lista.push({ tipo: "endereco", em: unidade.organizada_em, titulo: "Endere\xE7o definido", detalhe: "\xDAltimo endere\xE7o registrado", autor: null });
    if (unidade.arquivada_em) lista.push({ tipo: "arquivada", em: unidade.arquivada_em, titulo: "Arquivada", detalhe: unidade.motivo_arquivamento ?? null, autor: null });
  }
  if (unidade.vendida_em) lista.push({ tipo: "vendida", em: unidade.vendida_em, titulo: "Vendida", detalhe: null, autor: null });
  return lista.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}
var UPLOAD_TTL_MS = 60 * 60 * 1e3;
var uploadsRecentes = /* @__PURE__ */ new Map();
function podeDescartarFoto(url, usuarioId, agora = Date.now()) {
  const registro = uploadsRecentes.get(url);
  return Boolean(registro && registro.usuarioId === usuarioId && agora - registro.em <= UPLOAD_TTL_MS);
}
function registrarUploadRecente(url, usuarioId, agora = Date.now()) {
  for (const [chave, registro] of uploadsRecentes) if (agora - registro.em > UPLOAD_TTL_MS) uploadsRecentes.delete(chave);
  uploadsRecentes.set(url, { usuarioId, em: agora });
}
var FOTO_ORFA_MS = 24 * 60 * 60 * 1e3;
var LIMPEZA_INTERVALO_MS = 60 * 60 * 1e3;
function registroPermiteDescarte(registro, usuarioId, agora = Date.now()) {
  return Boolean(registro && registro.usuario_id === usuarioId && agora - Date.parse(registro.enviada_em) <= FOTO_ORFA_MS);
}
var TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/gif"];
var uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_FOTO.includes(file.mimetype)) return cb(new Error("Formato de imagem n\xE3o suportado (use JPG, PNG, WEBP ou GIF)"));
    cb(null, true);
  }
});
var RESERVAS_BASE = "id, unidade_id, responsavel, reservada_ate, criada_em";
var RESERVAS_COM_CLIENTE = `${RESERVAS_BASE}, cliente_id, cliente:clientes(id, nome, telefone)`;
var RESERVAS_COM_SINAL = `${RESERVAS_COM_CLIENTE}, valor_sinal, preco_referencia, forma_pagamento_sinal_id, criada_por_nome`;
var COLUNA_AUSENTE = ["42703", "PGRST200", "PGRST204", "42P01", "PGRST205"];
var FUNCAO_AUSENTE = ["PGRST202", "42883"];
function erroBanco(error) {
  if (error.code === "23505") return { status: 409, error: "Este local ou v\xEDnculo j\xE1 existe." };
  if (error.code === "23503") return { status: 400, error: "Local ou categoria n\xE3o encontrado." };
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") {
    return { status: 503, error: "A organiza\xE7\xE3o f\xEDsica ainda n\xE3o foi instalada no banco." };
  }
  return { status: 500, error: error.message || "Falha ao salvar organiza\xE7\xE3o do estoque." };
}
function estoqueOrganizacaoRouter(supabase2) {
  const router = Router4();
  const atualizacoes = new EventEmitter();
  atualizacoes.setMaxListeners(0);
  if (typeof supabase2.channel === "function") {
    supabase2.channel("rk-estoque-atualizacoes").on("postgres_changes", { event: "*", schema: "public", table: "estoque" }, () => atualizacoes.emit("mudanca")).on("postgres_changes", { event: "*", schema: "public", table: "estoque_unidades" }, () => atualizacoes.emit("mudanca")).subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.error("Falha na conex\xE3o de atualiza\xE7\xF5es do estoque:", error?.message ?? status);
    });
  }
  const recursosConfirmados = { clienteNaReserva: false, reservaComSinal: false, baixaAutomatica: false };
  async function detectarRecursos() {
    if (!recursosConfirmados.clienteNaReserva) {
      const { error } = await supabase2.from("estoque_reservas").select("cliente_id").limit(0);
      recursosConfirmados.clienteNaReserva = !error;
    }
    if (!recursosConfirmados.reservaComSinal) {
      const { error } = await supabase2.from("estoque_reservas").select("valor_sinal").limit(0);
      recursosConfirmados.reservaComSinal = !error;
    }
    if (!recursosConfirmados.baixaAutomatica) {
      const { error } = await supabase2.from("estoque_baixas_automaticas").select("id").limit(0);
      recursosConfirmados.baixaAutomatica = !error;
    }
    return { ...recursosConfirmados };
  }
  async function fotoEmUso(url) {
    if ((await detectarRecursos()).baixaAutomatica) {
      const { data, error } = await supabase2.rpc("foto_estoque_em_uso", { p_url: url });
      return error ? null : Boolean(data);
    }
    const [emUnidade, emPeca, emCapa] = await Promise.all([
      supabase2.from("estoque_unidades").select("id").filter("fotos", "cs", JSON.stringify([url])).limit(1),
      supabase2.from("estoque").select("id").filter("imagens", "cs", JSON.stringify([url])).limit(1),
      supabase2.from("estoque").select("id").eq("imagem_url", url).limit(1)
    ]);
    if (emUnidade.error || emPeca.error || emCapa.error) return null;
    return Boolean(emUnidade.data?.length || emPeca.data?.length || emCapa.data?.length);
  }
  let ultimaLimpeza = 0;
  async function limparFotosOrfas(agora = Date.now()) {
    if (agora - ultimaLimpeza < LIMPEZA_INTERVALO_MS) return;
    ultimaLimpeza = agora;
    if (!(await detectarRecursos()).baixaAutomatica) return;
    const { data, error } = await supabase2.from("estoque_fotos_enviadas").select("url").lt("enviada_em", new Date(agora - FOTO_ORFA_MS).toISOString()).limit(50);
    if (error || !data) return;
    for (const { url } of data) {
      const emUso = await fotoEmUso(url);
      if (emUso === null) continue;
      if (!emUso) await excluirImagemPorUrl(url).catch((falha) => console.error("Erro ao apagar foto \xF3rf\xE3:", falha));
      await supabase2.from("estoque_fotos_enviadas").delete().eq("url", url);
    }
  }
  async function podeDescartarRegistrada(url, usuarioId) {
    if (podeDescartarFoto(url, usuarioId)) return true;
    if (!(await detectarRecursos()).baixaAutomatica) return false;
    const { data } = await supabase2.from("estoque_fotos_enviadas").select("usuario_id, enviada_em").eq("url", url).maybeSingle();
    return registroPermiteDescarte(data, usuarioId);
  }
  async function autorDaRequisicao(req) {
    const usuario = req.usuario;
    if (!usuario) return { id: null, nome: null };
    const { data } = await supabase2.from("usuarios").select("nome_exibicao").eq("id", usuario.id).maybeSingle();
    return { id: usuario.id, nome: data?.nome_exibicao ?? usuario.username };
  }
  router.get("/eventos", VER, (_req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("event: conectado\ndata: {}\n\n");
    const enviarMudanca = () => {
      if (!res.destroyed) res.write("event: estoque-atualizado\ndata: {}\n\n");
    };
    atualizacoes.on("mudanca", enviarMudanca);
    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(": keep-alive\n\n");
    }, 2e4);
    res.on("close", () => {
      clearInterval(heartbeat);
      atualizacoes.off("mudanca", enviarMudanca);
    });
  });
  router.get("/locais", VER, async (_req, res) => {
    const recursos = await detectarRecursos();
    const colunas = recursos.reservaComSinal ? RESERVAS_COM_SINAL : recursos.clienteNaReserva ? RESERVAS_COM_CLIENTE : RESERVAS_BASE;
    const [locais, categorias, reservas, baixas] = await Promise.all([
      supabase2.from("estoque_locais").select("*").order("deposito").order("zona").order("codigo"),
      supabase2.from("estoque_local_categorias").select("local_id, categoria_id, prioridade"),
      supabase2.from("estoque_reservas").select(colunas).is("liberada_em", null).gt("reservada_ate", (/* @__PURE__ */ new Date()).toISOString()),
      recursos.baixaAutomatica ? supabase2.from("estoque_baixas_automaticas").select("id, venda_id, unidade_id, estoque_id, criada_em, venda:vendas(data, nome_item, cliente_nome, valor_total)").is("conferida_em", null).order("criada_em", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null })
    ]);
    const error = locais.error || categorias.error || reservas.error || baixas.error;
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true, data: { locais: locais.data ?? [], categorias: categorias.data ?? [], reservas: reservas.data ?? [], baixasPendentes: baixas.data ?? [], recursos } });
  });
  router.get("/unidades/:unidadeId/historico", VER, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    const recursos = await detectarRecursos();
    const colunasReserva = recursos.reservaComSinal ? "criada_em, reservada_ate, liberada_em, motivo_liberacao, responsavel, valor_sinal, criada_por_nome, liberada_por_nome" : "criada_em, reservada_ate, liberada_em, motivo_liberacao, responsavel";
    const [unidade, reservas, eventos] = await Promise.all([
      supabase2.from("estoque_unidades").select("criado_em, organizada_em, vendida_em, arquivada_em, motivo_arquivamento").eq("id", unidadeId).maybeSingle(),
      supabase2.from("estoque_reservas").select(colunasReserva).eq("unidade_id", unidadeId),
      recursos.reservaComSinal ? supabase2.from("estoque_unidade_eventos").select("tipo, criado_em, detalhe, usuario_nome").eq("unidade_id", unidadeId) : Promise.resolve({ data: null, error: null })
    ]);
    const error = unidade.error || reservas.error || (eventos.error && !COLUNA_AUSENTE.includes(eventos.error.code ?? "") ? eventos.error : null);
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!unidade.data) return res.status(404).json({ success: false, error: "Unidade n\xE3o encontrada." });
    const linhaDoTempo = montarHistoricoUnidade(unidade.data, reservas.data ?? [], eventos.error ? null : eventos.data);
    res.json({ success: true, data: { eventos: linhaDoTempo, autoriaRegistrada: recursos.reservaComSinal } });
  });
  router.post("/fotos", CRIAR_OU_EDITAR, (req, res) => {
    uploadFoto.single("imagem")(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
      try {
        const url = await uploadImagem(req.file.buffer, req.file.originalname, req.file.mimetype);
        const usuarioId = req.usuario?.id ?? "anonimo";
        registrarUploadRecente(url, usuarioId);
        if ((await detectarRecursos()).baixaAutomatica) {
          const { error } = await supabase2.from("estoque_fotos_enviadas").insert({ url, usuario_id: usuarioId });
          if (error) console.error("Erro ao registrar foto enviada:", error);
        }
        res.json({ success: true, url });
        void limparFotosOrfas().catch((falha) => console.error("Erro na limpeza de fotos \xF3rf\xE3s:", falha));
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Falha ao enviar a foto." });
      }
    });
  });
  router.post("/fotos/descartar", CRIAR_OU_EDITAR, async (req, res) => {
    const urls = req.body?.urls;
    if (!Array.isArray(urls) || urls.length > 20 || urls.some((url) => typeof url !== "string")) {
      return res.status(400).json({ success: false, error: "Informe at\xE9 20 fotos para descartar." });
    }
    const usuarioId = req.usuario?.id ?? "anonimo";
    const descartadas = [];
    for (const url of urls) {
      if (!await podeDescartarRegistrada(url, usuarioId)) continue;
      if (await fotoEmUso(url) !== false) continue;
      await excluirImagemPorUrl(url);
      uploadsRecentes.delete(url);
      if (recursosConfirmados.baixaAutomatica) await supabase2.from("estoque_fotos_enviadas").delete().eq("url", url);
      descartadas.push(url);
    }
    res.json({ success: true, data: { descartadas } });
  });
  router.post("/unidades/:unidadeId/reservas", EDITAR, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    const validacao = validarReservaInput(req.body);
    if ("erro" in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const recursos = await detectarRecursos();
    if (!recursos.reservaComSinal) {
      return res.status(409).json({ success: false, error: "Reserva com sinal ainda n\xE3o instalada no banco (migrations 067 e 068 pendentes). Nenhuma reserva foi criada." });
    }
    const { responsavel, clienteId, reservadaAte, valorSinal, formaPagamentoId } = validacao.dados;
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase2.rpc("reservar_unidade_estoque", {
      p_unidade_id: unidadeId,
      p_responsavel: responsavel ?? "",
      p_ate: reservadaAte,
      p_cliente_id: recursos.clienteNaReserva ? clienteId : null,
      p_valor_sinal: valorSinal,
      p_forma_pagamento_id: formaPagamentoId,
      p_usuario_id: autor.id,
      p_usuario_nome: autor.nome
    });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  });
  async function rpcComAutoria(req, funcao, argumentos) {
    const autor = await autorDaRequisicao(req);
    const resposta = await supabase2.rpc(funcao, { ...argumentos, p_usuario_id: autor.id, p_usuario_nome: autor.nome });
    if (resposta.error && FUNCAO_AUSENTE.includes(resposta.error.code ?? "")) return supabase2.rpc(funcao, argumentos);
    return resposta;
  }
  router.post("/reservas/:reservaId/liberar", EDITAR, async (req, res) => {
    if (!UUID.test(req.params.reservaId)) return res.status(400).json({ success: false, error: "Reserva inv\xE1lida." });
    const { data, error } = await rpcComAutoria(req, "liberar_reserva_estoque", { p_reserva_id: req.params.reservaId });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });
  router.post("/unidades/:unidadeId/arquivar", EDITAR, async (req, res) => {
    if (!UUID.test(req.params.unidadeId) || typeof req.body?.motivo !== "string" || req.body.motivo.trim().length < 3 || req.body.motivo.trim().length > 240) {
      return res.status(400).json({ success: false, error: "Informe a unidade e um motivo de 3 a 240 caracteres." });
    }
    const { data, error } = await rpcComAutoria(req, "arquivar_unidade_estoque", { p_unidade_id: req.params.unidadeId, p_motivo: req.body.motivo.trim() });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });
  router.post("/unidades/:unidadeId/restaurar", EDITAR, async (req, res) => {
    if (!UUID.test(req.params.unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    const { data, error } = await rpcComAutoria(req, "restaurar_unidade_estoque", { p_unidade_id: req.params.unidadeId });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });
  router.post("/baixas/:baixaId/conferir", EDITAR, async (req, res) => {
    const { baixaId } = req.params;
    const correta = req.body?.unidade_correta_id ?? null;
    if (!UUID.test(baixaId) || correta !== null && (typeof correta !== "string" || !UUID.test(correta))) {
      return res.status(400).json({ success: false, error: "Baixa ou unidade inv\xE1lida." });
    }
    if (!(await detectarRecursos()).baixaAutomatica) {
      return res.status(409).json({ success: false, error: "Confer\xEAncia de baixa ainda n\xE3o instalada no banco (migration 069 pendente)." });
    }
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase2.rpc("conferir_baixa_automatica", {
      p_baixa_id: baixaId,
      p_unidade_correta_id: correta,
      p_usuario_id: autor.id,
      p_usuario_nome: autor.nome
    });
    if (error) return res.status(/não encontrada/i.test(error.message) ? 404 : 409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });
  router.post("/unidades/:unidadeId/baixar-excedente", EDITAR, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    if (!(await detectarRecursos()).baixaAutomatica) {
      return res.status(409).json({ success: false, error: "Confer\xEAncia de estoque ainda n\xE3o instalada no banco (migration 069 pendente)." });
    }
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase2.rpc("baixar_ficha_excedente", { p_unidade_id: unidadeId, p_usuario_id: autor.id, p_usuario_nome: autor.nome });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });
  async function localAtivo(enderecoId) {
    if (!enderecoId) return { ok: true };
    const { data, error } = await supabase2.from("estoque_locais").select("id").eq("id", enderecoId).eq("ativo", true).maybeSingle();
    if (error) return { ok: false, ...erroBanco(error) };
    if (!data) return { ok: false, status: 400, error: "Local inativo ou inexistente." };
    return { ok: true };
  }
  router.post("/pecas/:pecaId/unidades", CRIAR, async (req, res) => {
    const { pecaId } = req.params;
    if (!UUID.test(pecaId)) return res.status(400).json({ success: false, error: "Pe\xE7a inv\xE1lida." });
    const validacao = validarUnidadePayload(req.body, "criar");
    if ("erro" in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const local = await localAtivo(validacao.dados.endereco_id);
    if ("error" in local) return res.status(local.status).json({ success: false, error: local.error });
    const { data, error } = await supabase2.rpc("adicionar_unidade_estoque", { p_estoque_id: pecaId, p_payload: validacao.dados });
    if (error) {
      if (FUNCAO_AUSENTE.includes(error.code ?? "")) {
        return res.status(503).json({ success: false, error: "Atualize o banco com a migration de organiza\xE7\xE3o antes de cadastrar novas unidades." });
      }
      return res.status(409).json({ success: false, error: error.message });
    }
    return res.status(201).json({ success: true, data });
  });
  router.post("/unidades/:unidadeId/editar", async (req, res) => {
    const podeEditar = temPermissao(req.usuario, "estoque.editar");
    if (!podeEditar && !temPermissao(req.usuario, "estoque.criar")) {
      return res.status(403).json({ success: false, error: "Acesso negado: voc\xEA n\xE3o tem permiss\xE3o para esta a\xE7\xE3o" });
    }
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    const validacao = validarUnidadePayload(req.body, "editar");
    if ("erro" in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const dados = validacao.dados;
    const { data: antes, error: erroLeitura } = await supabase2.from("estoque_unidades").select("fotos, criado_em").eq("id", unidadeId).maybeSingle();
    if (erroLeitura) {
      const falha = erroBanco(erroLeitura);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!antes) return res.status(404).json({ success: false, error: "Unidade n\xE3o encontrada." });
    const criadaEm = Date.parse(String(antes.criado_em ?? ""));
    if (!podeEditar && !(Date.now() - criadaEm <= JANELA_FICHA_NOVA_MS)) {
      return res.status(403).json({ success: false, error: "Acesso negado: editar unidades exige permiss\xE3o de edi\xE7\xE3o do estoque." });
    }
    let resultado;
    if ((await detectarRecursos()).baixaAutomatica) {
      const autor = await autorDaRequisicao(req);
      resultado = await supabase2.rpc("editar_unidade_estoque", {
        p_unidade_id: unidadeId,
        p_payload: dados,
        p_usuario_id: autor.id,
        p_usuario_nome: autor.nome
      });
      if (resultado.error) return res.status(409).json({ success: false, error: resultado.error.message });
    } else {
      const local = await localAtivo(dados.endereco_id);
      if ("error" in local) return res.status(local.status).json({ success: false, error: local.error });
      resultado = await supabase2.from("estoque_unidades").update(dados).eq("id", unidadeId).is("vendida_em", null).is("arquivada_em", null).select("*").maybeSingle();
      if (resultado.error) {
        const falha = erroBanco(resultado.error);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (!resultado.data) return res.status(409).json({ success: false, error: "Unidade vendida ou arquivada n\xE3o pode ser editada." });
    }
    if (dados.fotos) {
      const removidas = (antes.fotos ?? []).filter((url) => !dados.fotos.includes(url));
      for (const url of removidas) {
        if (await fotoEmUso(url) === false) excluirImagemPorUrl(url).catch((falha) => console.error("Erro ao limpar foto da unidade:", falha));
      }
    }
    return res.json({ success: true, data: resultado.data });
  });
  router.post("/locais", EDITAR, async (req, res) => {
    const erro = validarLocalInput(req.body ?? {});
    if (erro) return res.status(400).json({ success: false, error: erro });
    const { codigo, deposito, zona, prateleira, secao, descricao } = req.body;
    const { data, error } = await supabase2.from("estoque_locais").insert({
      codigo: codigo.trim().toUpperCase(),
      deposito: deposito.trim(),
      zona: zona.trim(),
      prateleira: prateleira.trim(),
      secao: secao.trim(),
      descricao: descricao?.trim() || null
    }).select("*").single();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.status(201).json({ success: true, data });
  });
  router.patch("/locais/:localId", EDITAR, async (req, res) => {
    const { localId } = req.params;
    if (!UUID.test(localId)) return res.status(400).json({ success: false, error: "Local inv\xE1lido." });
    const validacao = validarAtualizacaoLocal(req.body);
    if ("erro" in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    if (validacao.dados.ativo === false) {
      const { count, error: erroContagem } = await supabase2.from("estoque_unidades").select("id", { count: "exact", head: true }).eq("endereco_id", localId).is("vendida_em", null).is("arquivada_em", null);
      if (erroContagem) {
        const falha = erroBanco(erroContagem);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (count) return res.status(409).json({ success: false, error: `Mova ${count === 1 ? "a unidade guardada" : `as ${count} unidades guardadas`} neste local antes de desativ\xE1-lo.` });
    }
    const { data, error } = await supabase2.from("estoque_locais").update(validacao.dados).eq("id", localId).select("*").maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(404).json({ success: false, error: "Local n\xE3o encontrado." });
    res.json({ success: true, data });
  });
  router.patch("/locais/:localId/categorias/:categoriaId", EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: "Local ou categoria inv\xE1lido." });
    const prioridade = req.body?.prioridade;
    if (!Number.isInteger(prioridade) || prioridade < 1 || prioridade > 3) return res.status(400).json({ success: false, error: "Prioridade deve ser 1, 2 ou 3." });
    const { data, error } = await supabase2.from("estoque_local_categorias").update({ prioridade }).eq("local_id", localId).eq("categoria_id", categoriaId).select("*").maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(404).json({ success: false, error: "V\xEDnculo n\xE3o encontrado." });
    res.json({ success: true, data });
  });
  router.post("/locais/:localId/categorias/:categoriaId", EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: "Local ou categoria inv\xE1lido." });
    const { data, error } = await supabase2.from("estoque_local_categorias").insert({ local_id: localId, categoria_id: categoriaId }).select("*").single();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.status(201).json({ success: true, data });
  });
  router.delete("/locais/:localId/categorias/:categoriaId", EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: "Local ou categoria inv\xE1lido." });
    const { error } = await supabase2.from("estoque_local_categorias").delete().eq("local_id", localId).eq("categoria_id", categoriaId);
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true });
  });
  router.patch("/unidades/:unidadeId", EDITAR, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: "Unidade inv\xE1lida." });
    const enderecoId = req.body?.endereco_id;
    if (enderecoId !== void 0 && enderecoId !== null && !UUID.test(enderecoId)) {
      return res.status(400).json({ success: false, error: "Escolha um local cadastrado." });
    }
    if (req.body?.origem_identificacao !== void 0 && req.body?.origem_identificacao !== null && (typeof req.body.origem_identificacao !== "string" || req.body.origem_identificacao.length > 240)) {
      return res.status(400).json({ success: false, error: "Origem deve ter at\xE9 240 caracteres." });
    }
    const payload = {};
    if (enderecoId !== void 0) payload.endereco_id = enderecoId;
    if (req.body?.origem_identificacao !== void 0) payload.origem_identificacao = req.body.origem_identificacao?.trim() || null;
    if (!Object.keys(payload).length) return res.status(400).json({ success: false, error: "Nenhuma altera\xE7\xE3o informada." });
    const { data: unidade, error: erroUnidade } = await supabase2.from("estoque_unidades").select("id, vendida_em, arquivada_em").eq("id", unidadeId).maybeSingle();
    if (erroUnidade) {
      const falha = erroBanco(erroUnidade);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!unidade) return res.status(404).json({ success: false, error: "Unidade n\xE3o encontrada." });
    if (unidade.vendida_em || unidade.arquivada_em) return res.status(409).json({ success: false, error: "Unidade vendida ou arquivada n\xE3o pode ser movida." });
    if (enderecoId) {
      const { data: local, error: erroLocal } = await supabase2.from("estoque_locais").select("id").eq("id", enderecoId).eq("ativo", true).maybeSingle();
      if (erroLocal) {
        const falha = erroBanco(erroLocal);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (!local) return res.status(400).json({ success: false, error: "Local inativo ou inexistente." });
    }
    const { data, error } = await supabase2.from("estoque_unidades").update(payload).eq("id", unidadeId).is("vendida_em", null).is("arquivada_em", null).select("*").maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(409).json({ success: false, error: "A unidade mudou enquanto voc\xEA editava. Atualize a tela." });
    res.json({ success: true, data });
  });
  return router;
}

// src/server/routes/estoque.ts
var VER2 = exigirPermissao("estoque.ver");
var CRIAR2 = exigirPermissao("estoque.criar");
var EDITAR2 = exigirPermissao("estoque.editar");
var DELETAR = exigirPermissao("estoque.deletar");
var ANUNCIAR_ML = exigirPermissao("estoque.anunciar_ml");
var ANUNCIAR_SHOPEE = exigirPermissao("estoque.anunciar_shopee");
var SELECT_COM_JOINS = "*, categoria:categorias(id, nome, mercadolivre_categoria_id_padrao), modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(id, nome, ano), gaveta:gavetas(id, nome, icone)";
async function anexarUnidades(supabase2, itens) {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;
  const { data, error } = await supabase2.from("estoque_unidades").select("*");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("\u26A0\uFE0F Tabela estoque_unidades ausente \u2014 rode supabase/migration_014_unidades_avaria.sql pra habilitar as avarias.");
    } else {
      console.error("Erro ao buscar unidades de estoque:", error);
    }
    return lista.map((item) => ({ ...item, unidades: [] }));
  }
  const porEstoque = /* @__PURE__ */ new Map();
  for (const unidade of data ?? []) {
    const atual = porEstoque.get(unidade.estoque_id) ?? [];
    atual.push(unidade);
    porEstoque.set(unidade.estoque_id, atual);
  }
  return lista.map((item) => ({
    ...item,
    unidades: (porEstoque.get(item.id) ?? []).map((unidade) => ({
      ...unidade,
      fotos: fotosEfetivasDaUnidade(unidade, item.imagens)
    }))
  }));
}
async function anexarCompatibilidades(supabase2, itens) {
  if (itens.length === 0) return itens;
  const { data, error } = await supabase2.from("estoque_modelos_compativeis").select("estoque_id, modelo_moto:modelos_moto(id, nome, ano)");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("\u26A0\uFE0F Tabela estoque_modelos_compativeis ausente \u2014 rode supabase/migration_019_compatibilidade_pecas.sql pra habilitar compatibilidade entre modelos.");
    } else {
      console.error("Erro ao buscar compatibilidades de estoque:", error);
    }
    return itens.map((item) => ({ ...item, modelos_compativeis: [] }));
  }
  const porEstoque = /* @__PURE__ */ new Map();
  for (const linha of data ?? []) {
    if (!linha.modelo_moto) continue;
    const atual = porEstoque.get(linha.estoque_id) ?? [];
    atual.push(linha.modelo_moto);
    porEstoque.set(linha.estoque_id, atual);
  }
  return itens.map((item) => ({ ...item, modelos_compativeis: porEstoque.get(item.id) ?? [] }));
}
async function anexarFamilias(supabase2, itens) {
  if (itens.length === 0) return itens;
  const { data, error } = await supabase2.from("estoque_familias").select("*");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("\u26A0\uFE0F Tabela estoque_familias ausente \u2014 rode supabase/migration_056_estoque_familias.sql pra habilitar fam\xEDlias de pe\xE7a.");
    } else {
      console.error("Erro ao buscar fam\xEDlias de estoque:", error);
    }
    return itens.map((item) => ({ ...item, familia: null }));
  }
  const porId = /* @__PURE__ */ new Map();
  for (const familia of data ?? []) porId.set(familia.id, familia);
  return itens.map((item) => ({ ...item, familia: item.familia_id ? porId.get(item.familia_id) ?? null : null }));
}
async function casarComPecasProcuradas(supabase2, item, criadoPorUsuarioId) {
  try {
    const { data: pedidos, error } = await supabase2.from("pecas_procuradas").select("*").eq("status", "aguardando");
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        console.warn("\u26A0\uFE0F Tabela pecas_procuradas ausente \u2014 rode supabase/migration_033_pecas_procuradas.sql pra habilitar o alerta autom\xE1tico.");
        return;
      }
      throw error;
    }
    if (!pedidos || pedidos.length === 0) return;
    const { data: compativeis } = await supabase2.from("estoque_modelos_compativeis").select("modelo_moto_id").eq("estoque_id", item.id);
    const modelosDaPeca = new Set([item.modelo_moto_id, ...(compativeis ?? []).map((c) => c.modelo_moto_id)].filter(Boolean));
    for (const pedido of pedidos) {
      if (pedido.categoria_id && pedido.categoria_id !== item.categoria_id) continue;
      if (pedido.modelo_moto_id && !modelosDaPeca.has(pedido.modelo_moto_id)) continue;
      const { error: erroTarefa } = await supabase2.from("tarefas").insert({
        titulo: `Pe\xE7a procurada chegou: ${item.nome}`,
        descricao: `${pedido.cliente_nome || "Cliente"} procurava "${pedido.descricao}" \u2014 acabou de chegar em estoque.`,
        atribuido_para: pedido.criado_por,
        criado_por: criadoPorUsuarioId,
        cliente_id: pedido.cliente_id,
        prioridade: "alta",
        tipo: "geral"
      });
      if (erroTarefa) {
        console.error("Erro ao criar tarefa de pe\xE7a procurada:", erroTarefa);
        continue;
      }
      await supabase2.from("pecas_procuradas").update({ status: "atendida", atendida_em: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", pedido.id);
    }
  } catch (err) {
    console.error("Erro ao casar pe\xE7a nova com pedidos em aberto:", err);
  }
}
function sintetizarLinkLegado(item) {
  if (!item.anuncio_ml_url) return [];
  return [
    {
      id: `legado:${item.id}`,
      estoque_id: item.id,
      url: item.anuncio_ml_url,
      mlb_id: extrairMlbId(item.anuncio_ml_url) ?? "",
      legado: true,
      criado_em: item.criado_em,
      atualizado_em: item.atualizado_em
    }
  ];
}
async function anexarAnunciosMl(supabase2, itens) {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;
  const { data, error } = await supabase2.from("estoque_anuncios_ml").select("*").order("criado_em");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn(
        "\u26A0\uFE0F Tabela estoque_anuncios_ml ausente \u2014 rode supabase/migration_025_estoque_anuncios_ml.sql pra habilitar m\xFAltiplos an\xFAncios por pe\xE7a. Usando o link \xFAnico legado (anuncio_ml_url) por enquanto."
      );
      return lista.map((item) => ({ ...item, links_ml: sintetizarLinkLegado(item) }));
    }
    console.error("Erro ao buscar an\xFAncios ML de estoque:", error);
    return lista.map((item) => ({ ...item, links_ml: [] }));
  }
  const linkIds = (data ?? []).map((link) => link.id);
  const estatisticasPorLink = /* @__PURE__ */ new Map();
  if (linkIds.length > 0) {
    const { data: estatisticas, error: erroEstatisticas } = await supabase2.from("estoque_anuncios_ml_estatisticas").select("*").in("link_id", linkIds);
    if (erroEstatisticas) {
      if (erroEstatisticas.code !== "42P01" && erroEstatisticas.code !== "PGRST205") {
        console.error("Erro ao buscar estat\xEDsticas de an\xFAncios ML:", erroEstatisticas);
      }
    } else {
      for (const linha of estatisticas ?? []) estatisticasPorLink.set(linha.link_id, linha);
    }
  }
  const porEstoque = /* @__PURE__ */ new Map();
  for (const link of data ?? []) {
    const atual = porEstoque.get(link.estoque_id) ?? [];
    atual.push({ ...link, estatisticas: estatisticasPorLink.get(link.id) ?? null });
    porEstoque.set(link.estoque_id, atual);
  }
  return lista.map((item) => ({ ...item, links_ml: porEstoque.get(item.id) ?? [] }));
}
async function anexarAnunciosShopee(supabase2, itens) {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;
  const { data, error } = await supabase2.from("estoque_anuncios_shopee").select("*").order("criado_em");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return lista.map((item) => ({ ...item, links_shopee: [] }));
    }
    console.error("Erro ao buscar an\xFAncios Shopee de estoque:", error);
    return lista.map((item) => ({ ...item, links_shopee: [] }));
  }
  const linkIds = (data ?? []).map((link) => link.id);
  const estatisticasPorLink = /* @__PURE__ */ new Map();
  if (linkIds.length > 0) {
    const { data: estatisticas, error: erroEstatisticas } = await supabase2.from("estoque_anuncios_shopee_estatisticas").select("*").in("link_id", linkIds);
    if (erroEstatisticas) {
      if (erroEstatisticas.code !== "42P01" && erroEstatisticas.code !== "PGRST205") {
        console.error("Erro ao buscar estat\xEDsticas de an\xFAncios Shopee:", erroEstatisticas);
      }
    } else {
      for (const linha of estatisticas ?? []) estatisticasPorLink.set(linha.link_id, linha);
    }
  }
  const porEstoque = /* @__PURE__ */ new Map();
  for (const link of data ?? []) {
    const atual = porEstoque.get(link.estoque_id) ?? [];
    atual.push({ ...link, estatisticas: estatisticasPorLink.get(link.id) ?? null });
    porEstoque.set(link.estoque_id, atual);
  }
  return lista.map((item) => ({ ...item, links_shopee: porEstoque.get(item.id) ?? [] }));
}
function montarPayloadAnuncioMl(body) {
  const url = String(body?.url || "").trim();
  if (!url) return { erro: "Informe o link do an\xFAncio" };
  const mlbId = extrairMlbId(url);
  if (!mlbId) return { erro: "N\xE3o foi poss\xEDvel identificar o ID do an\xFAncio (MLB...) nesse link" };
  return { payload: { url, mlb_id: mlbId } };
}
function montarAtributoConfig(a) {
  return { id: String(a?.id ?? ""), value_id: a?.value_id ?? void 0, value_name: a?.value_name ?? void 0, value_struct: a?.value_struct ?? void 0 };
}
function montarConfiguracaoPublicacao(body) {
  const categoriaMlId = String(body?.categoria_ml_id || "").trim();
  if (!categoriaMlId) return { erro: "Selecione a categoria do Mercado Livre" };
  if (body?.condicao_ml !== "new" && body?.condicao_ml !== "used") {
    return { erro: 'Informe se o an\xFAncio \xE9 "novo" ou "usado"' };
  }
  const listingTypeId = String(body?.listing_type_id || "").trim();
  if (!listingTypeId) return { erro: "Selecione o tipo de an\xFAncio (Cl\xE1ssico ou Premium)" };
  const fotos = Array.isArray(body?.fotos) ? body.fotos.map((f) => String(f)).filter(Boolean) : [];
  if (fotos.length === 0) return { erro: "Selecione ao menos uma foto pro an\xFAncio" };
  const tituloAnuncio = String(body?.titulo_anuncio || "").trim();
  if (!tituloAnuncio) return { erro: "Informe o t\xEDtulo do an\xFAncio" };
  const descricaoAnuncio = String(body?.descricao_anuncio || "").trim();
  if (!descricaoAnuncio) return { erro: "Informe a descri\xE7\xE3o do an\xFAncio" };
  const variacoes = Array.isArray(body?.variacoes) ? body.variacoes.map((v) => ({
    unidadeId: String(v?.unidade_id ?? ""),
    atributos: Array.isArray(v?.atributos) ? v.atributos.map(montarAtributoConfig) : [],
    precoEfetivoSistema: v?.preco_efetivo_sistema != null ? Number(v.preco_efetivo_sistema) : void 0
  })) : void 0;
  return {
    config: {
      categoriaMlId,
      condicaoMl: body.condicao_ml,
      listingTypeId,
      atributos: Array.isArray(body?.atributos) ? body.atributos.map(montarAtributoConfig) : [],
      fotos,
      precoEfetivoSistema: body?.preco_efetivo_sistema != null ? Number(body.preco_efetivo_sistema) : void 0,
      variacoes,
      catalogoProdutoId: body?.catalogo_produto_id ? String(body.catalogo_produto_id) : void 0,
      tituloAnuncio,
      descricaoAnuncio
    }
  };
}
function montarConfiguracaoPublicacaoShopee(body) {
  const categoriaShopeeId = Number(body?.categoria_shopee_id);
  if (!Number.isFinite(categoriaShopeeId) || categoriaShopeeId <= 0) return { erro: "Selecione a categoria da Shopee" };
  const logisticsChannelId = Number(body?.logistics_channel_id);
  if (!Number.isFinite(logisticsChannelId) || logisticsChannelId <= 0) return { erro: "Selecione o canal de log\xEDstica" };
  const pesoKg = Number(body?.peso_kg);
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return { erro: "Informe o peso da pe\xE7a (kg)" };
  const tituloAnuncio = String(body?.titulo_anuncio || "").trim();
  if (!tituloAnuncio) return { erro: "Informe o t\xEDtulo do an\xFAncio" };
  const descricaoAnuncio = String(body?.descricao_anuncio || "").trim();
  if (!descricaoAnuncio) return { erro: "Informe a descri\xE7\xE3o do an\xFAncio" };
  const variacoes = Array.isArray(body?.variacoes) ? body.variacoes.map((v) => ({
    unidadeId: String(v?.unidade_id ?? ""),
    precoEfetivoSistema: v?.preco_efetivo_sistema != null ? Number(v.preco_efetivo_sistema) : void 0
  })) : void 0;
  return {
    config: {
      categoriaShopeeId,
      logisticsChannelId,
      atributos: Array.isArray(body?.atributos) ? body.atributos : [],
      pesoKg,
      precoEfetivoSistema: body?.preco_efetivo_sistema != null ? Number(body.preco_efetivo_sistema) : void 0,
      variacoes,
      tituloAnuncio,
      descricaoAnuncio
    }
  };
}
async function sincronizarCompatibilidades(supabase2, estoqueId, ids) {
  if (!Array.isArray(ids)) return null;
  const { data: atual } = await supabase2.from("estoque").select("modelo_moto_id").eq("id", estoqueId).single();
  const principal = atual?.modelo_moto_id ?? null;
  const idsLimpos = Array.from(new Set(ids.map((id) => String(id)).filter((id) => id && id !== principal)));
  const { error: erroDelete } = await supabase2.from("estoque_modelos_compativeis").delete().eq("estoque_id", estoqueId);
  if (erroDelete) {
    if (erroDelete.code === "42P01" || erroDelete.code === "PGRST205") return null;
    return erroDelete.message;
  }
  if (idsLimpos.length === 0) return null;
  const { error: erroInsert } = await supabase2.from("estoque_modelos_compativeis").insert(idsLimpos.map((modelo_moto_id) => ({ estoque_id: estoqueId, modelo_moto_id })));
  if (erroInsert) {
    if (erroInsert.code === "23503") return "Um dos modelos compat\xEDveis selecionados n\xE3o existe mais.";
    return erroInsert.message;
  }
  return null;
}
async function sincronizarUnidades(supabase2, estoqueId, quantidade) {
  const { error } = await supabase2.rpc("sincronizar_unidades_estoque", {
    p_estoque_id: estoqueId,
    p_quantidade_alvo: quantidade
  });
  if (!error) return null;
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205") {
    console.warn("\u26A0\uFE0F Fun\xE7\xE3o sincronizar_unidades_estoque ausente \u2014 rode supabase/migration_057_estoque_unidades_explicitas.sql pra habilitar unidades sempre expl\xEDcitas.");
    return null;
  }
  return error.message;
}
var CAMPOS_EDITAVEIS = [
  "nome",
  "categoria_id",
  "modelo_moto_id",
  "condicao",
  "condicao_nota",
  "nota_cadastro",
  "ano",
  "valor",
  "quantidade",
  "imagens",
  "descricao",
  "ativo",
  "componentes",
  "anuncio_fb_url",
  "familia_id"
];
function validarNovo(body) {
  if (body?.novo === void 0 || body?.novo === null) return null;
  if (typeof body.novo !== "boolean") return 'Campo "novo" deve ser booleano (true/false)';
  return null;
}
function montarPayload(body) {
  const payload = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== void 0) payload[campo] = body[campo];
  }
  if (payload.valor !== void 0) payload.valor = Number(payload.valor) || 0;
  if (payload.quantidade !== void 0) payload.quantidade = Math.max(0, Number(payload.quantidade) || 0);
  if (payload.condicao_nota !== void 0) {
    const nota = payload.condicao_nota === null || payload.condicao_nota === "" ? null : Number(payload.condicao_nota);
    payload.condicao_nota = nota === null || !Number.isFinite(nota) ? null : Math.min(10, Math.max(1, Math.round(nota)));
  }
  if (payload.imagens !== void 0) {
    payload.imagens = Array.isArray(payload.imagens) ? payload.imagens.map((u) => String(u)).filter(Boolean) : [];
  }
  if (payload.componentes !== void 0) {
    const lista = Array.isArray(payload.componentes) ? payload.componentes.map((c) => String(c).trim()).filter(Boolean) : [];
    payload.componentes = lista.length > 0 ? lista : null;
  }
  if (payload.familia_id !== void 0) payload.familia_id = payload.familia_id || null;
  if (body?.gaveta_id !== void 0) payload.gaveta_id = body.gaveta_id || null;
  if (typeof body?.novo === "boolean") payload.novo = body.novo;
  return payload;
}
async function validarNotaCadastro(supabase2, categoriaId, notaCadastro) {
  if (!categoriaId) return null;
  const { data: categorias, error } = await supabase2.from("categorias").select("id, nome, parent_id, ordem");
  if (error) throw error;
  if (!categoriaExigeNota(categoriaId, categorias || [])) return null;
  if (notaCadastro !== "com_nota" && notaCadastro !== "sem_nota") {
    return 'Para pe\xE7as de Motor, selecione "Com nota pra cadastro" ou "Sem nota pra cadastro"';
  }
  return null;
}
function estoqueRouter(supabase2) {
  const router = Router5();
  router.use("/organizacao", estoqueOrganizacaoRouter(supabase2));
  router.get("/", VER2, async (req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque").select(SELECT_COM_JOINS).order("criado_em", { ascending: false });
      if (error) throw error;
      const comUnidades = await anexarUnidades(supabase2, data);
      const comCompatibilidades = await anexarCompatibilidades(supabase2, comUnidades);
      const comFamilias = await anexarFamilias(supabase2, comCompatibilidades);
      const comAnunciosMl = await anexarAnunciosMl(supabase2, comFamilias);
      const comAnunciosShopee = await anexarAnunciosShopee(supabase2, comAnunciosMl);
      const payload = { success: true, data: await anexarPromocoes(supabase2, comAnunciosShopee) };
      res.vary("Accept-Encoding");
      if (req.acceptsEncodings("gzip")) {
        res.setHeader("Content-Encoding", "gzip");
        res.type("json").send(gzipSync(JSON.stringify(payload)));
      } else {
        res.json(payload);
      }
    } catch (error) {
      console.error("Erro ao listar estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/:id", VER2, async (req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque").select(SELECT_COM_JOINS).eq("id", req.params.id).single();
      if (error) throw error;
      const [comUnidades] = await anexarUnidades(supabase2, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase2, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase2, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase2, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase2, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase2, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", CRIAR2, async (req, res) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome da pe\xE7a \xE9 obrigat\xF3rio" });
      if (!["original", "paralela"].includes(req.body?.condicao)) {
        return res.status(400).json({ success: false, error: 'Condi\xE7\xE3o deve ser "original" ou "paralela"' });
      }
      const erroNovo = validarNovo(req.body);
      if (erroNovo) return res.status(400).json({ success: false, error: erroNovo });
      const payload = { ...montarPayload(req.body), nome };
      const erroNota = await validarNotaCadastro(supabase2, payload.categoria_id ?? null, payload.nota_cadastro);
      if (erroNota) return res.status(400).json({ success: false, error: erroNota });
      const { data, error } = await supabase2.from("estoque").insert([payload]).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      const erroSync = await sincronizarUnidades(supabase2, data.id, data.quantidade);
      if (erroSync) return res.status(400).json({ success: false, error: erroSync });
      const erroCompat = await sincronizarCompatibilidades(supabase2, data.id, req.body?.modelo_moto_compativel_ids);
      if (erroCompat) return res.status(400).json({ success: false, error: erroCompat });
      if (req.usuario) casarComPecasProcuradas(supabase2, data, req.usuario.id).catch((e) => console.error("Erro no match de pe\xE7a procurada:", e));
      const [comCompatibilidades] = await anexarCompatibilidades(supabase2, [{ ...data, unidades: [] }]);
      const [comFamilias] = await anexarFamilias(supabase2, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase2, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase2, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase2, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error) {
      console.error("Erro ao criar item de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const atualizarItem = async (req, res) => {
    try {
      const erroNovo = validarNovo(req.body);
      if (erroNovo) return res.status(400).json({ success: false, error: erroNovo });
      const payload = montarPayload(req.body);
      let imagensRemovidas = [];
      if (payload.imagens !== void 0) {
        const { data: atual } = await supabase2.from("estoque").select("imagens").eq("id", req.params.id).single();
        const antigas = atual?.imagens ?? [];
        imagensRemovidas = antigas.filter((url) => !payload.imagens.includes(url));
      }
      if (payload.categoria_id !== void 0 || payload.nota_cadastro !== void 0) {
        const { data: atual } = await supabase2.from("estoque").select("categoria_id, nota_cadastro").eq("id", req.params.id).single();
        const categoriaId = payload.categoria_id !== void 0 ? payload.categoria_id : atual?.categoria_id ?? null;
        const notaCadastro = payload.nota_cadastro !== void 0 ? payload.nota_cadastro : atual?.nota_cadastro ?? null;
        const erroNota = await validarNotaCadastro(supabase2, categoriaId, notaCadastro);
        if (erroNota) return res.status(400).json({ success: false, error: erroNota });
      }
      const { data, error } = await supabase2.from("estoque").update(payload).eq("id", req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      if (payload.quantidade !== void 0) {
        const erroSync = await sincronizarUnidades(supabase2, req.params.id, data.quantidade);
        if (erroSync) return res.status(400).json({ success: false, error: erroSync });
      }
      const erroCompat = await sincronizarCompatibilidades(supabase2, req.params.id, req.body?.modelo_moto_compativel_ids);
      if (erroCompat) return res.status(400).json({ success: false, error: erroCompat });
      for (const url of imagensRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error("Erro ao limpar imagem antiga:", e));
      }
      const [comUnidades] = await anexarUnidades(supabase2, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase2, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase2, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase2, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase2, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase2, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error) {
      console.error("Erro ao atualizar item de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  router.put("/:id", EDITAR2, atualizarItem);
  router.patch("/:id", EDITAR2, atualizarItem);
  router.delete("/:id", DELETAR, async (req, res) => {
    try {
      const { data: item } = await supabase2.from("estoque").select("imagens").eq("id", req.params.id).single();
      const { error } = await supabase2.from("estoque").delete().eq("id", req.params.id);
      if (error) throw error;
      for (const url of item?.imagens ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error("Erro ao limpar imagem:", e));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir item de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/bulk-delete", DELETAR, async (req, res) => {
    try {
      const ids = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "ids inv\xE1lidos" });
      }
      const { data: itens } = await supabase2.from("estoque").select("imagens").in("id", ids);
      const { error } = await supabase2.from("estoque").delete().in("id", ids);
      if (error) throw error;
      for (const item of itens || []) {
        for (const url of item.imagens ?? []) {
          excluirImagemPorUrl(url).catch((e) => console.error("Erro ao limpar imagem:", e));
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro no bulk-delete de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  function montarPayloadUnidade(body) {
    const payload = {};
    if (body?.nome !== void 0) payload.nome = body.nome === null ? null : String(body.nome).trim() || null;
    if (body?.avaria !== void 0) payload.avaria = Boolean(body.avaria);
    if (body?.avaria_descricao !== void 0) {
      payload.avaria_descricao = body.avaria_descricao === null ? null : String(body.avaria_descricao).trim() || null;
    }
    if (body?.descricao !== void 0) payload.descricao = body.descricao === null ? null : String(body.descricao).trim() || null;
    if (body?.fotos !== void 0) {
      payload.fotos = Array.isArray(body.fotos) ? body.fotos.map((f) => String(f)).filter(Boolean) : [];
    }
    if (body?.valor !== void 0) {
      const numero = body.valor === null || body.valor === "" ? null : Number(body.valor);
      payload.valor = numero === null || Number.isNaN(numero) ? null : Math.max(0, numero);
    }
    if (body?.condicao_nota !== void 0) {
      const nota = body.condicao_nota === null || body.condicao_nota === "" ? null : Number(body.condicao_nota);
      payload.condicao_nota = nota === null || !Number.isFinite(nota) ? null : Math.min(10, Math.max(1, Math.round(nota)));
    }
    return payload;
  }
  function erroColunaCondicaoNotaAusente(error) {
    if (!error) return false;
    const codigoConhecido = error.code === "42703" || error.code === "PGRST204";
    return codigoConhecido && String(error.message || "").includes("condicao_nota");
  }
  async function inserirOuAtualizarUnidade(executar, payload) {
    const resultado = await executar(payload);
    if (!resultado.error || !("condicao_nota" in payload) || !erroColunaCondicaoNotaAusente(resultado.error)) {
      return resultado;
    }
    console.warn(
      "\u26A0\uFE0F Coluna estoque_unidades.condicao_nota ausente \u2014 rode supabase/migration_024_condicao_nota_unidade.sql pra habilitar a nota por unidade. Salvando o restante da ficha sem ela."
    );
    const { condicao_nota, ...semNota } = payload;
    return executar(semNota);
  }
  router.get("/:id/unidades", VER2, async (req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque_unidades").select("*").eq("estoque_id", req.params.id).order("criado_em");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar unidades:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/unidades", EDITAR2, async (req, res) => {
    try {
      const { data: item, error: erroItem } = await supabase2.from("estoque").select("id, quantidade").eq("id", req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: "Pe\xE7a n\xE3o encontrada" });
      const { count, error: erroContagem } = await supabase2.from("estoque_unidades").select("id", { count: "exact", head: true }).eq("estoque_id", req.params.id);
      if (erroContagem) throw erroContagem;
      if ((count ?? 0) >= item.quantidade) {
        return res.status(400).json({
          success: false,
          error: `Esta pe\xE7a tem ${item.quantidade} unidade(s) em estoque e j\xE1 ${count} ficha(s) cadastrada(s). Aumente a quantidade ou revise as fichas existentes.`
        });
      }
      const payload = { ...montarPayloadUnidade(req.body), estoque_id: req.params.id };
      const { data, error } = await inserirOuAtualizarUnidade(
        (p) => supabase2.from("estoque_unidades").insert(p).select("*").single(),
        payload
      );
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar unidade:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/unidades/:unidadeId", EDITAR2, async (req, res) => {
    try {
      const payload = montarPayloadUnidade(req.body);
      let fotosRemovidas = [];
      if (payload.fotos !== void 0) {
        const { data: atual } = await supabase2.from("estoque_unidades").select("fotos").eq("id", req.params.unidadeId).single();
        const antigas = atual?.fotos ?? [];
        fotosRemovidas = antigas.filter((url) => !payload.fotos.includes(url));
      }
      const { data, error } = await inserirOuAtualizarUnidade(
        (p) => supabase2.from("estoque_unidades").update(p).eq("id", req.params.unidadeId).eq("estoque_id", req.params.id).select("*").single(),
        payload
      );
      if (error) throw error;
      for (const url of fotosRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error("Erro ao limpar foto de avaria:", e));
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar unidade:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/unidades/:unidadeId", EDITAR2, async (req, res) => {
    try {
      const { data: unidade } = await supabase2.from("estoque_unidades").select("fotos").eq("id", req.params.unidadeId).single();
      const { error } = await supabase2.from("estoque_unidades").delete().eq("id", req.params.unidadeId).eq("estoque_id", req.params.id);
      if (error) throw error;
      for (const url of unidade?.fotos ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error("Erro ao limpar foto de avaria:", e));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir unidade:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/unidades/:unidadeId/mover", EDITAR2, async (req, res) => {
    try {
      const { ficha_destino_id } = req.body;
      if (!ficha_destino_id) return res.status(400).json({ success: false, error: "ficha_destino_id obrigat\xF3rio" });
      const { error } = await supabase2.rpc("mover_unidade_estoque", {
        p_unidade_id: req.params.unidadeId,
        p_ficha_destino_id: ficha_destino_id
      });
      if (error) {
        if (error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205") {
          console.warn("\u26A0\uFE0F Fun\xE7\xE3o mover_unidade_estoque ausente \u2014 rode supabase/migration_060_mover_unidade_estoque.sql.");
          return res.status(503).json({ success: false, error: "Fun\xE7\xE3o de movimenta\xE7\xE3o n\xE3o dispon\xEDvel. Rode a migration_060." });
        }
        if (error.code === "P0001") return res.status(400).json({ success: false, error: error.message });
        throw error;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao mover unidade:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/:id/anuncios-ml", VER2, async (req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque_anuncios_ml").select("*").eq("estoque_id", req.params.id).order("criado_em");
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          const { data: item } = await supabase2.from("estoque").select("id, anuncio_ml_url, criado_em, atualizado_em").eq("id", req.params.id).maybeSingle();
          return res.json({ success: true, data: item ? sintetizarLinkLegado(item) : [] });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar an\xFAncios ML da pe\xE7a:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/anuncios-ml", ANUNCIAR_ML, async (req, res) => {
    try {
      const { payload, erro } = montarPayloadAnuncioMl(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });
      const { data: item, error: erroItem } = await supabase2.from("estoque").select("id, anuncio_ml_url").eq("id", req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: "Pe\xE7a n\xE3o encontrada" });
      const { data, error } = await supabase2.from("estoque_anuncios_ml").insert({ ...payload, estoque_id: req.params.id }).select("*").single();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          if (item.anuncio_ml_url) {
            return res.status(409).json({ success: false, error: "Rode a migration_025 antes de vincular mais de um an\xFAncio a esta pe\xE7a." });
          }
          const { data: atualizado, error: erroLegado } = await supabase2.from("estoque").update({ anuncio_ml_url: payload.url }).eq("id", req.params.id).select("id, anuncio_ml_url, criado_em, atualizado_em").single();
          if (erroLegado) throw erroLegado;
          return res.json({ success: true, data: sintetizarLinkLegado(atualizado)[0] });
        }
        if (error.code === "23505") {
          return res.status(400).json({ success: false, error: "Este an\xFAncio j\xE1 est\xE1 vinculado a outra pe\xE7a do estoque." });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao vincular an\xFAncio ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/anuncios-ml/:linkId", ANUNCIAR_ML, async (req, res) => {
    try {
      const { payload, erro } = montarPayloadAnuncioMl(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });
      if (req.params.linkId.startsWith("legado:")) {
        const { data: data2, error: error2 } = await supabase2.from("estoque").update({ anuncio_ml_url: payload.url }).eq("id", req.params.id).select("id, anuncio_ml_url, criado_em, atualizado_em").single();
        if (error2) throw error2;
        return res.json({ success: true, data: sintetizarLinkLegado(data2)[0] });
      }
      const { data, error } = await supabase2.from("estoque_anuncios_ml").update(payload).eq("id", req.params.linkId).eq("estoque_id", req.params.id).select("*").single();
      if (error) {
        if (error.code === "23505") {
          return res.status(400).json({ success: false, error: "Este an\xFAncio j\xE1 est\xE1 vinculado a outra pe\xE7a do estoque." });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar an\xFAncio ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/anuncios-ml/:linkId", ANUNCIAR_ML, async (req, res) => {
    try {
      if (req.params.linkId.startsWith("legado:")) {
        const { error: error2 } = await supabase2.from("estoque").update({ anuncio_ml_url: null }).eq("id", req.params.id);
        if (error2) throw error2;
        return res.json({ success: true });
      }
      const { error } = await supabase2.from("estoque_anuncios_ml").delete().eq("id", req.params.linkId).eq("estoque_id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover an\xFAncio ML:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/publicar-ml", ANUNCIAR_ML, async (req, res) => {
    try {
      const { config, erro } = montarConfiguracaoPublicacao(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const resultado = await publicarAnuncio(supabase2, conexao.accessToken, req.params.id, config);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao publicar an\xFAncio no Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: extrairMensagemErroMl(error.response?.data) || error.message });
    }
  });
  router.get("/:id/anuncios-ml/:linkId/estatisticas", VER2, async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      await sincronizarEstatisticas(supabase2, conexao.accessToken, [req.params.linkId]);
      const { data, error } = await supabase2.from("estoque_anuncios_ml_estatisticas").select("*").eq("link_id", req.params.linkId).maybeSingle();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
          return res.status(409).json({ success: false, error: "Estat\xEDsticas ainda n\xE3o habilitadas \u2014 rode supabase/migration_043_mercadolivre_publicacao.sql." });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar estat\xEDsticas do an\xFAncio:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  router.post("/:id/anuncios-ml/:linkId/republicar", ANUNCIAR_ML, async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const resultado = await aplicarSincronizacao(supabase2, conexao.accessToken, [req.params.linkId]);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao republicar an\xFAncio no Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: extrairMensagemErroMl(error.response?.data) || error.message });
    }
  });
  router.get("/:id/anuncios-shopee", VER2, async (req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque_anuncios_shopee").select("*").eq("estoque_id", req.params.id).order("criado_em");
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return res.json({ success: true, data: [] });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar an\xFAncios da Shopee da pe\xE7a:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/publicar-shopee", ANUNCIAR_SHOPEE, async (req, res) => {
    try {
      const { config, erro } = montarConfiguracaoPublicacaoShopee(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      const resultado = await publicarAnuncioShopee(supabase2, conexao.accessToken, conexao.shopId, req.params.id, config);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao publicar an\xFAncio na Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  router.get("/:id/anuncios-shopee/:linkId/estatisticas", VER2, async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      await sincronizarEstatisticasShopee(supabase2, conexao.accessToken, conexao.shopId, [req.params.linkId]);
      const { data, error } = await supabase2.from("estoque_anuncios_shopee_estatisticas").select("*").eq("link_id", req.params.linkId).maybeSingle();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") {
          return res.status(409).json({ success: false, error: "Estat\xEDsticas ainda n\xE3o habilitadas \u2014 rode supabase/migration_045_shopee_publicacao.sql." });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar estat\xEDsticas do an\xFAncio na Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  router.post("/:id/anuncios-shopee/:linkId/republicar", ANUNCIAR_SHOPEE, async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      const resultado = await republicarAnuncioShopee(supabase2, conexao.accessToken, conexao.shopId, req.params.linkId);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao republicar an\xFAncio na Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  router.post("/bulk-update-categoria", EDITAR2, async (req, res) => {
    try {
      const ids = req.body?.ids || [];
      const categoria_id = req.body?.categoria_id;
      if (!Array.isArray(ids) || ids.length === 0 || !categoria_id) {
        return res.status(400).json({ success: false, error: "ids e categoria_id s\xE3o obrigat\xF3rios" });
      }
      const { error } = await supabase2.from("estoque").update({ categoria_id }).in("id", ids);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro no bulk-update-categoria de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/bulk-update-quantidade", EDITAR2, async (req, res) => {
    try {
      const ids = req.body?.ids || [];
      const delta = Number(req.body?.delta) || 0;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "ids inv\xE1lidos" });
      }
      const { data: itens, error: fetchError } = await supabase2.from("estoque").select("id, quantidade").in("id", ids);
      if (fetchError) throw fetchError;
      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase2.from("estoque").update({ quantidade: novaQuantidade }).eq("id", item.id);
        if (updateError) throw updateError;
        const erroSync = await sincronizarUnidades(supabase2, item.id, novaQuantidade);
        if (erroSync) return res.status(400).json({ success: false, error: `Pe\xE7a ${item.id}: ${erroSync}` });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro no bulk-update-quantidade de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/estoqueFamilias.ts
import { Router as Router6 } from "express";
var VER3 = exigirPermissao("estoque.ver");
var CRIAR3 = exigirPermissao("estoque.criar");
var EDITAR3 = exigirPermissao("estoque.editar");
var DELETAR2 = exigirPermissao("estoque.deletar");
function montarPayloadFamilia(body) {
  const payload = {};
  if (body?.nome !== void 0) payload.nome = String(body.nome).trim();
  if (body?.categoria_id !== void 0) payload.categoria_id = body.categoria_id || null;
  if (body?.descricao !== void 0) payload.descricao = body.descricao ? String(body.descricao).trim() || null : null;
  if (body?.imagem_url !== void 0) payload.imagem_url = body.imagem_url || null;
  return payload;
}
function estoqueFamiliasRouter(supabase2) {
  const router = Router6();
  router.get("/", VER3, async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("estoque_familias").select("*").order("nome");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar fam\xEDlias de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", CRIAR3, async (req, res) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (!payload.nome) return res.status(400).json({ success: false, error: "Nome da fam\xEDlia \xE9 obrigat\xF3rio" });
      const { data, error } = await supabase2.from("estoque_familias").insert([payload]).select("*").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar fam\xEDlia de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const atualizarFamilia = async (req, res) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (payload.nome !== void 0 && !payload.nome) {
        return res.status(400).json({ success: false, error: "Nome da fam\xEDlia \xE9 obrigat\xF3rio" });
      }
      const { data, error } = await supabase2.from("estoque_familias").update(payload).eq("id", req.params.id).select("*").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar fam\xEDlia de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  router.put("/:id", EDITAR3, atualizarFamilia);
  router.patch("/:id", EDITAR3, atualizarFamilia);
  router.delete("/:id", DELETAR2, async (req, res) => {
    try {
      const { data: fichas, error: erroFichas } = await supabase2.from("estoque").select("id").eq("familia_id", req.params.id);
      if (erroFichas) throw erroFichas;
      const idsFichas = (fichas ?? []).map((f) => f.id);
      if (idsFichas.length > 0) {
        const { count, error: erroVendidas } = await supabase2.from("estoque_unidades").select("id", { count: "exact", head: true }).in("estoque_id", idsFichas).not("vendida_em", "is", null);
        if (erroVendidas && erroVendidas.code !== "42P01" && erroVendidas.code !== "PGRST205") {
          throw erroVendidas;
        }
        if (!erroVendidas && (count ?? 0) > 0) {
          return res.status(409).json({
            success: false,
            error: "Esta fam\xEDlia tem unidade(s) j\xE1 vendida(s) \u2014 desvincule as pe\xE7as em vez de excluir, pra preservar o hist\xF3rico de venda."
          });
        }
      }
      const { error } = await supabase2.from("estoque_familias").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir fam\xEDlia de estoque:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/gavetas.ts
import { Router as Router7 } from "express";
var SELECT_GAVETA = "*, categoria:categorias(id, nome)";
function gavetasRouter(supabase2) {
  const router = Router7();
  const VER4 = exigirPermissao("estoque.ver");
  const CRIAR4 = exigirPermissao("estoque.criar");
  const EDITAR4 = exigirPermissao("estoque.editar");
  const DELETAR3 = exigirPermissao("estoque.deletar");
  router.get("/", VER4, async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("gavetas").select(SELECT_GAVETA).order("nome");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e) {
      console.error("Erro ao listar gavetas:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
  router.post("/", CRIAR4, async (req, res) => {
    try {
      const nome = String(req.body?.nome ?? "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
      const payload = {
        nome,
        categoria_id: req.body?.categoria_id || null,
        icone: req.body?.icone ? String(req.body.icone) : null
      };
      const { data, error } = await supabase2.from("gavetas").insert(payload).select(SELECT_GAVETA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (e) {
      console.error("Erro ao criar gaveta:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
  router.patch("/:id", EDITAR4, async (req, res) => {
    try {
      const payload = {};
      if (req.body?.nome !== void 0) {
        const nome = String(req.body.nome ?? "").trim();
        if (!nome) return res.status(400).json({ success: false, error: "Nome n\xE3o pode ficar vazio" });
        payload.nome = nome;
      }
      if (req.body?.categoria_id !== void 0) payload.categoria_id = req.body.categoria_id || null;
      if (req.body?.icone !== void 0) payload.icone = req.body.icone ? String(req.body.icone) : null;
      const { data, error } = await supabase2.from("gavetas").update(payload).eq("id", req.params.id).select(SELECT_GAVETA).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Gaveta n\xE3o encontrada" });
      res.json({ success: true, data });
    } catch (e) {
      console.error("Erro ao atualizar gaveta:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
  router.delete("/:id", DELETAR3, async (req, res) => {
    try {
      const { error: erroSolta } = await supabase2.from("estoque").update({ gaveta_id: null }).eq("gaveta_id", req.params.id);
      if (erroSolta) throw erroSolta;
      const { error } = await supabase2.from("gavetas").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error("Erro ao excluir gaveta:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });
  return router;
}

// src/server/routes/promocoes.ts
import { Router as Router8 } from "express";
var ESCOPOS = ["peca", "modelo_moto", "categoria", "global"];
var TIPOS_DESCONTO = ["percentual", "valor_fixo"];
function parseData(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}
function promocoesRouter(supabase2) {
  const router = Router8();
  router.get("/", exigirPermissao("configuracoes.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("promocoes").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar promo\xE7\xF5es:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("configuracoes.gerenciar_promocoes"), async (req, res) => {
    try {
      const escopo = String(req.body?.escopo || "");
      if (!ESCOPOS.includes(escopo)) {
        return res.status(400).json({ success: false, error: "Escopo inv\xE1lido" });
      }
      const tipo_desconto = String(req.body?.tipo_desconto || "");
      if (!TIPOS_DESCONTO.includes(tipo_desconto)) {
        return res.status(400).json({ success: false, error: "Tipo de desconto inv\xE1lido" });
      }
      const valor = Number(req.body?.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(400).json({ success: false, error: "O valor do desconto precisa ser maior que zero" });
      }
      if (tipo_desconto === "percentual" && valor > 100) {
        return res.status(400).json({ success: false, error: "Desconto percentual n\xE3o pode passar de 100%" });
      }
      const alvo_id = escopo === "global" ? null : req.body?.alvo_id || null;
      if (escopo !== "global" && !alvo_id) {
        return res.status(400).json({ success: false, error: "Selecione o alvo da promo\xE7\xE3o" });
      }
      const data_inicio = parseData(req.body?.data_inicio) ?? (/* @__PURE__ */ new Date()).toISOString();
      const data_fim = parseData(req.body?.data_fim);
      if (data_fim && data_fim <= data_inicio) {
        return res.status(400).json({ success: false, error: "A data de t\xE9rmino precisa ser depois do in\xEDcio" });
      }
      const payload = {
        escopo,
        alvo_id,
        tipo_desconto,
        valor,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        data_inicio,
        data_fim,
        ativo: true
      };
      const { data, error } = await supabase2.from("promocoes").insert([payload]).select("*").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar promo\xE7\xE3o:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("configuracoes.gerenciar_promocoes"), async (req, res) => {
    try {
      const atualizacao = {};
      if (req.body?.ativo !== void 0) atualizacao.ativo = Boolean(req.body.ativo);
      if (req.body?.descricao !== void 0) atualizacao.descricao = req.body.descricao ? String(req.body.descricao).trim() : null;
      if (req.body?.valor !== void 0) {
        const valor = Number(req.body.valor);
        if (!Number.isFinite(valor) || valor <= 0) {
          return res.status(400).json({ success: false, error: "O valor do desconto precisa ser maior que zero" });
        }
        atualizacao.valor = valor;
      }
      if (req.body?.data_fim !== void 0) {
        atualizacao.data_fim = req.body.data_fim ? parseData(req.body.data_fim) : null;
      }
      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: "Nada para atualizar" });
      }
      const { data, error } = await supabase2.from("promocoes").update(atualizacao).eq("id", req.params.id).select("*").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar promo\xE7\xE3o:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("configuracoes.gerenciar_promocoes"), async (req, res) => {
    try {
      const { error } = await supabase2.from("promocoes").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir promo\xE7\xE3o:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/vendas.ts
import { Router as Router9 } from "express";
var SELECT_COM_JOIN = "*, modelo_moto:modelos_moto(id, nome, ano), forma_pagamento:formas_pagamento(id, nome, natureza), cliente:clientes(id, nome, telefone), unidade:estoque_unidades(id, sku, nome, avaria, avaria_descricao, descricao, fotos, valor, condicao_nota)";
var SELECT_COMPROVANTE = "*, autor:usuarios!comprovantes_pix_criado_por_fkey(id, nome_exibicao)";
function vendasRouter(supabase2) {
  const router = Router9();
  router.get("/", exigirPermissao("vendas.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("vendas").select(SELECT_COM_JOIN).order("data", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar vendas:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("vendas.criar"), async (req, res) => {
    try {
      const { estoque_id, quantidade, valor_unitario, forma_pagamento_id, modelo_moto_id, cliente_nome, cliente_id, observacoes, data, componente, unidade_id } = req.body || {};
      if (!estoque_id) return res.status(400).json({ success: false, error: "estoque_id \xE9 obrigat\xF3rio" });
      if (!quantidade || Number(quantidade) <= 0) return res.status(400).json({ success: false, error: "Quantidade inv\xE1lida" });
      if (valor_unitario === void 0 || Number(valor_unitario) < 0) {
        return res.status(400).json({ success: false, error: "Valor unit\xE1rio inv\xE1lido" });
      }
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: "Forma de pagamento \xE9 obrigat\xF3ria" });
      if (cliente_id) {
        const { data: cli } = await supabase2.from("clientes").select("banido").eq("id", cliente_id).maybeSingle();
        if (cli?.banido) return res.status(400).json({ success: false, error: "Este cliente est\xE1 banido e n\xE3o pode receber novas vendas" });
      }
      const { data: venda, error } = await supabase2.rpc("registrar_venda", {
        p_estoque_id: estoque_id,
        p_quantidade: Number(quantidade),
        p_valor_unitario: Number(valor_unitario),
        p_forma_pagamento_id: forma_pagamento_id,
        p_modelo_moto_id: modelo_moto_id || null,
        p_cliente_nome: cliente_nome || null,
        p_observacoes: observacoes || null,
        p_data: data || null,
        // Nome de uma parte cadastrada em estoque.componentes — quando
        // informado, dá baixa só nela (ver comentário em registrar_venda).
        p_componente: componente || null,
        p_cliente_id: cliente_id || null,
        p_unidade_id: unidade_id || null,
        p_nome_item: null,
        // Seleciona a assinatura vigente de 13 parâmetros sem alterar o valor da venda.
        p_valor_recebido: null
      });
      if (error) throw error;
      void avisarAnunciosDesatualizados(supabase2, [estoque_id]);
      res.json({ success: true, data: venda });
    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("vendas.editar"), async (req, res) => {
    try {
      const payload = {};
      for (const campo of ["forma_pagamento_id", "observacoes", "cliente_nome", "cliente_id"]) {
        if (req.body[campo] !== void 0) payload[campo] = req.body[campo];
      }
      const { data, error } = await supabase2.from("vendas").update(payload).eq("id", req.params.id).select(SELECT_COM_JOIN).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("vendas.cancelar"), async (req, res) => {
    try {
      const { error } = await supabase2.rpc("cancelar_venda", { p_venda_id: req.params.id });
      if (error) {
        if (error.code === "23503") {
          return res.status(409).json({ success: false, error: "N\xE3o \xE9 poss\xEDvel cancelar: j\xE1 h\xE1 recebimento(s) de fiado registrados pra esta venda." });
        }
        throw error;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao cancelar venda:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/fiado-completo", exigirPermissao("vendas.cancelar_fiado"), async (req, res) => {
    try {
      const { error } = await supabase2.rpc("cancelar_venda_fiado_completa", { p_venda_id: req.params.id });
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao cancelar venda fiado em cascata:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.get("/:id/comprovantes", exigirPermissao("vendas.ver"), async (req, res) => {
    try {
      const { data, error } = await supabase2.from("comprovantes_pix").select(SELECT_COMPROVANTE).eq("venda_id", req.params.id).is("removido_em", null).order("criado_em", { ascending: false });
      if (error) throw error;
      const comUrl = await Promise.all(
        (data ?? []).map(async (c) => ({ ...c, url: await gerarUrlAssinadaComprovante(c.storage_path) }))
      );
      res.json({ success: true, data: comUrl });
    } catch (error) {
      console.error("Erro ao listar comprovantes da venda:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/comprovantes", exigirPermissao("vendas.editar"), async (req, res) => {
    try {
      const { storage_path, nome_arquivo, tipo_mime, tamanho_bytes } = req.body || {};
      if (!storage_path || !nome_arquivo || !tipo_mime || !tamanho_bytes) {
        return res.status(400).json({ success: false, error: "Dados do arquivo incompletos" });
      }
      const { data: venda, error: erroVenda } = await supabase2.from("vendas").select("cliente_id").eq("id", req.params.id).maybeSingle();
      if (erroVenda) throw erroVenda;
      if (!venda) return res.status(404).json({ success: false, error: "Venda n\xE3o encontrada" });
      const { data, error } = await supabase2.from("comprovantes_pix").insert({
        venda_id: req.params.id,
        cliente_id: venda.cliente_id,
        storage_path,
        nome_arquivo,
        tipo_mime,
        tamanho_bytes,
        criado_por: req.usuario.id
      }).select(SELECT_COMPROVANTE).single();
      if (error) throw error;
      res.json({ success: true, data: { ...data, url: await gerarUrlAssinadaComprovante(data.storage_path) } });
    } catch (error) {
      console.error("Erro ao anexar comprovante na venda:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/comprovantes/:comprovanteId", exigirPermissao("vendas.excluir_comprovante"), async (req, res) => {
    try {
      const { error } = await supabase2.from("comprovantes_pix").update({ removido_em: (/* @__PURE__ */ new Date()).toISOString(), removido_por: req.usuario.id }).eq("id", req.params.comprovanteId).eq("venda_id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover comprovante da venda:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/orcamentos.ts
import { Router as Router10 } from "express";
var SELECT_COM_ITENS = "*, itens:orcamento_itens(*), cliente:clientes(id, nome, telefone)";
var CAMPOS_HEADER_EDITAVEIS = ["cliente_nome", "cliente_telefone", "cliente_id", "desconto_tipo", "desconto_valor", "observacoes", "validade"];
function montarParamsRegistrarVenda(item, params) {
  const componenteFinal = params.componente ?? item.componente ?? null;
  return {
    p_estoque_id: item.estoque_id ?? null,
    p_quantidade: componenteFinal ? 1 : item.quantidade,
    p_valor_unitario: item.valor_unitario,
    p_forma_pagamento_id: params.forma_pagamento_id,
    p_modelo_moto_id: null,
    p_cliente_nome: params.cliente_nome,
    p_observacoes: null,
    p_data: params.data || null,
    p_componente: componenteFinal,
    p_cliente_id: params.cliente_id ?? null,
    p_nome_item: item.estoque_id ? null : item.nome_item,
    // Desambigua a assinatura vigente de 13 parâmetros; null mantém o preço cheio.
    p_valor_recebido: null
  };
}
function orcamentosRouter(supabase2) {
  const router = Router10();
  const buscarOrcamento = async (id) => {
    const { data, error } = await supabase2.from("orcamentos").select(SELECT_COM_ITENS).eq("id", id).single();
    if (error) throw error;
    return data;
  };
  const recalcularStatus = async (orcamentoId) => {
    const { data: orcamento, error: e1 } = await supabase2.from("orcamentos").select("status").eq("id", orcamentoId).single();
    if (e1) throw e1;
    if (orcamento.status !== "aberto") return;
    const { count, error: e2 } = await supabase2.from("orcamento_itens").select("id", { count: "exact", head: true }).eq("orcamento_id", orcamentoId).is("venda_id", null);
    if (e2) throw e2;
    if (count === 0) {
      const { error: e3 } = await supabase2.from("orcamentos").update({ status: "convertido" }).eq("id", orcamentoId);
      if (e3) throw e3;
    }
  };
  const venderLinha = async (item, params) => {
    const paramsRpc = montarParamsRegistrarVenda(item, params);
    const { data: venda, error } = await supabase2.rpc("registrar_venda", paramsRpc);
    if (error) throw error;
    const { error: linkError } = await supabase2.from("vendas").update({ orcamento_item_id: item.id }).eq("id", venda.id);
    if (linkError) throw linkError;
    if (paramsRpc.p_componente === (item.componente ?? null)) {
      const { error: fecharError } = await supabase2.from("orcamento_itens").update({ venda_id: venda.id }).eq("id", item.id);
      if (fecharError) throw fecharError;
    }
    return venda;
  };
  router.get("/", exigirPermissao("orcamentos.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("orcamentos").select(SELECT_COM_ITENS).order("criado_em", { ascending: false }).order("criado_em", { foreignTable: "orcamento_itens", ascending: true });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar or\xE7amentos:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("orcamentos.criar"), async (req, res) => {
    try {
      const { cliente_nome, cliente_telefone, cliente_id, desconto_tipo, desconto_valor, observacoes, validade, itens } = req.body || {};
      if (!cliente_nome || !String(cliente_nome).trim()) return res.status(400).json({ success: false, error: "Nome do cliente \xE9 obrigat\xF3rio" });
      if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ success: false, error: "Adicione ao menos um item ao or\xE7amento" });
      if (cliente_id) {
        const { data: cli } = await supabase2.from("clientes").select("banido").eq("id", cliente_id).maybeSingle();
        if (cli?.banido) return res.status(400).json({ success: false, error: "Este cliente est\xE1 banido e n\xE3o pode receber novos or\xE7amentos" });
      }
      const { data: orcamento, error: e1 } = await supabase2.from("orcamentos").insert({
        cliente_nome,
        cliente_telefone: cliente_telefone || null,
        cliente_id: cliente_id || null,
        desconto_tipo: desconto_tipo || null,
        desconto_valor: Number(desconto_valor) || 0,
        observacoes: observacoes || null,
        validade: validade || null
      }).select().single();
      if (e1) throw e1;
      const linhas = itens.map((i) => ({
        orcamento_id: orcamento.id,
        estoque_id: i.estoque_id || null,
        nome_item: i.nome_item,
        componentes_disponiveis: i.componentes_disponiveis || null,
        componente: i.componente || null,
        quantidade: Number(i.quantidade) || 1,
        valor_unitario: Number(i.valor_unitario) || 0
      }));
      const { error: e2 } = await supabase2.from("orcamento_itens").insert(linhas);
      if (e2) throw e2;
      const data = await buscarOrcamento(orcamento.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar or\xE7amento:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("orcamentos.editar"), async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase2.from("orcamentos").select("status").eq("id", req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== "aberto") return res.status(400).json({ success: false, error: "S\xF3 \xE9 poss\xEDvel editar or\xE7amentos em aberto" });
      const payload = {};
      for (const campo of CAMPOS_HEADER_EDITAVEIS) {
        if (req.body[campo] !== void 0) payload[campo] = req.body[campo];
      }
      const { error: e2 } = await supabase2.from("orcamentos").update(payload).eq("id", req.params.id);
      if (e2) throw e2;
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar or\xE7amento:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/cancelar", exigirPermissao("orcamentos.cancelar"), async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase2.from("orcamentos").select("status").eq("id", req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== "aberto") return res.status(400).json({ success: false, error: "S\xF3 \xE9 poss\xEDvel cancelar or\xE7amentos em aberto" });
      const { error: e2 } = await supabase2.from("orcamentos").update({ status: "cancelado", cancelado_em: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", req.params.id);
      if (e2) throw e2;
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao cancelar or\xE7amento:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("orcamentos.excluir"), async (req, res) => {
    try {
      const { error } = await supabase2.from("orcamentos").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir or\xE7amento:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/itens", exigirPermissao("orcamentos.editar"), async (req, res) => {
    try {
      const { data: atual, error: e1 } = await supabase2.from("orcamentos").select("status").eq("id", req.params.id).single();
      if (e1) throw e1;
      if (atual.status !== "aberto") return res.status(400).json({ success: false, error: "S\xF3 \xE9 poss\xEDvel adicionar itens a or\xE7amentos em aberto" });
      const { estoque_id, nome_item, componentes_disponiveis, componente, quantidade, valor_unitario } = req.body || {};
      if (!nome_item) return res.status(400).json({ success: false, error: "nome_item \xE9 obrigat\xF3rio" });
      const { error: e2 } = await supabase2.from("orcamento_itens").insert({
        orcamento_id: req.params.id,
        estoque_id: estoque_id || null,
        nome_item,
        componentes_disponiveis: componentes_disponiveis || null,
        componente: componente || null,
        quantidade: Number(quantidade) || 1,
        valor_unitario: Number(valor_unitario) || 0
      });
      if (e2) throw e2;
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao adicionar item ao or\xE7amento:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/itens/:itemId", exigirPermissao("orcamentos.editar"), async (req, res) => {
    try {
      const { data: item, error: e1 } = await supabase2.from("orcamento_itens").select("venda_id").eq("id", req.params.itemId).eq("orcamento_id", req.params.id).single();
      if (e1) throw e1;
      if (item.venda_id) return res.status(400).json({ success: false, error: "Esta linha j\xE1 foi vendida, n\xE3o pode ser editada" });
      const payload = {};
      if (req.body.valor_unitario !== void 0) payload.valor_unitario = Number(req.body.valor_unitario) || 0;
      if (req.body.quantidade !== void 0) payload.quantidade = Number(req.body.quantidade) || 1;
      const { error: e2 } = await supabase2.from("orcamento_itens").update(payload).eq("id", req.params.itemId);
      if (e2) throw e2;
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar item do or\xE7amento:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/itens/:itemId", exigirPermissao("orcamentos.editar"), async (req, res) => {
    try {
      const { data: item, error: e1 } = await supabase2.from("orcamento_itens").select("venda_id").eq("id", req.params.itemId).eq("orcamento_id", req.params.id).single();
      if (e1) throw e1;
      if (item.venda_id) return res.status(400).json({ success: false, error: "Esta linha j\xE1 foi vendida, n\xE3o pode ser removida" });
      const { error: e2 } = await supabase2.from("orcamento_itens").delete().eq("id", req.params.itemId);
      if (e2) throw e2;
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao remover item do or\xE7amento:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/itens/:itemId/vender", exigirPermissao("orcamentos.vender"), async (req, res) => {
    try {
      const { forma_pagamento_id, componente, data: dataVenda } = req.body || {};
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: "Forma de pagamento \xE9 obrigat\xF3ria" });
      const { data: orcamento, error: e1 } = await supabase2.from("orcamentos").select("status, cliente_nome, cliente_id").eq("id", req.params.id).single();
      if (e1) throw e1;
      if (orcamento.status !== "aberto") return res.status(400).json({ success: false, error: "Este or\xE7amento n\xE3o est\xE1 mais em aberto" });
      if (orcamento.cliente_id) {
        const { data: cli } = await supabase2.from("clientes").select("banido").eq("id", orcamento.cliente_id).maybeSingle();
        if (cli?.banido) return res.status(400).json({ success: false, error: "Este cliente est\xE1 banido e n\xE3o pode receber vendas" });
      }
      const { data: item, error: e2 } = await supabase2.from("orcamento_itens").select("*").eq("id", req.params.itemId).eq("orcamento_id", req.params.id).single();
      if (e2) throw e2;
      if (item.venda_id) return res.status(400).json({ success: false, error: "Esta linha j\xE1 foi vendida" });
      const venda = await venderLinha(item, { forma_pagamento_id, componente, data: dataVenda, cliente_nome: orcamento.cliente_nome, cliente_id: orcamento.cliente_id });
      if (item.estoque_id) void avisarAnunciosDesatualizados(supabase2, [item.estoque_id]);
      await recalcularStatus(req.params.id);
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data: { venda, orcamento: data } });
    } catch (error) {
      console.error("Erro ao vender item do or\xE7amento:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/vender-tudo", exigirPermissao("orcamentos.vender"), async (req, res) => {
    try {
      const { forma_pagamento_id, data: dataVenda } = req.body || {};
      if (!forma_pagamento_id) return res.status(400).json({ success: false, error: "Forma de pagamento \xE9 obrigat\xF3ria" });
      const { data: orcamento, error: e1 } = await supabase2.from("orcamentos").select("status, cliente_nome, cliente_id").eq("id", req.params.id).single();
      if (e1) throw e1;
      if (orcamento.status !== "aberto") return res.status(400).json({ success: false, error: "Este or\xE7amento n\xE3o est\xE1 mais em aberto" });
      if (orcamento.cliente_id) {
        const { data: cli } = await supabase2.from("clientes").select("banido").eq("id", orcamento.cliente_id).maybeSingle();
        if (cli?.banido) return res.status(400).json({ success: false, error: "Este cliente est\xE1 banido e n\xE3o pode receber vendas" });
      }
      const { data: pendentes, error: e2 } = await supabase2.from("orcamento_itens").select("*").eq("orcamento_id", req.params.id).is("venda_id", null);
      if (e2) throw e2;
      const sucesso = [];
      const falhas = [];
      const estoqueIdsVendidos = [];
      for (const item of pendentes || []) {
        try {
          await venderLinha(item, { forma_pagamento_id, data: dataVenda, cliente_nome: orcamento.cliente_nome, cliente_id: orcamento.cliente_id });
          sucesso.push(item.id);
          if (item.estoque_id) estoqueIdsVendidos.push(item.estoque_id);
        } catch (err) {
          falhas.push({ itemId: item.id, error: err.message });
        }
      }
      void avisarAnunciosDesatualizados(supabase2, estoqueIdsVendidos);
      await recalcularStatus(req.params.id);
      const data = await buscarOrcamento(req.params.id);
      res.json({ success: true, data: { sucesso, falhas, orcamento: data } });
    } catch (error) {
      console.error("Erro ao vender or\xE7amento:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/clientes.ts
import { Router as Router12 } from "express";

// src/server/routes/clientes/clientesOperacao.ts
import { Router as Router11 } from "express";

// src/server/routes/clientes/clientesValidacao.ts
var ORIGENS_CLIENTE = ["whatsapp", "facebook", "mercado_livre", "instagram", "indicacao", "balcao"];
var ORIGENS_CLIENTE_LEGADAS = ["redes_sociais", "outro"];
var PREFERENCIAS_CONTATO_OPERACIONAIS = ["whatsapp", "instagram"];
var UFS = /* @__PURE__ */ new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function objeto(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function texto(value, limite) {
  return typeof value === "string" ? value.trim().slice(0, limite) : "";
}
function textoOuNulo(value, limite) {
  return texto(value, limite) || null;
}
function uuidOuNulo(value) {
  const valueString = texto(value, 60);
  return UUID2.test(valueString) ? valueString : null;
}
function normalizarTelefone(value) {
  if (value === null || value === void 0 || value === "") return null;
  const digitos = String(value).replace(/\D/g, "").slice(0, 11);
  return digitos.length === 10 || digitos.length === 11 ? digitos : null;
}
function normalizarInstagram(value) {
  if (value === null || value === void 0) return null;
  const handle = String(value).trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  return handle;
}
function validarContatoObrigatorio(input) {
  const dados = objeto(input);
  const telefone = normalizarTelefone(dados.telefone);
  const instagram = normalizarInstagram(dados.instagram_usuario);
  const telefoneInformado = texto(dados.telefone, 40).length > 0;
  const instagramInformado = texto(dados.instagram_usuario, 80).length > 0;
  const preferencia = texto(dados.preferencia_contato, 30);
  const erros = [];
  if (telefoneInformado && !telefone) erros.push("WhatsApp inv\xE1lido");
  if (instagramInformado && !instagram) erros.push("Instagram inv\xE1lido");
  if (!telefone && !instagram) erros.push("Informe WhatsApp ou Instagram");
  if (!PREFERENCIAS_CONTATO_OPERACIONAIS.includes(preferencia)) {
    erros.push("Escolha WhatsApp ou Instagram como contato");
  } else if (preferencia === "whatsapp" && !telefone) {
    erros.push("Informe o WhatsApp escolhido como contato");
  } else if (preferencia === "instagram" && !instagram) {
    erros.push("Informe o Instagram escolhido como contato");
  }
  return Array.from(new Set(erros));
}
function validarClienteInput(input) {
  const dados = objeto(input);
  const erros = validarContatoObrigatorio(dados);
  const nome = texto(dados.nome, 160);
  const cidade = texto(dados.cidade, 120);
  const estado = texto(dados.estado, 2).toUpperCase();
  const origem = texto(dados.origem, 40);
  const preferencia = texto(dados.preferencia_contato, 30);
  const id = uuidOuNulo(dados.id);
  if (nome.length < 2) erros.push("Nome deve ter pelo menos 2 caracteres");
  if (!cidade) erros.push("Cidade \xE9 obrigat\xF3ria");
  if (!estado) erros.push("Estado \xE9 obrigat\xF3rio");
  else if (!UFS.has(estado)) erros.push("Estado inv\xE1lido");
  const origemNovaValida = ORIGENS_CLIENTE.includes(origem);
  const origemLegadaPreservada = Boolean(id) && ORIGENS_CLIENTE_LEGADAS.includes(origem);
  if (!origemNovaValida && !origemLegadaPreservada) erros.push("Origem inv\xE1lida");
  if (dados.id !== void 0 && !id) erros.push("Cliente inv\xE1lido");
  if (erros.length > 0) return { ok: false, erros: Array.from(new Set(erros)) };
  const tags = Array.isArray(dados.tags) ? Array.from(new Set(dados.tags.map((tag) => texto(tag, 40).toLowerCase()).filter(Boolean))).slice(0, 20) : [];
  return {
    ok: true,
    valor: {
      ...id ? { id } : {},
      nome,
      telefone: normalizarTelefone(dados.telefone),
      instagram_usuario: normalizarInstagram(dados.instagram_usuario),
      documento: texto(dados.documento, 30).replace(/\D/g, "") || null,
      data_nascimento: textoOuNulo(dados.data_nascimento, 10),
      origem,
      preferencia_contato: preferencia,
      tags,
      observacoes: textoOuNulo(dados.observacoes, 2e3),
      cidade,
      estado,
      cep: texto(dados.cep, 12).replace(/\D/g, "") || null,
      logradouro: textoOuNulo(dados.logradouro, 180),
      numero: textoOuNulo(dados.numero, 30),
      complemento: textoOuNulo(dados.complemento, 120),
      bairro: textoOuNulo(dados.bairro, 120)
    }
  };
}
function validarPedidoInput(input) {
  const dados = objeto(input);
  const erros = [];
  const descricao = texto(dados.descricao, 500);
  const clienteMotoId = uuidOuNulo(dados.cliente_moto_id);
  const modeloMotoId = uuidOuNulo(dados.modelo_moto_id);
  const motoTexto = textoOuNulo(dados.moto_modelo_texto, 160);
  const categoriaId = uuidOuNulo(dados.categoria_id);
  const responsavelId = uuidOuNulo(dados.responsavel_id);
  const idempotencyKey = texto(dados.idempotency_key, 120);
  const prometidoPara = textoOuNulo(dados.prometido_para, 40);
  if (!descricao) erros.push("Descri\xE7\xE3o da pe\xE7a \xE9 obrigat\xF3ria");
  if (!clienteMotoId && !modeloMotoId && !motoTexto) erros.push("Informe a moto do pedido");
  if (!responsavelId) erros.push("Respons\xE1vel \xE9 obrigat\xF3rio");
  if (!idempotencyKey || idempotencyKey.length < 8) erros.push("Chave de idempot\xEAncia \xE9 obrigat\xF3ria");
  if (dados.cliente_moto_id !== void 0 && texto(dados.cliente_moto_id, 60) && !clienteMotoId) erros.push("Moto do cliente inv\xE1lida");
  if (dados.modelo_moto_id !== void 0 && texto(dados.modelo_moto_id, 60) && !modeloMotoId) erros.push("Modelo de moto inv\xE1lido");
  if (dados.categoria_id !== void 0 && texto(dados.categoria_id, 60) && !categoriaId) erros.push("Categoria inv\xE1lida");
  if (prometidoPara && !Number.isFinite(Date.parse(prometidoPara))) erros.push("Data combinada inv\xE1lida");
  if (erros.length > 0 || !responsavelId) return { ok: false, erros: Array.from(new Set(erros)) };
  return {
    ok: true,
    valor: {
      descricao,
      cliente_moto_id: clienteMotoId,
      modelo_moto_id: modeloMotoId,
      moto_modelo_texto: motoTexto,
      categoria_id: categoriaId,
      ano_compatibilidade: textoOuNulo(dados.ano_compatibilidade, 20),
      observacoes: textoOuNulo(dados.observacoes, 2e3),
      responsavel_id: responsavelId,
      prometido_para: prometidoPara,
      idempotency_key: idempotencyKey
    }
  };
}

// src/server/routes/clientes/clientesOperacao.ts
var ERROS_CAPABILITY_AUSENTE = /* @__PURE__ */ new Set(["42P01", "42703", "PGRST204", "PGRST205"]);
var STATUS_ATIVOS = ["nova", "em_busca", "peca_disponivel", "aguardando_cliente", "aguardando"];
var STATUS_PEDIDO = /* @__PURE__ */ new Set([
  ...STATUS_ATIVOS,
  "vendida",
  "nao_encontrada",
  "cliente_desistiu",
  "cancelada",
  "atendida"
]);
var ACOES_PEDIDO = /* @__PURE__ */ new Set([
  "iniciar_busca",
  "cliente_avisado",
  "cliente_desistiu",
  "aguardando_resposta",
  "vai_buscar",
  "nao_quer_mais",
  "marcar_nao_encontrada",
  "cancelar",
  "reabrir"
]);
var UUID3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function objeto2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stringLimitada(value, limite) {
  return typeof value === "string" ? value.trim().slice(0, limite) : "";
}
function erroCodigo(error) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code ?? "") : null;
}
function erroCapabilityAusente(error) {
  const codigo = erroCodigo(error);
  if (codigo !== null) return ERROS_CAPABILITY_AUSENTE.has(codigo);
  const registro = objeto2(error);
  return Object.keys(registro).length === 1 && registro.message === "";
}
function registrarErro(contexto, error) {
  console.error(contexto, { code: erroCodigo(error) ?? "UNKNOWN" });
}
function cursorCodificar(row) {
  return Buffer.from(JSON.stringify({ criado_em: row.criado_em, id: row.id }), "utf8").toString("base64url");
}
function cursorDecodificar(raw) {
  const texto2 = stringLimitada(raw, 500);
  if (!texto2) return null;
  try {
    const value = JSON.parse(Buffer.from(texto2, "base64url").toString("utf8"));
    const parsed = objeto2(value);
    const criadoEm = stringLimitada(parsed.criado_em, 40);
    const id = stringLimitada(parsed.id, 60);
    if (!criadoEm || !Number.isFinite(Date.parse(criadoEm)) || !UUID3.test(id)) return null;
    return { criado_em: criadoEm, id };
  } catch {
    return null;
  }
}
function limparBuscaAproximada(value) {
  return stringLimitada(value, 120).replace(/[%_,()."']/g, " ").replace(/\s+/g, " ").trim();
}
function payloadMoto(input) {
  const moto = objeto2(input);
  const permitido = {};
  for (const campo of ["modelo_moto_id", "modelo_texto", "placa", "chassi", "ano", "cor", "observacoes"]) {
    const valor = stringLimitada(moto[campo], campo === "observacoes" ? 1e3 : 160);
    if (valor) permitido[campo] = valor;
  }
  return Object.keys(permitido).length > 0 ? permitido : void 0;
}
function respostaValidacao(res, erros) {
  return res.status(400).json({ success: false, error: erros.join(". "), details: erros });
}
function clientesOperacaoRouter(supabase2) {
  const router = Router11();
  const VER4 = exigirPermissao("clientes.ver");
  const EDITAR4 = exigirPermissao("clientes.editar");
  const ADMINISTRAR = exigirPermissao("clientes.administrar");
  const CRIAR_OU_EDITAR2 = exigirAlguma("clientes.criar", "clientes.editar");
  router.get("/resumo", VER4, async (_req, res) => {
    try {
      const consultas = await Promise.all([
        supabase2.from("clientes").select("id", { count: "exact", head: true }),
        supabase2.from("pecas_procuradas").select("id, cliente_id, status, criado_em, prometido_para, proxima_acao_em, responsavel_id").in("status", STATUS_ATIVOS),
        supabase2.from("clientes_eventos").select("tipo", { count: "exact", head: true }).in("tipo", ["duplicidade_sugerida", "duplicidade_reutilizada", "duplicidade_confirmada_separada"]),
        supabase2.from("tarefas").select("id", { count: "exact", head: true }).in("visita_status", ["agendada", "confirmada", "reagendada"]).lt("prazo", (/* @__PURE__ */ new Date()).toISOString()),
        supabase2.from("estoque_reservas").select("id", { count: "exact", head: true }).not("decisao_pendente_em", "is", null),
        supabase2.from("pecas_procuradas_matches").select("id", { count: "exact", head: true })
      ]);
      const [clientes, pedidosRaw, duplicidadesRaw, visitasRaw, reservasRaw, matchesRaw] = consultas;
      if (clientes.error) throw clientes.error;
      const pedidos = pedidosRaw.error ? erroCapabilityAusente(pedidosRaw.error) ? { disponivel: false, data: [] } : (() => {
        throw pedidosRaw.error;
      })() : { disponivel: true, data: pedidosRaw.data ?? [] };
      const duplicidades = duplicidadesRaw.error ? erroCapabilityAusente(duplicidadesRaw.error) ? { disponivel: false, data: [] } : (() => {
        throw duplicidadesRaw.error;
      })() : { disponivel: true, data: duplicidadesRaw.data ?? [] };
      const visitas = visitasRaw.error ? erroCapabilityAusente(visitasRaw.error) ? { disponivel: false, data: [] } : (() => {
        throw visitasRaw.error;
      })() : { disponivel: true, data: visitasRaw.data ?? [] };
      const reservas = reservasRaw.error ? erroCapabilityAusente(reservasRaw.error) ? { disponivel: false, data: [] } : (() => {
        throw reservasRaw.error;
      })() : { disponivel: true, data: reservasRaw.data ?? [] };
      const matches = matchesRaw.error ? erroCapabilityAusente(matchesRaw.error) ? { disponivel: false, data: [] } : (() => {
        throw matchesRaw.error;
      })() : { disponivel: true, data: matchesRaw.data ?? [] };
      const porStatus = pedidos.data.reduce((acc, pedido) => {
        const status = String(pedido.status ?? "desconhecido");
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});
      const agora = Date.now();
      const porIdade = pedidos.data.reduce(
        (acc, pedido) => {
          const criadaEm = Date.parse(String(pedido.criado_em ?? ""));
          if (!Number.isFinite(criadaEm)) return acc;
          const dias = Math.max(0, Math.floor((agora - criadaEm) / 864e5));
          if (dias <= 2) acc.ate_2_dias += 1;
          else if (dias <= 7) acc.de_3_a_7_dias += 1;
          else acc.mais_de_7_dias += 1;
          return acc;
        },
        { ate_2_dias: 0, de_3_a_7_dias: 0, mais_de_7_dias: 0 }
      );
      const semResposta48h = pedidos.data.filter((pedido) => {
        if (pedido.status !== "aguardando_cliente") return false;
        const proxima = Date.parse(String(pedido.proxima_acao_em ?? ""));
        return Number.isFinite(proxima) && proxima <= agora;
      }).length;
      res.json({
        success: true,
        data: {
          total_clientes: clientes.count ?? 0,
          pedidos_por_status: porStatus,
          pendencias_por_idade: porIdade,
          respostas_acima_48h: semResposta48h,
          reservas_sem_decisao: reservasRaw.count ?? 0,
          visitas_vencidas: visitasRaw.count ?? 0,
          decisoes_duplicidade: duplicidadesRaw.count ?? 0,
          capabilities: {
            base: pedidos.disponivel && duplicidades.disponivel,
            visitas: visitas.disponivel,
            reservas: reservas.disponivel,
            matches: matches.disponivel
          },
          visitas: visitas.data,
          reservas: reservas.data,
          matches: matches.data
        }
      });
    } catch (error) {
      registrarErro("Erro ao carregar resumo operacional de clientes", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel carregar o resumo de clientes" });
    }
  });
  router.get("/clientes", VER4, async (req, res) => {
    try {
      const limite = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const cursor = cursorDecodificar(req.query.cursor);
      if (req.query.cursor && !cursor) return respostaValidacao(res, ["Cursor inv\xE1lido"]);
      const responsavel = stringLimitada(req.query.responsavel, 60);
      const somenteSemPendencias = req.query.semPendencias === "true";
      const relacaoPedidos = responsavel ? "pedidos:pecas_procuradas!inner" : "pedidos:pecas_procuradas";
      const relacaoAtivas = somenteSemPendencias ? ", pedidos_ativas:pecas_procuradas!left(id)" : "";
      let query = supabase2.from("clientes").select(
        `id, nome, telefone, instagram_usuario, preferencia_contato, origem, cidade, estado, ativo, banido, criado_em, atualizado_em, motos:clientes_motos(id, modelo_moto_id, modelo_texto, ano, principal, modelo_moto:modelos_moto(id, nome, ano)), ${relacaoPedidos}(id, descricao, status, responsavel_id, prometido_para, proxima_acao_em, criado_em)` + relacaoAtivas
      ).order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(limite + 1);
      const cidade = stringLimitada(req.query.cidade, 120);
      const origem = stringLimitada(req.query.origem, 40);
      const busca = limparBuscaAproximada(req.query.busca);
      if (cidade) query = query.eq("cidade", cidade);
      if (origem) query = query.eq("origem", origem);
      if (responsavel) query = query.eq("pedidos.responsavel_id", responsavel);
      if (req.query.ativo === "true") query = query.eq("ativo", true);
      if (req.query.ativo === "false") query = query.eq("ativo", false);
      if (busca) query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%,instagram_usuario.ilike.%${busca}%,cidade.ilike.%${busca}%`);
      if (req.query.cadastroIncompleto === "true") {
        query = query.or("and(telefone.is.null,instagram_usuario.is.null),cidade.is.null,estado.is.null,origem.is.null");
      }
      if (somenteSemPendencias) {
        query = query.in("pedidos_ativas.status", STATUS_ATIVOS).is("pedidos_ativas", null);
      }
      if (cursor) query = query.or(`criado_em.lt.${cursor.criado_em},and(criado_em.eq.${cursor.criado_em},id.lt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      const linhas = data ?? [];
      const temMais = linhas.length > limite;
      const itens = linhas.slice(0, limite);
      res.json({
        success: true,
        data: {
          itens,
          proximo_cursor: temMais && itens.length > 0 ? cursorCodificar(itens[itens.length - 1]) : null
        }
      });
    } catch (error) {
      registrarErro("Erro ao listar clientes operacionais", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel listar os clientes" });
    }
  });
  router.get("/clientes/:clienteId", VER4, async (req, res) => {
    if (!UUID3.test(req.params.clienteId)) return respostaValidacao(res, ["Cliente inv\xE1lido"]);
    try {
      const [cliente, eventos] = await Promise.all([
        supabase2.from("clientes").select(
          "*, notas:clientes_notas(*, autor:usuarios(id, nome_exibicao)), motos:clientes_motos(*, modelo_moto:modelos_moto(id, nome, ano)), pecas_procuradas:pecas_procuradas(*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano)), comprovantes_pix:comprovantes_pix(*, venda:vendas(id, nome_item, data))"
        ).eq("id", req.params.clienteId).maybeSingle(),
        supabase2.from("clientes_eventos").select("id, tipo, detalhe, criado_por, criado_em").eq("cliente_id", req.params.clienteId).order("criado_em", { ascending: false })
      ]);
      if (cliente.error) throw cliente.error;
      if (!cliente.data) return res.status(404).json({ success: false, error: "Cliente n\xE3o encontrado" });
      if (eventos.error && !erroCapabilityAusente(eventos.error)) throw eventos.error;
      res.json({ success: true, data: { ...cliente.data, eventos: eventos.data ?? [] } });
    } catch (error) {
      registrarErro("Erro ao buscar cliente operacional", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel carregar o cliente" });
    }
  });
  router.post("/duplicidades", CRIAR_OU_EDITAR2, async (req, res) => {
    try {
      const body = objeto2(req.body);
      const telefone = normalizarTelefone(body.telefone);
      const instagram = normalizarInstagram(body.instagram_usuario);
      const nome = limparBuscaAproximada(body.nome);
      if (!telefone && !instagram && nome.length < 2) return respostaValidacao(res, ["Informe nome, WhatsApp ou Instagram"]);
      const colunas = "id, nome, telefone, instagram_usuario, cidade, estado, ativo";
      const consultas = [];
      if (telefone) consultas.push({ criterio: "whatsapp", promise: supabase2.from("clientes").select(colunas).eq("telefone", telefone).limit(10) });
      if (instagram) consultas.push({ criterio: "instagram", promise: supabase2.from("clientes").select(colunas).ilike("instagram_usuario", instagram).limit(10) });
      if (nome.length >= 2) consultas.push({ criterio: "nome", promise: supabase2.from("clientes").select(colunas).ilike("nome", `%${nome}%`).limit(10) });
      const resultados = await Promise.all(consultas.map(async ({ criterio, promise }) => ({ criterio, resultado: await promise })));
      const candidatos = /* @__PURE__ */ new Map();
      for (const { criterio, resultado } of resultados) {
        if (resultado.error) throw resultado.error;
        for (const raw of resultado.data ?? []) {
          const candidato = objeto2(raw);
          const id = String(candidato.id ?? "");
          if (!id) continue;
          const atual = candidatos.get(id) ?? { ...candidato, criterios: [] };
          if (!atual.criterios.includes(criterio)) atual.criterios.push(criterio);
          candidatos.set(id, atual);
        }
      }
      res.json({ success: true, data: [...candidatos.values()] });
    } catch (error) {
      registrarErro("Erro ao procurar duplicidades de cliente", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel verificar cadastros semelhantes" });
    }
  });
  router.post("/clientes", exigirPermissao("clientes.criar"), async (req, res) => {
    const validacao = validarClienteInput(req.body);
    if (validacao.ok === false) return respostaValidacao(res, validacao.erros);
    try {
      const { data, error } = await supabase2.from("clientes").insert(validacao.valor).select("*").single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao criar cliente operacional", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel cadastrar o cliente" });
    }
  });
  router.patch("/clientes/:clienteId", EDITAR4, async (req, res) => {
    if (!UUID3.test(req.params.clienteId)) return respostaValidacao(res, ["Cliente inv\xE1lido"]);
    try {
      const { data: atual, error: erroBusca } = await supabase2.from("clientes").select("*").eq("id", req.params.clienteId).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!atual) return res.status(404).json({ success: false, error: "Cliente n\xE3o encontrado" });
      const body = objeto2(req.body);
      if (body.origem !== void 0 && body.origem !== atual.origem) {
        return respostaValidacao(res, ["Corre\xE7\xE3o de origem usa a a\xE7\xE3o administrativa pr\xF3pria"]);
      }
      const validacao = validarClienteInput({ ...atual, ...body, id: req.params.clienteId });
      if (validacao.ok === false) return respostaValidacao(res, validacao.erros);
      const { id: _id, ...payload } = validacao.valor;
      const { data, error } = await supabase2.from("clientes").update(payload).eq("id", req.params.clienteId).select("*").maybeSingle();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao editar cliente operacional", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel atualizar o cliente" });
    }
  });
  router.patch("/clientes/:clienteId/origem", ADMINISTRAR, async (req, res) => {
    const origem = stringLimitada(req.body?.origem, 40);
    const motivo = stringLimitada(req.body?.motivo, 500);
    const erros = [];
    if (!UUID3.test(req.params.clienteId)) erros.push("Cliente inv\xE1lido");
    if (!ORIGENS_CLIENTE.includes(origem)) erros.push("Origem inv\xE1lida");
    if (motivo.length < 3) erros.push("Motivo da corre\xE7\xE3o \xE9 obrigat\xF3rio");
    if (erros.length > 0) return respostaValidacao(res, erros);
    try {
      const { data, error } = await supabase2.rpc("corrigir_origem_cliente", {
        p_cliente_id: req.params.clienteId,
        p_nova_origem: origem,
        p_usuario_id: req.usuario.id,
        p_motivo: motivo
      });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao corrigir origem do cliente", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel corrigir a origem" });
    }
  });
  router.post("/pedidos", CRIAR_OU_EDITAR2, async (req, res) => {
    const body = objeto2(req.body);
    const clienteRaw = objeto2(body.cliente);
    const pedidoRaw = objeto2(body.pedido);
    const cliente = validarClienteInput(clienteRaw);
    const pedido = validarPedidoInput({ ...pedidoRaw, responsavel_id: pedidoRaw.responsavel_id ?? req.usuario?.id });
    if (cliente.ok === false || pedido.ok === false) {
      return respostaValidacao(res, [
        ...cliente.ok === false ? cliente.erros : [],
        ...pedido.ok === false ? pedido.erros : []
      ]);
    }
    const clienteExistente = Boolean(cliente.valor.id);
    if (clienteExistente && !temPermissao(req.usuario, "clientes.editar")) {
      return res.status(403).json({ success: false, error: "Acesso negado: editar cliente existente n\xE3o \xE9 permitido" });
    }
    if (!clienteExistente && !temPermissao(req.usuario, "clientes.criar")) {
      return res.status(403).json({ success: false, error: "Acesso negado: cadastrar novo cliente n\xE3o \xE9 permitido" });
    }
    const clienteRpc = { ...cliente.valor };
    const moto = payloadMoto(clienteRaw.moto);
    if (moto) clienteRpc.moto = moto;
    const decisao = stringLimitada(clienteRaw.duplicidade_decisao, 40);
    if (["sugerida", "reutilizada", "confirmada_separada"].includes(decisao)) clienteRpc.duplicidade_decisao = decisao;
    if (Array.isArray(clienteRaw.duplicidade_criterios)) {
      clienteRpc.duplicidade_criterios = clienteRaw.duplicidade_criterios.map((item) => stringLimitada(item, 20)).filter((item) => ["nome", "whatsapp", "instagram"].includes(item));
    }
    try {
      const { data, error } = await supabase2.rpc("registrar_cliente_com_pedido", {
        p_cliente: clienteRpc,
        p_pedido: pedido.valor,
        p_usuario_id: req.usuario.id
      });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro na RPC registrar_cliente_com_pedido", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel registrar o pedido" });
    }
  });
  router.patch("/pedidos/:pedidoId/status", EDITAR4, async (req, res) => {
    const status = stringLimitada(req.body?.status, 40);
    const motivo = stringLimitada(req.body?.motivo, 500) || null;
    const vendaId = stringLimitada(req.body?.venda_id, 60) || null;
    const erros = [];
    if (!UUID3.test(req.params.pedidoId)) erros.push("Pedido inv\xE1lido");
    if (!STATUS_PEDIDO.has(status)) erros.push("Status inv\xE1lido");
    if (erros.length > 0) return respostaValidacao(res, erros);
    try {
      const { data, error } = await supabase2.rpc("transicionar_pedido_busca", {
        p_pedido_id: req.params.pedidoId,
        p_novo_status: status,
        p_usuario_id: req.usuario.id,
        p_motivo: motivo,
        p_venda_id: vendaId
      });
      if (error) return res.status(400).json({ success: false, error: "Transi\xE7\xE3o de pedido inv\xE1lida" });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao transicionar pedido de cliente", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel atualizar o pedido" });
    }
  });
  router.post("/pedidos/:pedidoId/acao", EDITAR4, async (req, res) => {
    const acao = stringLimitada(req.body?.acao, 40);
    const erros = [];
    if (!UUID3.test(req.params.pedidoId)) erros.push("Pedido inv\xE1lido");
    if (!ACOES_PEDIDO.has(acao)) erros.push("A\xE7\xE3o inv\xE1lida");
    if (erros.length > 0) return respostaValidacao(res, erros);
    const motivo = stringLimitada(req.body?.motivo, 500);
    if (["cliente_desistiu", "nao_quer_mais", "marcar_nao_encontrada", "cancelar"].includes(acao) && motivo.length < 3) {
      return respostaValidacao(res, ["Motivo \xE9 obrigat\xF3rio para encerrar o pedido"]);
    }
    try {
      const { data, error } = await supabase2.rpc("registrar_acao_pedido", {
        p_pedido_id: req.params.pedidoId,
        p_acao: acao,
        p_usuario_id: req.usuario.id,
        p_detalhe: motivo ? { motivo } : {}
      });
      if (error) return res.status(400).json({ success: false, error: "A\xE7\xE3o incompat\xEDvel com o estado atual" });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao registrar a\xE7\xE3o do pedido", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel registrar a a\xE7\xE3o" });
    }
  });
  router.patch("/clientes/:clienteId/moto-principal", EDITAR4, async (req, res) => {
    const motoId = stringLimitada(req.body?.moto_id, 60);
    if (!UUID3.test(req.params.clienteId) || !UUID3.test(motoId)) return respostaValidacao(res, ["Cliente ou moto inv\xE1lido"]);
    try {
      const { data, error } = await supabase2.rpc("definir_moto_principal", {
        p_cliente_id: req.params.clienteId,
        p_moto_id: motoId
      });
      if (error) return res.status(400).json({ success: false, error: "A moto n\xE3o pertence ao cliente" });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro("Erro ao definir moto principal", error);
      res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel definir a moto principal" });
    }
  });
  return router;
}

// src/server/routes/clientes.ts
var SELECT_COM_DETALHES = "*, notas:clientes_notas(*, autor:usuarios(id, nome_exibicao)), motos:clientes_motos(*, modelo_moto:modelos_moto(id, nome, ano)), pecas_procuradas:pecas_procuradas(*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano))";
var CAMPOS_EDITAVEIS_COMUNS = [
  "nome",
  "telefone",
  "instagram_usuario",
  "documento",
  "data_nascimento",
  "preferencia_contato",
  "tags",
  "observacoes",
  "ml_nickname",
  "cidade",
  "estado",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro"
];
var CAMPOS_EDITAVEIS_ADMIN = ["ativo", "banido"];
function normalizarTags(tags) {
  if (!Array.isArray(tags)) return void 0;
  const limpas = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(limpas));
}
function normalizarDigitos(value) {
  if (value === void 0 || value === null) return null;
  const digitos = String(value).replace(/\D/g, "");
  return digitos || null;
}
function clientesRouter(supabase2) {
  const router = Router12();
  router.use("/operacao", clientesOperacaoRouter(supabase2));
  router.get("/", exigirPermissao("clientes.ver"), async (req, res) => {
    try {
      let query = supabase2.from("clientes").select(
        "id, nome, telefone, instagram_usuario, documento, data_nascimento, origem, preferencia_contato, tags, observacoes, ativo, banido, ml_nickname, cidade, estado, criado_em, atualizado_em"
      ).order("nome");
      if (req.query.incluir_inativos !== "true") query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar clientes:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/pecas-procuradas/todas", exigirPermissao("clientes.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("pecas_procuradas").select("id, cliente_id, status, modelo_moto_id, modelo_moto:modelos_moto(id, nome, ano)").not("cliente_id", "is", null);
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar pe\xE7as procuradas:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/motos/todas", exigirPermissao("clientes.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("clientes_motos").select("id, cliente_id, modelo_moto_id, modelo_moto:modelos_moto(id, nome, ano)").not("modelo_moto_id", "is", null);
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar motos de clientes:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/:id", exigirPermissao("clientes.ver"), async (req, res) => {
    try {
      const { data, error } = await supabase2.from("clientes").select(SELECT_COM_DETALHES).eq("id", req.params.id).order("criado_em", { foreignTable: "clientes_notas", ascending: false }).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Cliente n\xE3o encontrado" });
      const { data: comprovantes, error: erroComprovantes } = await supabase2.from("comprovantes_pix").select("*, venda:vendas(id, nome_item, data)").eq("cliente_id", req.params.id).is("removido_em", null).order("criado_em", { ascending: false });
      if (erroComprovantes) throw erroComprovantes;
      const comprovantesComUrl = await Promise.all(
        (comprovantes ?? []).map(async (c) => ({ ...c, url: await gerarUrlAssinadaComprovante(c.storage_path) }))
      );
      res.json({ success: true, data: { ...data, comprovantes_pix: comprovantesComUrl } });
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("clientes.criar"), async (req, res) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      if (!nome) return res.status(400).json({ success: false, error: "Nome \xE9 obrigat\xF3rio" });
      const payload = {
        nome,
        telefone: normalizarDigitos(req.body?.telefone),
        instagram_usuario: req.body?.instagram_usuario ? String(req.body.instagram_usuario).trim().replace(/^@+/, "").toLowerCase() : null,
        documento: normalizarDigitos(req.body?.documento),
        data_nascimento: req.body?.data_nascimento || null,
        origem: req.body?.origem || null,
        preferencia_contato: req.body?.preferencia_contato || null,
        tags: normalizarTags(req.body?.tags) ?? [],
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null,
        cidade: req.body?.cidade ? String(req.body.cidade).trim() : null,
        cep: normalizarDigitos(req.body?.cep),
        logradouro: req.body?.logradouro ? String(req.body.logradouro).trim() : null,
        numero: req.body?.numero ? String(req.body.numero).trim() : null,
        complemento: req.body?.complemento ? String(req.body.complemento).trim() : null,
        bairro: req.body?.bairro ? String(req.body.bairro).trim() : null,
        estado: (() => {
          const raw = req.body?.estado;
          if (raw == null || raw === "") return null;
          const s = String(raw).trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(s)) return null;
          return s;
        })()
      };
      const { data, error } = await supabase2.from("clientes").insert(payload).select("*").single();
      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ success: false, error: "J\xE1 existe um cliente cadastrado com este documento" });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirAlguma("clientes.editar", "clientes.administrar"), async (req, res) => {
    try {
      const payload = {};
      const possuiCampoComum = CAMPOS_EDITAVEIS_COMUNS.some((campo) => req.body?.[campo] !== void 0);
      const possuiCampoAdministrativo = CAMPOS_EDITAVEIS_ADMIN.some((campo) => req.body?.[campo] !== void 0);
      if (possuiCampoComum && !temPermissao(req.usuario, "clientes.editar")) {
        return res.status(403).json({ success: false, error: "Acesso negado: edi\xE7\xE3o cadastral n\xE3o permitida" });
      }
      if (possuiCampoAdministrativo && !temPermissao(req.usuario, "clientes.administrar")) {
        return res.status(403).json({ success: false, error: "Acesso negado: esta a\xE7\xE3o \xE9 administrativa" });
      }
      for (const campo of CAMPOS_EDITAVEIS_ADMIN) {
        if (req.body?.[campo] !== void 0 && typeof req.body[campo] !== "boolean") {
          return res.status(400).json({ success: false, error: `${campo} deve ser verdadeiro ou falso` });
        }
      }
      for (const campo of CAMPOS_EDITAVEIS_COMUNS) {
        if (req.body?.[campo] === void 0) continue;
        if (campo === "nome") {
          const nome = String(req.body.nome).trim();
          if (!nome) return res.status(400).json({ success: false, error: "Nome n\xE3o pode ficar em branco" });
          payload.nome = nome;
        } else if (campo === "tags") {
          payload.tags = normalizarTags(req.body.tags) ?? [];
        } else if (campo === "telefone" || campo === "documento" || campo === "cep") {
          payload[campo] = normalizarDigitos(req.body[campo]);
        } else if (campo === "instagram_usuario") {
          const instagram = String(req.body.instagram_usuario ?? "").trim().replace(/^@+/, "").toLowerCase();
          payload.instagram_usuario = instagram || null;
        } else if (campo === "estado") {
          const s = String(req.body.estado ?? "").trim().toUpperCase();
          payload.estado = /^[A-Z]{2}$/.test(s) ? s : null;
        } else {
          payload[campo] = req.body[campo] === "" ? null : req.body[campo];
        }
      }
      for (const campo of CAMPOS_EDITAVEIS_ADMIN) {
        if (req.body?.[campo] !== void 0) payload[campo] = Boolean(req.body[campo]);
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: "Nenhum campo edit\xE1vel foi informado" });
      }
      const { data, error } = await supabase2.from("clientes").update(payload).eq("id", req.params.id).select("*").maybeSingle();
      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ success: false, error: "J\xE1 existe um cliente cadastrado com este documento" });
        }
        throw error;
      }
      if (!data) return res.status(404).json({ success: false, error: "Cliente n\xE3o encontrado" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/notas", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const texto2 = String(req.body?.texto || "").trim();
      if (!texto2) return res.status(400).json({ success: false, error: "Texto da nota \xE9 obrigat\xF3rio" });
      const { data, error } = await supabase2.from("clientes_notas").insert({ cliente_id: req.params.id, texto: texto2, criado_por: req.usuario.id }).select("*, autor:usuarios(id, nome_exibicao)").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao adicionar nota:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/notas/:notaId", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      const { data: nota, error: erroBusca } = await supabase2.from("clientes_notas").select("id, criado_por").eq("id", req.params.notaId).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!nota) return res.status(404).json({ success: false, error: "Nota n\xE3o encontrada" });
      if (!roles.includes("admin") && nota.criado_por !== req.usuario.id) {
        return res.status(403).json({ success: false, error: "S\xF3 quem escreveu a nota pode exclu\xED-la" });
      }
      const { error } = await supabase2.from("clientes_notas").delete().eq("id", req.params.notaId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir nota:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/motos", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const payload = {
        cliente_id: req.params.id,
        modelo_moto_id: req.body?.modelo_moto_id || null,
        modelo_texto: req.body?.modelo_texto ? String(req.body.modelo_texto).trim() : null,
        placa: req.body?.placa ? String(req.body.placa).trim() : null,
        chassi: req.body?.chassi ? String(req.body.chassi).trim() : null,
        ano: req.body?.ano ? String(req.body.ano).trim() : null,
        cor: req.body?.cor ? String(req.body.cor).trim() : null,
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null
      };
      const { data, error } = await supabase2.from("clientes_motos").insert(payload).select("*, modelo_moto:modelos_moto(id, nome, ano)").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao cadastrar moto do cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/motos/:motoId", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const payload = {};
      for (const campo of ["modelo_moto_id", "modelo_texto", "placa", "chassi", "ano", "cor", "observacoes"]) {
        if (req.body?.[campo] !== void 0) payload[campo] = req.body[campo] === "" ? null : req.body[campo];
      }
      const { data, error } = await supabase2.from("clientes_motos").update(payload).eq("id", req.params.motoId).eq("cliente_id", req.params.id).select("*, modelo_moto:modelos_moto(id, nome, ano)").maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Moto n\xE3o encontrada" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar moto do cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/motos/:motoId", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const { error } = await supabase2.from("clientes_motos").delete().eq("id", req.params.motoId).eq("cliente_id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir moto do cliente:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/pecas-procuradas", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const descricao = String(req.body?.descricao || "").trim();
      if (!descricao) return res.status(400).json({ success: false, error: "Descri\xE7\xE3o \xE9 obrigat\xF3ria" });
      const payload = {
        cliente_id: req.params.id,
        cliente_nome: req.body?.cliente_nome ? String(req.body.cliente_nome).trim() : null,
        descricao,
        categoria_id: req.body?.categoria_id || null,
        modelo_moto_id: req.body?.modelo_moto_id || null,
        cliente_moto_id: req.body?.cliente_moto_id || null,
        moto_modelo_texto: req.body?.moto_modelo_texto ? String(req.body.moto_modelo_texto).trim() : null,
        ano_compatibilidade: req.body?.ano_compatibilidade ? String(req.body.ano_compatibilidade).trim() : null,
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null,
        criado_por: req.usuario.id,
        responsavel_id: req.body?.responsavel_id || req.usuario.id,
        prometido_para: req.body?.prometido_para || null,
        idempotency_key: req.body?.idempotency_key || null
      };
      const { data, error } = await supabase2.from("pecas_procuradas").insert(payload).select("*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano)").single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao cadastrar pe\xE7a procurada:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/pecas-procuradas/:pedidoId", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const status = req.body?.status;
      if (!["aguardando", "atendida", "cancelada"].includes(status)) {
        return res.status(400).json({ success: false, error: "Status inv\xE1lido" });
      }
      const novoStatus = status === "aguardando" ? "em_busca" : status;
      const { data, error } = await supabase2.rpc("transicionar_pedido_busca", {
        p_pedido_id: req.params.pedidoId,
        p_novo_status: novoStatus,
        p_usuario_id: req.usuario.id,
        p_motivo: status === "cancelada" ? String(req.body?.motivo || "Cancelado pelo fluxo anterior") : null,
        p_venda_id: null
      });
      if (error) return res.status(400).json({ success: false, error: "N\xE3o foi poss\xEDvel alterar o estado deste pedido" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar pe\xE7a procurada:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/pecas-procuradas/:pedidoId", exigirPermissao("clientes.editar"), async (req, res) => {
    try {
      const { data, error } = await supabase2.rpc("registrar_acao_pedido", {
        p_pedido_id: req.params.pedidoId,
        p_acao: "cancelar",
        p_usuario_id: req.usuario.id,
        p_detalhe: { motivo: "Cancelado pelo fluxo anterior" }
      });
      if (error) return res.status(400).json({ success: false, error: "N\xE3o foi poss\xEDvel cancelar este pedido" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao excluir pe\xE7a procurada:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/caixa.ts
import { Router as Router13 } from "express";
var SELECT_COM_JOIN2 = "*, forma_pagamento:formas_pagamento(id, nome)";
function caixaRouter(supabase2) {
  const router = Router13();
  router.get("/", exigirPermissao("caixa.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("caixa").select(SELECT_COM_JOIN2).order("data", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("caixa.criar"), async (req, res) => {
    try {
      const { tipo, descricao, valor, forma_pagamento_id, data } = req.body || {};
      if (!["entrada", "saida"].includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo deve ser "entrada" ou "saida"' });
      }
      if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ success: false, error: "Descri\xE7\xE3o \xE9 obrigat\xF3ria" });
      }
      if (!valor || Number(valor) <= 0) {
        return res.status(400).json({ success: false, error: "Valor deve ser maior que zero" });
      }
      const payload = {
        tipo,
        descricao: String(descricao).trim(),
        valor: Number(valor),
        forma_pagamento_id: forma_pagamento_id || null,
        data: data || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
      };
      const { data: created, error } = await supabase2.from("caixa").insert([payload]).select(SELECT_COM_JOIN2).single();
      if (error) throw error;
      res.json({ success: true, data: created });
    } catch (error) {
      console.error("Erro ao lan\xE7ar no caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.put("/:id", exigirPermissao("caixa.editar"), async (req, res) => {
    try {
      const payload = {};
      for (const campo of ["tipo", "descricao", "valor", "forma_pagamento_id", "data"]) {
        if (req.body[campo] !== void 0) payload[campo] = req.body[campo];
      }
      if (payload.tipo !== void 0 && !["entrada", "saida"].includes(payload.tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo deve ser "entrada" ou "saida"' });
      }
      if (payload.descricao !== void 0) {
        payload.descricao = String(payload.descricao).trim();
        if (!payload.descricao) return res.status(400).json({ success: false, error: "Descri\xE7\xE3o \xE9 obrigat\xF3ria" });
      }
      if (payload.valor !== void 0) payload.valor = Number(payload.valor);
      if (payload.valor !== void 0 && (!Number.isFinite(payload.valor) || payload.valor <= 0)) {
        return res.status(400).json({ success: false, error: "Valor deve ser maior que zero" });
      }
      if (payload.data !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.data))) {
        return res.status(400).json({ success: false, error: "Data deve estar no formato AAAA-MM-DD" });
      }
      const { data, error } = await supabase2.from("caixa").update(payload).eq("id", req.params.id).select(SELECT_COM_JOIN2).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar lan\xE7amento de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("caixa.excluir"), async (req, res) => {
    try {
      const [{ data: viaFiado, error: erroFiado }, { data: viaPendencia, error: erroPendencia }] = await Promise.all([
        supabase2.from("fiado_recebimentos").select("id").eq("caixa_id", req.params.id).maybeSingle(),
        supabase2.from("caixa_pendencia_recebimentos").select("id").eq("caixa_id", req.params.id).maybeSingle()
      ]);
      if (erroFiado) throw erroFiado;
      if (erroPendencia) throw erroPendencia;
      if (viaFiado) {
        return res.status(409).json({ success: false, error: "Este lan\xE7amento veio de um recebimento de fiado \u2014 reverta-o pela aba Fiado." });
      }
      if (viaPendencia) {
        return res.status(409).json({ success: false, error: "Este lan\xE7amento veio de um recebimento de pend\xEAncia \u2014 reverta-o pela sub-aba Pend\xEAncias, dentro de Caixa." });
      }
      const { data: venda, error: erroVenda } = await supabase2.from("caixa").select("venda_id").eq("id", req.params.id).maybeSingle();
      if (erroVenda) throw erroVenda;
      if (venda?.venda_id) {
        return res.status(409).json({ success: false, error: "Este lan\xE7amento veio de uma venda \u2014 cancele a venda para estornar o Caixa." });
      }
      const { error } = await supabase2.from("caixa").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir lan\xE7amento de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/caixaPendencias.ts
import { Router as Router14 } from "express";

// src/server/routes/caixaPendenciasValidation.ts
var moeda = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function prepararEdicaoPendencia(body, atual, recebido) {
  if (atual.status === "quitada") {
    return { ok: false, status: 409, error: "Pend\xEAncias quitadas n\xE3o podem ser reabertas por esta edi\xE7\xE3o." };
  }
  const payload = {};
  if (body.descricao !== void 0) {
    const descricao = String(body.descricao).trim();
    if (!descricao) return { ok: false, status: 400, error: "Descri\xE7\xE3o \xE9 obrigat\xF3ria." };
    payload.descricao = descricao;
  }
  if (body.data !== void 0) {
    const data = String(body.data);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || !parsed || parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
      return { ok: false, status: 400, error: "Data inv\xE1lida." };
    }
    payload.data = data;
  }
  if (body.cliente_id !== void 0) payload.cliente_id = body.cliente_id || null;
  if (body.valor_total !== void 0) {
    const total = Number(body.valor_total);
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, status: 400, error: "O valor total deve ser maior que zero." };
    }
    if (total + 5e-3 < recebido) {
      return { ok: false, status: 400, error: `O valor total n\xE3o pode ser menor que o valor j\xE1 recebido (${moeda(recebido)}).` };
    }
    payload.valor_total = total;
    payload.status = Math.abs(total - recebido) <= 5e-3 ? "quitada" : "aberta";
  }
  if (!Object.keys(payload).length) return { ok: false, status: 400, error: "Informe ao menos um campo para atualizar." };
  return { ok: true, payload };
}

// src/server/routes/caixaPendencias.ts
var SELECT_PENDENCIA = "*, criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone)";
var SELECT_RECEBIMENTO = "*, forma_pagamento:formas_pagamento(id, nome), usuario:usuarios(id, nome_exibicao)";
function caixaPendenciasRouter(supabase2) {
  const router = Router14();
  router.get("/", exigirPermissao("caixa.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("caixa_pendencias").select(SELECT_PENDENCIA).order("criado_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar pend\xEAncias de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/recebimentos", exigirPermissao("caixa.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("caixa_pendencia_recebimentos").select(SELECT_RECEBIMENTO).order("recebido_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar recebimentos de pend\xEAncia de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const { descricao, valor_total, data } = req.body || {};
      if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ success: false, error: "Descri\xE7\xE3o \xE9 obrigat\xF3ria" });
      }
      if (!valor_total || Number(valor_total) <= 0) {
        return res.status(400).json({ success: false, error: "Valor deve ser maior que zero" });
      }
      const payload = {
        descricao: String(descricao).trim(),
        valor_total: Number(valor_total),
        data: data || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        criado_por: req.usuario.id,
        cliente_id: req.body?.cliente_id || null
      };
      const { data: created, error } = await supabase2.from("caixa_pendencias").insert([payload]).select(SELECT_PENDENCIA).single();
      if (error) throw error;
      res.json({ success: true, data: created });
    } catch (error) {
      console.error("Erro ao criar pend\xEAncia de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const { data: atual, error: erroBusca } = await supabase2.from("caixa_pendencias").select("id, descricao, valor_total, data, cliente_id, status").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!atual) return res.status(404).json({ success: false, error: "Pend\xEAncia n\xE3o encontrada." });
      const { data: recebimentos, error: erroRecebimentos } = await supabase2.from("caixa_pendencia_recebimentos").select("valor").eq("pendencia_id", req.params.id);
      if (erroRecebimentos) throw erroRecebimentos;
      const recebido = (recebimentos ?? []).reduce((total, item) => total + Number(item.valor || 0), 0);
      const campos = {
        descricao: req.body?.descricao,
        valor_total: req.body?.valor_total,
        data: req.body?.data,
        cliente_id: req.body?.cliente_id
      };
      const resultado = prepararEdicaoPendencia(campos, atual, recebido);
      if (resultado.ok === false) return res.status(resultado.status).json({ success: false, error: resultado.error });
      const { data, error } = await supabase2.from("caixa_pendencias").update(resultado.payload).eq("id", req.params.id).eq("status", "aberta").select(SELECT_PENDENCIA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao editar pend\xEAncia de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/recebimentos", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const valor = Number(req.body?.valor);
      const formaPagamentoId = req.body?.forma_pagamento_id;
      if (!formaPagamentoId) return res.status(400).json({ success: false, error: "Forma de pagamento \xE9 obrigat\xF3ria" });
      if (!valor || valor <= 0) return res.status(400).json({ success: false, error: "Valor inv\xE1lido" });
      const { data: recebimento, error } = await supabase2.rpc("registrar_recebimento_caixa_pendencia", {
        p_pendencia_id: req.params.id,
        p_valor: valor,
        p_forma_pagamento_id: formaPagamentoId,
        p_usuario_id: req.usuario.id
      });
      if (error) throw error;
      const { data, error: erroBusca } = await supabase2.from("caixa_pendencia_recebimentos").select(SELECT_RECEBIMENTO).eq("id", recebimento.id).single();
      if (erroBusca) throw erroBusca;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao registrar recebimento de pend\xEAncia de caixa:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id/recebimentos/:recebimentoId", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const { data: recebimento, error: erroBusca } = await supabase2.from("caixa_pendencia_recebimentos").select("id, pendencia_id, caixa_id").eq("id", req.params.recebimentoId).eq("pendencia_id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!recebimento) return res.status(404).json({ success: false, error: "Recebimento n\xE3o encontrado" });
      if (recebimento.caixa_id) {
        const { error: erroCaixa } = await supabase2.from("caixa").delete().eq("id", recebimento.caixa_id);
        if (erroCaixa) throw erroCaixa;
      }
      const { error } = await supabase2.from("caixa_pendencia_recebimentos").delete().eq("id", req.params.recebimentoId);
      if (error) throw error;
      const { error: erroReabrir } = await supabase2.from("caixa_pendencias").update({ status: "aberta" }).eq("id", req.params.id);
      if (erroReabrir) throw erroReabrir;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover recebimento de pend\xEAncia de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const { error } = await supabase2.from("caixa_pendencias").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      if (error.code === "23503") {
        return res.status(409).json({ success: false, error: "Esta pend\xEAncia j\xE1 tem recebimento registrado \u2014 reverta os recebimentos antes de excluir." });
      }
      console.error("Erro ao excluir pend\xEAncia de caixa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/fiado.ts
import { Router as Router15 } from "express";
var SELECT_COM_JOINS2 = "*, forma_pagamento:formas_pagamento(id, nome), usuario:usuarios(id, nome_exibicao)";
function fiadoRouter(supabase2) {
  const router = Router15();
  router.get("/recebimentos", exigirPermissao("caixa.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("fiado_recebimentos").select(SELECT_COM_JOINS2).order("recebido_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar recebimentos de fiado:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/recebimentos", exigirPermissao("caixa.receber_fiado"), async (req, res) => {
    try {
      const vendaId = req.body?.venda_id;
      const valor = Number(req.body?.valor);
      const formaPagamentoId = req.body?.forma_pagamento_id;
      if (!vendaId) return res.status(400).json({ success: false, error: "venda_id \xE9 obrigat\xF3rio" });
      if (!formaPagamentoId) return res.status(400).json({ success: false, error: "Forma de pagamento \xE9 obrigat\xF3ria" });
      if (!valor || valor <= 0) return res.status(400).json({ success: false, error: "Valor inv\xE1lido" });
      const { data: recebimento, error } = await supabase2.rpc("registrar_recebimento_fiado", {
        p_venda_id: vendaId,
        p_valor: valor,
        p_forma_pagamento_id: formaPagamentoId,
        p_usuario_id: req.usuario.id
      });
      if (error) throw error;
      const { data, error: erroBusca } = await supabase2.from("fiado_recebimentos").select(SELECT_COM_JOINS2).eq("id", recebimento.id).single();
      if (erroBusca) throw erroBusca;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao registrar recebimento de fiado:", error);
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.delete("/recebimentos/:id", exigirPermissao("caixa.receber_fiado"), async (req, res) => {
    try {
      const { data: recebimento, error: erroBusca } = await supabase2.from("fiado_recebimentos").select("id, caixa_id").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!recebimento) return res.status(404).json({ success: false, error: "Recebimento n\xE3o encontrado" });
      if (recebimento.caixa_id) {
        const { error: erroCaixa } = await supabase2.from("caixa").delete().eq("id", recebimento.caixa_id);
        if (erroCaixa) throw erroCaixa;
      }
      const { error } = await supabase2.from("fiado_recebimentos").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover recebimento de fiado:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/envios.ts
import { Router as Router16 } from "express";

// src/services/rastreioMelhorEnvioService.ts
import axios4 from "axios";
var STATUS_TERMINAIS = ["entregue", "cancelado"];
function mapearStatusExterno(statusExterno) {
  const s = (statusExterno || "").toLowerCase();
  if (["delivered", "entregue"].includes(s)) return "entregue";
  if (["posted", "released", "postado"].includes(s)) return "postado";
  if (["in_transit", "transit", "em_transito"].includes(s)) return "em_transito";
  if (["cancelled", "canceled", "cancelado"].includes(s)) return "cancelado";
  return null;
}
async function rastrearEnvio(envio) {
  const atualizacao = { status_atualizado_em: (/* @__PURE__ */ new Date()).toISOString() };
  if (!envio.melhor_envio_order_id) {
    atualizacao.status_detalhe = "Sem n\xFAmero de pedido do Melhor Envio \u2014 status \xE9 s\xF3 manual pra este envio.";
    return atualizacao;
  }
  try {
    const token = process.env.MELHOR_ENVIO_TOKEN;
    const response = await axios4.post(
      "https://melhorenvio.com.br/api/v2/me/shipment/tracking",
      { orders: [envio.melhor_envio_order_id] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "RK Sucatas (contato@rksucatas.com.br)"
        }
      }
    );
    const info = response.data?.[envio.melhor_envio_order_id] ?? response.data;
    const statusMapeado = mapearStatusExterno(info?.status);
    if (statusMapeado) atualizacao.status = statusMapeado;
    atualizacao.status_detalhe = info?.tracking ? `Rastreio: ${info.tracking}` : JSON.stringify(info).slice(0, 500);
  } catch (erroExterno) {
    const detalhe = erroExterno.response?.data?.message || erroExterno.message;
    console.error("Erro ao rastrear envio via Melhor Envio:", erroExterno.response?.data || erroExterno.message);
    atualizacao.status_detalhe = `N\xE3o foi poss\xEDvel atualizar automaticamente: ${detalhe}`;
  }
  return atualizacao;
}
async function rastrearEnviosPendentes(supabase2) {
  const { data: envios, error } = await supabase2.from("envios").select("id, melhor_envio_order_id").not("melhor_envio_order_id", "is", null).not("status", "in", `(${STATUS_TERMINAIS.join(",")})`);
  if (error) {
    console.error("Erro ao buscar envios pendentes de rastreio:", error.message);
    return;
  }
  for (const envio of envios ?? []) {
    const atualizacao = await rastrearEnvio(envio);
    const { error: erroUpdate } = await supabase2.from("envios").update(atualizacao).eq("id", envio.id);
    if (erroUpdate) console.error(`Erro ao gravar rastreio do envio ${envio.id}:`, erroUpdate.message);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// src/server/routes/envios.ts
var SELECT_COM_JOIN3 = "*, cliente:clientes(id, nome, telefone)";
var STATUS_VALIDOS = ["aguardando_postagem", "postado", "em_transito", "entregue", "problema", "cancelado"];
var CAMPOS_EDITAVEIS2 = [
  "cliente_id",
  "cliente_nome",
  "venda_id",
  "transportadora",
  "servico",
  "codigo_rastreio",
  "melhor_envio_order_id",
  "cep_destino",
  "valor_frete",
  "status"
];
function enviosRouter(supabase2) {
  const router = Router16();
  router.get("/", exigirPermissao("frete.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("envios").select(SELECT_COM_JOIN3).order("criado_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar envios:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("frete.criar"), async (req, res) => {
    try {
      const payload = {
        cliente_id: req.body?.cliente_id || null,
        cliente_nome: req.body?.cliente_nome ? String(req.body.cliente_nome).trim() : null,
        venda_id: req.body?.venda_id || null,
        transportadora: req.body?.transportadora ? String(req.body.transportadora).trim() : null,
        servico: req.body?.servico ? String(req.body.servico).trim() : null,
        codigo_rastreio: req.body?.codigo_rastreio ? String(req.body.codigo_rastreio).trim() : null,
        melhor_envio_order_id: req.body?.melhor_envio_order_id ? String(req.body.melhor_envio_order_id).trim() : null,
        cep_destino: req.body?.cep_destino ? String(req.body.cep_destino).trim() : null,
        valor_frete: req.body?.valor_frete !== void 0 && req.body.valor_frete !== null ? Number(req.body.valor_frete) : null,
        criado_por: req.usuario?.id ?? null
      };
      const { data, error } = await supabase2.from("envios").insert(payload).select(SELECT_COM_JOIN3).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao registrar envio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("frete.editar"), async (req, res) => {
    try {
      const payload = {};
      for (const campo of CAMPOS_EDITAVEIS2) {
        if (req.body?.[campo] === void 0) continue;
        if (campo === "status") {
          if (!STATUS_VALIDOS.includes(req.body.status)) return res.status(400).json({ success: false, error: "Status inv\xE1lido" });
          payload.status = req.body.status;
          payload.status_atualizado_em = (/* @__PURE__ */ new Date()).toISOString();
        } else if (campo === "valor_frete") {
          payload.valor_frete = req.body.valor_frete === "" || req.body.valor_frete === null ? null : Number(req.body.valor_frete);
        } else {
          payload[campo] = req.body[campo] === "" ? null : req.body[campo];
        }
      }
      const { data, error } = await supabase2.from("envios").update(payload).eq("id", req.params.id).select(SELECT_COM_JOIN3).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Envio n\xE3o encontrado" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar envio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("frete.deletar"), async (req, res) => {
    try {
      const { error } = await supabase2.from("envios").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir envio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/rastrear", exigirPermissao("frete.editar"), async (req, res) => {
    try {
      const { data: envio, error: erroBusca } = await supabase2.from("envios").select("*").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!envio) return res.status(404).json({ success: false, error: "Envio n\xE3o encontrado" });
      const atualizacao = await rastrearEnvio(envio);
      const { data, error } = await supabase2.from("envios").update(atualizacao).eq("id", req.params.id).select(SELECT_COM_JOIN3).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao rastrear envio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/upload.ts
import { Router as Router17 } from "express";
import multer2 from "multer";
var TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
var upload = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5MB
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem n\xE3o suportado (use JPG, PNG, WEBP ou GIF)"));
    }
    cb(null, true);
  }
});
var TIPOS_ACEITOS_COMPROVANTE = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
var uploadComprovante = multer2({
  storage: multer2.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5MB
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ACEITOS_COMPROVANTE.includes(file.mimetype)) {
      return cb(new Error("Formato n\xE3o suportado pra comprovante (use JPG, PNG, WEBP, GIF ou PDF)"));
    }
    cb(null, true);
  }
});
function uploadRouter() {
  const router = Router17();
  router.post("/imagem", (req, res) => {
    upload.single("imagem")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
      }
      try {
        const url = await uploadImagem(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({ success: true, url });
      } catch (error) {
        console.error("Erro ao subir imagem:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });
  router.post("/comprovante", (req, res) => {
    uploadComprovante.single("arquivo")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
      }
      try {
        const storage_path = await uploadComprovantePix(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({
          success: true,
          storage_path,
          nome_arquivo: req.file.originalname,
          tipo_mime: req.file.mimetype,
          tamanho_bytes: req.file.size
        });
      } catch (error) {
        console.error("Erro ao subir comprovante:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });
  return router;
}

// src/server/routes/usuarios.ts
import { Router as Router18 } from "express";
import bcrypt from "bcryptjs";

// src/constants/roles.ts
var ALL_ROLES = ["admin", "equipe", "estoque_leitura", "mandados", "mecanico"];

// src/server/routes/usuarios.ts
var SELECT_SEM_SENHA = "id, username, nome_exibicao, roles, permissoes, ativo, criado_em";
function usuariosRouter(supabase2) {
  const router = Router18();
  router.get("/", async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("usuarios").select(SELECT_SEM_SENHA).order("nome_exibicao");
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar usu\xE1rios:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim().toLowerCase();
      const nomeExibicao = String(req.body?.nome_exibicao || "").trim();
      const password = String(req.body?.password || "");
      const roles = req.body?.roles;
      if (!username || !nomeExibicao || !password) {
        return res.status(400).json({ success: false, error: "Usu\xE1rio, nome e senha s\xE3o obrigat\xF3rios" });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: "Senha precisa ter pelo menos 6 caracteres" });
      }
      if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => ALL_ROLES.includes(r))) {
        return res.status(400).json({ success: false, error: "Selecione pelo menos um papel v\xE1lido" });
      }
      const permissoes = sanitizarPermissoes(req.body?.permissoes);
      const senha_hash = bcrypt.hashSync(password, 10);
      const { data, error } = await supabase2.from("usuarios").insert({ username, nome_exibicao: nomeExibicao, senha_hash, roles, permissoes }).select(SELECT_SEM_SENHA).single();
      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ success: false, error: "J\xE1 existe um usu\xE1rio com esse username" });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar usu\xE1rio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", async (req, res) => {
    try {
      const payload = {};
      if (req.body?.username !== void 0) {
        const username = String(req.body.username).trim().toLowerCase();
        if (!username) return res.status(400).json({ success: false, error: "Usu\xE1rio n\xE3o pode ficar em branco" });
        payload.username = username;
      }
      if (req.body?.nome_exibicao !== void 0) payload.nome_exibicao = String(req.body.nome_exibicao).trim();
      if (req.body?.roles !== void 0) {
        const roles = req.body.roles;
        if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => ALL_ROLES.includes(r))) {
          return res.status(400).json({ success: false, error: "Selecione pelo menos um papel v\xE1lido" });
        }
        payload.roles = roles;
      }
      if (req.body?.permissoes !== void 0) payload.permissoes = sanitizarPermissoes(req.body.permissoes);
      if (req.body?.ativo !== void 0) payload.ativo = Boolean(req.body.ativo);
      const { data: atual, error: erroAtual } = await supabase2.from("usuarios").select("id, roles, ativo").eq("id", req.params.id).maybeSingle();
      if (erroAtual) throw erroAtual;
      if (!atual) return res.status(404).json({ success: false, error: "Usu\xE1rio n\xE3o encontrado" });
      const vaiDesativar = payload.ativo === false;
      const vaiTirarDeAdmin = payload.roles !== void 0 && !payload.roles.includes("admin");
      const alvoEhEuMesmo = req.usuario?.id === req.params.id;
      if (alvoEhEuMesmo && (vaiDesativar || vaiTirarDeAdmin)) {
        return res.status(400).json({ success: false, error: "N\xE3o \xE9 poss\xEDvel remover seu pr\xF3prio acesso de administrador" });
      }
      if (atual.roles.includes("admin") && atual.ativo && (vaiDesativar || vaiTirarDeAdmin)) {
        const { count, error: erroContagem } = await supabase2.from("usuarios").select("id", { count: "exact", head: true }).contains("roles", ["admin"]).eq("ativo", true).neq("id", req.params.id);
        if (erroContagem) throw erroContagem;
        if (!count) {
          return res.status(400).json({ success: false, error: "N\xE3o \xE9 poss\xEDvel remover o \xFAltimo administrador ativo do sistema" });
        }
      }
      const { data, error } = await supabase2.from("usuarios").update(payload).eq("id", req.params.id).select(SELECT_SEM_SENHA).single();
      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ success: false, error: "J\xE1 existe um usu\xE1rio com esse username" });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar usu\xE1rio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", async (req, res) => {
    try {
      const alvoId = req.params.id;
      const adminId = req.usuario.id;
      if (alvoId === adminId) {
        return res.status(400).json({ success: false, error: "N\xE3o \xE9 poss\xEDvel excluir a si mesmo" });
      }
      const { data: alvo, error: erroAlvo } = await supabase2.from("usuarios").select("id, roles, ativo, nome_exibicao").eq("id", alvoId).maybeSingle();
      if (erroAlvo) throw erroAlvo;
      if (!alvo) return res.status(404).json({ success: false, error: "Usu\xE1rio n\xE3o encontrado" });
      if (alvo.roles.includes("admin") && alvo.ativo) {
        const { count, error: erroContagem } = await supabase2.from("usuarios").select("id", { count: "exact", head: true }).contains("roles", ["admin"]).eq("ativo", true).neq("id", alvoId);
        if (erroContagem) throw erroContagem;
        if (!count) {
          return res.status(400).json({ success: false, error: "N\xE3o \xE9 poss\xEDvel excluir o \xFAltimo administrador ativo do sistema" });
        }
      }
      const reatribuicoes = [
        supabase2.from("tarefas").update({ atribuido_para: adminId }).eq("atribuido_para", alvoId),
        supabase2.from("tarefas").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("lembretes").update({ atribuido_para: adminId }).eq("atribuido_para", alvoId),
        supabase2.from("lembretes").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("clientes_notas").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("comprovantes_pix").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("comprovantes_pix").update({ removido_por: adminId }).eq("removido_por", alvoId),
        supabase2.from("pecas_procuradas").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("envios").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("caixa_pendencias").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("caixa_pendencia_recebimentos").update({ recebido_por: adminId }).eq("recebido_por", alvoId),
        supabase2.from("fiado_recebimentos").update({ recebido_por: adminId }).eq("recebido_por", alvoId),
        supabase2.from("cobrancas").update({ criado_por: adminId }).eq("criado_por", alvoId),
        supabase2.from("cobrancas").update({ enviado_por: adminId }).eq("enviado_por", alvoId)
      ];
      const resultados = await Promise.all(reatribuicoes);
      for (const r of resultados) {
        if (r.error) throw new Error(`Erro na reatribui\xE7\xE3o: ${r.error.message}`);
      }
      const { error: erroDeletar } = await supabase2.from("usuarios").delete().eq("id", alvoId);
      if (erroDeletar) throw erroDeletar;
      res.json({ success: true, data: null, mensagem: `Usu\xE1rio "${alvo.nome_exibicao}" exclu\xEDdo. Registros reatribu\xEDdos para voc\xEA.` });
    } catch (error) {
      console.error("Erro ao excluir usu\xE1rio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/reset-password", async (req, res) => {
    try {
      const password = String(req.body?.password || "");
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: "Senha precisa ter pelo menos 6 caracteres" });
      }
      const senha_hash = bcrypt.hashSync(password, 10);
      const { error } = await supabase2.from("usuarios").update({ senha_hash }).eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/tarefas.ts
import { Router as Router19 } from "express";
var SELECT_COM_JOINS3 = "*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone), itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por, concluido_por_usuario:usuarios!concluido_por(id, nome_exibicao)), participantes:tarefa_participantes(id, usuario_id, concluido, concluido_em, lida, usuario:usuarios!usuario_id(id, nome_exibicao)), imagens:tarefa_imagens(id, url, ordem)";
var CAMPOS_EDITAVEIS3 = ["titulo", "descricao", "prazo", "atribuido_para", "cliente_id", "prioridade", "tipo"];
var ERRO_RESPONSAVEL_INVALIDO = "Respons\xE1vel precisa ser um usu\xE1rio ativo com acesso \xE0s tarefas (ou voc\xEA mesmo)";
var PRIORIDADES_VALIDAS = ["baixa", "media", "alta"];
var TIPOS_VALIDOS = ["geral", "visita"];
function normalizarItens(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({ id: i?.id, texto: String(i?.texto ?? "").trim() })).filter((i) => i.texto.length > 0).map((i) => i.id ? { id: i.id, texto: i.texto } : { texto: i.texto });
}
function comItensOrdenados(tarefa) {
  const itens = (tarefa.itens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const imagens = (tarefa.imagens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return { ...tarefa, itens, imagens };
}
function normalizarImagens(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((u) => String(u ?? "").trim()).filter((u) => u.length > 0);
}
function derivarConclusao(itens, statusAtual, agoraIso = (/* @__PURE__ */ new Date()).toISOString()) {
  if (itens.length === 0) return null;
  const todos = itens.every((i) => i.concluido);
  if (todos && statusAtual !== "concluida") return { status: "concluida", concluida_em: agoraIso };
  if (!todos && statusAtual === "concluida") return { status: "pendente", concluida_em: null };
  return null;
}
function responsavelValido(responsavel, souEuMesmo) {
  if (!responsavel || !responsavel.ativo) return false;
  if (souEuMesmo) return true;
  const admin = Array.isArray(responsavel.roles) && responsavel.roles.includes("admin");
  return pode(responsavel.permissoes, admin, "tarefas.ver");
}
function normalizarMotivoPausa(raw) {
  return String(raw ?? "").trim();
}
function podePausarTarefa(status) {
  return status === "pendente";
}
function souParticipante(tarefa, usuarioId) {
  if (tarefa.atribuido_para === usuarioId) return true;
  return (tarefa.participantes ?? []).some((p) => p.usuario_id === usuarioId);
}
function aguardandoAprovacao(tarefa) {
  const participantes = tarefa.participantes ?? [];
  if (participantes.length === 0 || tarefa.status !== "pendente") return false;
  return participantes.every((p) => p.concluido);
}
function tarefasRouter(supabase2) {
  const router = Router19();
  async function recalcularEDevolver(tarefaId) {
    const { count: totalParticipantes } = await supabase2.from("tarefa_participantes").select("id", { count: "exact", head: true }).eq("tarefa_id", tarefaId);
    if (!totalParticipantes) {
      const { data: itens } = await supabase2.from("tarefa_itens").select("concluido").eq("tarefa_id", tarefaId);
      const { data: atual } = await supabase2.from("tarefas").select("status").eq("id", tarefaId).single();
      const patch = derivarConclusao(itens ?? [], atual.status);
      if (patch) await supabase2.from("tarefas").update(patch).eq("id", tarefaId);
    }
    const { data, error } = await supabase2.from("tarefas").select(SELECT_COM_JOINS3).eq("id", tarefaId).single();
    if (error || !data) throw error ?? new Error("Tarefa n\xE3o encontrada ao recarregar ap\xF3s atualiza\xE7\xE3o");
    return comItensOrdenados(data);
  }
  router.get("/", async (req, res) => {
    try {
      if (!temPermissao(req.usuario, "tarefas.ver")) {
        return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      }
      let query = supabase2.from("tarefas").select(SELECT_COM_JOINS3).order("status", { ascending: true }).order("prazo", { ascending: true, nullsFirst: false });
      const gerente = temPermissao(req.usuario, "tarefas.criar");
      if (gerente) {
        if (req.query.status) query = query.eq("status", String(req.query.status));
        if (req.query.atribuido_para) query = query.eq("atribuido_para", String(req.query.atribuido_para));
        if (req.query.cliente_id) query = query.eq("cliente_id", String(req.query.cliente_id));
      }
      const { data, error } = await query;
      if (error) throw error;
      let resultado = data ?? [];
      if (!gerente) resultado = resultado.filter((t) => souParticipante(t, req.usuario.id));
      res.json({ success: true, data: resultado.map(comItensOrdenados) });
    } catch (error) {
      console.error("Erro ao listar tarefas:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", async (req, res) => {
    try {
      if (!temPermissao(req.usuario, "tarefas.criar")) {
        return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      }
      const titulo = String(req.body?.titulo || "").trim();
      const itens = normalizarItens(req.body?.itens);
      const imagens = normalizarImagens(req.body?.imagens);
      const atribuido_para = req.body?.atribuido_para;
      const participantesIdsBrutos = req.body?.participantes_ids;
      const usaParticipantes = Array.isArray(participantesIdsBrutos) && participantesIdsBrutos.length > 0;
      if (!titulo && itens.length === 0) {
        return res.status(400).json({ success: false, error: "Informe um t\xEDtulo ou pelo menos um item" });
      }
      if (!usaParticipantes && !atribuido_para) return res.status(400).json({ success: false, error: "Respons\xE1vel \xE9 obrigat\xF3rio" });
      const prioridade = req.body?.prioridade || "media";
      if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
        return res.status(400).json({ success: false, error: "Prioridade inv\xE1lida" });
      }
      const tipo = req.body?.tipo || "geral";
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: "Tipo de tarefa inv\xE1lido" });
      }
      if (usaParticipantes) {
        const idsUnicos = Array.from(new Set(participantesIdsBrutos.map((id) => String(id))));
        const { data: candidatos, error: erroCandidatos } = await supabase2.from("usuarios").select("id, roles, permissoes, ativo").in("id", idsUnicos);
        if (erroCandidatos) throw erroCandidatos;
        const porId = new Map((candidatos ?? []).map((u) => [u.id, u]));
        for (const id of idsUnicos) {
          if (!responsavelValido(porId.get(id) ?? null, id === req.usuario.id)) {
            return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
          }
        }
        const payload2 = {
          titulo: titulo || null,
          descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
          prazo: req.body?.prazo || null,
          atribuido_para: idsUnicos[0],
          criado_por: req.usuario.id,
          cliente_id: req.body?.cliente_id || null,
          prioridade,
          tipo
        };
        const { data: criada, error: erroCriada } = await supabase2.from("tarefas").insert(payload2).select("id").single();
        if (erroCriada) throw erroCriada;
        const linhasParticipantes = idsUnicos.map((usuario_id) => ({
          tarefa_id: criada.id,
          usuario_id,
          lida: usuario_id === req.usuario.id
        }));
        const { error: erroParticipantes } = await supabase2.from("tarefa_participantes").insert(linhasParticipantes);
        if (erroParticipantes) throw erroParticipantes;
        if (itens.length > 0) {
          const linhasItens = itens.map((it, i) => ({ tarefa_id: criada.id, texto: it.texto, ordem: i }));
          const { error: erroItens } = await supabase2.from("tarefa_itens").insert(linhasItens);
          if (erroItens) throw erroItens;
        }
        if (imagens.length > 0) {
          const linhasImagens = imagens.map((url, i) => ({ tarefa_id: criada.id, url, ordem: i }));
          const { error: erroImagens } = await supabase2.from("tarefa_imagens").insert(linhasImagens);
          if (erroImagens) throw erroImagens;
        }
        const corpo = titulo || itens[0]?.texto || "Nova tarefa";
        for (const id of idsUnicos) {
          if (id === req.usuario.id) continue;
          notificarUsuario(supabase2, id, { titulo: "Nova tarefa", corpo, url: "/tarefas" }).catch(
            (e) => console.error("Erro ao notificar nova tarefa:", e)
          );
        }
        const { data: completa2, error: erroCompleta2 } = await supabase2.from("tarefas").select(SELECT_COM_JOINS3).eq("id", criada.id).single();
        if (erroCompleta2) throw erroCompleta2;
        return res.json({ success: true, data: comItensOrdenados(completa2) });
      }
      const { data: responsavel, error: erroResponsavel } = await supabase2.from("usuarios").select("id, roles, permissoes, ativo").eq("id", atribuido_para).maybeSingle();
      if (erroResponsavel) throw erroResponsavel;
      if (!responsavelValido(responsavel, atribuido_para === req.usuario.id)) {
        return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
      }
      const payload = {
        titulo: titulo || null,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        prazo: req.body?.prazo || null,
        atribuido_para,
        criado_por: req.usuario.id,
        cliente_id: req.body?.cliente_id || null,
        prioridade,
        tipo
      };
      const { data, error } = await supabase2.from("tarefas").insert(payload).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      const { error: erroParticipante } = await supabase2.from("tarefa_participantes").insert({
        tarefa_id: data.id,
        usuario_id: atribuido_para,
        lida: atribuido_para === req.usuario.id
      });
      if (erroParticipante) throw erroParticipante;
      if (itens.length > 0) {
        const linhas = itens.map((it, i) => ({ tarefa_id: data.id, texto: it.texto, ordem: i }));
        const { error: erroItens } = await supabase2.from("tarefa_itens").insert(linhas);
        if (erroItens) throw erroItens;
      }
      if (imagens.length > 0) {
        const linhasImagens = imagens.map((url, i) => ({ tarefa_id: data.id, url, ordem: i }));
        const { error: erroImagens } = await supabase2.from("tarefa_imagens").insert(linhasImagens);
        if (erroImagens) throw erroImagens;
      }
      const { data: completa, error: erroCompleta } = await supabase2.from("tarefas").select(SELECT_COM_JOINS3).eq("id", data.id).single();
      if (erroCompleta) throw erroCompleta;
      if (atribuido_para !== req.usuario.id) {
        const corpo = titulo || itens[0]?.texto || "Nova tarefa";
        notificarUsuario(supabase2, atribuido_para, { titulo: "Nova tarefa", corpo, url: "/tarefas" }).catch(
          (e) => console.error("Erro ao notificar nova tarefa:", e)
        );
      }
      res.json({ success: true, data: comItensOrdenados(completa ?? data) });
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  async function carregarTarefaEditavel(req, res, chave) {
    if (!temPermissao(req.usuario, chave)) {
      res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      return null;
    }
    const { data: tarefa, error } = await supabase2.from("tarefas").select("id, criado_por").eq("id", req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!tarefa) {
      res.status(404).json({ success: false, error: "Tarefa n\xE3o encontrada" });
      return null;
    }
    if (!ehAdmin(req.usuario) && tarefa.criado_por !== req.usuario.id) {
      res.status(403).json({ success: false, error: "S\xF3 quem criou a tarefa pode alter\xE1-la" });
      return null;
    }
    return tarefa;
  }
  router.patch("/:id", async (req, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, "tarefas.editar");
      if (!tarefa) return;
      const payload = {};
      for (const campo of CAMPOS_EDITAVEIS3) {
        if (req.body?.[campo] !== void 0) payload[campo] = req.body[campo];
      }
      if (payload.titulo === "") payload.titulo = null;
      const participantesInformados = Array.isArray(req.body?.participantes_ids);
      const participantesIds = participantesInformados ? Array.from(new Set(req.body.participantes_ids.map((id) => String(id)).filter(Boolean))) : void 0;
      if (participantesInformados) {
        if (!participantesIds?.length) {
          return res.status(400).json({ success: false, error: "Selecione pelo menos um respons\xE1vel" });
        }
        const { data: candidatos, error: erroCandidatos } = await supabase2.from("usuarios").select("id, roles, permissoes, ativo").in("id", participantesIds);
        if (erroCandidatos) throw erroCandidatos;
        const porId = new Map((candidatos ?? []).map((u) => [u.id, u]));
        for (const id of participantesIds) {
          if (!responsavelValido(porId.get(id) ?? null, id === req.usuario.id)) {
            return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
          }
        }
        payload.atribuido_para = participantesIds[0];
      }
      if (payload.atribuido_para !== void 0) {
        const { data: responsavel } = await supabase2.from("usuarios").select("id, roles, permissoes, ativo").eq("id", payload.atribuido_para).maybeSingle();
        if (!responsavelValido(responsavel, payload.atribuido_para === req.usuario.id)) {
          return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
        }
      }
      const itensSendoAlterados = req.body?.itens !== void 0;
      const tituloSendoLimpo = req.body?.titulo !== void 0 && !payload.titulo;
      let desejados;
      if (itensSendoAlterados) desejados = normalizarItens(req.body.itens);
      if (tituloSendoLimpo || itensSendoAlterados) {
        let tituloFinal;
        if (req.body?.titulo !== void 0) {
          tituloFinal = String(req.body.titulo || "").trim();
        } else {
          const { data: tAtual } = await supabase2.from("tarefas").select("titulo").eq("id", req.params.id).single();
          tituloFinal = (tAtual?.titulo ?? "").trim();
        }
        let totalItensFinal;
        if (desejados !== void 0) {
          totalItensFinal = desejados.length;
        } else {
          const { count } = await supabase2.from("tarefa_itens").select("id", { count: "exact", head: true }).eq("tarefa_id", req.params.id);
          totalItensFinal = count ?? 0;
        }
        if (totalItensFinal === 0 && !tituloFinal) {
          return res.status(400).json({ success: false, error: "Informe um t\xEDtulo ou pelo menos um item" });
        }
      }
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase2.from("tarefas").update(payload).eq("id", req.params.id);
        if (error) throw error;
      }
      if (desejados !== void 0) {
        const { data: atuais } = await supabase2.from("tarefa_itens").select("id").eq("tarefa_id", req.params.id);
        const idsAtuais = new Set((atuais ?? []).map((i) => i.id));
        const idsDesejados = new Set(desejados.filter((i) => i.id).map((i) => i.id));
        const remover = [...idsAtuais].filter((id) => !idsDesejados.has(id));
        if (remover.length) await supabase2.from("tarefa_itens").delete().in("id", remover);
        for (let i = 0; i < desejados.length; i++) {
          const it = desejados[i];
          if (it.id && idsAtuais.has(it.id)) {
            await supabase2.from("tarefa_itens").update({ texto: it.texto, ordem: i }).eq("id", it.id);
          } else {
            await supabase2.from("tarefa_itens").insert({ tarefa_id: req.params.id, texto: it.texto, ordem: i });
          }
        }
      }
      if (req.body?.imagens !== void 0) {
        const desejadas = normalizarImagens(req.body.imagens);
        await supabase2.from("tarefa_imagens").delete().eq("tarefa_id", req.params.id);
        if (desejadas.length > 0) {
          const linhas = desejadas.map((url, i) => ({ tarefa_id: req.params.id, url, ordem: i }));
          const { error: erroImagens } = await supabase2.from("tarefa_imagens").insert(linhas);
          if (erroImagens) throw erroImagens;
        }
      }
      if (participantesInformados && participantesIds) {
        const { data: participantesAtuais, error: erroLeituraParticipantes } = await supabase2.from("tarefa_participantes").select("usuario_id, lida").eq("tarefa_id", req.params.id);
        if (erroLeituraParticipantes) throw erroLeituraParticipantes;
        const lidaPorUsuario = new Map((participantesAtuais ?? []).map((participante) => [
          participante.usuario_id,
          Boolean(participante.lida)
        ]));
        const { error: erroRemocao } = await supabase2.from("tarefa_participantes").delete().eq("tarefa_id", req.params.id);
        if (erroRemocao) throw erroRemocao;
        if (participantesIds.length > 0) {
          const { error: erroParticipantes } = await supabase2.from("tarefa_participantes").insert(
            participantesIds.map((usuario_id) => ({
              tarefa_id: req.params.id,
              usuario_id,
              lida: lidaPorUsuario.get(usuario_id) ?? usuario_id === req.usuario.id
            }))
          );
          if (erroParticipantes) throw erroParticipantes;
        }
      }
      const data = await recalcularEDevolver(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/pausar", async (req, res) => {
    try {
      const tarefaEditavel = await carregarTarefaEditavel(req, res, "tarefas.editar");
      if (!tarefaEditavel) return;
      const motivo = normalizarMotivoPausa(req.body?.motivo);
      if (!motivo) return res.status(400).json({ success: false, error: "Informe o motivo da pausa" });
      const { data: atual, error: erroAtual } = await supabase2.from("tarefas").select("status").eq("id", req.params.id).single();
      if (erroAtual) throw erroAtual;
      if (!podePausarTarefa(atual.status)) {
        return res.status(400).json({ success: false, error: "Tarefa conclu\xEDda n\xE3o pode ser pausada" });
      }
      const { data, error } = await supabase2.from("tarefas").update({ pausada: true, pausada_em: (/* @__PURE__ */ new Date()).toISOString(), pausada_por: req.usuario.id, pausa_motivo: motivo }).eq("id", req.params.id).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error) {
      console.error("Erro ao pausar tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/despausar", async (req, res) => {
    try {
      const tarefaEditavel = await carregarTarefaEditavel(req, res, "tarefas.editar");
      if (!tarefaEditavel) return;
      const { data, error } = await supabase2.from("tarefas").update({ pausada: false, pausada_em: null, pausada_por: null, pausa_motivo: null }).eq("id", req.params.id).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error) {
      console.error("Erro ao retomar tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/concluir", async (req, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase2.from("tarefas").select("id, atribuido_para, participantes:tarefa_participantes(usuario_id)").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: "Tarefa n\xE3o encontrada" });
      const podeConcluir = temPermissao(req.usuario, "tarefas.concluir") && (temPermissao(req.usuario, "tarefas.criar") || souParticipante(tarefa, req.usuario.id));
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: "S\xF3 o respons\xE1vel pela tarefa pode dar baixa" });
      }
      if ((tarefa.participantes ?? []).length > 0) {
        return res.status(400).json({ success: false, error: "Esta tarefa tem participantes \u2014 cada um marca sua parte e quem criou finaliza (PATCH /finalizar)." });
      }
      const { count } = await supabase2.from("tarefa_itens").select("id", { count: "exact", head: true }).eq("tarefa_id", req.params.id);
      if ((count ?? 0) > 0) {
        return res.status(400).json({ success: false, error: "Esta tarefa \xE9 controlada pelos itens do checklist \u2014 marque/desmarque os itens." });
      }
      const { data, error } = await supabase2.from("tarefas").update({ status: "concluida", concluida_em: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", req.params.id).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao concluir tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/reabrir", async (req, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase2.from("tarefas").select("id, atribuido_para, participantes:tarefa_participantes(usuario_id)").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: "Tarefa n\xE3o encontrada" });
      const podeReabrir = temPermissao(req.usuario, "tarefas.concluir") && (temPermissao(req.usuario, "tarefas.criar") || souParticipante(tarefa, req.usuario.id));
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: "S\xF3 o respons\xE1vel pela tarefa pode reabri-la" });
      }
      if ((tarefa.participantes ?? []).length > 0) {
        return res.status(400).json({ success: false, error: "Esta tarefa tem participantes \u2014 reabra revertendo a finaliza\xE7\xE3o, n\xE3o por aqui." });
      }
      const { count } = await supabase2.from("tarefa_itens").select("id", { count: "exact", head: true }).eq("tarefa_id", req.params.id);
      if ((count ?? 0) > 0) {
        return res.status(400).json({ success: false, error: "Esta tarefa \xE9 controlada pelos itens do checklist \u2014 marque/desmarque os itens." });
      }
      const { data, error } = await supabase2.from("tarefas").update({ status: "pendente", concluida_em: null }).eq("id", req.params.id).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao reabrir tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/itens/:itemId/toggle", async (req, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase2.from("tarefas").select("id, atribuido_para, participantes:tarefa_participantes(usuario_id)").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: "Tarefa n\xE3o encontrada" });
      const podeMarcar = temPermissao(req.usuario, "tarefas.concluir") && (temPermissao(req.usuario, "tarefas.criar") || souParticipante(tarefa, req.usuario.id));
      if (!podeMarcar) return res.status(403).json({ success: false, error: "S\xF3 o respons\xE1vel pela tarefa pode marcar os itens" });
      const { data: item, error: erroItem } = await supabase2.from("tarefa_itens").select("id, concluido").eq("id", req.params.itemId).eq("tarefa_id", req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: "Item n\xE3o encontrado" });
      const novo = !item.concluido;
      const { error: erroUp } = await supabase2.from("tarefa_itens").update({
        concluido: novo,
        concluido_em: novo ? (/* @__PURE__ */ new Date()).toISOString() : null,
        concluido_por: novo ? req.usuario.id : null
      }).eq("id", item.id);
      if (erroUp) throw erroUp;
      const data = await recalcularEDevolver(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao alternar item da tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/participantes/toggle", async (req, res) => {
    try {
      if (!temPermissao(req.usuario, "tarefas.concluir")) {
        return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      }
      const { data: tarefa, error: erroBusca } = await supabase2.from("tarefas").select("id, titulo, criado_por").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: "Tarefa n\xE3o encontrada" });
      const { data: participante, error: erroParticipante } = await supabase2.from("tarefa_participantes").select("id, concluido").eq("tarefa_id", req.params.id).eq("usuario_id", req.usuario.id).maybeSingle();
      if (erroParticipante) throw erroParticipante;
      if (!participante) return res.status(403).json({ success: false, error: "Voc\xEA n\xE3o \xE9 participante desta tarefa" });
      const novo = !participante.concluido;
      const { error: erroUp } = await supabase2.from("tarefa_participantes").update({ concluido: novo, concluido_em: novo ? (/* @__PURE__ */ new Date()).toISOString() : null }).eq("id", participante.id);
      if (erroUp) throw erroUp;
      const data = await recalcularEDevolver(req.params.id);
      if (aguardandoAprovacao(data) && tarefa.criado_por !== req.usuario.id) {
        notificarUsuario(supabase2, tarefa.criado_por, {
          titulo: "Tarefa pronta pra aprova\xE7\xE3o",
          corpo: `Todos os participantes conclu\xEDram "${tarefa.titulo || "a tarefa"}" \u2014 falta voc\xEA finalizar.`,
          url: "/tarefas"
        }).catch((e) => console.error("Erro ao notificar aprova\xE7\xE3o pendente:", e));
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao alternar participa\xE7\xE3o na tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/marcar-lida", async (req, res) => {
    try {
      const { error } = await supabase2.from("tarefa_participantes").update({ lida: true }).eq("tarefa_id", req.params.id).eq("usuario_id", req.usuario.id).eq("lida", false);
      if (error) throw error;
      res.json({ success: true, data: null });
    } catch (error) {
      console.error("Erro ao marcar tarefa como lida:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/finalizar", async (req, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, "tarefas.criar");
      if (!tarefa) return;
      const { data: completa, error: erroCompleta } = await supabase2.from("tarefas").select(SELECT_COM_JOINS3).eq("id", req.params.id).single();
      if (erroCompleta) throw erroCompleta;
      const atual = comItensOrdenados(completa);
      if (!aguardandoAprovacao(atual)) {
        return res.status(400).json({ success: false, error: "Esta tarefa ainda n\xE3o est\xE1 pronta pra finalizar \u2014 falta algum participante concluir a pr\xF3pria parte." });
      }
      const { data, error } = await supabase2.from("tarefas").update({ status: "concluida", concluida_em: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", req.params.id).select(SELECT_COM_JOINS3).single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error) {
      console.error("Erro ao finalizar tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", async (req, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, "tarefas.excluir");
      if (!tarefa) return;
      const { error } = await supabase2.from("tarefas").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/lembretes.ts
import { Router as Router20 } from "express";
var SELECT_COM_JOINS4 = "*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao)";
function podeAcessar(usuario) {
  return temPermissao(usuario, "tarefas.ver");
}
function ehGerente(usuario) {
  return temPermissao(usuario, "tarefas.criar");
}
function calcularProximaNotificacao(intervaloMinutos, horarioFixo) {
  if (intervaloMinutos != null) return new Date(Date.now() + intervaloMinutos * 60 * 1e3).toISOString();
  if (horarioFixo) return new Date(horarioFixo).toISOString();
  return null;
}
function lembretesRouter(supabase2) {
  const router = Router20();
  router.get("/", async (req, res) => {
    try {
      if (!podeAcessar(req.usuario)) {
        return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      }
      const meuId = req.usuario.id;
      let query = supabase2.from("lembretes").select(SELECT_COM_JOINS4).or(`atribuido_para.eq.${meuId},criado_por.eq.${meuId}`).order("status", { ascending: true }).order("proxima_notificacao_em", { ascending: true, nullsFirst: false });
      if (req.query.status) query = query.eq("status", String(req.query.status));
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar lembretes:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", async (req, res) => {
    try {
      if (!podeAcessar(req.usuario)) {
        return res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      }
      const titulo = String(req.body?.titulo || "").trim();
      if (!titulo) return res.status(400).json({ success: false, error: "T\xEDtulo \xE9 obrigat\xF3rio" });
      const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
      const horarioFixo = req.body?.horario_fixo || null;
      if (intervaloMinutos == null && !horarioFixo) {
        return res.status(400).json({ success: false, error: "Escolha um intervalo de repeti\xE7\xE3o ou um hor\xE1rio espec\xEDfico" });
      }
      if (intervaloMinutos != null && horarioFixo) {
        return res.status(400).json({ success: false, error: "Escolha s\xF3 um: repetir OU hor\xE1rio espec\xEDfico" });
      }
      if (intervaloMinutos != null && (!Number.isFinite(intervaloMinutos) || intervaloMinutos < 5)) {
        return res.status(400).json({ success: false, error: "Intervalo m\xEDnimo \xE9 5 minutos" });
      }
      const atribuidoPara = req.body?.atribuido_para || req.usuario.id;
      if (atribuidoPara !== req.usuario.id) {
        const { data: destinatario, error: erroDestinatario } = await supabase2.from("usuarios").select("id, ativo").eq("id", atribuidoPara).maybeSingle();
        if (erroDestinatario) throw erroDestinatario;
        if (!destinatario || !destinatario.ativo) {
          return res.status(400).json({ success: false, error: "Respons\xE1vel precisa ser um usu\xE1rio ativo" });
        }
      }
      const payload = {
        titulo,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        atribuido_para: atribuidoPara,
        criado_por: req.usuario.id,
        intervalo_minutos: intervaloMinutos,
        proxima_notificacao_em: calcularProximaNotificacao(intervaloMinutos, horarioFixo)
      };
      const { data, error } = await supabase2.from("lembretes").insert(payload).select(SELECT_COM_JOINS4).single();
      if (error) throw error;
      if (atribuidoPara !== req.usuario.id) {
        notificarUsuario(supabase2, atribuidoPara, { titulo: "Novo lembrete", corpo: titulo, url: "/tarefas" }).catch(
          (e) => console.error("Erro ao notificar novo lembrete:", e)
        );
      }
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar lembrete:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  async function carregarLembreteEditavel(req, res) {
    if (!podeAcessar(req.usuario)) {
      res.status(403).json({ success: false, error: "Acesso negado para este perfil" });
      return null;
    }
    const { data: lembrete, error } = await supabase2.from("lembretes").select("id, criado_por, atribuido_para").eq("id", req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!lembrete) {
      res.status(404).json({ success: false, error: "Lembrete n\xE3o encontrado" });
      return null;
    }
    if (!ehAdmin(req.usuario) && lembrete.criado_por !== req.usuario.id) {
      res.status(403).json({ success: false, error: "S\xF3 quem criou o lembrete pode alter\xE1-lo" });
      return null;
    }
    return lembrete;
  }
  router.patch("/:id", async (req, res) => {
    try {
      const lembrete = await carregarLembreteEditavel(req, res);
      if (!lembrete) return;
      const payload = {};
      if (req.body?.titulo !== void 0) payload.titulo = String(req.body.titulo).trim();
      if (req.body?.descricao !== void 0) payload.descricao = req.body.descricao ? String(req.body.descricao).trim() : null;
      if (req.body?.atribuido_para !== void 0) payload.atribuido_para = req.body.atribuido_para;
      const intervaloMinutos = req.body?.intervalo_minutos !== void 0 ? req.body.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null : void 0;
      const horarioFixo = req.body?.horario_fixo !== void 0 ? req.body.horario_fixo || null : void 0;
      if (intervaloMinutos !== void 0 || horarioFixo !== void 0) {
        const novoIntervalo = intervaloMinutos !== void 0 ? intervaloMinutos : null;
        const novoHorario = horarioFixo !== void 0 ? horarioFixo : null;
        if (novoIntervalo == null && !novoHorario) {
          return res.status(400).json({ success: false, error: "Escolha um intervalo de repeti\xE7\xE3o ou um hor\xE1rio espec\xEDfico" });
        }
        if (novoIntervalo != null && novoHorario) {
          return res.status(400).json({ success: false, error: "Escolha s\xF3 um: repetir OU hor\xE1rio espec\xEDfico" });
        }
        if (novoIntervalo != null && (!Number.isFinite(novoIntervalo) || novoIntervalo < 5)) {
          return res.status(400).json({ success: false, error: "Intervalo m\xEDnimo \xE9 5 minutos" });
        }
        payload.intervalo_minutos = novoIntervalo;
        payload.proxima_notificacao_em = calcularProximaNotificacao(novoIntervalo, novoHorario);
      }
      const { data, error } = await supabase2.from("lembretes").update(payload).eq("id", req.params.id).select(SELECT_COM_JOINS4).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar lembrete:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/concluir", async (req, res) => {
    try {
      const { data: lembrete, error: erroBusca } = await supabase2.from("lembretes").select("id, atribuido_para").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!lembrete) return res.status(404).json({ success: false, error: "Lembrete n\xE3o encontrado" });
      const podeConcluir = ehGerente(req.usuario) || lembrete.atribuido_para === req.usuario.id;
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: "S\xF3 o respons\xE1vel pelo lembrete pode conclu\xED-lo" });
      }
      const { data, error } = await supabase2.from("lembretes").update({ status: "concluido", concluido_em: (/* @__PURE__ */ new Date()).toISOString(), proxima_notificacao_em: null }).eq("id", req.params.id).select(SELECT_COM_JOINS4).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao concluir lembrete:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id/reabrir", async (req, res) => {
    try {
      const { data: lembrete, error: erroBusca } = await supabase2.from("lembretes").select("id, atribuido_para, intervalo_minutos").eq("id", req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!lembrete) return res.status(404).json({ success: false, error: "Lembrete n\xE3o encontrado" });
      const podeReabrir = ehGerente(req.usuario) || lembrete.atribuido_para === req.usuario.id;
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: "S\xF3 o respons\xE1vel pelo lembrete pode reabri-lo" });
      }
      const proximaNotificacaoEm = lembrete.intervalo_minutos != null ? new Date(Date.now() + lembrete.intervalo_minutos * 60 * 1e3).toISOString() : null;
      const { data, error } = await supabase2.from("lembretes").update({ status: "pendente", concluido_em: null, proxima_notificacao_em: proximaNotificacaoEm }).eq("id", req.params.id).select(SELECT_COM_JOINS4).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao reabrir lembrete:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", async (req, res) => {
    try {
      const lembrete = await carregarLembreteEditavel(req, res);
      if (!lembrete) return;
      const { error } = await supabase2.from("lembretes").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao excluir lembrete:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/notificacoes.ts
import { Router as Router21 } from "express";
var SELECT_SUBSCRIPTION = "id, tipo, user_agent, ativo, criado_em";
function notificacoesRouter(supabase2) {
  const router = Router21();
  router.get("/vapid-public-key", (_req, res) => {
    const chave = process.env.VAPID_PUBLIC_KEY;
    if (!chave) return res.status(503).json({ success: false, error: "Push notifications n\xE3o configuradas neste servidor" });
    res.json({ success: true, data: { publicKey: chave } });
  });
  router.get("/me/subscriptions", async (req, res) => {
    try {
      const { data, error } = await supabase2.from("push_subscriptions").select(SELECT_SUBSCRIPTION).eq("usuario_id", req.usuario.id).order("criado_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar subscriptions:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/me/subscriptions", async (req, res) => {
    try {
      const { tipo, endpoint, keys, token, user_agent } = req.body || {};
      const userAgent = user_agent ? String(user_agent).slice(0, 200) : null;
      if (tipo === "web") {
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          return res.status(400).json({ success: false, error: "Subscription de Web Push incompleta" });
        }
        const { data, error } = await supabase2.from("push_subscriptions").upsert(
          { usuario_id: req.usuario.id, tipo: "web", endpoint, p256dh: keys.p256dh, auth_key: keys.auth, fcm_token: null, user_agent: userAgent, ativo: true },
          { onConflict: "endpoint" }
        ).select(SELECT_SUBSCRIPTION).single();
        if (error) throw error;
        return res.json({ success: true, data });
      }
      if (tipo === "fcm") {
        if (!token) return res.status(400).json({ success: false, error: "Token FCM \xE9 obrigat\xF3rio" });
        const { data, error } = await supabase2.from("push_subscriptions").upsert(
          { usuario_id: req.usuario.id, tipo: "fcm", endpoint: null, p256dh: null, auth_key: null, fcm_token: token, user_agent: userAgent, ativo: true },
          { onConflict: "fcm_token" }
        ).select(SELECT_SUBSCRIPTION).single();
        if (error) throw error;
        return res.json({ success: true, data });
      }
      res.status(400).json({ success: false, error: "Tipo de subscription inv\xE1lido" });
    } catch (error) {
      console.error("Erro ao registrar subscription:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  async function carregarSubscriptionDoUsuario(req, res) {
    const { data, error } = await supabase2.from("push_subscriptions").select("id, usuario_id").eq("id", req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!data || data.usuario_id !== req.usuario.id) {
      res.status(404).json({ success: false, error: "Subscription n\xE3o encontrada" });
      return null;
    }
    return data;
  }
  router.patch("/me/subscriptions/:id", async (req, res) => {
    try {
      const sub = await carregarSubscriptionDoUsuario(req, res);
      if (!sub) return;
      const ativo = req.body?.ativo;
      if (typeof ativo !== "boolean") return res.status(400).json({ success: false, error: '"ativo" precisa ser booleano' });
      const { data, error } = await supabase2.from("push_subscriptions").update({ ativo }).eq("id", sub.id).select(SELECT_SUBSCRIPTION).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar subscription:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/me/subscriptions/:id", async (req, res) => {
    try {
      const sub = await carregarSubscriptionDoUsuario(req, res);
      if (!sub) return;
      const { error } = await supabase2.from("push_subscriptions").delete().eq("id", sub.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover subscription:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/mercadolivre.ts
import { Router as Router22 } from "express";
import axios5 from "axios";
import crypto2 from "crypto";
var ML_AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
var ML_API_URL2 = "https://api.mercadolibre.com";
var estadosPendentes = /* @__PURE__ */ new Map();
var ESTADO_TTL_MS = 10 * 60 * 1e3;
function limparEstadosExpirados() {
  const agora = Date.now();
  for (const [estado, criadoEm] of estadosPendentes) {
    if (agora - criadoEm > ESTADO_TTL_MS) estadosPendentes.delete(estado);
  }
}
function mensagemErro(error) {
  return error.response?.data?.message || error.message;
}
function mercadolivreRouter(supabase2) {
  const router = Router22();
  router.get("/auth/login", exigirPermissao("mercadolivre.conectar"), (_req, res) => {
    limparEstadosExpirados();
    const estado = crypto2.randomBytes(24).toString("hex");
    estadosPendentes.set(estado, Date.now());
    const url = new URL(ML_AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", requireEnv("MERCADOLIVRE_APP_ID"));
    url.searchParams.set("redirect_uri", requireEnv("MERCADOLIVRE_REDIRECT_URI"));
    url.searchParams.set("state", estado);
    res.json({ success: true, url: url.toString() });
  });
  router.get("/status", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("mercadolivre_conexao").select("ml_user_id, atualizado_em").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return res.json({ success: true, conectado: false, ml_user_id: null });
        }
        throw error;
      }
      res.json({ success: true, conectado: !!data, ml_user_id: data?.ml_user_id ?? null });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/me", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const token = await obterAccessTokenValido(supabase2);
      if (!token) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const { data } = await axios5.get(`${ML_API_URL2}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.delete("/desconectar", exigirPermissao("mercadolivre.conectar"), async (_req, res) => {
    try {
      const { error } = await supabase2.from("mercadolivre_conexao").delete().not("ml_user_id", "is", null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/sincronizacao/preview", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const preview = await buscarPreviewSincronizacao(supabase2, conexao.accessToken);
      res.json({ success: true, data: preview });
    } catch (error) {
      console.error("Erro ao calcular preview de sincroniza\xE7\xE3o do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.post("/sincronizacao/aplicar", exigirPermissao("mercadolivre.sincronizar"), async (req, res) => {
    try {
      const linkIds = Array.isArray(req.body?.linkIds) ? req.body.linkIds.map((id) => String(id)) : [];
      if (linkIds.length === 0) return res.status(400).json({ success: false, error: "Selecione ao menos um an\xFAncio pra sincronizar" });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const resultado = await aplicarSincronizacao(supabase2, conexao.accessToken, linkIds);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao aplicar sincroniza\xE7\xE3o do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/configuracoes", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const margemPercentual = await obterMargemSincronizacao(supabase2);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error) {
      console.error("Erro ao buscar configura\xE7\xF5es do Mercado Livre:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/configuracoes", exigirPermissao("mercadolivre.conectar"), async (req, res) => {
    try {
      const margemPercentual = Number(req.body?.margem_percentual);
      if (!Number.isFinite(margemPercentual) || margemPercentual < 0 || margemPercentual > 500) {
        return res.status(400).json({ success: false, error: "A margem deve ser um n\xFAmero entre 0 e 500" });
      }
      await atualizarMargemSincronizacao(supabase2, margemPercentual);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error) {
      console.error("Erro ao atualizar configura\xE7\xF5es do Mercado Livre:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/anuncios-orfaos", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const orfaos = await listarAnunciosOrfaos(supabase2, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: orfaos });
    } catch (error) {
      console.error("Erro ao listar an\xFAncios \xF3rf\xE3os do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/anuncios-duplicados", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const duplicados = await listarAnunciosDuplicados(supabase2, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: duplicados });
    } catch (error) {
      console.error("Erro ao listar an\xFAncios duplicados do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.post("/anuncios/:mlbId/pausar", exigirPermissao("mercadolivre.pausar_anuncio"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      await pausarAnuncio(conexao.accessToken, req.params.mlbId);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao pausar an\xFAncio do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/pedidos/novos", exigirPermissao("mercadolivre.ver"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const dias = Number(req.query.dias) || 30;
      const pedidos = await buscarPreviewPedidos(supabase2, conexao.accessToken, conexao.mlUserId, dias);
      res.json({ success: true, data: pedidos });
    } catch (error) {
      console.error("Erro ao buscar pedidos novos do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.post("/pedidos/importar", exigirPermissao("mercadolivre.importar_pedidos"), async (req, res) => {
    try {
      const itensBody = Array.isArray(req.body?.itens) ? req.body.itens : [];
      if (itensBody.length === 0) return res.status(400).json({ success: false, error: "Selecione ao menos um item pra importar" });
      const itens = itensBody.map((i) => ({
        estoqueId: i.estoque_id,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valor_unitario) || 0,
        formaPagamentoId: i.forma_pagamento_id,
        clienteNome: i.cliente_nome || null,
        clienteId: i.cliente_id || null,
        data: i.data || null,
        mlOrderId: String(i.ml_order_id),
        mlItemId: String(i.ml_item_id),
        mlShippingId: i.ml_shipping_id ? String(i.ml_shipping_id) : null,
        mlSaleFee: i.ml_sale_fee != null ? Number(i.ml_sale_fee) : null,
        mlCustoEnvio: i.ml_custo_envio != null ? Number(i.ml_custo_envio) : null,
        mlDescontoVendedor: Number(i.ml_desconto_vendedor) || 0
      }));
      const resultado = await importarPedidosEmLote(supabase2, itens);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao importar pedidos do Mercado Livre:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/pedidos/corrigir-taxa", exigirPermissao("mercadolivre.importar_pedidos"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const resultado = await corrigirTaxaVendasMlImportadas(supabase2, conexao.accessToken);
      res.json({ success: true, data: resultado });
    } catch (error) {
      console.error("Erro ao corrigir taxa de vendas importadas do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/pedidos/:mlOrderId/envio", exigirPermissao("mercadolivre.ver"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const envio = await buscarEnvioDoPedido(supabase2, conexao.accessToken, req.params.mlOrderId);
      res.json({ success: true, data: envio });
    } catch (error) {
      console.error("Erro ao buscar envio do pedido do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/perguntas", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const perguntas = await buscarPerguntasComRascunho(supabase2, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: perguntas });
    } catch (error) {
      console.error("Erro ao buscar perguntas do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.post("/perguntas/:questionId/responder", exigirPermissao("mercadolivre.responder_perguntas"), async (req, res) => {
    try {
      const texto2 = String(req.body?.texto || "").trim();
      if (!texto2) return res.status(400).json({ success: false, error: "Escreva uma resposta antes de enviar" });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      await responderPergunta(conexao.accessToken, Number(req.params.questionId), texto2);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao responder pergunta do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/pendencias", exigirPermissao("mercadolivre.ver"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.json({ success: true, data: { perguntasSemResposta: 0, pedidosNovos: 0 } });
      const contagem = await contarPendencias(supabase2, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: contagem });
    } catch (error) {
      console.warn("Indicador de pend\xEAncias do Mercado Livre indispon\xEDvel:", error.response?.data || error.message);
      res.json({ success: true, data: { perguntasSemResposta: 0, pedidosNovos: 0 } });
    }
  });
  router.get("/categorias/sugerir", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const titulo = String(req.query.titulo || "").trim();
      if (!titulo) return res.status(400).json({ success: false, error: "Informe um t\xEDtulo pra sugerir a categoria" });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const sugestoes = await sugerirCategoria(conexao.accessToken, titulo);
      res.json({ success: true, data: sugestoes });
    } catch (error) {
      console.error("Erro ao sugerir categoria do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/categorias/filhos", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const categoriaId = req.query.categoria_id ? String(req.query.categoria_id) : void 0;
      const filhos = await listarFilhosCategoria(conexao.accessToken, categoriaId);
      res.json({ success: true, data: filhos });
    } catch (error) {
      console.error("Erro ao listar subcategorias do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/categorias/:id", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const detalhe = await buscarDetalheCategoria(conexao.accessToken, req.params.id);
      res.json({ success: true, data: detalhe });
    } catch (error) {
      console.error("Erro ao buscar detalhe de categoria do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/categorias/:id/atributos", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const atributos = await buscarAtributosCategoriaComCache(supabase2, conexao.accessToken, req.params.id);
      res.json({ success: true, data: atributos });
    } catch (error) {
      console.error("Erro ao buscar atributos de categoria do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/produtos-catalogo", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const titulo = String(req.query.titulo || "").trim();
      if (!titulo) return res.status(400).json({ success: false, error: "Informe um t\xEDtulo pra buscar produtos de cat\xE1logo" });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const produtos = await buscarProdutosCatalogo(conexao.accessToken, titulo);
      res.json({ success: true, data: produtos });
    } catch (error) {
      console.error("Erro ao buscar produtos de cat\xE1logo do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  router.get("/tipos-anuncio", exigirAlguma("mercadolivre.ver", "estoque.anunciar_ml"), async (req, res) => {
    try {
      const preco = Number(req.query.preco);
      if (!Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: "Informe um pre\xE7o v\xE1lido" });
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Conta do Mercado Livre ainda n\xE3o conectada" });
      const tipos = await buscarTiposAnuncioDisponiveis(conexao.accessToken, preco);
      res.json({ success: true, data: tipos });
    } catch (error) {
      console.error("Erro ao buscar tipos de an\xFAncio do Mercado Livre:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });
  return router;
}
function mercadolivreCallbackHandler(supabase2) {
  return async (req, res) => {
    limparEstadosExpirados();
    const { code, state, error: erroML } = req.query;
    const appUrl = process.env.APP_URL || "";
    if (erroML) return res.redirect(`${appUrl}/mercadolivre?ml_erro=${encodeURIComponent(erroML)}`);
    if (!code || !state || !estadosPendentes.has(state)) {
      return res.redirect(`${appUrl}/mercadolivre?ml_erro=estado_invalido`);
    }
    estadosPendentes.delete(state);
    try {
      await trocarTokens(supabase2, { grant_type: "authorization_code", code, redirect_uri: requireEnv("MERCADOLIVRE_REDIRECT_URI") });
      res.redirect(`${appUrl}/mercadolivre?conectado=1`);
    } catch (err) {
      console.error("Erro ao trocar code por token do Mercado Livre:", err.response?.data || err.message);
      res.redirect(`${appUrl}/mercadolivre?ml_erro=troca_token`);
    }
  };
}
function mercadolivreWebhookHandler(supabase2) {
  return async (req, res) => {
    res.sendStatus(200);
    const { topic, resource, user_id, application_id } = req.body || {};
    if (!topic || !resource) return;
    if (application_id && String(application_id) !== process.env.MERCADOLIVRE_APP_ID) return;
    const { error } = await supabase2.from("mercadolivre_notificacoes").upsert({ topic, resource, ml_user_id: user_id ? String(user_id) : null, origem: "webhook" }, { onConflict: "topic,resource", ignoreDuplicates: true });
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("Erro ao registrar notifica\xE7\xE3o do Mercado Livre:", error);
    }
  };
}

// src/server/routes/shopee.ts
import { Router as Router23 } from "express";
import crypto3 from "crypto";
var estadosPendentes2 = /* @__PURE__ */ new Map();
var ESTADO_TTL_MS2 = 10 * 60 * 1e3;
function limparEstadosExpirados2() {
  const agora = Date.now();
  for (const [estado, criadoEm] of estadosPendentes2) {
    if (agora - criadoEm > ESTADO_TTL_MS2) estadosPendentes2.delete(estado);
  }
}
function mensagemErro2(error) {
  return error.response?.data?.message || error.message;
}
function shopeeRouter(supabase2) {
  const router = Router23();
  router.get("/auth/login", exigirPermissao("estoque.anunciar_shopee"), (_req, res) => {
    limparEstadosExpirados2();
    const estado = crypto3.randomBytes(24).toString("hex");
    estadosPendentes2.set(estado, Date.now());
    res.json({ success: true, url: gerarUrlAutorizacaoShopee(estado) });
  });
  router.get("/status", exigirAlguma("estoque.ver", "estoque.anunciar_shopee"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from(TABELA_CONEXAO2).select("shop_id, atualizado_em").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          return res.json({ success: true, conectado: false, shop_id: null });
        }
        throw error;
      }
      res.json({ success: true, conectado: !!data, shop_id: data?.shop_id ?? null });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/desconectar", exigirPermissao("estoque.anunciar_shopee"), async (_req, res) => {
    try {
      const { error } = await supabase2.from(TABELA_CONEXAO2).delete().not("shop_id", "is", null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/configuracoes", exigirAlguma("estoque.ver", "estoque.anunciar_shopee"), async (_req, res) => {
    try {
      const margemPercentual = await obterMargemSincronizacaoShopee(supabase2);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error) {
      console.error("Erro ao buscar configura\xE7\xF5es da Shopee:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/configuracoes", exigirPermissao("estoque.anunciar_shopee"), async (req, res) => {
    try {
      const margemPercentual = Number(req.body?.margem_percentual);
      if (!Number.isFinite(margemPercentual) || margemPercentual < 0 || margemPercentual > 500) {
        return res.status(400).json({ success: false, error: "A margem deve ser um n\xFAmero entre 0 e 500" });
      }
      await atualizarMargemSincronizacaoShopee(supabase2, margemPercentual);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error) {
      console.error("Erro ao atualizar configura\xE7\xF5es da Shopee:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get("/categorias", exigirAlguma("estoque.ver", "estoque.anunciar_shopee"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      const raiz = await buscarCategoriasRaizShopee(conexao.accessToken, conexao.shopId);
      res.json({ success: true, data: raiz });
    } catch (error) {
      console.error("Erro ao listar categorias raiz da Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro2(error) });
    }
  });
  router.get("/categorias/:id", exigirAlguma("estoque.ver", "estoque.anunciar_shopee"), async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      const categoriaId = Number(req.params.id);
      const detalhe = await buscarCategoriaShopee(conexao.accessToken, conexao.shopId, categoriaId);
      const atributos = await buscarAtributosSeCategoriaFolha(conexao.accessToken, conexao.shopId, categoriaId, detalhe.filhos.length);
      res.json({ success: true, data: { categoria: detalhe.categoria, filhos: detalhe.filhos, atributos } });
    } catch (error) {
      console.error("Erro ao buscar categoria da Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro2(error) });
    }
  });
  router.get("/canais-logistica", exigirAlguma("estoque.ver", "estoque.anunciar_shopee"), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return res.status(409).json({ success: false, error: "Loja da Shopee ainda n\xE3o conectada" });
      const sugestao = await buscarCanalLogisticaPadrao(conexao.accessToken, conexao.shopId);
      res.json({ success: true, data: sugestao });
    } catch (error) {
      console.error("Erro ao listar canais de log\xEDstica da Shopee:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro2(error) });
    }
  });
  async function buscarAtributosSeCategoriaFolha(accessToken, shopId, categoriaId, quantidadeFilhos) {
    if (quantidadeFilhos > 0) return [];
    return buscarAtributosCategoriaComCache2(supabase2, accessToken, shopId, categoriaId);
  }
  return router;
}
function shopeeCallbackHandler(supabase2) {
  return async (req, res) => {
    limparEstadosExpirados2();
    const { code, shop_id: shopId, state, error: erroShopee } = req.query;
    const appUrl = process.env.APP_URL || "";
    if (erroShopee) return res.redirect(`${appUrl}/estoque?shopee_erro=${encodeURIComponent(erroShopee)}`);
    if (!code || !shopId || !state || !estadosPendentes2.has(state)) {
      return res.redirect(`${appUrl}/estoque?shopee_erro=estado_invalido`);
    }
    estadosPendentes2.delete(state);
    try {
      await trocarCodigoPorTokenShopee(supabase2, code, shopId);
      res.redirect(`${appUrl}/estoque?shopee_conectado=1`);
    } catch (err) {
      console.error("Erro ao trocar code por token da Shopee:", err.response?.data || err.message);
      res.redirect(`${appUrl}/estoque?shopee_erro=troca_token`);
    }
  };
}

// src/server/routes/dashboard.ts
import { Router as Router24 } from "express";
function dashboardRouter(supabase2) {
  const router = Router24();
  router.get("/resumo-pendencias", exigirPermissao("dashboard.ver"), async (_req, res) => {
    try {
      const [orcRes, vendasFiadoRes, fiadoRecRes, pendenciasManuaisRes] = await Promise.all([
        supabase2.from("orcamentos").select("id, codigo, cliente_nome, criado_em, itens:orcamento_itens(valor_unitario, quantidade)").eq("status", "aberto").order("criado_em", { ascending: false }).limit(5),
        supabase2.from("vendas").select("id, data, valor_total, cliente_nome, cliente_id, forma_pagamento:formas_pagamento(id, nome, natureza)").eq("forma_pagamento.natureza", "fiado"),
        supabase2.from("fiado_recebimentos").select("id, venda_id, valor, data"),
        supabase2.from("caixa_pendencias").select("id, valor_total, descricao, data, criado_em, recebimentos:caixa_pendencia_recebimentos(valor)").eq("status", "aberta")
      ]);
      if (orcRes.error) throw orcRes.error;
      const pendencias = (orcRes.data || []).map((o) => {
        const total = (o.itens || []).reduce((s, i) => s + Number(i.valor_unitario) * Number(i.quantidade), 0);
        return { id: o.id, codigo: o.codigo, cliente_nome: o.cliente_nome, criado_em: o.criado_em, total };
      });
      const vendasFiado = (vendasFiadoRes.data || []).filter((v) => v.forma_pagamento?.natureza === "fiado");
      const recebimentos = fiadoRecRes.data || [];
      const recebidoPorVenda = /* @__PURE__ */ new Map();
      for (const r of recebimentos) {
        recebidoPorVenda.set(r.venda_id, (recebidoPorVenda.get(r.venda_id) ?? 0) + Number(r.valor));
      }
      const EPSILON2 = 0.01;
      const agora = Date.now();
      const porCliente = /* @__PURE__ */ new Map();
      for (const v of vendasFiado) {
        const recebido = recebidoPorVenda.get(v.id) ?? 0;
        const saldo = Number(v.valor_total) - recebido;
        if (saldo <= EPSILON2) continue;
        const dias = Math.floor((agora - (/* @__PURE__ */ new Date(`${v.data}T00:00:00`)).getTime()) / 864e5);
        const chave = v.cliente_id || v.cliente_nome || "Sem cliente";
        const atual = porCliente.get(chave);
        if (atual) {
          atual.totalEmAberto += saldo;
          if (dias > atual.diasEmAbertoMax) atual.diasEmAbertoMax = dias;
        } else {
          porCliente.set(chave, { clienteNome: v.cliente_nome || "Sem cliente", totalEmAberto: saldo, diasEmAbertoMax: dias });
        }
      }
      const fiadoResumo = Array.from(porCliente.values()).filter((r) => r.diasEmAbertoMax >= 15).sort((a, b) => b.totalEmAberto - a.totalEmAberto);
      const fiadoTotalEmAberto = fiadoResumo.reduce((s, r) => s + r.totalEmAberto, 0);
      const pendenciasManuais = (pendenciasManuaisRes.data || []).map((p) => {
        const recebido = (p.recebimentos || []).reduce((s, r) => s + Number(r.valor), 0);
        return { id: p.id, descricao: p.descricao, saldo: Number(p.valor_total) - recebido };
      }).filter((p) => p.saldo > EPSILON2);
      const pendenciasManuaisTotalEmAberto = pendenciasManuais.reduce((s, p) => s + p.saldo, 0);
      res.json({
        success: true,
        data: {
          pendencias,
          totalPendencias: pendencias.length,
          fiadoResumo,
          fiadoTotalEmAberto,
          pendenciasManuaisTotalEmAberto,
          pendenciasManuaisQtd: pendenciasManuais.length
        }
      });
    } catch (error) {
      console.error("Erro ao buscar resumo de pend\xEAncias:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/server/routes/cobrancas.ts
import { Router as Router25 } from "express";
var SELECT_COBRANCA = "*, criador:usuarios!cobrancas_criado_por_fkey(id, nome_exibicao), enviador:usuarios!cobrancas_enviado_por_fkey(id, nome_exibicao)";
function cobrancasRouter(supabase2) {
  const router = Router25();
  router.get("/", exigirPermissao("caixa.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase2.from("cobrancas").select(SELECT_COBRANCA).order("criado_em", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao listar cobran\xE7as:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const vendaId = req.body?.venda_id || null;
      const pendenciaId = req.body?.pendencia_id || null;
      if (!vendaId && !pendenciaId) {
        return res.status(400).json({ success: false, error: "Informe venda_id ou pendencia_id" });
      }
      if (vendaId && pendenciaId) {
        return res.status(400).json({ success: false, error: "Informe apenas um: venda_id ou pendencia_id" });
      }
      const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
      const horarioFixo = req.body?.horario_fixo || null;
      if (intervaloMinutos != null && horarioFixo) {
        return res.status(400).json({ success: false, error: "Escolha s\xF3 um: intervalo OU hor\xE1rio fixo" });
      }
      if (intervaloMinutos != null && (!Number.isFinite(intervaloMinutos) || intervaloMinutos < 5)) {
        return res.status(400).json({ success: false, error: "Intervalo m\xEDnimo \xE9 5 minutos" });
      }
      const timerAtivo = !!(intervaloMinutos || horarioFixo);
      let proximaNotificacaoEm = null;
      if (timerAtivo) {
        if (intervaloMinutos) {
          proximaNotificacaoEm = new Date(Date.now() + intervaloMinutos * 60 * 1e3).toISOString();
        } else if (horarioFixo) {
          proximaNotificacaoEm = new Date(horarioFixo).toISOString();
        }
      }
      const payload = {
        venda_id: vendaId,
        pendencia_id: pendenciaId,
        intervalo_minutos: intervaloMinutos,
        horario_fixo: horarioFixo,
        proxima_notificacao_em: proximaNotificacaoEm,
        timer_ativo: timerAtivo,
        criado_por: req.usuario.id
      };
      if (req.body?.boleto_storage_path) {
        payload.boleto_storage_path = req.body.boleto_storage_path;
        payload.boleto_nome_arquivo = req.body.boleto_nome_arquivo || null;
        payload.boleto_tipo_mime = req.body.boleto_tipo_mime || null;
        payload.boleto_tamanho_bytes = req.body.boleto_tamanho_bytes || null;
      }
      const { data, error } = await supabase2.from("cobrancas").insert(payload).select(SELECT_COBRANCA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao criar cobran\xE7a:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.patch("/:id", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const payload = {};
      if (req.body?.boleto_storage_path !== void 0) {
        payload.boleto_storage_path = req.body.boleto_storage_path;
        payload.boleto_nome_arquivo = req.body.boleto_nome_arquivo || null;
        payload.boleto_tipo_mime = req.body.boleto_tipo_mime || null;
        payload.boleto_tamanho_bytes = req.body.boleto_tamanho_bytes || null;
      }
      if (req.body?.intervalo_minutos !== void 0 || req.body?.horario_fixo !== void 0) {
        const intervaloMinutos = req.body?.intervalo_minutos != null ? Number(req.body.intervalo_minutos) : null;
        const horarioFixo = req.body?.horario_fixo || null;
        if (intervaloMinutos != null && horarioFixo) {
          return res.status(400).json({ success: false, error: "Escolha s\xF3 um: intervalo OU hor\xE1rio fixo" });
        }
        payload.intervalo_minutos = intervaloMinutos;
        payload.horario_fixo = horarioFixo;
        const timerAtivo = !!(intervaloMinutos || horarioFixo);
        payload.timer_ativo = timerAtivo;
        if (timerAtivo) {
          if (intervaloMinutos) {
            payload.proxima_notificacao_em = new Date(Date.now() + intervaloMinutos * 60 * 1e3).toISOString();
          } else if (horarioFixo) {
            payload.proxima_notificacao_em = new Date(horarioFixo).toISOString();
          }
        } else {
          payload.proxima_notificacao_em = null;
        }
      }
      if (req.body?.timer_ativo !== void 0 && req.body?.intervalo_minutos === void 0 && req.body?.horario_fixo === void 0) {
        payload.timer_ativo = !!req.body.timer_ativo;
        if (!payload.timer_ativo) {
          payload.proxima_notificacao_em = null;
        }
      }
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: "Nenhum campo para atualizar" });
      }
      const { data, error } = await supabase2.from("cobrancas").update(payload).eq("id", req.params.id).select(SELECT_COBRANCA).single();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: "Cobran\xE7a n\xE3o encontrada" });
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao atualizar cobran\xE7a:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.post("/:id/registrar-envio", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const agora = (/* @__PURE__ */ new Date()).toISOString();
      const payload = {
        ultimo_envio_em: agora,
        enviado_por: req.usuario.id
      };
      const { data: cobranca, error: erroBusca } = await supabase2.from("cobrancas").select("intervalo_minutos, horario_fixo, timer_ativo").eq("id", req.params.id).single();
      if (erroBusca) throw erroBusca;
      if (!cobranca) return res.status(404).json({ success: false, error: "Cobran\xE7a n\xE3o encontrada" });
      if (cobranca.timer_ativo && cobranca.intervalo_minutos) {
        payload.proxima_notificacao_em = new Date(Date.now() + cobranca.intervalo_minutos * 60 * 1e3).toISOString();
      }
      const { data, error } = await supabase2.from("cobrancas").update(payload).eq("id", req.params.id).select(SELECT_COBRANCA).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      console.error("Erro ao registrar envio:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.delete("/:id", exigirPermissao("caixa.gerenciar_pendencias"), async (req, res) => {
    try {
      const { error } = await supabase2.from("cobrancas").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true, data: null });
    } catch (error) {
      console.error("Erro ao excluir cobran\xE7a:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  return router;
}

// src/services/mercadolivreScheduler.ts
var INTERVALO_MS = 5 * 60 * 1e3;
function iniciarDetectorDePendenciasML(supabase2) {
  const executar = () => {
    verificarNotificacoesPendentes(supabase2).then(() => processarPedidosPendentes(supabase2)).catch((err) => {
      console.error("Erro no detector de pend\xEAncias do Mercado Livre:", err.response?.data || err.message);
    });
  };
  executar();
  setInterval(executar, INTERVALO_MS);
}

// src/services/mercadolivreEstatisticasScheduler.ts
var INTERVALO_MS2 = 20 * 60 * 1e3;
function iniciarSincronizadorDeEstatisticasML(supabase2) {
  const executar = async () => {
    try {
      const conexao = await obterConexaoAtual(supabase2);
      if (!conexao) return;
      const { data: links, error } = await supabase2.from("estoque_anuncios_ml").select("id");
      if (error) return;
      const linkIds = (links ?? []).map((l) => l.id);
      await sincronizarEstatisticas(supabase2, conexao.accessToken, linkIds);
    } catch (err) {
      console.error("Erro no sincronizador de estat\xEDsticas do Mercado Livre:", err.response?.data || err.message);
    }
  };
  executar();
  setInterval(executar, INTERVALO_MS2);
}

// src/services/shopeeScheduler.ts
var INTERVALO_RENOVACAO_MS = 3 * 60 * 60 * 1e3;
var INTERVALO_ESTATISTICAS_MS = 20 * 60 * 1e3;
function iniciarRenovacaoDeTokenShopee(supabase2) {
  const executar = async () => {
    try {
      const { data: conexao, error } = await supabase2.from(TABELA_CONEXAO2).select("refresh_token, shop_id").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      if (error || !conexao) return;
      await renovarTokenShopee(supabase2, conexao.refresh_token, conexao.shop_id);
    } catch (err) {
      console.error("Erro ao renovar token da Shopee:", err.response?.data || err.message);
    }
  };
  executar();
  setInterval(executar, INTERVALO_RENOVACAO_MS);
}
function iniciarSincronizadorDeEstatisticasShopee(supabase2) {
  const executar = async () => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase2);
      if (!conexao) return;
      const { data: links, error } = await supabase2.from("estoque_anuncios_shopee").select("id");
      if (error) return;
      const linkIds = (links ?? []).map((l) => l.id);
      await sincronizarEstatisticasShopee(supabase2, conexao.accessToken, conexao.shopId, linkIds);
    } catch (err) {
      console.error("Erro no sincronizador de estat\xEDsticas da Shopee:", err.response?.data || err.message);
    }
  };
  executar();
  setInterval(executar, INTERVALO_ESTATISTICAS_MS);
}

// src/services/enviosScheduler.ts
var INTERVALO_MS3 = 45 * 60 * 1e3;
function iniciarRastreioAutomaticoDeEnvios(supabase2) {
  const executar = () => {
    rastrearEnviosPendentes(supabase2).catch((err) => {
      console.error("Erro no rastreio autom\xE1tico de envios:", err.response?.data || err.message);
    });
  };
  executar();
  setInterval(executar, INTERVALO_MS3);
}

// src/features/fiado/metricas.ts
var EPSILON = 0.01;
function vendasFiadoEmAberto(vendas, recebimentos, agora = /* @__PURE__ */ new Date()) {
  const recebidoPorVenda = /* @__PURE__ */ new Map();
  for (const r of recebimentos) {
    recebidoPorVenda.set(r.venda_id, (recebidoPorVenda.get(r.venda_id) ?? 0) + Number(r.valor));
  }
  return vendas.filter((v) => v.forma_pagamento?.natureza === "fiado").map((venda) => {
    const recebido = recebidoPorVenda.get(venda.id) ?? 0;
    return { venda, recebido, saldo: Number(venda.valor_total) - recebido };
  }).filter((item) => item.saldo > EPSILON).map((item) => ({
    ...item,
    diasEmAberto: Math.floor((agora.getTime() - (/* @__PURE__ */ new Date(`${item.venda.data}T00:00:00`)).getTime()) / 864e5)
  })).sort((a, b) => b.diasEmAberto - a.diasEmAberto);
}
function resumoFiadoPorCliente(vendas, recebimentos, agora = /* @__PURE__ */ new Date()) {
  const emAberto = vendasFiadoEmAberto(vendas, recebimentos, agora);
  const porChave = /* @__PURE__ */ new Map();
  for (const item of emAberto) {
    const clienteId = item.venda.cliente_id;
    const clienteNome = item.venda.cliente?.nome || item.venda.cliente_nome || "Sem nome";
    const chave = clienteId ?? `nome:${clienteNome.toLowerCase()}`;
    const atual = porChave.get(chave) ?? { clienteId, clienteNome, vendas: [], totalEmAberto: 0, diasEmAbertoMax: 0 };
    atual.vendas.push(item);
    atual.totalEmAberto += item.saldo;
    atual.diasEmAbertoMax = Math.max(atual.diasEmAbertoMax, item.diasEmAberto);
    porChave.set(chave, atual);
  }
  return Array.from(porChave.values()).sort((a, b) => b.diasEmAbertoMax - a.diasEmAbertoMax);
}

// src/features/clientes/metricas.ts
var DIAS_SUMIDO = 90;
function calcularHistoricoCliente(clienteId, vendas, orcamentos, agora = /* @__PURE__ */ new Date()) {
  const vendasCliente = vendas.filter((v) => v.cliente_id === clienteId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const orcamentosAbertos = orcamentos.filter((o) => o.cliente_id === clienteId && o.status === "aberto");
  const totalGasto = vendasCliente.reduce((soma, v) => soma + Number(v.valor_total), 0);
  const quantidadeCompras = vendasCliente.length;
  const ticketMedio = quantidadeCompras > 0 ? totalGasto / quantidadeCompras : 0;
  const ultimaCompraEm = vendasCliente[0]?.data ?? null;
  const diasDesdeUltimaCompra = ultimaCompraEm ? Math.floor((agora.getTime() - (/* @__PURE__ */ new Date(`${ultimaCompraEm}T00:00:00`)).getTime()) / 864e5) : null;
  return { vendas: vendasCliente, orcamentosAbertos, totalGasto, quantidadeCompras, ticketMedio, ultimaCompraEm, diasDesdeUltimaCompra };
}
function clientesSumidos(clientes, vendas, orcamentos, limiteDias = DIAS_SUMIDO, agora = /* @__PURE__ */ new Date()) {
  return clientes.filter((c) => c.ativo).map((c) => ({ cliente: c, historico: calcularHistoricoCliente(c.id, vendas, orcamentos, agora) })).filter(({ historico }) => historico.quantidadeCompras > 0 && (historico.diasDesdeUltimaCompra ?? 0) >= limiteDias).sort((a, b) => (b.historico.diasDesdeUltimaCompra ?? 0) - (a.historico.diasDesdeUltimaCompra ?? 0));
}

// src/services/notificacoesScheduler.ts
var INTERVALO_MS4 = 24 * 60 * 60 * 1e3;
var DIAS_FIADO_VENCIDO = 15;
var DIAS_CLIENTE_SUMIDO = 90;
var ultimaExecucaoEm = null;
async function checarAlertas(supabase2) {
  const hoje = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (ultimaExecucaoEm === hoje) return;
  const [{ data: vendas, error: erroVendas }, { data: recebimentos, error: erroRecebimentos }, { data: clientes, error: erroClientes }, { data: orcamentos, error: erroOrcamentos }] = await Promise.all([
    supabase2.from("vendas").select("id, cliente_id, cliente_nome, valor_total, data, forma_pagamento:formas_pagamento(natureza), cliente:clientes(nome)"),
    supabase2.from("fiado_recebimentos").select("venda_id, valor"),
    supabase2.from("clientes").select("id, nome, ativo"),
    supabase2.from("orcamentos").select("id, cliente_id, status")
  ]);
  if (erroVendas || erroRecebimentos || erroClientes || erroOrcamentos) {
    throw erroVendas || erroRecebimentos || erroClientes || erroOrcamentos;
  }
  const fiadosVencidos = resumoFiadoPorCliente(vendas ?? [], recebimentos ?? []).filter(
    (r) => r.diasEmAbertoMax >= DIAS_FIADO_VENCIDO
  );
  const sumidos = clientesSumidos(clientes ?? [], vendas ?? [], orcamentos ?? [], DIAS_CLIENTE_SUMIDO);
  ultimaExecucaoEm = hoje;
  if (fiadosVencidos.length === 0 && sumidos.length === 0) return;
  const partes = [];
  if (fiadosVencidos.length > 0) partes.push(`${fiadosVencidos.length} cliente(s) com fiado vencido (${DIAS_FIADO_VENCIDO}+ dias)`);
  if (sumidos.length > 0) partes.push(`${sumidos.length} cliente(s) sumido(s) (${DIAS_CLIENTE_SUMIDO}+ dias sem comprar)`);
  const destinatarios = await buscarDestinatariosEquipe(supabase2);
  if (destinatarios.length === 0) return;
  await notificarUsuarios(supabase2, destinatarios, {
    titulo: "Alertas do dia",
    corpo: partes.join(" \xB7 "),
    url: "/dashboard"
  });
}
function iniciarChecagemDiariaDeAlertas(supabase2) {
  const executar = () => {
    checarAlertas(supabase2).catch((err) => {
      console.error("Erro na checagem di\xE1ria de alertas (fiado/clientes sumidos):", err.message || err);
    });
  };
  executar();
  setInterval(executar, INTERVALO_MS4);
}

// src/services/lembretesScheduler.ts
var INTERVALO_MS5 = 30 * 1e3;
async function dispararLembretesDevidos(supabase2) {
  const { data, error } = await supabase2.rpc("disparar_lembretes_devidos");
  if (error) throw error;
  const devidos = data ?? [];
  if (devidos.length === 0) return;
  await Promise.all(
    devidos.map(
      (l) => notificarUsuario(supabase2, l.atribuido_para, { titulo: l.titulo, corpo: l.descricao || l.titulo, url: "/tarefas" }).catch(
        (e) => console.error(`Erro ao notificar lembrete ${l.id}:`, e)
      )
    )
  );
}
function iniciarDisparoDeLembretes(supabase2) {
  const executar = () => {
    dispararLembretesDevidos(supabase2).catch((err) => {
      console.error("Erro no disparo de lembretes:", err.message || err);
    });
  };
  executar();
  setInterval(executar, INTERVALO_MS5);
}

// src/services/cobrancasScheduler.ts
var INTERVALO_MS6 = 30 * 1e3;
async function dispararCobrancasDevidas(supabase2) {
  const { data, error } = await supabase2.rpc("disparar_cobrancas_devidas");
  if (error) throw error;
  const devidas = data ?? [];
  if (devidas.length === 0) return;
  const destinatarios = await buscarDestinatariosEquipe(supabase2);
  if (destinatarios.length === 0) return;
  for (const c of devidas) {
    let descricao = "Pend\xEAncia";
    let valor = "";
    if (c.venda_id) {
      const { data: venda } = await supabase2.from("vendas").select("nome_item, valor_total, cliente_nome").eq("id", c.venda_id).maybeSingle();
      if (venda) {
        const nome = venda.cliente_nome || "Sem cliente";
        descricao = `${nome} \u2014 ${venda.nome_item}`;
        valor = ` de R$${Number(venda.valor_total).toFixed(2).replace(".", ",")}`;
      }
    } else if (c.pendencia_id) {
      const { data: pend } = await supabase2.from("caixa_pendencias").select("descricao, valor_total").eq("id", c.pendencia_id).maybeSingle();
      if (pend) {
        descricao = pend.descricao;
        valor = ` de R$${Number(pend.valor_total).toFixed(2).replace(".", ",")}`;
      }
    }
    await Promise.all(
      destinatarios.map(
        (uid) => notificarUsuario(supabase2, uid, {
          titulo: "Cobran\xE7a pendente",
          corpo: `${descricao}${valor}`,
          url: "/caixa"
        }).catch((e) => console.error(`Erro ao notificar cobran\xE7a ${c.id}:`, e))
      )
    );
  }
}
function iniciarDisparoDeCobrancas(supabase2) {
  const executar = () => {
    dispararCobrancasDevidas(supabase2).catch((err) => {
      console.error("Erro no disparo de cobran\xE7as:", err.message || err);
    });
  };
  executar();
  setInterval(executar, INTERVALO_MS6);
}

// server.ts
dotenv3.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });
async function startServer() {
  console.log("\u{1F310} Validando vari\xE1veis de ambiente...");
  ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET", "ADMIN_PASSWORD", "MELHOR_ENVIO_TOKEN", "MERCADOLIVRE_APP_ID", "MERCADOLIVRE_CLIENT_SECRET", "MERCADOLIVRE_REDIRECT_URI", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "FIREBASE_SERVICE_ACCOUNT"].forEach((env) => {
    if (!process.env[env]) console.warn(`\u26A0\uFE0F Vari\xE1vel de ambiente [${env}] n\xE3o est\xE1 definida!`);
    else console.log(`\u2705 [${env}] est\xE1 presente.`);
  });
  const JWT_SECRET2 = requireEnv("JWT_SECRET");
  const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  const previewSomenteLeitura = process.env.NODE_ENV !== "production" && process.env.RK_READ_ONLY_PREVIEW === "1";
  const httpServer = createServer(app);
  app.set("trust proxy", 1);
  const allowedOrigins = ["http://localhost:3000", "http://localhost", "https://localhost", "capacitor://localhost", "https://rk-sucatas.onrender.com"];
  if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isLocalPreview = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
        const isAllowed = isLocalPreview || allowedOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed));
        if (!isAllowed) console.log(`\u26A0\uFE0F Origin n\xE3o permitida pelo CORS: ${origin}`);
        callback(null, isAllowed);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"]
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (previewSomenteLeitura) {
    app.use("/api", (req, res, next) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return res.status(405).json({ success: false, error: "Preview local: somente leitura" });
      }
      next();
    });
  }
  app.use("/api", (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
  const { count: totalUsuarios, error: erroContagemUsuarios } = await supabase.from("usuarios").select("id", { count: "exact", head: true });
  if (erroContagemUsuarios) {
    console.warn("\u26A0\uFE0F N\xE3o foi poss\xEDvel checar a tabela usuarios (rodou a migration_011?):", erroContagemUsuarios.message);
  } else if (totalUsuarios === 0 && !previewSomenteLeitura) {
    const senhaHash = bcrypt2.hashSync(ADMIN_PASSWORD, 10);
    const { error: erroBootstrap } = await supabase.from("usuarios").insert({ username: "ayrton", nome_exibicao: "Ayrton", senha_hash: senhaHash, roles: ["admin"] });
    if (erroBootstrap) {
      console.error("\u274C Falha ao criar usu\xE1rio admin de bootstrap:", erroBootstrap.message);
    } else {
      console.log('\u{1F464} Bootstrap: usu\xE1rio admin "ayrton" criado a partir de ADMIN_PASSWORD');
    }
  }
  app.get("/api/health", (_req, res) => {
    res.json({ success: true, status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/mercadolivre/callback", mercadolivreCallbackHandler(supabase));
  app.get("/api/shopee/callback", shopeeCallbackHandler(supabase));
  const notificationsLimiter = rateLimit({
    windowMs: 60 * 1e3,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.post("/api/mercadolivre/notifications", notificationsLimiter, mercadolivreWebhookHandler(supabase));
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Muitas tentativas de login. Tente novamente em alguns minutos." }
  });
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "Usu\xE1rio e senha s\xE3o obrigat\xF3rios" });
      }
      const ERRO_GENERICO = "Usu\xE1rio ou senha incorretos";
      const { data: usuario, error: erroBusca } = await supabase.from("usuarios").select("id, username, nome_exibicao, senha_hash, roles, permissoes, ativo").eq("username", String(username).trim().toLowerCase()).eq("ativo", true).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!usuario) {
        return res.status(401).json({ success: false, error: ERRO_GENERICO });
      }
      const senhaConfere = bcrypt2.compareSync(password, usuario.senha_hash);
      if (!senhaConfere) {
        return res.status(401).json({ success: false, error: ERRO_GENERICO });
      }
      const payload = { id: usuario.id, username: usuario.username, roles: usuario.roles, permissoes: usuario.permissoes ?? {} };
      const token = jwt2.sign(payload, JWT_SECRET2, { expiresIn: "7d" });
      res.json({ success: true, token, user: { ...payload, nome_exibicao: usuario.nome_exibicao } });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ success: false, error: "Erro interno no login" });
    }
  });
  app.use("/api", autenticar);
  app.use("/api/notificacoes", notificacoesRouter(supabase));
  app.get("/api/usuarios/responsaveis-tarefa", exigirPermissao("tarefas.criar"), async (req, res) => {
    try {
      const { data, error } = await supabase.from("usuarios").select("id, nome_exibicao, roles, permissoes").eq("ativo", true).order("nome_exibicao");
      if (error) throw error;
      const filtrados = (data ?? []).filter((u) => {
        const admin = Array.isArray(u.roles) && u.roles.includes("admin");
        return pode(u.permissoes, admin, "tarefas.ver") || u.id === req.usuario.id;
      }).map((u) => ({ id: u.id, nome_exibicao: u.nome_exibicao }));
      res.json({ success: true, data: filtrados });
    } catch (err) {
      console.error("Erro ao listar usu\xE1rios respons\xE1veis por tarefa:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get("/api/usuarios/ativos-resumo", exigirPermissao("tarefas.ver"), async (_req, res) => {
    try {
      const { data, error } = await supabase.from("usuarios").select("id, nome_exibicao, roles, permissoes").eq("ativo", true).order("nome_exibicao");
      if (error) throw error;
      const filtrados = (data ?? []).filter((u) => pode(u.permissoes, Array.isArray(u.roles) && u.roles.includes("admin"), "tarefas.ver")).map((u) => ({ id: u.id, nome_exibicao: u.nome_exibicao }));
      res.json({ success: true, data: filtrados });
    } catch (err) {
      console.error("Erro ao listar usu\xE1rios ativos:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/frete/calculate", exigirPermissao("frete.ver"), async (req, res) => {
    try {
      const { cep_origem, cep_destino, peso, largura, altura, comprimento } = req.body || {};
      const token = process.env.MELHOR_ENVIO_TOKEN;
      const response = await axios6.post(
        "https://melhorenvio.com.br/api/v2/me/shipment/calculate",
        {
          from: { postal_code: cep_origem },
          to: { postal_code: cep_destino },
          products: [
            {
              id: "sucata1",
              weight: parseFloat(peso),
              width: parseFloat(largura),
              height: parseFloat(altura),
              length: parseFloat(comprimento),
              insurance_value: 0,
              quantity: 1
            }
          ],
          options: { insurance_value: 0, receipt: false, own_hand: false }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "RK Sucatas (contato@rksucatas.com.br)"
          }
        }
      );
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error("Erro ao calcular frete:", error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });
  app.use("/api/categorias", categoriasRouter(supabase));
  app.use("/api/modelos-moto", modelosMotoRouter(supabase));
  app.use("/api/formas-pagamento", formasPagamentoRouter(supabase));
  app.use("/api/estoque", estoqueRouter(supabase));
  app.use("/api/estoque-familias", estoqueFamiliasRouter(supabase));
  app.use("/api/gavetas", gavetasRouter(supabase));
  app.use("/api/promocoes", promocoesRouter(supabase));
  app.use("/api/vendas", vendasRouter(supabase));
  app.use("/api/orcamentos", orcamentosRouter(supabase));
  app.use("/api/clientes", clientesRouter(supabase));
  app.use("/api/caixa", caixaRouter(supabase));
  app.use("/api/caixa-pendencias", caixaPendenciasRouter(supabase));
  app.use("/api/cobrancas", cobrancasRouter(supabase));
  app.use("/api/fiado", fiadoRouter(supabase));
  app.use("/api/envios", enviosRouter(supabase));
  app.use(
    "/api/upload",
    exigirAlguma("estoque.criar", "estoque.editar", "vendas.criar", "vendas.editar", "clientes.editar", "configuracoes.gerenciar_motos"),
    uploadRouter()
  );
  app.use("/api/dashboard", dashboardRouter(supabase));
  app.use("/api/tarefas", tarefasRouter(supabase));
  app.use("/api/lembretes", lembretesRouter(supabase));
  app.use("/api/mercadolivre", mercadolivreRouter(supabase));
  app.use("/api/shopee", shopeeRouter(supabase));
  app.use("/api/usuarios", autorizar("admin"), usuariosRouter(supabase));
  if (!previewSomenteLeitura) {
    iniciarDetectorDePendenciasML(supabase);
    iniciarSincronizadorDeEstatisticasML(supabase);
    iniciarRenovacaoDeTokenShopee(supabase);
    iniciarSincronizadorDeEstatisticasShopee(supabase);
    iniciarRastreioAutomaticoDeEnvios(supabase);
    iniciarChecagemDiariaDeAlertas(supabase);
    iniciarDisparoDeLembretes(supabase);
    iniciarDisparoDeCobrancas(supabase);
  }
  app.use("/api", (err, _req, res, _next) => {
    console.error("\u274C Erro na API:", err);
    res.status(err.status || 500).json({ success: false, error: err.message || "Erro interno no servidor" });
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, error: `Rota API n\xE3o encontrada: ${req.method} ${req.url}` });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      // O loader runner evita que o Vite tente gravar um arquivo temporário
      // dentro de node_modules quando o preview roda em uma worktree.
      configLoader: "runner",
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html") || filePath.endsWith(".webmanifest")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ success: false, error: "API endpoint not found" });
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Server running on http://localhost:${PORT} [PID:${process.pid}]`);
    console.log(`\u{1F517} APP_URL: ${process.env.APP_URL || "N\xE3o definida (usando localhost)"}`);
  });
  const shutdown = () => {
    console.log("\u{1F6D1} Encerrando servidor...");
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
startServer();
