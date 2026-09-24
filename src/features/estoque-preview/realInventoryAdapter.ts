import type { Categoria } from "../../types/catalog";
import type { Estoque, EstoqueLocal, EstoqueLocalCategoria, EstoqueUnidade } from "../estoque/types";
import type { ReservaComSinal } from "./organizacaoApi";
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

function unidadeReal(item: Estoque, unidade: EstoqueUnidade, indice: number, locais: Map<string, EstoqueLocal>, reservas: Map<string, ReservaComSinal>): UnidadeEstoque {
  const sku = unidade.sku == null ? `${item.codigo}-${String(indice + 1).padStart(2, "0")}` : String(unidade.sku);
  // A foto geral do cadastro legado descreve o tipo da peça, não esta peça
  // física. Exibi-la em todas as unidades cria uma falsa impressão de que
  // cada uma já foi fotografada e conferida individualmente.
  const fotoUrl = unidade.fotos?.[0] ?? null;
  const reserva = reservas.get(unidade.id);
  return {
    id: unidade.id,
    individualizada: true,
    pecaId: item.id,
    codigoLegado: item.codigo,
    sku,
    grau: grauDaNota(unidade.condicao_nota ?? item.condicao_nota),
    preco: unidade.valor ?? item.valor ?? null,
    fotoUrl,
    origem: unidade.origem_identificacao ?? null,
    endereco: unidade.endereco_id ? locais.get(unidade.endereco_id)?.codigo ?? null : null,
    organizadaEm: unidade.organizada_em ?? null,
    vendidaEm: unidade.vendida_em ?? null,
    estado: unidade.vendida_em || unidade.arquivada_em ? "arquivada" : reserva ? "reservada" : unidade.endereco_id ? "disponivel" : "organizar",
    reservaId: reserva?.id,
    reservadaAte: reserva?.reservada_ate,
    reservadaPara: reserva ? reserva.cliente?.nome ?? reserva.responsavel : undefined,
    reservaClienteId: reserva?.cliente_id ?? null,
    reservaTelefone: reserva?.cliente?.telefone ?? null,
    reservaValorSinal: reserva?.valor_sinal ?? null,
    reservadaEm: reserva?.criada_em,
    arquivadaEm: unidade.arquivada_em ?? undefined,
    motivoArquivamento: unidade.motivo_arquivamento ?? undefined,
    detalhes: [unidade.nome, unidade.descricao, unidade.avaria_descricao].filter(Boolean).join(" · ") || null,
  };
}

function unidadeVirtual(item: Estoque, indice: number): UnidadeEstoque {
  return {
    id: `${item.id}-virtual-${indice + 1}`,
    individualizada: false,
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

export function adaptarEstoqueReal(itens: Estoque[], categoriasDisponiveis: ApiCategoria[], locaisDisponiveis: EstoqueLocal[] = [], vinculos: EstoqueLocalCategoria[] = [], reservasDisponiveis: ReservaComSinal[] = []): EstoquePreviewState {
  // Todas as categorias ficam disponíveis mesmo quando ainda não têm item
  // vinculado. Isso deixa as seções prontas para preencher sem reclassificar
  // o estoque legado antes da implantação física.
  const categorias = new Map<string, { id: string; nome: string }>(
    categoriasDisponiveis.map((categoria) => [categoria.id, { id: categoria.id, nome: categoria.nome }])
  );
  const pecas: PecaEstoque[] = [];
  const unidades: UnidadeEstoque[] = [];
  const locais = new Map(locaisDisponiveis.map((local) => [local.id, local]));
  const reservas = new Map(reservasDisponiveis.map((reserva) => [reserva.unidade_id, reserva]));

  for (const item of itens.filter((estoque) => estoque.ativo !== false)) {
    const categoria = nomeCategoria(item, categoriasDisponiveis);
    categorias.set(categoria.id, categoria);
    const fichas = item.unidades ?? [];
    const fichasAtivas = fichas.filter((unidade) => !unidade.vendida_em && !unidade.arquivada_em);
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
      fichasExcedentes: Math.max(0, fichasAtivas.length - Math.max(0, item.quantidade)),
    });

    unidades.push(...fichas.map((unidade, indice) => unidadeReal(item, unidade, indice, locais, reservas)));
    const quantidadeRepresentada = Math.max(0, item.quantidade - fichasAtivas.length);
    for (let indice = 0; indice < quantidadeRepresentada; indice += 1) {
      unidades.push(unidadeVirtual(item, fichasAtivas.length + indice));
    }
  }

  const categoriasPorSecao: Record<string, string[]> = {};
  const prioridadesPorSecao: Record<string, Record<string, number>> = {};
  for (const vinculo of vinculos) {
    const codigo = locais.get(vinculo.local_id)?.codigo;
    if (!codigo) continue;
    categoriasPorSecao[codigo] = [...(categoriasPorSecao[codigo] ?? []), vinculo.categoria_id];
    prioridadesPorSecao[codigo] = { ...(prioridadesPorSecao[codigo] ?? {}), [vinculo.categoria_id]: vinculo.prioridade ?? 1 };
  }
  return { categorias: [...categorias.values()], pecas, unidades, categoriasPorSecao, prioridadesPorSecao, locais: locaisDisponiveis };
}
