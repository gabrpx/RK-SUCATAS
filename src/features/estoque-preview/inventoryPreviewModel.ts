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
  /**
   * Fichas livres acima da quantidade da peça: sobra de vendas antigas feitas
   * sem escolher a unidade (antes da migration_069). Não sabemos qual saiu,
   * então as métricas não as contam como disponíveis até a equipe conferir.
   */
  fichasExcedentes?: number;
}

export interface UnidadeEstoque {
  id: string;
  /** False when this row only represents legacy quantity without a persisted unit ID. */
  individualizada?: boolean;
  pecaId: string;
  codigoLegado: string;
  sku: string;
  grau: GrauUnidade;
  preco: number | null;
  fotoUrl: string | null;
  origem: string | null;
  endereco: string | null;
  organizadaEm?: string | null;
  vendidaEm?: string | null;
  estado: EstadoUnidade;
  reservadaAte?: string;
  reservaId?: string;
  reservadaPara?: string;
  /** Cliente cadastrado vinculado à reserva (migration_067); ausente em reserva de balcão por nome livre. */
  reservaClienteId?: string | null;
  reservaTelefone?: string | null;
  /** Sinal pago na reserva (migration_068). Nulo em reservas anteriores à regra de 20%. */
  reservaValorSinal?: number | null;
  reservadaEm?: string;
  percentualSinal?: number;
  arquivadaEm?: string;
  motivoArquivamento?: string;
  detalhes?: string | null;
}

export interface EstoquePreviewState {
  categorias: CategoriaEstoque[];
  pecas: PecaEstoque[];
  unidades: UnidadeEstoque[];
  categoriasPorSecao: Record<string, string[]>;
  /** Prioridade (1 principal, 2 secundária, 3 eventual) de cada categoria por código de local. */
  prioridadesPorSecao?: Record<string, Record<string, number>>;
  locais?: { id: string; codigo: string; deposito: string; zona: string; prateleira: string; secao: string; descricao: string | null; ativo: boolean }[];
}

export interface ResultadoBuscaEstoque {
  peca: PecaEstoque;
  categoria: CategoriaEstoque;
  unidades: UnidadeEstoque[];
}

