export type GrauUnidade = "A" | "B" | "C";
export type EstadoUnidade =
  | "disponivel"
  | "reservada"
  | "organizar"
  | "arquivada";

export interface CategoriaEstoque {
  id: string;
  nome: string;
}

export interface PecaEstoque {
  id: string;
  codigoLegado: string;
  nome: string;
  categoriaId: string;
  compatibilidades: string[];
  detalhes: string;
  origemDado?: "demo" | "real";
  familiaNome?: string | null;
  gavetaNome?: string | null;
}

export interface UnidadeEstoque {
  id: string;
  pecaId: string;
  codigoLegado: string;
  sku: string;
  grau: GrauUnidade;
  preco: number | null;
  fotoUrl: string | null;
  origem: string | null;
  endereco: string | null;
  estado: EstadoUnidade;
  reservadaAte?: string;
  percentualSinal?: number;
  arquivadaEm?: string;
  motivoArquivamento?: string;
  detalhes?: string | null;
}

export interface EstoquePreviewState {
  categorias: CategoriaEstoque[];
  pecas: PecaEstoque[];
  unidades: UnidadeEstoque[];
  categoriasPorSecao: Record<string, string>;
}

export interface ResultadoBuscaEstoque {
  peca: PecaEstoque;
  categoria: CategoriaEstoque;
  unidades: UnidadeEstoque[];
}

export interface NovaUnidadeInput {
  pecaId?: string;
  novaPeca?: {
    nome: string;
    categoriaId: string;
    codigoLegado?: string;
    compatibilidades?: string[];
    detalhes?: string;
  };
  preco: number | null;
  grau: GrauUnidade;
  origem: string | null;
  fotoUrl: string | null;
  endereco: string | null;
}

export interface SecaoPrateleira {
  endereco: string;
  categoria: CategoriaEstoque | null;
  unidades: UnidadeEstoque[];
}

const categorias: CategoriaEstoque[] = [
  { id: "categoria-rabeta", nome: "Rabeta" },
  { id: "categoria-escapamentos", nome: "Escapamentos" },
  { id: "categoria-embreagem", nome: "Embreagem" },
];

