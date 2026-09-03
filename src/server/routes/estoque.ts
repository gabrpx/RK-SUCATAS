// CRUD do estoque de peças. Cada linha carrega a categoria e o modelo de moto
// já resolvidos via join, pra UI não precisar cruzar os lookups na mão.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { excluirImagemPorUrl } from '../../services/storageService.js';
import { categoriaExigeNota } from '../../features/estoque/categoriaMotor.js';
import type { Categoria } from '../../types/catalog.js';
import { anexarPromocoes } from '../../features/promocoes/calculo.js';
import { extrairMlbId, obterConexaoAtual } from '../../services/mercadolivreApi.js';
import { publicarAnuncio, sincronizarEstatisticas, extrairMensagemErroMl, type ConfiguracaoAnuncioMl } from '../../services/mercadolivrePublicacao.js';
import { aplicarSincronizacao } from '../../services/mercadolivreSync.js';
import { obterConexaoAtualShopee } from '../../services/shopeeApi.js';
import {
  publicarAnuncioShopee,
  sincronizarEstatisticasShopee,
  republicarAnuncioShopee,
  type ConfiguracaoAnuncioShopee,
} from '../../services/shopeePublicacao.js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

// Gates por permissão granular (ver src/constants/permissoes.ts). Leitura é
// separada da escrita, e a escrita ainda se divide por ação: criar/editar
// (inclui fichas de unidade e ações em lote)/excluir/anunciar em cada canal.
const VER = exigirPermissao('estoque.ver');
const CRIAR = exigirPermissao('estoque.criar');
const EDITAR = exigirPermissao('estoque.editar');
const DELETAR = exigirPermissao('estoque.deletar');
const ANUNCIAR_ML = exigirPermissao('estoque.anunciar_ml');
const ANUNCIAR_SHOPEE = exigirPermissao('estoque.anunciar_shopee');

// !estoque_modelo_moto_id_fkey desambigua explicitamente a FK: desde a
// migration_019, `estoque_modelos_compativeis` criou um caminho N:N implícito
// entre estoque e modelos_moto, e sem isso o PostgREST não sabe se o embed
// quer o modelo principal (FK direta) ou os compatíveis (via tabela ponte).
// Colunas da categoria são explícitas (não `*`) pra não trafegar campo
// desnecessário — mas isso significa que coluna nova de `categorias` usada
// pelo frontend precisa entrar aqui à mão. Ver estoque.test.ts.
export const SELECT_COM_JOINS =
  '*, categoria:categorias(id, nome, mercadolivre_categoria_id_padrao), modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(id, nome, ano)';

// As fichas de unidade (migration_014) vêm numa consulta separada, e não como
// join no select acima, de propósito: enquanto a migração não roda em
// produção a tabela não existe, e um join pra tabela inexistente derruba a
// listagem inteira do estoque. Assim a aba continua funcionando normalmente
// e as avarias simplesmente aparecem vazias até a migração ser aplicada.
async function anexarUnidades(supabase: SupabaseClient, itens: any[] | null): Promise<any[]> {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;

  // Sem filtro por id: a tabela só tem linha pra unidade sinalizada, então é
  // pequena por construção — e evita montar um `in(...)` com milhares de ids.
  const { data, error } = await supabase.from('estoque_unidades').select('*');

  if (error) {
    // 42P01 = tabela não existe; PGRST205 = PostgREST ainda não a conhece.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela estoque_unidades ausente — rode supabase/migration_014_unidades_avaria.sql pra habilitar as avarias.');
    } else {
      console.error('Erro ao buscar unidades de estoque:', error);
    }
    return lista.map((item) => ({ ...item, unidades: [] }));
  }

  const porEstoque = new Map<string, any[]>();
  for (const unidade of data ?? []) {
    const atual = porEstoque.get(unidade.estoque_id) ?? [];
    atual.push(unidade);
    porEstoque.set(unidade.estoque_id, atual);
  }

  return lista.map((item) => ({ ...item, unidades: porEstoque.get(item.id) ?? [] }));
}

// Modelos SECUNDÁRIOS de uma peça (migration_019) — além do principal em
// `modelo_moto_id`, pra peça que serve em mais de um modelo/ano (ex: lanterna
// que serve tanto na CG 150 quanto na CG 125 Fan). Mesma degradação graciosa
// de anexarUnidades: enquanto a migration_019 não roda em produção, a tabela
// não existe e o estoque continua funcionando normalmente, só sem compatibilidade.
async function anexarCompatibilidades(supabase: SupabaseClient, itens: any[]): Promise<any[]> {
  if (itens.length === 0) return itens;

  const { data, error } = await supabase.from('estoque_modelos_compativeis').select('estoque_id, modelo_moto:modelos_moto(id, nome, ano)');

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela estoque_modelos_compativeis ausente — rode supabase/migration_019_compatibilidade_pecas.sql pra habilitar compatibilidade entre modelos.');
    } else {
      console.error('Erro ao buscar compatibilidades de estoque:', error);
    }
    return itens.map((item) => ({ ...item, modelos_compativeis: [] }));
  }

  const porEstoque = new Map<string, any[]>();
  for (const linha of data ?? []) {
    if (!linha.modelo_moto) continue;
    const atual = porEstoque.get(linha.estoque_id) ?? [];
    atual.push(linha.modelo_moto);
    porEstoque.set(linha.estoque_id, atual);
  }

  return itens.map((item) => ({ ...item, modelos_compativeis: porEstoque.get(item.id) ?? [] }));
}

