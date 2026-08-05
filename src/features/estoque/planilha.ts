// Ponte entre planilha (CSV) e o estoque: lê as linhas de uma exportação do
// Excel/Sheets e devolve rascunhos validados, e gera o CSV de backup no
// sentido inverso. Função pura — quem chama decide o que fazer com os erros.
import { parseCsv, gerarCsv } from '../../utils/csv';
import { categoriaExigeNota } from './categoriaMotor';
import { valorTotalItem, contarAvarias, contarFichas } from './valorEstoque';
import { getAncestorChain } from '../categorias/categoriaTree';
import type { Categoria, ModeloMoto } from '../../types/catalog';
import type { CondicaoPeca, Estoque, EstoqueInput, NotaCadastro } from './types';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cada campo aceita vários nomes de coluna porque a planilha vem de onde o
// pessoal já anotava — não dá pra exigir um cabeçalho exato.
const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'peca', 'produto', 'item', 'descricao curta', 'nome da peca'],
  categoria: ['categoria', 'tipo de peca', 'grupo'],
  modelo: ['modelo', 'moto', 'modelo moto', 'modelo de moto', 'veiculo'],
  condicao: ['condicao', 'original ou paralela', 'origem'],
  condicaoNota: ['nota de condicao', 'condicao nota', 'estado fisico', 'estado'],
  valor: ['valor', 'preco', 'preco unitario', 'valor unitario', 'preco de venda'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'estoque'],
  ano: ['ano'],
  nota: ['nota', 'nota fiscal', 'nota cadastro', 'nota para cadastro', 'nota pra cadastro'],
  descricao: ['descricao', 'observacao', 'obs', 'detalhes'],
};

export type CampoPlanilha = keyof typeof SINONIMOS;

export function mapearCabecalho(cabecalho: string[]): Partial<Record<CampoPlanilha, number>> {
  const mapa: Partial<Record<CampoPlanilha, number>> = {};
  cabecalho.forEach((coluna, indice) => {
    const alvo = normalizar(coluna);
    for (const [campo, nomes] of Object.entries(SINONIMOS) as [CampoPlanilha, string[]][]) {
      if (mapa[campo] === undefined && nomes.includes(alvo)) mapa[campo] = indice;
    }
  });
  return mapa;
}