const pecas: PecaEstoque[] = [
  {
    id: "peca-rk-810",
    codigoLegado: "RK-810",
    nome: "SUPORTE DE PLACA (RABETA) CBX TWISTER 250",
    categoriaId: "categoria-rabeta",
    compatibilidades: ["CBX Twister 250"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-792",
    codigoLegado: "RK-792",
    nome: "SUPORTE DE PLACA (RABETA) CG 150 MIX (09/13)",
    categoriaId: "categoria-rabeta",
    compatibilidades: ["CG 150 Mix", "2009 a 2013"],
    detalhes: "O registro legado com quantidade 3 foi dividido em três unidades.",
  },
  {
    id: "peca-rk-791",
    codigoLegado: "RK-791",
    nome: "SUPORTE DE PLACA (RABETA) CG 150",
    categoriaId: "categoria-rabeta",
    compatibilidades: ["CG 150"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-315",
    codigoLegado: "RK-315",
    nome: "ESCAPAMENTO HONDA CB TWISTER 250F",
    categoriaId: "categoria-escapamentos",
    compatibilidades: ["Honda CB Twister 250F"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-803",
    codigoLegado: "RK-803",
    nome: "ESCAPAMENTO DAFRA KANSAS 150",
    categoriaId: "categoria-escapamentos",
    compatibilidades: ["Dafra Kansas 150"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-798",
    codigoLegado: "RK-798",
    nome: "EMBREAGEM COMPLETA COM CAMPANA FACTOR 150",
    categoriaId: "categoria-embreagem",
    compatibilidades: ["Factor 150"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-790",
    codigoLegado: "RK-790",
    nome: "EMBREAGEM COMPLETA CG 160",
    categoriaId: "categoria-embreagem",
    compatibilidades: ["CG 160"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
  {
    id: "peca-rk-789",
    codigoLegado: "RK-789",
    nome: "CAMPANA DE EMBREAGEM CG 160",
    categoriaId: "categoria-embreagem",
    compatibilidades: ["CG 160"],
    detalhes: "Cadastro real usado apenas para demonstração da nova organização.",
  },
];

const unidade = (
  codigoLegado: string,
  numero: number,
  pecaId: string,
  preco: number,
  endereco: string | null,
  estado: EstadoUnidade = "disponivel"
): UnidadeEstoque => ({
  id: `unidade-${codigoLegado.toLocaleLowerCase()}-${String(numero).padStart(2, "0")}`,
  pecaId,
  codigoLegado,
  sku: `${codigoLegado}-${String(numero).padStart(2, "0")}`,
  grau: "B",
  preco,
  fotoUrl: null,
  origem: null,
  endereco,
  estado,
});

const unidades: UnidadeEstoque[] = [
  unidade("RK-810", 1, "peca-rk-810", 150, "P01-S01"),
  unidade("RK-792", 1, "peca-rk-792", 139.9, "P01-S01"),
  unidade("RK-792", 2, "peca-rk-792", 139.9, "P01-S01"),
  {
    ...unidade("RK-792", 3, "peca-rk-792", 139.9, "P01-S01", "reservada"),
    reservadaAte: "2026-09-28T18:00:00.000Z",
    percentualSinal: 20,
  },
  unidade("RK-791", 1, "peca-rk-791", 139.9, null, "organizar"),
  unidade("RK-315", 1, "peca-rk-315", 450, "P02-S01"),
  unidade("RK-803", 1, "peca-rk-803", 300, "P02-S01"),
  unidade("RK-798", 1, "peca-rk-798", 320, "P03-S01"),
  unidade("RK-790", 1, "peca-rk-790", 299.9, "P03-S01"),
  unidade("RK-789", 1, "peca-rk-789", 199.9, "P03-S01"),
];

export function criarEstoqueDemo(): EstoquePreviewState {
  return {
    categorias: categorias.map((categoria) => ({ ...categoria })),
    pecas: pecas.map((peca) => ({
      ...peca,
      compatibilidades: [...peca.compatibilidades],
    })),
    unidades: unidades.map((item) => ({ ...item })),
    categoriasPorSecao: {
      "P01-S01": "categoria-rabeta",
      "P02-S01": "categoria-escapamentos",
      "P03-S01": "categoria-embreagem",
    },
  };
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function buscarPecas(
  estoque: EstoquePreviewState,
  busca: string,
  incluirArquivadas = false
): ResultadoBuscaEstoque[] {
  const termo = normalizar(busca);
  return estoque.pecas.flatMap((peca) => {
    const categoria = estoque.categorias.find(
      (item) => item.id === peca.categoriaId
    );
    if (!categoria) return [];
    const unidadesDaPeca = estoque.unidades.filter(
      (item) =>
        item.pecaId === peca.id &&
        (incluirArquivadas || item.estado !== "arquivada")
    );
    if (!unidadesDaPeca.length && !incluirArquivadas) return [];
    const campos = [
      peca.nome,
      peca.codigoLegado,
      categoria.nome,
      peca.detalhes,
      ...peca.compatibilidades,
      ...unidadesDaPeca.flatMap((item) => [
        item.sku,
        item.endereco ?? "",
        item.origem ?? "",
      ]),
    ];
    if (termo && !campos.some((campo) => normalizar(campo).includes(termo))) {
      return [];
    }
    return [{ peca, categoria, unidades: unidadesDaPeca }];
  });
}

export function getMetricas(estoque: EstoquePreviewState) {
  const ativas = estoque.unidades.filter((item) => item.estado !== "arquivada");
  return {
    totalAtivas: ativas.length,
    disponiveis: ativas.filter((item) => item.estado === "disponivel").length,
    reservadas: ativas.filter((item) => item.estado === "reservada").length,
    paraOrganizar: ativas.filter(
      (item) => item.estado === "organizar" || !item.endereco
    ).length,
    semFoto: ativas.filter((item) => !item.fotoUrl).length,
    arquivadas: estoque.unidades.filter((item) => item.estado === "arquivada")
      .length,
  };
}

export function getSecoesDaPrateleira(
  estoque: EstoquePreviewState,
  codigoPrateleira: string
): SecaoPrateleira[] {
  return Array.from({ length: 8 }, (_, indice) => {
    const endereco = `${codigoPrateleira}-S${String(indice + 1).padStart(2, "0")}`;
    const categoriaId = estoque.categoriasPorSecao[endereco];
    return {
      endereco,
      categoria:
        estoque.categorias.find((categoria) => categoria.id === categoriaId) ??
        null,
      unidades: estoque.unidades.filter(
        (item) => item.estado !== "arquivada" && item.endereco === endereco
      ),
    };
  });
}

function proximoCodigoNovo(estoque: EstoquePreviewState): string {
  const totalNovos = estoque.pecas.filter((peca) =>
    peca.codigoLegado.startsWith("NOVO-")
  ).length;
  return `NOVO-${String(totalNovos + 1).padStart(3, "0")}`;
}

export function adicionarUnidade(
  estoque: EstoquePreviewState,
  entrada: NovaUnidadeInput
): EstoquePreviewState {
  let pecasAtualizadas = estoque.pecas;
  let peca = entrada.pecaId
    ? estoque.pecas.find((item) => item.id === entrada.pecaId)
    : undefined;

  if (!peca && entrada.novaPeca) {
    const codigoLegado = entrada.novaPeca.codigoLegado?.trim() || proximoCodigoNovo(estoque);
    peca = {
      id: `peca-${codigoLegado.toLocaleLowerCase()}`,
      codigoLegado,
      nome: entrada.novaPeca.nome.trim(),
      categoriaId: entrada.novaPeca.categoriaId,
      compatibilidades: entrada.novaPeca.compatibilidades ?? [],
      detalhes: entrada.novaPeca.detalhes?.trim() ?? "",
    };
    pecasAtualizadas = [...estoque.pecas, peca];
  }

  if (!peca) throw new Error("Escolha ou crie uma Peça antes de adicionar a Unidade");

  const quantidadeMesmoCodigo = estoque.unidades.filter(
    (item) => item.codigoLegado === peca?.codigoLegado
  ).length;
  const numero = quantidadeMesmoCodigo + 1;
  const sufixo = String(numero).padStart(2, "0");
  const novaUnidade: UnidadeEstoque = {
    id: `unidade-${peca.codigoLegado.toLocaleLowerCase()}-${sufixo}`,
    pecaId: peca.id,
    codigoLegado: peca.codigoLegado,
    sku: `${peca.codigoLegado}-${sufixo}`,
    grau: entrada.grau,
    preco: entrada.preco,
    fotoUrl: entrada.fotoUrl,
    origem: entrada.origem?.trim() || null,
    endereco: entrada.endereco,
    estado: entrada.endereco ? "disponivel" : "organizar",
  };

  return {
    ...estoque,
    pecas: pecasAtualizadas,
    unidades: [...estoque.unidades, novaUnidade],
  };
}

export function editarUnidade(
  estoque: EstoquePreviewState,
  unidadeId: string,
  alteracoes: Partial<
    Pick<
      UnidadeEstoque,
      "preco" | "grau" | "origem" | "fotoUrl" | "endereco" | "estado"
    >
  >
): EstoquePreviewState {
  return {
    ...estoque,
    unidades: estoque.unidades.map((item) =>
      item.id === unidadeId ? { ...item, ...alteracoes } : item
    ),
  };
}

export function editarPeca(
  estoque: EstoquePreviewState,
  pecaId: string,
  alteracoes: Partial<
    Pick<PecaEstoque, "nome" | "categoriaId" | "compatibilidades" | "detalhes">
  >
): EstoquePreviewState {
  return {
    ...estoque,
    pecas: estoque.pecas.map((item) =>
      item.id === pecaId ? { ...item, ...alteracoes } : item
    ),
  };
}

export function definirCategoriaDaSecao(
  estoque: EstoquePreviewState,
  endereco: string,
  categoriaId: string | null
): EstoquePreviewState {
  const categoriasPorSecao = { ...estoque.categoriasPorSecao };
  if (categoriaId) categoriasPorSecao[endereco] = categoriaId;
  else delete categoriasPorSecao[endereco];
  return { ...estoque, categoriasPorSecao };
}

export function arquivarUnidade(
  estoque: EstoquePreviewState,
  unidadeId: string,
  motivo: string,
  agora = new Date().toISOString()
): EstoquePreviewState {
  return {
    ...estoque,
    unidades: estoque.unidades.map((item) =>
      item.id === unidadeId
        ? {
            ...item,
            estado: "arquivada",
            arquivadaEm: agora,
            motivoArquivamento: motivo.trim() || "Arquivada pela equipe",
          }
        : item
    ),
  };
}

export function restaurarUnidade(
  estoque: EstoquePreviewState,
  unidadeId: string
): EstoquePreviewState {
  return {
    ...estoque,
    unidades: estoque.unidades.map((item) => {
      if (item.id !== unidadeId) return item;
      const { arquivadaEm: _arquivadaEm, motivoArquivamento: _motivo, ...resto } = item;
      return {
        ...resto,
        estado: item.endereco ? "disponivel" : "organizar",
      };
    }),
  };
}