// Família de peça (migration_056) — mesma degradação graciosa de
// anexarCompatibilidades: enquanto a migração não rodar em produção, a
// tabela não existe e o estoque continua funcionando normalmente, cada
// peça simplesmente sem família.
async function anexarFamilias(supabase: SupabaseClient, itens: any[]): Promise<any[]> {
  if (itens.length === 0) return itens;

  const { data, error } = await supabase.from('estoque_familias').select('*');

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela estoque_familias ausente — rode supabase/migration_056_estoque_familias.sql pra habilitar famílias de peça.');
    } else {
      console.error('Erro ao buscar famílias de estoque:', error);
    }
    return itens.map((item) => ({ ...item, familia: null }));
  }

  const porId = new Map<string, any>();
  for (const familia of data ?? []) porId.set(familia.id, familia);

  return itens.map((item) => ({ ...item, familia: item.familia_id ? porId.get(item.familia_id) ?? null : null }));
}

// Peça procurada (migration_033): quando uma peça nova cadastrada no estoque
// bate com um pedido em aberto (categoria e/ou modelo de moto do pedido, os
// que estiverem preenchidos — campo vazio no pedido não filtra por isso),
// cria uma tarefa avisando quem registrou o pedido e marca ele como
// atendido. Best-effort de propósito: nunca deve derrubar a criação da peça,
// que é o fluxo principal — erro aqui só vai pro log.
async function casarComPecasProcuradas(supabase: SupabaseClient, item: any, criadoPorUsuarioId: string): Promise<void> {
  try {
    // Tabela é pequena por construção (só pedidos ainda não atendidos) — filtra
    // tudo em memória em vez de tentar expressar o match em SQL.
    const { data: pedidos, error } = await supabase.from('pecas_procuradas').select('*').eq('status', 'aguardando');
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn('⚠️ Tabela pecas_procuradas ausente — rode supabase/migration_033_pecas_procuradas.sql pra habilitar o alerta automático.');
        return;
      }
      throw error;
    }
    if (!pedidos || pedidos.length === 0) return;

    const { data: compativeis } = await supabase.from('estoque_modelos_compativeis').select('modelo_moto_id').eq('estoque_id', item.id);
    const modelosDaPeca = new Set<string>([item.modelo_moto_id, ...(compativeis ?? []).map((c: any) => c.modelo_moto_id)].filter(Boolean));

    for (const pedido of pedidos) {
      if (pedido.categoria_id && pedido.categoria_id !== item.categoria_id) continue;
      if (pedido.modelo_moto_id && !modelosDaPeca.has(pedido.modelo_moto_id)) continue;

      const { error: erroTarefa } = await supabase.from('tarefas').insert({
        titulo: `Peça procurada chegou: ${item.nome}`,
        descricao: `${pedido.cliente_nome || 'Cliente'} procurava "${pedido.descricao}" — acabou de chegar em estoque.`,
        atribuido_para: pedido.criado_por,
        criado_por: criadoPorUsuarioId,
        cliente_id: pedido.cliente_id,
        prioridade: 'alta',
        tipo: 'geral',
      });
      if (erroTarefa) {
        console.error('Erro ao criar tarefa de peça procurada:', erroTarefa);
        continue;
      }

      await supabase.from('pecas_procuradas').update({ status: 'atendida', atendida_em: new Date().toISOString() }).eq('id', pedido.id);
    }
  } catch (err) {
    console.error('Erro ao casar peça nova com pedidos em aberto:', err);
  }
}

// Um item sem nenhuma linha em estoque_anuncios_ml ainda, mas com o campo
// legado preenchido, sintetiza 1 "link" a partir dele — mesmo formato de
// EstoqueAnuncioMl, com `legado: true` pra o frontend saber que esse
// vínculo em particular vive na coluna antiga (id não é uuid de verdade).
function sintetizarLinkLegado(item: any): any[] {
  if (!item.anuncio_ml_url) return [];
  return [
    {
      id: `legado:${item.id}`,
      estoque_id: item.id,
      url: item.anuncio_ml_url,
      mlb_id: extrairMlbId(item.anuncio_ml_url) ?? '',
      legado: true,
      criado_em: item.criado_em,
      atualizado_em: item.atualizado_em,
    },
  ];
}

