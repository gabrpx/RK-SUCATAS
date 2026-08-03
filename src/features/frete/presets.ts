// Caixas que a loja usa de verdade e a última cotação feita. Tudo em
// localStorage: é preferência de quem está no balcão, não dado do negócio —
// não vale uma tabela no banco nem sincronizar entre aparelhos.
//
// Existe porque redigitar peso e as três medidas a cada cotação era o maior
// atrito da tela: quem atende repete a mesma caixa o dia inteiro.

export interface Dimensoes {
  peso: string;
  largura: string;
  altura: string;
  comprimento: string;
}

export interface PresetCaixa extends Dimensoes {
  id: string;
  nome: string;
}

// Ponto de partida com as embalagens mais comuns de peça de moto. A pessoa
// pode salvar as próprias por cima destas.
export const PRESETS_PADRAO: PresetCaixa[] = [
  { id: 'p', nome: 'Pequena', peso: '0.5', largura: '16', altura: '10', comprimento: '20' },
  { id: 'm', nome: 'Média', peso: '2', largura: '25', altura: '18', comprimento: '30' },
  { id: 'g', nome: 'Grande', peso: '5', largura: '40', altura: '30', comprimento: '45' },
];

const CHAVE_PRESETS = 'rk_frete_presets';
const CHAVE_ULTIMA = 'rk_frete_ultima';
const CHAVE_HISTORICO = 'rk_frete_historico';

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Storage cheio ou indisponível — a tela funciona igual, só não lembra.
  }
}

export const presetsCaixa = {
  listar: (): PresetCaixa[] => ler(CHAVE_PRESETS, PRESETS_PADRAO),
  salvar: (presets: PresetCaixa[]) => gravar(CHAVE_PRESETS, presets),
};

export const ultimasDimensoes = {
  ler: (): Dimensoes | null => ler<Dimensoes | null>(CHAVE_ULTIMA, null),
  gravar: (d: Dimensoes) => gravar(CHAVE_ULTIMA, d),
};

export interface CotacaoHistorico extends Dimensoes {
  cep: string;
  cidade: string;
  /** Menor preço encontrado naquela cotação, só pra dar contexto na lista */
  menorPreco: number | null;
  transportadora: string | null;
  quando: string;
}

const MAXIMO_HISTORICO = 8;

export const historicoCotacoes = {
  listar: (): CotacaoHistorico[] => ler<CotacaoHistorico[]>(CHAVE_HISTORICO, []),
  registrar: (cotacao: CotacaoHistorico) => {
    // Mesma peça pro mesmo CEP não vira duas linhas — a mais recente vence.
    const anteriores = historicoCotacoes.listar().filter((c) => c.cep !== cotacao.cep);
    gravar(CHAVE_HISTORICO, [cotacao, ...anteriores].slice(0, MAXIMO_HISTORICO));
  },
  limpar: () => gravar(CHAVE_HISTORICO, []),
};

// ---------------------------------------------------------------- CEP

export function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export function cepValido(valor: string): boolean {
  return valor.replace(/\D/g, '').length === 8;
}
