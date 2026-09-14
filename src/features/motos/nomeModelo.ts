import type { ModeloMoto } from '../../types/catalog';
import { getAncestorChain } from './motoTree';

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(nome: string) {
  return normalizar(nome).split(' ').filter(Boolean);
}

function contemMesmoNome(nome: string, folha: string) {
  const nomeTokens = tokens(nome);
  const folhaTokens = tokens(folha);
  return nomeTokens.length > 0 && nomeTokens.every((token) => folhaTokens.includes(token));
}

/** Retorna somente a variação filha que diferencia o modelo base. */
export function obterNomeVariacaoModelo(modelo: ModeloMoto, modelos: ModeloMoto[]): string | null {
  const caminho = getAncestorChain(modelo.id, modelos);
  if (caminho.length < 4) return null;

  const base = caminho.at(-2);
  const folha = caminho.at(-1);
  if (!base || !folha) return null;

  const nomeBase = base.nome.trim();
  const nomeFolha = folha.nome.trim();
  if (!nomeBase || !nomeFolha || normalizar(nomeBase) === normalizar(nomeFolha)) return null;

  const variacao = nomeFolha
    .replace(new RegExp(`^${nomeBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
    .replace(/\s+\d{2,4}$/, '')
    .trim();
  return variacao && !contemMesmoNome(variacao, nomeBase) ? variacao : null;
}

/** Nome de apresentação baseado no caminho real do catálogo. */
export function formatarNomeModeloMoto(modelo: ModeloMoto, modelos: ModeloMoto[]) {
  const caminho = getAncestorChain(modelo.id, modelos);
  const nomes = caminho.map((item) => item.nome.trim()).filter(Boolean);
  if (nomes.length === 0) return modelo.nome;

  const folha = nomes.at(-1)!;
  const prefixos = nomes.slice(0, -1).filter((nome) => !/^\d+$/.test(normalizar(nome)) && !contemMesmoNome(nome, folha));
  const nome = [...prefixos, folha].join(' ');
  return modelo.ano?.trim() ? `${nome} · ${modelo.ano.trim()}` : nome;
}