// Vínculos de anúncio ML (migration_025) — aninhados no item, mesmo motivo
// de anexarUnidades acima: um link não faz sentido fora da peça. Diferente
// de anexarUnidades/anexarCompatibilidades, o fallback aqui não pode só
// devolver lista vazia quando a tabela ainda não existe — isso regrediria
// uma capacidade que já funciona em produção hoje (1 link por peça via
// anuncio_ml_url), então sintetiza esse link legado em vez de escondê-lo.
async function anexarAnunciosMl(supabase: SupabaseClient, itens: any[] | null): Promise<any[]> {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;

  const { data, error } = await supabase.from('estoque_anuncios_ml').select('*').order('criado_em');

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn(
        '⚠️ Tabela estoque_anuncios_ml ausente — rode supabase/migration_025_estoque_anuncios_ml.sql pra habilitar múltiplos anúncios por peça. Usando o link único legado (anuncio_ml_url) por enquanto.'
      );
      return lista.map((item) => ({ ...item, links_ml: sintetizarLinkLegado(item) }));
    }
    console.error('Erro ao buscar anúncios ML de estoque:', error);
    return lista.map((item) => ({ ...item, links_ml: [] }));
  }

  // Estatísticas (migration_043, Fase 7) — snapshot já pronto pro modal de
  // detalhes não precisar chamar o Mercado Livre ao abrir (ver
  // mercadolivreEstatisticasScheduler.ts, que mantém isso atualizado em
  // background). Mesma degradação graciosa: sem a tabela ainda, o link
  // aparece igual, só sem o mini-bloco de números.
  const linkIds = (data ?? []).map((link: any) => link.id);
  const estatisticasPorLink = new Map<string, any>();
  if (linkIds.length > 0) {
    const { data: estatisticas, error: erroEstatisticas } = await supabase
      .from('estoque_anuncios_ml_estatisticas')
      .select('*')
      .in('link_id', linkIds);
    if (erroEstatisticas) {
      if (erroEstatisticas.code !== '42P01' && erroEstatisticas.code !== 'PGRST205') {
        console.error('Erro ao buscar estatísticas de anúncios ML:', erroEstatisticas);
      }
    } else {
      for (const linha of estatisticas ?? []) estatisticasPorLink.set(linha.link_id, linha);
    }
  }

  const porEstoque = new Map<string, any[]>();
  for (const link of data ?? []) {
    const atual = porEstoque.get(link.estoque_id) ?? [];
    atual.push({ ...link, estatisticas: estatisticasPorLink.get(link.id) ?? null });
    porEstoque.set(link.estoque_id, atual);
  }

  return lista.map((item) => ({ ...item, links_ml: porEstoque.get(item.id) ?? [] }));
}

// Vínculos de anúncio da Shopee (migration_045, Fase 7) — companheiro mais
// simples de anexarAnunciosMl acima: sem "legado" pra sintetizar (a Shopee
// nunca teve um campo único anterior, nasceu já com N anúncios por peça), só
// degradação graciosa se a migração ainda não rodou.
async function anexarAnunciosShopee(supabase: SupabaseClient, itens: any[] | null): Promise<any[]> {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;

  const { data, error } = await supabase.from('estoque_anuncios_shopee').select('*').order('criado_em');

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return lista.map((item) => ({ ...item, links_shopee: [] }));
    }
    console.error('Erro ao buscar anúncios Shopee de estoque:', error);
    return lista.map((item) => ({ ...item, links_shopee: [] }));
  }

  // Estatísticas — snapshot já pronto pro modal de detalhes não precisar
  // chamar a Shopee ao abrir (ver shopeeScheduler.ts, que mantém isso
  // atualizado em background). Mesma degradação graciosa de anexarAnunciosMl.
  const linkIds = (data ?? []).map((link: any) => link.id);
  const estatisticasPorLink = new Map<string, any>();
  if (linkIds.length > 0) {
    const { data: estatisticas, error: erroEstatisticas } = await supabase.from('estoque_anuncios_shopee_estatisticas').select('*').in('link_id', linkIds);
    if (erroEstatisticas) {
      if (erroEstatisticas.code !== '42P01' && erroEstatisticas.code !== 'PGRST205') {
        console.error('Erro ao buscar estatísticas de anúncios Shopee:', erroEstatisticas);
      }
    } else {
      for (const linha of estatisticas ?? []) estatisticasPorLink.set(linha.link_id, linha);
    }
  }

  const porEstoque = new Map<string, any[]>();
  for (const link of data ?? []) {
    const atual = porEstoque.get(link.estoque_id) ?? [];
    atual.push({ ...link, estatisticas: estatisticasPorLink.get(link.id) ?? null });
    porEstoque.set(link.estoque_id, atual);
  }

  return lista.map((item) => ({ ...item, links_shopee: porEstoque.get(item.id) ?? [] }));
}

function montarPayloadAnuncioMl(body: any): { payload?: { url: string; mlb_id: string }; erro?: string } {
  const url = String(body?.url || '').trim();
  if (!url) return { erro: 'Informe o link do anúncio' };
  const mlbId = extrairMlbId(url);
  if (!mlbId) return { erro: 'Não foi possível identificar o ID do anúncio (MLB...) nesse link' };
  return { payload: { url, mlb_id: mlbId } };
}

function montarAtributoConfig(a: any) {
  return { id: String(a?.id ?? ''), value_id: a?.value_id ?? undefined, value_name: a?.value_name ?? undefined, value_struct: a?.value_struct ?? undefined };
}