export interface NovaUnidadeInput {
  fotos?: File[];
  pecaId?: string;
  novaPeca?: {
    nome: string;
    categoriaId: string;
    condicao?: "original" | "paralela";
    notaCadastro?: "com_nota" | "sem_nota" | null;
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
  categorias: CategoriaEstoque[];
  unidades: UnidadeEstoque[];
}

export const enderecosPrateleira = Array.from({ length: 11 }, (_, prateleira) =>
  Array.from({ length: 8 }, (_, secao) => {
    const codigoPrateleira = `P${String(prateleira + 1).padStart(2, "0")}`;
    const codigoSecao = `S${String(secao + 1).padStart(2, "0")}`;
    return { value: `${codigoPrateleira}-${codigoSecao}`, label: `${codigoPrateleira}-${codigoSecao} · Prateleira ${prateleira + 1}, seção ${secao + 1}` };
  })
).flat();

const categorias: CategoriaEstoque[] = [
  { id: "categoria-rabeta", nome: "Rabeta" },
  { id: "categoria-escapamentos", nome: "Escapamentos" },
  { id: "categoria-embreagem", nome: "Embreagem" },
  { id: "categoria-iluminacao", nome: "Iluminação" },
];

const pecas: PecaEstoque[] = [
  {
    id: "peca-rk-825",
    codigoLegado: "RK-825",
    nome: "FAROL DIANTEIRO HONDA CG 160",
    categoriaId: "categoria-iluminacao",
    compatibilidades: ["CG 160"],
    detalhes: "Cadastro sem unidade física conferida.",
  },
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
    reservadaPara: "Cliente demonstração A",
    reservadaEm: "2026-09-21T18:00:00.000Z",
    reservaValorSinal: 27.98,
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
      "P01-S01": ["categoria-rabeta"],
      "P02-S01": ["categoria-escapamentos"],
      "P03-S01": ["categoria-embreagem"],
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

/** Quantidade real da peça: unidades ativas menos as fichas que sobraram. */
export function quantidadeAtivaDaPeca(resultado: ResultadoBuscaEstoque) {
  return Math.max(0, resultado.unidades.length - (resultado.peca.fichasExcedentes ?? 0));
}

/** Mesma regra do Dashboard (valorEstoque.isEstoqueBaixo): 1 ou 2 unidades. */
export function filtrarEstoqueBaixo(resultados: ResultadoBuscaEstoque[]) {
  return resultados.filter((resultado) => {
    const quantidade = quantidadeAtivaDaPeca(resultado);
    return quantidade > 0 && quantidade <= 2;
  });
}

export function getMetricas(estoque: EstoquePreviewState) {
  const ativas = estoque.unidades.filter((item) => item.estado !== "arquivada");
  const fichasExcedentes = estoque.pecas.reduce((total, peca) => total + (peca.fichasExcedentes ?? 0), 0);
  const disponiveisBrutas = ativas.filter((item) => item.estado === "disponivel").length;
  // Não sabemos qual ficha sobrando já saiu: tira do valor as mais caras da
  // peça (nunca superestima o estoque) e as mesmas do total "com preço".
  let valorSobrando = 0;
  let comPrecoSobrando = 0;
  for (const peca of estoque.pecas) {
    const sobra = peca.fichasExcedentes ?? 0;
    if (!sobra) continue;
    const precos = ativas.filter((item) => item.pecaId === peca.id).map((item) => item.preco ?? 0).sort((a, b) => b - a).slice(0, sobra);
    valorSobrando += precos.reduce((total, preco) => total + preco, 0);
    comPrecoSobrando += precos.filter((preco) => preco > 0).length;
  }
  return {
    // Conservador: ficha sobrando não conta como peça à venda até ser conferida.
    totalAtivas: Math.max(0, ativas.length - fichasExcedentes),
    disponiveis: Math.max(0, disponiveisBrutas - fichasExcedentes),
    fichasExcedentes,
    // Localização é física: uma unidade reservada continua no mesmo endereço.
    localizadas: ativas.filter((item) => Boolean(item.endereco)).length,
    reservadas: ativas.filter((item) => item.estado === "reservada").length,
    paraOrganizar: ativas.filter(
      (item) => item.estado === "organizar" || !item.endereco
    ).length,
    valorEmEstoque: Math.max(0, ativas.reduce((total, item) => total + (item.preco ?? 0), 0) - valorSobrando),
    unidadesComPreco: Math.max(0, ativas.filter((item) => item.preco != null && item.preco > 0).length - comPrecoSobrando),
    valorDisponivel: ativas.filter((item) => item.estado === "disponivel").reduce((total, item) => total + (item.preco ?? 0), 0),
    valorReservado: ativas.filter((item) => item.estado === "reservada").reduce((total, item) => total + (item.preco ?? 0), 0),
    semEstoque: estoque.pecas.filter((peca) => !ativas.some((item) => item.pecaId === peca.id)).length,
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
    const categoriaIds = estoque.categoriasPorSecao[endereco] ?? [];
    const categorias = categoriaIds.flatMap((id) => estoque.categorias.filter((categoria) => categoria.id === id));
    return {
      endereco,
      categoria: categorias[0] ?? null,
      categorias,
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
    unidades: estoque.unidades.map((item) => {
      if (item.id !== unidadeId) return item;
      const mudouEndereco = alteracoes.endereco !== undefined && alteracoes.endereco !== item.endereco;
      const proximo = { ...item, ...alteracoes, ...(mudouEndereco && alteracoes.endereco ? { organizadaEm: new Date().toISOString() } : {}) };
      // Estado segue o endereço, mas nunca desfaz reserva/arquivamento.
      if (mudouEndereco && (item.estado === "disponivel" || item.estado === "organizar")) proximo.estado = proximo.endereco ? "disponivel" : "organizar";
      return proximo;
    }),
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
  if (categoriaId) categoriasPorSecao[endereco] = [categoriaId];
  else delete categoriasPorSecao[endereco];
  return { ...estoque, categoriasPorSecao };
}

export function alternarCategoriaDaSecao(
  estoque: EstoquePreviewState,
  endereco: string,
  categoriaId: string
): EstoquePreviewState {
  if (!estoque.categorias.some((categoria) => categoria.id === categoriaId)) return estoque;
  const atuais = estoque.categoriasPorSecao[endereco] ?? [];
  const proximas = atuais.includes(categoriaId)
    ? atuais.filter((id) => id !== categoriaId)
    : [...atuais, categoriaId];
  const categoriasPorSecao = { ...estoque.categoriasPorSecao };
  if (proximas.length) categoriasPorSecao[endereco] = proximas;
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

export interface ReservaUnidadeInput {
  clienteId: string | null;
  nome: string;
  telefone?: string | null;
  /** Duração em dias corridos de 24 h (1 a 30), mesma regra da API e do banco. */
  dias: number;
  valorSinal: number;
  formaPagamentoId: string;
}

/** Percentual mínimo do sinal exigido pela loja para reservar. */
export const PERCENTUAL_SINAL_MINIMO = 20;

export function sinalMinimo(preco: number) {
  return Math.max(Math.round(preco * PERCENTUAL_SINAL_MINIMO) / 100, 0.01);
}

/**
 * Vencimento = agora + dias × 24 h, idêntico ao cálculo da API
 * (`vencimentoReserva` em estoqueOrganizacao.ts) e ao limite do banco
 * (`now() + interval '30 days'`). No modo real a API é quem calcula; aqui
 * serve para a prévia do formulário e para a demonstração.
 */
export function vencimentoReserva(dias: number, agora = Date.now()) {
  return new Date(agora + dias * 86_400_000 - (dias === DIAS_RESERVA_MAXIMO ? 60_000 : 0)).toISOString();
}

/** Motivo pelo qual a unidade não pode ser reservada agora, ou null se pode. */
export function motivoBloqueioReserva(unidade: UnidadeEstoque): string | null {
  if (unidade.individualizada === false) return "Esta quantidade ainda não tem ficha física individual.";
  if (unidade.vendidaEm) return "Unidade vendida.";
  if (unidade.estado === "arquivada") return "Unidade arquivada.";
  if (unidade.estado === "reservada") return "Unidade já reservada.";
  if (unidade.preco == null || unidade.preco <= 0) return "Defina o preço antes de reservar: o sinal é de 20% do preço.";
  return null;
}

export const DIAS_RESERVA_MAXIMO = 30;

/** Dias de calendário até o vencimento (reserva feita hoje com 7 dias = 7, não 8 por causa das horas). */
export function diasRestantesReserva(vencimentoIso: string, agora = new Date()) {
  const vencimento = new Date(vencimentoIso);
  if (Number.isNaN(vencimento.getTime())) return 0;
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000));
}

/** Prazo padrão de reserva combinado com a loja: 7 dias. */
export const DIAS_RESERVA_PADRAO = 7;

export function podeReservar(unidade: UnidadeEstoque) {
  return unidade.individualizada !== false && unidade.estado !== "arquivada" && unidade.estado !== "reservada" && !unidade.vendidaEm;
}

export function reservarUnidade(
  estoque: EstoquePreviewState,
  unidadeId: string,
  reserva: ReservaUnidadeInput,
  reservaId = `reserva-demo-${unidadeId}`,
  agora = Date.now()
): EstoquePreviewState {
  return {
    ...estoque,
    unidades: estoque.unidades.map((item) =>
      item.id === unidadeId && podeReservar(item) && !motivoBloqueioReserva(item) && item.preco != null && reserva.valorSinal >= sinalMinimo(item.preco) && reserva.valorSinal <= item.preco
        ? {
            ...item,
            estado: "reservada",
            reservaId,
            reservadaEm: new Date(agora).toISOString(),
            reservaValorSinal: Math.round(reserva.valorSinal * 100) / 100,
            reservadaAte: vencimentoReserva(reserva.dias, agora),
            reservadaPara: reserva.nome.trim(),
            reservaClienteId: reserva.clienteId,
            reservaTelefone: reserva.telefone ?? null,
          }
        : item
    ),
  };
}

export function liberarReservaUnidade(
  estoque: EstoquePreviewState,
  unidadeId: string
): EstoquePreviewState {
  return {
    ...estoque,
    unidades: estoque.unidades.map((item) => {
      if (item.id !== unidadeId || item.estado !== "reservada") return item;
      const {
        reservaId: _reservaId, reservadaAte: _ate, reservadaPara: _para,
        reservaClienteId: _cliente, reservaTelefone: _telefone, percentualSinal: _sinal,
        reservaValorSinal: _valorSinal, reservadaEm: _reservadaEm, ...resto
      } = item;
      return { ...resto, estado: item.endereco ? "disponivel" : "organizar" };
    }),
  };
}

export interface EventoLocal {
  tipo: "cadastrada" | "endereco" | "reservada" | "reserva_liberada" | "reserva_vencida" | "arquivada" | "restaurada" | "vendida";
  em: string;
  titulo: string;
  detalhe: string | null;
  autor: string | null;
}

/**
 * Linha do tempo da demonstração: usa apenas o que a própria sessão registrou
 * (reserva, endereço, arquivamento). No modo real a linha do tempo vem da API.
 */
export function historicoDemonstracao(unidade: UnidadeEstoque): EventoLocal[] {
  const eventos: EventoLocal[] = [];
  if (unidade.organizadaEm && unidade.endereco) eventos.push({ tipo: "endereco", em: unidade.organizadaEm, titulo: `Guardada em ${unidade.endereco}`, detalhe: null, autor: null });
  if (unidade.estado === "reservada" && unidade.reservadaEm) {
    eventos.push({ tipo: "reservada", em: unidade.reservadaEm, titulo: `Reservada para ${unidade.reservadaPara ?? "cliente"}`, detalhe: unidade.reservaValorSinal != null ? `Sinal de ${unidade.reservaValorSinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : null, autor: null });
  }
  if (unidade.arquivadaEm) eventos.push({ tipo: "arquivada", em: unidade.arquivadaEm, titulo: "Arquivada", detalhe: unidade.motivoArquivamento ?? null, autor: null });
  if (unidade.vendidaEm) eventos.push({ tipo: "vendida", em: unidade.vendidaEm, titulo: "Vendida", detalhe: null, autor: null });
  return eventos.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}
