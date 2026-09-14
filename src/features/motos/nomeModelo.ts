import type { ModeloMoto } from '../../types/catalog';
import { getAncestorChain } from './motoTree';

type RegraApelido = {
  cilindrada: string;
  inicio: number;
  fim: number;
  apelido: string;
};

const REGRAS_APELIDO: RegraApelido[] = [
  { cilindrada: 'cg 125', inicio: 1995, fim: 1999, apelido: 'Titan' },
  { cilindrada: 'cg 150', inicio: 2004, fim: 2008, apelido: 'Carburada' },
];

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function anoInicial(ano: string | null | undefined) {
  const encontrado = ano?.match(/\d{4}/)?.[0];
  return encontrado ? Number(encontrado) : null;
}

function apelidoConhecido(caminho: ModeloMoto[], ano: string | null) {
  const cilindrada = caminho.find((item) => /^cg\s+\d+/i.test(item.nome));
  const inicio = anoInicial(ano) ?? anoInicial(cilindrada?.ano);
  if (!cilindrada || inicio === null) return null;

  const regra = REGRAS_APELIDO.find(
    (item) => normalizar(cilindrada.nome) === item.cilindrada && inicio >= item.inicio && inicio <= item.fim,
  );
  return regra?.apelido ?? null;
}

/**
 * Nome de apresentação: mantém o catálogo original e só acrescenta apelidos
 * conhecidos quando a combinação de cilindrada e período é inequívoca.
 */
export function formatarNomeModeloMoto(modelo: ModeloMoto, modelos: ModeloMoto[]) {
  const caminho = getAncestorChain(modelo.id, modelos);
  const nomes = caminho.map((item) => item.nome).filter(Boolean);
  const ultimoNome = nomes.at(-1) ?? modelo.nome;
  const apelido = apelidoConhecido(caminho, modelo.ano);
  const nomeComApelido = apelido && !normalizar(ultimoNome).includes(normalizar(apelido)) ? `${ultimoNome} ${apelido}` : ultimoNome;
  const prefixo = nomes.length > 1 ? nomes.slice(0, -1).filter((nome) => normalizar(nome) !== normalizar(ultimoNome)).join(' ') : '';
  const nome = [prefixo, nomeComApelido].filter(Boolean).join(' ');
  return modelo.ano ? `${nome} · ${modelo.ano}` : nome;
}