// Corpo de POST /:id/publicar-ml → ConfiguracaoAnuncioMl (src/services/mercadolivrePublicacao.ts).
// Validação mínima aqui (campos obrigatórios presentes) — o formulário
// dinâmico de atributos obrigatórios por categoria já barra isso antes de
// chegar aqui; a API do Mercado Livre é a fonte da verdade final.
function montarConfiguracaoPublicacao(body: any): { config?: ConfiguracaoAnuncioMl; erro?: string } {
  const categoriaMlId = String(body?.categoria_ml_id || '').trim();
  if (!categoriaMlId) return { erro: 'Selecione a categoria do Mercado Livre' };
  if (body?.condicao_ml !== 'new' && body?.condicao_ml !== 'used') {
    return { erro: 'Informe se o anúncio é "novo" ou "usado"' };
  }
  const listingTypeId = String(body?.listing_type_id || '').trim();
  if (!listingTypeId) return { erro: 'Selecione o tipo de anúncio (Clássico ou Premium)' };
  const fotos = Array.isArray(body?.fotos) ? body.fotos.map((f: any) => String(f)).filter(Boolean) : [];
  if (fotos.length === 0) return { erro: 'Selecione ao menos uma foto pro anúncio' };
  const tituloAnuncio = String(body?.titulo_anuncio || '').trim();
  if (!tituloAnuncio) return { erro: 'Informe o título do anúncio' };
  const descricaoAnuncio = String(body?.descricao_anuncio || '').trim();
  if (!descricaoAnuncio) return { erro: 'Informe a descrição do anúncio' };

  const variacoes = Array.isArray(body?.variacoes)
    ? body.variacoes.map((v: any) => ({
        unidadeId: String(v?.unidade_id ?? ''),
        atributos: Array.isArray(v?.atributos) ? v.atributos.map(montarAtributoConfig) : [],
        precoEfetivoSistema: v?.preco_efetivo_sistema != null ? Number(v.preco_efetivo_sistema) : undefined,
      }))
    : undefined;

  return {
    config: {
      categoriaMlId,
      condicaoMl: body.condicao_ml,
      listingTypeId,
      atributos: Array.isArray(body?.atributos) ? body.atributos.map(montarAtributoConfig) : [],
      fotos,
      precoEfetivoSistema: body?.preco_efetivo_sistema != null ? Number(body.preco_efetivo_sistema) : undefined,
      variacoes,
      catalogoProdutoId: body?.catalogo_produto_id ? String(body.catalogo_produto_id) : undefined,
      tituloAnuncio,
      descricaoAnuncio,
    },
  };
}

// Corpo de POST /:id/publicar-shopee → ConfiguracaoAnuncioShopee
// (src/services/shopeePublicacao.ts). Mesma validação mínima de
// montarConfiguracaoPublicacao (ML) — o formulário dinâmico de atributos
// obrigatórios por categoria já barra isso antes de chegar aqui.
function montarConfiguracaoPublicacaoShopee(body: any): { config?: ConfiguracaoAnuncioShopee; erro?: string } {
  const categoriaShopeeId = Number(body?.categoria_shopee_id);
  if (!Number.isFinite(categoriaShopeeId) || categoriaShopeeId <= 0) return { erro: 'Selecione a categoria da Shopee' };
  const logisticsChannelId = Number(body?.logistics_channel_id);
  if (!Number.isFinite(logisticsChannelId) || logisticsChannelId <= 0) return { erro: 'Selecione o canal de logística' };
  const pesoKg = Number(body?.peso_kg);
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return { erro: 'Informe o peso da peça (kg)' };
  const tituloAnuncio = String(body?.titulo_anuncio || '').trim();
  if (!tituloAnuncio) return { erro: 'Informe o título do anúncio' };
  const descricaoAnuncio = String(body?.descricao_anuncio || '').trim();
  if (!descricaoAnuncio) return { erro: 'Informe a descrição do anúncio' };

  const variacoes = Array.isArray(body?.variacoes)
    ? body.variacoes.map((v: any) => ({
        unidadeId: String(v?.unidade_id ?? ''),
        precoEfetivoSistema: v?.preco_efetivo_sistema != null ? Number(v.preco_efetivo_sistema) : undefined,
      }))
    : undefined;

  return {
    config: {
      categoriaShopeeId,
      logisticsChannelId,
      atributos: Array.isArray(body?.atributos) ? body.atributos : [],
      pesoKg,
      precoEfetivoSistema: body?.preco_efetivo_sistema != null ? Number(body.preco_efetivo_sistema) : undefined,
      variacoes,
      tituloAnuncio,
      descricaoAnuncio,
    },
  };
}

// Sincroniza `estoque_modelos_compativeis` por delete-then-insert: mais simples
// que diffar, e a lista é sempre pequena (poucos modelos por peça). Ignorada
// quando o campo não veio no body (ex: PATCH que não mexe em compatibilidade).
async function sincronizarCompatibilidades(supabase: SupabaseClient, estoqueId: string, ids: unknown): Promise<string | null> {
  if (!Array.isArray(ids)) return null;

  const { data: atual } = await supabase.from('estoque').select('modelo_moto_id').eq('id', estoqueId).single();
  const principal = atual?.modelo_moto_id ?? null;
  const idsLimpos = Array.from(new Set(ids.map((id) => String(id)).filter((id) => id && id !== principal)));

  const { error: erroDelete } = await supabase.from('estoque_modelos_compativeis').delete().eq('estoque_id', estoqueId);
  if (erroDelete) {
    if (erroDelete.code === '42P01' || erroDelete.code === 'PGRST205') return null;
    return erroDelete.message;
  }

  if (idsLimpos.length === 0) return null;

  const { error: erroInsert } = await supabase
    .from('estoque_modelos_compativeis')
    .insert(idsLimpos.map((modelo_moto_id) => ({ estoque_id: estoqueId, modelo_moto_id })));
  if (erroInsert) {
    if (erroInsert.code === '23503') return 'Um dos modelos compatíveis selecionados não existe mais.';
    return erroInsert.message;
  }
  return null;
}

const CAMPOS_EDITAVEIS = [
  'nome',
  'categoria_id',
  'modelo_moto_id',
  'condicao',
  'condicao_nota',
  'nota_cadastro',
  'ano',
  'valor',
  'quantidade',
  'imagens',
  'descricao',
  'ativo',
  'componentes',
  'anuncio_fb_url',
  'familia_id',
] as const;

