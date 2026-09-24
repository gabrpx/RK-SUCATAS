import { estoqueApi } from '../estoque/api';
import { enviarFotoUnidade, organizacaoApi } from './organizacaoApi';
import type { EstoqueLocal, EstoqueUnidade } from '../estoque/types';
import { comprimirImagem } from '../../utils/comprimirImagem';
import type { NovaUnidadeInput, PecaEstoque } from './inventoryPreviewModel';

export interface ResultadoCadastro {
  completo: boolean;
  mensagem: string;
  pecaId: string;
  unidadeId?: string;
  /** true quando as URLs enviadas já estão gravadas na ficha (não podem ser descartadas). */
  fotosAnexadas: boolean;
}

function exigirSucesso<T>(resposta: { success: boolean; data: T; error?: string }, mensagem: string): T {
  if (!resposta.success) throw new Error(resposta.error || mensagem);
  return resposta.data;
}

function notaDoGrau(grau: NovaUnidadeInput['grau']) {
  return grau === 'A' ? 9 : grau === 'B' ? 6 : 3;
}

/**
 * Upload antes do cadastro evita uma peça duplicada em caso de falha da foto.
 * O cache (arquivo → URL) vive no composer durante a sessão do cadastro: uma
 * nova tentativa reaproveita as fotos já enviadas em vez de subir cópias. Se
 * o cadastro for abandonado, o composer pede o descarte das URLs que não
 * chegaram a ser gravadas (ver `organizacaoApi.descartarFotos`).
 */
export async function enviarFotosComCache(fotos: File[], cache: Map<File, string>): Promise<string[]> {
  const urls: string[] = [];
  for (const foto of fotos) {
    const existente = cache.get(foto);
    if (existente) { urls.push(existente); continue; }
    const { arquivo } = await comprimirImagem(foto);
    const resposta = await enviarFotoUnidade(arquivo);
    if (!resposta.success || !resposta.url) throw new Error(resposta.error || `Falha ao enviar ${foto.name}. Nenhuma peça foi criada.`);
    cache.set(foto, resposta.url);
    urls.push(resposta.url);
  }
  return urls;
}

export async function salvarUnidadeOperacional(
  entrada: NovaUnidadeInput,
  pecas: PecaEstoque[],
  locais: EstoqueLocal[],
  cacheFotos: Map<File, string> = new Map()
): Promise<ResultadoCadastro> {
  if (entrada.preco !== null && (!Number.isFinite(entrada.preco) || entrada.preco <= 0)) {
    throw new Error('Informe um preço maior que zero ou deixe em branco para definir depois.');
  }
  const local = entrada.endereco ? locais.find((item) => item.codigo === entrada.endereco && item.ativo) : null;
  if (entrada.endereco && !local) throw new Error('O endereço selecionado não está cadastrado ou está inativo.');
  const urls = await enviarFotosComCache(entrada.fotos ?? [], cacheFotos);
  const nota = notaDoGrau(entrada.grau);

  let pecaId = entrada.pecaId;
  let unidade: EstoqueUnidade | undefined;
  let fotosAnexadas = urls.length === 0;
  if (pecaId) {
    if (!pecas.some((item) => item.id === pecaId && item.origemDado === 'real')) {
      throw new Error('Escolha uma peça existente do estoque real.');
    }
    // Uma transação só: ficha, preço, nota, fotos, endereço e origem.
    unidade = exigirSucesso(await organizacaoApi.criarUnidade(pecaId, {
      fotos: urls, valor: entrada.preco, condicao_nota: nota,
      endereco_id: local?.id ?? null, origem_identificacao: entrada.origem ?? null,
    }), 'Não foi possível adicionar a unidade.');
    return { completo: true, mensagem: 'Unidade cadastrada no estoque.', pecaId, unidadeId: unidade.id, fotosAnexadas: true };
  } else if (entrada.novaPeca) {
    const nova = entrada.novaPeca;
    if (!nova.nome.trim() || !nova.categoriaId) throw new Error('Nome e categoria são obrigatórios.');
    const peca = exigirSucesso(await estoqueApi.criar({
      nome: nova.nome.trim(), categoria_id: nova.categoriaId,
      condicao: nova.condicao ?? 'original', nota_cadastro: nova.notaCadastro ?? null,
      valor: entrada.preco, quantidade: 1, condicao_nota: nota, imagens: [],
      modelo_moto_id: null, modelo_moto_compativel_ids: [], ano: null, ativo: true, componentes: null, anuncio_fb_url: null, descricao: [nova.detalhes, nova.compatibilidades?.length ? `Referência de moto: ${nova.compatibilidades.join(', ')}` : null].filter(Boolean).join(' · ') || null,
    }), 'Não foi possível criar a peça.');
    pecaId = peca.id;
    try {
      const fichas = exigirSucesso(await estoqueApi.listarUnidades(pecaId), 'A peça foi salva, mas a unidade não pôde ser carregada.');
      unidade = fichas.find((item) => !item.vendida_em);
      if (!unidade) return { completo: false, mensagem: 'Peça salva. A ficha da unidade ainda não foi gerada; confira a sincronização do estoque.', pecaId, fotosAnexadas };
      // Fotos, preço, nota, endereço e origem numa única gravação da ficha.
      exigirSucesso(await organizacaoApi.editarUnidade(unidade.id, {
        fotos: urls, valor: entrada.preco, condicao_nota: nota,
        ...(local || entrada.origem ? { endereco_id: local?.id ?? null, origem_identificacao: entrada.origem ?? null } : {}),
      }), 'A peça foi salva, mas a ficha da unidade (foto, condição e endereço) precisa ser conferida.');
      fotosAnexadas = true;
    } catch (erro) {
      return { completo: false, mensagem: erro instanceof Error ? `Peça salva. ${erro.message}` : 'Peça salva; confira a unidade.', pecaId, unidadeId: unidade?.id, fotosAnexadas };
    }
  } else {
    throw new Error('Escolha uma peça existente ou informe uma nova.');
  }

  if (!pecaId || !unidade) throw new Error('Não foi possível identificar a unidade cadastrada.');
  return { completo: true, mensagem: 'Unidade cadastrada no estoque.', pecaId, unidadeId: unidade.id, fotosAnexadas };
}