// Converte número escrito em pt-BR ou en-US sem confundir milhar com decimal.
// A regra do ponto sozinho olha o último grupo: "1.500" é mil e quinhentos
// (3 dígitos = milhar), "1234.56" é decimal. Preço em real com 3 casas
// decimais não existe, então a heurística é segura — e mesmo assim o valor
// convertido aparece na pré-visualização antes de importar.
export function parseNumeroBr(texto: string): number | null {
  const limpo = (texto || '').replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;

  let normalizado: string;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes('.')) {
    const ultimoGrupo = limpo.split('.').pop() || '';
    normalizado = ultimoGrupo.length === 3 ? limpo.replace(/\./g, '') : limpo;
  } else {
    normalizado = limpo;
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function acharPorNome<T extends { id: string; nome: string }>(texto: string, lista: T[]): T | undefined {
  const alvo = normalizar(texto);
  if (!alvo) return undefined;
  // Aceita caminho ("Motor > Carburador") pegando o último trecho — é assim
  // que a árvore costuma ser escrita à mão na planilha.
  const ultimoTrecho = normalizar(texto.split(/[>/|]/).pop() || '');
  return lista.find((item) => normalizar(item.nome) === alvo) ?? lista.find((item) => normalizar(item.nome) === ultimoTrecho);
}

export interface LinhaImportacao {
  /** Linha no arquivo (1 = cabeçalho), pra mensagem de erro ser acionável */
  numeroLinha: number;
  nome: string;
  categoriaTexto: string;
  categoriaId: string | null;
  modeloTexto: string;
  modeloMotoId: string | null;
  condicao: CondicaoPeca;
  condicaoNota: number | null;
  notaCadastro: NotaCadastro | null;
  valor: number;
  quantidade: number;
  ano: string | null;
  descricao: string | null;
  /** Impedem importar a linha */
  erros: string[];
  /** Importa mesmo assim, mas vale conferir */
  avisos: string[];
}

export interface ResultadoLeitura {
  linhas: LinhaImportacao[];
  /** Campos que não foram encontrados no cabeçalho */
  colunasFaltando: CampoPlanilha[];
  /** Nomes de categoria citados na planilha que ainda não existem */
  categoriasAusentes: string[];
  cabecalhoOriginal: string[];
}

const CAMPOS_OBRIGATORIOS: CampoPlanilha[] = ['nome', 'categoria'];

export function lerPlanilhaEstoque(textoCsv: string, categorias: Categoria[], modelos: ModeloMoto[]): ResultadoLeitura {
  const linhasBrutas = parseCsv(textoCsv);
  if (linhasBrutas.length === 0) {
    return { linhas: [], colunasFaltando: CAMPOS_OBRIGATORIOS, categoriasAusentes: [], cabecalhoOriginal: [] };
  }

  const [cabecalho, ...corpo] = linhasBrutas;
  const mapa = mapearCabecalho(cabecalho);
  const colunasFaltando = CAMPOS_OBRIGATORIOS.filter((campo) => mapa[campo] === undefined);

  const celula = (linha: string[], campo: CampoPlanilha): string => {
    const indice = mapa[campo];
    return indice === undefined ? '' : (linha[indice] ?? '').trim();
  };

  const categoriasAusentes = new Set<string>();

  const linhas: LinhaImportacao[] = corpo.map((linhaBruta, indice) => {
    const erros: string[] = [];
    const avisos: string[] = [];

    const nome = celula(linhaBruta, 'nome');
    if (!nome) erros.push('Nome da peça vazio');

    const categoriaTexto = celula(linhaBruta, 'categoria');
    const categoria = categoriaTexto ? acharPorNome(categoriaTexto, categorias) : undefined;
    if (!categoriaTexto) {
      erros.push('Categoria vazia');
    } else if (!categoria) {
      categoriasAusentes.add(categoriaTexto);
      erros.push(`Categoria "${categoriaTexto}" não existe no sistema`);
    }

    const modeloTexto = celula(linhaBruta, 'modelo');
    const modelo = modeloTexto ? acharPorNome(modeloTexto, modelos) : undefined;
    if (modeloTexto && !modelo) avisos.push(`Moto "${modeloTexto}" não encontrada — vai entrar como universal`);

    const condicaoTexto = normalizar(celula(linhaBruta, 'condicao'));
    let condicao: CondicaoPeca = 'original';
    if (condicaoTexto.startsWith('paralel')) condicao = 'paralela';
    else if (condicaoTexto && !condicaoTexto.startsWith('origin')) {
      avisos.push(`Condição "${celula(linhaBruta, 'condicao')}" não reconhecida — vai entrar como Original`);
    }

    // Aceita "8", "8/10" (como sai no export) ou "8 de 10" — só o primeiro
    // número importa, e fora de 1-10 vira aviso em vez de bloquear a linha.
    const condicaoNotaTexto = celula(linhaBruta, 'condicaoNota');
    let condicaoNota: number | null = null;
    if (condicaoNotaTexto) {
      const numero = Number(condicaoNotaTexto.match(/\d+/)?.[0]);
      if (Number.isFinite(numero) && numero >= 1 && numero <= 10) condicaoNota = numero;
      else avisos.push(`Nota de condição "${condicaoNotaTexto}" fora de 1-10 — entra sem avaliação`);
    }

    const valorTexto = celula(linhaBruta, 'valor');
    const valorParseado = parseNumeroBr(valorTexto);
    const valor = valorParseado ?? 0;
    if (valorTexto && valorParseado === null) erros.push(`Valor "${valorTexto}" não é um número`);
    else if (valor < 0) erros.push('Valor negativo');
    else if (!valorTexto || valor === 0) avisos.push('Sem preço — entra como R$ 0,00');

    const quantidadeTexto = celula(linhaBruta, 'quantidade');
    const quantidadeParseada = parseNumeroBr(quantidadeTexto);
    const quantidade = quantidadeParseada === null ? 1 : Math.max(0, Math.round(quantidadeParseada));
    if (quantidadeTexto && quantidadeParseada === null) erros.push(`Quantidade "${quantidadeTexto}" não é um número`);

    // Motor Completo é bloqueado pelo backend sem essa informação — melhor
    // barrar aqui com a linha exata do que receber 400 no meio do lote.
    const notaTexto = normalizar(celula(linhaBruta, 'nota'));
    let notaCadastro: NotaCadastro | null = null;
    if (notaTexto) notaCadastro = notaTexto.includes('sem') ? 'sem_nota' : 'com_nota';
    if (categoria && categoriaExigeNota(categoria.id, categorias) && !notaCadastro) {
      erros.push('Peça de Motor Completo exige a coluna "Nota" preenchida (com nota / sem nota)');
    }

    const ano = celula(linhaBruta, 'ano') || null;
    const descricao = celula(linhaBruta, 'descricao') || null;

    return {
      numeroLinha: indice + 2, // +1 pelo cabeçalho, +1 porque planilha começa em 1
      nome,
      categoriaTexto,
      categoriaId: categoria?.id ?? null,
      modeloTexto,
      modeloMotoId: modelo?.id ?? null,
      condicao,
      condicaoNota,
      notaCadastro,
      valor,
      quantidade,
      ano,
      descricao,
      erros,
      avisos,
    };
  });

  return { linhas, colunasFaltando, categoriasAusentes: [...categoriasAusentes], cabecalhoOriginal: cabecalho };
}

export function linhaParaEstoqueInput(linha: LinhaImportacao): EstoqueInput {
  return {
    nome: linha.nome,
    categoria_id: linha.categoriaId,
    modelo_moto_id: linha.modeloMotoId,
    condicao: linha.condicao,
    condicao_nota: linha.condicaoNota,
    nota_cadastro: linha.notaCadastro,
    ano: linha.ano,
    valor: linha.valor,
    quantidade: linha.quantidade,
    imagens: [],
    descricao: linha.descricao,
    ativo: true,
    componentes: null,
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    // Importação em massa não tem coluna pra modelos compatíveis — dá pra
    // adicionar depois editando a peça.
    modelo_moto_compativel_ids: [],
  };
}

// ============================================================================
// Exportação (backup)
// ============================================================================

const CABECALHO_EXPORT = [
  'Código',
  'Nome',
  'Categoria',
  'Caminho da categoria',
  'Moto',
  'Condição',
  'Nota de condição',
  'Nota',
  'Ano',
  'Valor',
  'Quantidade',
  'Valor total',
  'Unidades com ficha',
  'Notas das unidades',
  'Unidades com avaria',
  'Avarias',
  'Anúncio ML',
  'Anúncio FB',
  'Componentes',
  'Descrição',
  'Ativo',
  'Cadastrado em',
];

// Decimal com vírgula pro Excel pt-BR entender como número (e não como texto).
function numeroBr(valor: number): string {
  return (Number(valor) || 0).toFixed(2).replace('.', ',');
}

export function gerarCsvEstoque(items: Estoque[], categorias: Categoria[]): string {
  const linhas: (string | number | null)[][] = [CABECALHO_EXPORT];

  for (const item of items) {
    const caminho = item.categoria_id
      ? getAncestorChain(item.categoria_id, categorias)
          .map((c) => c.nome)
          .join(' > ')
      : '';

    linhas.push([
      item.codigo,
      item.nome,
      item.categoria?.nome ?? '',
      caminho,
      item.modelo_moto?.nome ?? '',
      item.condicao === 'original' ? 'Original' : 'Paralela',
      item.condicao_nota != null ? `${item.condicao_nota}/10` : '',
      item.nota_cadastro === 'com_nota' ? 'Com nota' : item.nota_cadastro === 'sem_nota' ? 'Sem nota' : '',
      item.ano ?? '',
      numeroBr(item.valor),
      item.quantidade,
      // Respeita preço próprio de unidade avariada — o backup precisa bater
      // com o total mostrado na tela.
      numeroBr(valorTotalItem(item)),
      contarFichas(item) || '',
      // Só lista quem tem nota PRÓPRIA (não a herdada da peça) — mantém a
      // coluna enxuta em vez de repetir a mesma nota pra toda unidade sem ficha.
      (item.unidades ?? [])
        .filter((u) => u.condicao_nota != null)
        .map((u) => `${u.apelido || 'Unidade'}: ${u.condicao_nota}/10`)
        .join(' | '),
      contarAvarias(item) || '',
      (item.unidades ?? [])
        .filter((u) => u.avaria)
        .map((u) => [u.apelido, u.avaria_descricao].filter(Boolean).join(': '))
        .join(' | '),
      item.anuncio_ml_url ?? '',
      item.anuncio_fb_url ?? '',
      (item.componentes ?? []).join(' | '),
      item.descricao ?? '',
      item.ativo ? 'Sim' : 'Não',
      new Date(item.criado_em).toLocaleString('pt-BR'),
    ]);
  }

  return gerarCsv(linhas);
}

// Modelo em branco pra quem for montar a planilha do zero antes de importar.
export function gerarCsvModelo(): string {
  return gerarCsv([
    ['Nome', 'Categoria', 'Moto', 'Condição', 'Valor', 'Quantidade', 'Ano', 'Nota', 'Descrição'],
    ['CDI Titan 150', 'CDI', 'Titan 150', 'Original', '120,00', '1', '2012', '', 'Testado'],
    ['Carburador CG 125', 'Carburador', 'CG 125', 'Paralela', '95,50', '2', '2008', '', ''],
  ]);
}