export function montarPayload(body: any) {
  const payload: Record<string, any> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) payload[campo] = body[campo];
  }
  if (payload.valor !== undefined) payload.valor = Number(payload.valor) || 0;
  if (payload.quantidade !== undefined) payload.quantidade = Math.max(0, Number(payload.quantidade) || 0);
  if (payload.condicao_nota !== undefined) {
    const nota = payload.condicao_nota === null || payload.condicao_nota === '' ? null : Number(payload.condicao_nota);
    payload.condicao_nota = nota === null || !Number.isFinite(nota) ? null : Math.min(10, Math.max(1, Math.round(nota)));
  }
  if (payload.imagens !== undefined) {
    payload.imagens = Array.isArray(payload.imagens) ? payload.imagens.map((u: any) => String(u)).filter(Boolean) : [];
  }
  // Lista de nomes de partes em que o item pode ser desmembrado na venda —
  // null quando vazia, pra "item comum" continuar sem nenhum campo extra.
  if (payload.componentes !== undefined) {
    const lista = Array.isArray(payload.componentes) ? payload.componentes.map((c: any) => String(c).trim()).filter(Boolean) : [];
    payload.componentes = lista.length > 0 ? lista : null;
  }
  // null explícito desvincula a peça da família (ver rodapé "Excluir" da
  // spec — desvincular em vez de apagar quando há venda no histórico).
  if (payload.familia_id !== undefined) payload.familia_id = payload.familia_id || null;
  return payload;
}

// Peças de Motor (ou subcategoria dela) exigem informar se têm nota fiscal
// pra cadastro — mesma regra de src/features/estoque/categoriaMotor.ts,
// aplicada aqui pra não depender só da validação do frontend.
async function validarNotaCadastro(supabase: SupabaseClient, categoriaId: string | null, notaCadastro: unknown): Promise<string | null> {
  if (!categoriaId) return null;
  const { data: categorias, error } = await supabase.from('categorias').select('id, nome, parent_id, ordem');
  if (error) throw error;
  if (!categoriaExigeNota(categoriaId, (categorias || []) as Categoria[])) return null;
  if (notaCadastro !== 'com_nota' && notaCadastro !== 'sem_nota') {
    return 'Para peças de Motor, selecione "Com nota pra cadastro" ou "Sem nota pra cadastro"';
  }
  return null;
}

