import type { Categoria } from "../../types/catalog";
import type { Estoque, EstoqueUnidade } from "../estoque/types";
import type { EstoquePreviewState, GrauUnidade, PecaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

type ApiCategoria = Pick<Categoria, "id" | "nome" | "parent_id" | "ordem">;

function grauDaNota(nota: number | null | undefined): GrauUnidade {
  if (nota == null) return "B";
  if (nota >= 8) return "A";
  if (nota >= 5) return "B";
  return "C";
}

function compatibilidadesDoItem(item: Estoque): string[] {
  const principal = item.modelo_moto ? `${item.modelo_moto.nome}${item.modelo_moto.ano ? ` · ${item.modelo_moto.ano}` : ""}` : null;
  const extras = (item.modelos_compativeis ?? []).map((modelo) => `${modelo.nome}${modelo.ano ? ` · ${modelo.ano}` : ""}`);
  return Array.from(new Set([principal, ...extras].filter((value): value is string => Boolean(value))));
}

function detalhesDaPeca(item: Estoque): string {
  const partes = [item.descricao?.trim() ?? ""];
  if (item.gaveta?.nome) partes.push(`Gaveta atual: ${item.gaveta.nome}`);
  if (item.familia?.nome) partes.push(`Família atual: ${item.familia.nome}`);
  if (item.condicao === "paralela") partes.push("Origem: paralela");
  return partes.filter(Boolean).join(" · ");
}

function nomeCategoria(item: Estoque, categorias: ApiCategoria[]): { id: string; nome: string } {
  if (item.categoria_id && item.categoria?.nome) return { id: item.categoria_id, nome: item.categoria.nome };
  const encontrada = categorias.find((categoria) => categoria.id === item.categoria_id);
  if (encontrada) return encontrada;
  return { id: item.categoria_id ?? "categoria-sem-categoria", nome: "Sem categoria" };
}

function unidadeReal(item: Estoque, unidade: EstoqueUnidade, indice: number): UnidadeEstoque {
  const sku = unidade.sku == null ? `${item.codigo}-${String(indice + 1).padStart(2, "0")}` : String(unidade.sku);
  // A foto geral do cadastro legado descreve o tipo da peça, não esta peça
  // física. Exibi-la em todas as unidades cria uma falsa impressão de que
  // cada uma já foi fotografada e conferida individualmente.
  const fotoUrl = unidade.fotos?.[0] ?? null;
  return {
    id: unidade.id,
    pecaId: item.id,
    codigoLegado: item.codigo,
    sku,
    grau: grauDaNota(unidade.condicao_nota ?? item.condicao_nota),
    preco: unidade.valor ?? item.valor ?? null,
    fotoUrl,
    origem: null,
    endereco: null,
    estado: unidade.vendida_em ? "arquivada" : "organizar",
    detalhes: [unidade.nome, unidade.descricao, unidade.avaria_descricao].filter(Boolean).join(" · ") || null,
  };
}

function unidadeVirtual(item: Estoque, indice: number): UnidadeEstoque {
  return {
    id: `${item.id}-virtual-${indice + 1}`,
    pecaId: item.id,
    codigoLegado: item.codigo,
    sku: `${item.codigo}-${String(indice + 1).padStart(2, "0")}`,
    grau: grauDaNota(item.condicao_nota),
    preco: item.valor ?? null,
    fotoUrl: null,
    origem: null,
    endereco: null,
    estado: "organizar",
    detalhes: "Unidade criada apenas para representar a quantidade legada; a ficha física será completada na implantação.",
  };
}

export function adaptarEstoqueReal(itens: Estoque[], categoriasDisponiveis: ApiCategoria[]): EstoquePreviewState {
  // Todas as categorias ficam disponíveis mesmo quando ainda não têm item
  // vinculado. Isso deixa as seções prontas para preencher sem reclassificar
  // o estoque legado antes da implantação física.
  const categorias = new Map<string, { id: string; nome: string }>(
    categoriasDisponiveis.map((categoria) => [categoria.id, { id: categoria.id, nome: categoria.nome }])
  );
  const pecas: PecaEstoque[] = [];
  const unidades: UnidadeEstoque[] = [];

  for (const item of itens.filter((estoque) => estoque.ativo !== false)) {
    const categoria = nomeCategoria(item, categoriasDisponiveis);
    categorias.set(categoria.id, categoria);
    pecas.push({
      id: item.id,
      codigoLegado: item.codigo,
      nome: item.nome,
      categoriaId: categoria.id,
      compatibilidades: compatibilidadesDoItem(item),
      detalhes: detalhesDaPeca(item),
      origemDado: "real",
      familiaNome: item.familia?.nome ?? null,
      gavetaNome: item.gaveta?.nome ?? null,
    });

    const fichas = item.unidades ?? [];
    const fichasAtivas = fichas.filter((unidade) => !unidade.vendida_em);
    unidades.push(...fichas.map((unidade, indice) => unidadeReal(item, unidade, indice)));
    const quantidadeRepresentada = Math.max(0, item.quantidade - fichasAtivas.length);
    for (let indice = 0; indice < quantidadeRepresentada; indice += 1) {
      unidades.push(unidadeVirtual(item, fichasAtivas.length + indice));
    }
  }

  return { categorias: [...categorias.values()], pecas, unidades, categoriasPorSecao: {} };
}