export function estoqueRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', VER, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).order('criado_em', { ascending: false });
      if (error) throw error;
      const comUnidades = await anexarUnidades(supabase, data);
      const comCompatibilidades = await anexarCompatibilidades(supabase, comUnidades);
      const comFamilias = await anexarFamilias(supabase, comCompatibilidades);
      const comAnunciosMl = await anexarAnunciosMl(supabase, comFamilias);
      const comAnunciosShopee = await anexarAnunciosShopee(supabase, comAnunciosMl);
      res.json({ success: true, data: await anexarPromocoes(supabase, comAnunciosShopee) });
    } catch (error: any) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/:id', VER, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).eq('id', req.params.id).single();
      if (error) throw error;
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', CRIAR, async (req: AuthenticatedRequest, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome da peça é obrigatório' });
      if (!['original', 'paralela'].includes(req.body?.condicao)) {
        return res.status(400).json({ success: false, error: 'Condição deve ser "original" ou "paralela"' });
      }

      const payload: Record<string, any> = { ...montarPayload(req.body), nome };
      const erroNota = await validarNotaCadastro(supabase, payload.categoria_id ?? null, payload.nota_cadastro);
      if (erroNota) return res.status(400).json({ success: false, error: erroNota });

      const { data, error } = await supabase.from('estoque').insert([payload]).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      const erroCompat = await sincronizarCompatibilidades(supabase, data.id, req.body?.modelo_moto_compativel_ids);
      if (erroCompat) return res.status(400).json({ success: false, error: erroCompat });

      if (req.usuario) casarComPecasProcuradas(supabase, data, req.usuario.id).catch((e) => console.error('Erro no match de peça procurada:', e));

      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [{ ...data, unidades: [] }]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      console.error('Erro ao criar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Compartilhado por PUT/PATCH: fotos removidas da galeria saem do Storage
  // depois de confirmar a troca — nunca deixa arquivo órfão (mesma lógica já
  // usada pelas fotos de unidade, ver montarPayloadUnidade abaixo).
  const atualizarItem = async (req: any, res: any) => {
    try {
      const payload = montarPayload(req.body);
      let imagensRemovidas: string[] = [];

      if (payload.imagens !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('imagens').eq('id', req.params.id).single();
        const antigas: string[] = atual?.imagens ?? [];
        imagensRemovidas = antigas.filter((url) => !payload.imagens.includes(url));
      }

      if (payload.categoria_id !== undefined || payload.nota_cadastro !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('categoria_id, nota_cadastro').eq('id', req.params.id).single();
        const categoriaId = payload.categoria_id !== undefined ? payload.categoria_id : atual?.categoria_id ?? null;
        const notaCadastro = payload.nota_cadastro !== undefined ? payload.nota_cadastro : atual?.nota_cadastro ?? null;
        const erroNota = await validarNotaCadastro(supabase, categoriaId, notaCadastro);
        if (erroNota) return res.status(400).json({ success: false, error: erroNota });
      }

      const { data, error } = await supabase.from('estoque').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      const erroCompat = await sincronizarCompatibilidades(supabase, req.params.id, req.body?.modelo_moto_compativel_ids);
      if (erroCompat) return res.status(400).json({ success: false, error: erroCompat });

      for (const url of imagensRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem antiga:', e));
      }

      // Sem isso o item volta pro frontend sem as fichas de unidade e o aviso
      // de avaria some da lista até o próximo refresh.
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comCompatibilidades] = await anexarCompatibilidades(supabase, [comUnidades]);
      const [comFamilias] = await anexarFamilias(supabase, [comCompatibilidades]);
      const [comAnunciosMl] = await anexarAnunciosMl(supabase, [comFamilias]);
      const [comAnunciosShopee] = await anexarAnunciosShopee(supabase, [comAnunciosMl]);
      const [comPromocao] = await anexarPromocoes(supabase, [comAnunciosShopee]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      console.error('Erro ao atualizar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.put('/:id', EDITAR, atualizarItem);
  // PATCH usa a mesma lógica do PUT — a diferença semântica (parcial vs total)
  // já é garantida por montarPayload só incluir os campos enviados.
  router.patch('/:id', EDITAR, atualizarItem);

  router.delete('/:id', DELETAR, async (req, res) => {
    try {
      const { data: item } = await supabase.from('estoque').select('imagens').eq('id', req.params.id).single();
      const { error } = await supabase.from('estoque').delete().eq('id', req.params.id);
      if (error) throw error;

      for (const url of item?.imagens ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem:', e));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/bulk-delete', DELETAR, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }
      const { data: itens } = await supabase.from('estoque').select('imagens').in('id', ids);
      const { error } = await supabase.from('estoque').delete().in('id', ids);
      if (error) throw error;

      for (const item of itens || []) {
        for (const url of item.imagens ?? []) {
          excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem:', e));
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-delete de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Unidades físicas com avaria (ver supabase/migration_014_unidades_avaria.sql)
  // ==========================================================================
  // Aninhadas no item porque uma ficha de unidade não existe fora dele. As
  // rotas têm dois segmentos, então nunca colidem com GET/PUT/DELETE '/:id'.

  function montarPayloadUnidade(body: any) {
    const payload: Record<string, any> = {};
    // body.apelido/avaria_descricao === null (herança/campo limpo) precisa
    // virar null no banco, não a string "null" — String(null) === 'null'.
    if (body?.apelido !== undefined) payload.apelido = body.apelido === null ? null : String(body.apelido).trim() || null;
    if (body?.avaria !== undefined) payload.avaria = Boolean(body.avaria);
    if (body?.avaria_descricao !== undefined) {
      payload.avaria_descricao = body.avaria_descricao === null ? null : String(body.avaria_descricao).trim() || null;
    }
    if (body?.fotos !== undefined) {
      payload.fotos = Array.isArray(body.fotos) ? body.fotos.map((f: any) => String(f)).filter(Boolean) : [];
    }
    // Distingue "não mandou o campo" de "mandou vazio pra voltar ao preço da
    // peça" — null aqui significa herdar estoque.valor, não zero.
    if (body?.valor !== undefined) {
      const numero = body.valor === null || body.valor === '' ? null : Number(body.valor);
      payload.valor = numero === null || Number.isNaN(numero) ? null : Math.max(0, numero);
    }
    // Mesma semântica de herança de `valor` acima, mesmo clamp de
    // estoque.condicao_nota em montarPayload — null = herda a nota da peça.
    if (body?.condicao_nota !== undefined) {
      const nota = body.condicao_nota === null || body.condicao_nota === '' ? null : Number(body.condicao_nota);
      payload.condicao_nota = nota === null || !Number.isFinite(nota) ? null : Math.min(10, Math.max(1, Math.round(nota)));
    }
    return payload;
  }

  // A tabela estoque_unidades já existe em produção (migration_014), mas a
  // coluna condicao_nota só existe depois que a migration_024 rodar.
  // Diferente de anexarUnidades/anexarCompatibilidades (tabela inteira
  // ausente, detectado só na leitura), aqui o risco é a ESCRITA falhar por
  // causa de UM campo — e não é razoável deixar apelido/avaria/fotos/valor
  // pararem de salvar por isso. Tenta com o campo; se a coluna não existir
  // ainda, tenta de novo sem ele e avisa no log — mesmo espírito de "a aba
  // não pode quebrar por migration pendente", agora pra escrita.
  function erroColunaCondicaoNotaAusente(error: any): boolean {
    if (!error) return false;
    // 42703 = Postgres "undefined_column"; PGRST204 = PostgREST "coluna fora
    // do cache de schema" (mesma causa, mensageiro diferente).
    const codigoConhecido = error.code === '42703' || error.code === 'PGRST204';
    return codigoConhecido && String(error.message || '').includes('condicao_nota');
  }

  async function inserirOuAtualizarUnidade<T>(
    executar: (payload: Record<string, any>) => PromiseLike<{ data: T | null; error: any }>,
    payload: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    const resultado = await executar(payload);
    if (!resultado.error || !('condicao_nota' in payload) || !erroColunaCondicaoNotaAusente(resultado.error)) {
      return resultado;
    }
    console.warn(
      '⚠️ Coluna estoque_unidades.condicao_nota ausente — rode supabase/migration_024_condicao_nota_unidade.sql pra habilitar a nota por unidade. Salvando o restante da ficha sem ela.'
    );
    const { condicao_nota, ...semNota } = payload;
    return executar(semNota);
  }

  router.get('/:id/unidades', VER, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_unidades').select('*').eq('estoque_id', req.params.id).order('criado_em');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar unidades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/unidades', EDITAR, async (req, res) => {
    try {
      const { data: item, error: erroItem } = await supabase.from('estoque').select('id, quantidade').eq('id', req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: 'Peça não encontrada' });

      // Não faz sentido ter mais fichas de unidade do que unidades físicas —
      // seriam fichas de peças que não estão mais na loja.
      const { count, error: erroContagem } = await supabase
        .from('estoque_unidades')
        .select('id', { count: 'exact', head: true })
        .eq('estoque_id', req.params.id);
      if (erroContagem) throw erroContagem;

      if ((count ?? 0) >= item.quantidade) {
        return res.status(400).json({
          success: false,
          error: `Esta peça tem ${item.quantidade} unidade(s) em estoque e já ${count} ficha(s) cadastrada(s). Aumente a quantidade ou revise as fichas existentes.`,
        });
      }

      const payload = { ...montarPayloadUnidade(req.body), estoque_id: req.params.id };
      const { data, error } = await inserirOuAtualizarUnidade(
        (p) => supabase.from('estoque_unidades').insert(p).select('*').single(),
        payload
      );
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/unidades/:unidadeId', EDITAR, async (req, res) => {
    try {
      const payload = montarPayloadUnidade(req.body);

      // Foto removida da ficha some do Storage também — mesma regra que o
      // item usa pra imagens, pra não acumular arquivo órfão.
      let fotosRemovidas: string[] = [];
      if (payload.fotos !== undefined) {
        const { data: atual } = await supabase.from('estoque_unidades').select('fotos').eq('id', req.params.unidadeId).single();
        const antigas: string[] = atual?.fotos ?? [];
        fotosRemovidas = antigas.filter((url) => !payload.fotos.includes(url));
      }

      const { data, error } = await inserirOuAtualizarUnidade(
        (p) =>
          supabase
            .from('estoque_unidades')
            .update(p)
            .eq('id', req.params.unidadeId)
            .eq('estoque_id', req.params.id)
            .select('*')
            .single(),
        payload
      );
      if (error) throw error;

      for (const url of fotosRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar foto de avaria:', e));
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/unidades/:unidadeId', EDITAR, async (req, res) => {
    try {
      const { data: unidade } = await supabase.from('estoque_unidades').select('fotos').eq('id', req.params.unidadeId).single();

      const { error } = await supabase.from('estoque_unidades').delete().eq('id', req.params.unidadeId).eq('estoque_id', req.params.id);
      if (error) throw error;

      for (const url of unidade?.fotos ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar foto de avaria:', e));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Anúncios do Mercado Livre por peça (migration_025) — substituem o campo
  // único anuncio_ml_url (no máximo 1 por peça) por N vínculos, cada um
  // sincronizável com seu próprio anúncio no ML. Aninhadas no item, mesmo
  // padrão de /:id/unidades acima.
  // ==========================================================================

  router.get('/:id/anuncios-ml', VER, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_anuncios_ml').select('*').eq('estoque_id', req.params.id).order('criado_em');
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          const { data: item } = await supabase.from('estoque').select('id, anuncio_ml_url, criado_em, atualizado_em').eq('id', req.params.id).maybeSingle();
          return res.json({ success: true, data: item ? sintetizarLinkLegado(item) : [] });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar anúncios ML da peça:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/anuncios-ml', ANUNCIAR_ML, async (req, res) => {
    try {
      const { payload, erro } = montarPayloadAnuncioMl(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });

      const { data: item, error: erroItem } = await supabase.from('estoque').select('id, anuncio_ml_url').eq('id', req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: 'Peça não encontrada' });

      const { data, error } = await supabase
        .from('estoque_anuncios_ml')
        .insert({ ...payload, estoque_id: req.params.id })
        .select('*')
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          // Migração ainda não rodou: preserva a capacidade que já existe em
          // produção hoje (1 link por peça) escrevendo na coluna legada, mas
          // não deixa criar um SEGUNDO vínculo por essa via — isso exige a
          // migration_025 rodada.
          if (item.anuncio_ml_url) {
            return res.status(409).json({ success: false, error: 'Rode a migration_025 antes de vincular mais de um anúncio a esta peça.' });
          }
          const { data: atualizado, error: erroLegado } = await supabase
            .from('estoque')
            .update({ anuncio_ml_url: payload!.url })
            .eq('id', req.params.id)
            .select('id, anuncio_ml_url, criado_em, atualizado_em')
            .single();
          if (erroLegado) throw erroLegado;
          return res.json({ success: true, data: sintetizarLinkLegado(atualizado)[0] });
        }
        if (error.code === '23505') {
          return res.status(400).json({ success: false, error: 'Este anúncio já está vinculado a outra peça do estoque.' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao vincular anúncio ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/anuncios-ml/:linkId', ANUNCIAR_ML, async (req, res) => {
    try {
      const { payload, erro } = montarPayloadAnuncioMl(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });

      if (req.params.linkId.startsWith('legado:')) {
        const { data, error } = await supabase
          .from('estoque')
          .update({ anuncio_ml_url: payload!.url })
          .eq('id', req.params.id)
          .select('id, anuncio_ml_url, criado_em, atualizado_em')
          .single();
        if (error) throw error;
        return res.json({ success: true, data: sintetizarLinkLegado(data)[0] });
      }

      const { data, error } = await supabase
        .from('estoque_anuncios_ml')
        .update(payload)
        .eq('id', req.params.linkId)
        .eq('estoque_id', req.params.id)
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ success: false, error: 'Este anúncio já está vinculado a outra peça do estoque.' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar anúncio ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/anuncios-ml/:linkId', ANUNCIAR_ML, async (req, res) => {
    try {
      if (req.params.linkId.startsWith('legado:')) {
        const { error } = await supabase.from('estoque').update({ anuncio_ml_url: null }).eq('id', req.params.id);
        if (error) throw error;
        return res.json({ success: true });
      }

      const { error } = await supabase.from('estoque_anuncios_ml').delete().eq('id', req.params.linkId).eq('estoque_id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover anúncio ML:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Publicação de anúncios NOVOS no Mercado Livre (migration_043) — cria o
  // anúncio via POST /items em vez de só colar um link já existente. Lógica
  // de verdade em src/services/mercadolivrePublicacao.ts; aqui só valida o
  // corpo e checa a conexão, mesmo padrão do resto das rotas de ML.
  // ==========================================================================

  router.post('/:id/publicar-ml', ANUNCIAR_ML, async (req, res) => {
    try {
      const { config, erro } = montarConfiguracaoPublicacao(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await publicarAnuncio(supabase, conexao.accessToken, req.params.id, config!);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao publicar anúncio no Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: extrairMensagemErroMl(error.response?.data) || error.message });
    }
  });

  // Leitura pontual sob demanda (botão "Atualizar agora" na UI) — além do
  // que o scheduler da Fase 7 já mantém fresco em background.
  router.get('/:id/anuncios-ml/:linkId/estatisticas', VER, async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      await sincronizarEstatisticas(supabase, conexao.accessToken, [req.params.linkId]);
      const { data, error } = await supabase.from('estoque_anuncios_ml_estatisticas').select('*').eq('link_id', req.params.linkId).maybeSingle();
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') {
          return res.status(409).json({ success: false, error: 'Estatísticas ainda não habilitadas — rode supabase/migration_043_mercadolivre_publicacao.sql.' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar estatísticas do anúncio:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  // Reenvia preço/estoque atual da peça pro anúncio já publicado — reaproveita
  // 100% a lógica de mercadolivreSync.ts (mesmo cálculo de margem, mesma
  // comparação em centavos) em vez de duplicá-la; "republicar" aqui é só
  // aplicar a sincronização existente pra 1 link específico.
  router.post('/:id/anuncios-ml/:linkId/republicar', ANUNCIAR_ML, async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await aplicarSincronizacao(supabase, conexao.accessToken, [req.params.linkId]);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao republicar anúncio no Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: extrairMensagemErroMl(error.response?.data) || error.message });
    }
  });

  // ==========================================================================
  // Publicação de anúncios na Shopee (migration_045) — segundo canal,
  // arquivo-espelho paralelo ao bloco do Mercado Livre acima. Lógica de
  // verdade em src/services/shopee{Api,Publicacao}.ts; aqui só valida o
  // corpo e checa a conexão, mesmo padrão do resto das rotas de estoque.
  // ==========================================================================

  // Lista simples dos anúncios da Shopee desta peça — usada pra atualizar a
  // UI logo depois de publicar (a Shopee não tem fluxo de "colar link já
  // existente" como o Mercado Livre, então não precisa de POST/PATCH/DELETE
  // aqui, só leitura).
  router.get('/:id/anuncios-shopee', VER, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_anuncios_shopee').select('*').eq('estoque_id', req.params.id).order('criado_em');
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return res.json({ success: true, data: [] });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar anúncios da Shopee da peça:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/publicar-shopee', ANUNCIAR_SHOPEE, async (req, res) => {
    try {
      const { config, erro } = montarConfiguracaoPublicacaoShopee(req.body);
      if (erro) return res.status(400).json({ success: false, error: erro });

      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      const resultado = await publicarAnuncioShopee(supabase, conexao.accessToken, conexao.shopId, req.params.id, config!);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao publicar anúncio na Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  // Leitura pontual sob demanda (botão "Atualizar agora" na UI) — além do
  // que o scheduler da Fase 7 já mantém fresco em background. Nunca chamado
  // no ato de abrir o modal de detalhes.
  router.get('/:id/anuncios-shopee/:linkId/estatisticas', VER, async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      await sincronizarEstatisticasShopee(supabase, conexao.accessToken, conexao.shopId, [req.params.linkId]);
      const { data, error } = await supabase.from('estoque_anuncios_shopee_estatisticas').select('*').eq('link_id', req.params.linkId).maybeSingle();
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') {
          return res.status(409).json({ success: false, error: 'Estatísticas ainda não habilitadas — rode supabase/migration_045_shopee_publicacao.sql.' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar estatísticas do anúncio na Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  // Reenvia preço/estoque atual da peça pro anúncio já publicado.
  router.post('/:id/anuncios-shopee/:linkId/republicar', ANUNCIAR_SHOPEE, async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      const resultado = await republicarAnuncioShopee(supabase, conexao.accessToken, conexao.shopId, req.params.linkId);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao republicar anúncio na Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  router.post('/bulk-update-categoria', EDITAR, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const categoria_id: string = req.body?.categoria_id;
      if (!Array.isArray(ids) || ids.length === 0 || !categoria_id) {
        return res.status(400).json({ success: false, error: 'ids e categoria_id são obrigatórios' });
      }
      const { error } = await supabase.from('estoque').update({ categoria_id }).in('id', ids);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-categoria de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Ajuste relativo de quantidade (delta pode ser negativo), usado pelos
  // botões +1/-1 em lote na UI.
  router.post('/bulk-update-quantidade', EDITAR, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const delta: number = Number(req.body?.delta) || 0;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }

      const { data: itens, error: fetchError } = await supabase.from('estoque').select('id, quantidade').in('id', ids);
      if (fetchError) throw fetchError;

      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase.from('estoque').update({ quantidade: novaQuantidade }).eq('id', item.id);
        if (updateError) throw updateError;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-quantidade de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
