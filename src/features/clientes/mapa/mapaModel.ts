import type { ClienteOperacaoListaItem, SituacaoCliente, SituacaoClienteNivel } from '../operacaoTypes';

export interface GrupoCidadeClientes {
  chave: string;
  cidade: string;
  estado: string;
  clientes: ClienteOperacaoListaItem[];
  situacao: SituacaoCliente;
}

export interface DistribuicaoClientesMapa {
  grupos: GrupoCidadeClientes[];
  semLocalizacao: ClienteOperacaoListaItem[];
}

const ORDEM_NIVEL: Record<SituacaoClienteNivel, number> = {
  critico: 0,
  atencao: 1,
  informativo: 2,
  neutro: 3,
};

const SITUACAO_NEUTRA: SituacaoCliente = {
  codigo: 'sem_pendencias',
  rotulo: 'Sem pendências',
  nivel: 'neutro',
  proximaAcaoEm: null,
};

export function normalizarChaveCidade(cidade: string | null | undefined, estado: string | null | undefined): string | null {
  const nome = String(cidade ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
  const uf = String(estado ?? '').trim().toUpperCase();
  return nome && /^[A-Z]{2}$/.test(uf) ? `${uf}:${nome}` : null;
}

function situacaoMaisUrgente(atual: SituacaoCliente, proxima: SituacaoCliente): SituacaoCliente {
  const ordemAtual = ORDEM_NIVEL[atual.nivel];
  const ordemProxima = ORDEM_NIVEL[proxima.nivel];
  if (ordemProxima < ordemAtual) return proxima;
  if (ordemProxima > ordemAtual) return atual;
  const prazoAtual = atual.proximaAcaoEm ?? '9999-12-31';
  const prazoProxima = proxima.proximaAcaoEm ?? '9999-12-31';
  return prazoProxima < prazoAtual ? proxima : atual;
}

export function agruparClientesPorCidade(
  itens: ClienteOperacaoListaItem[],
  situacoesPorCliente: ReadonlyMap<string, SituacaoCliente>
): DistribuicaoClientesMapa {
  const porChave = new Map<string, GrupoCidadeClientes>();
  const semLocalizacao: ClienteOperacaoListaItem[] = [];

  for (const item of itens) {
    const chave = normalizarChaveCidade(item.cidade, item.estado);
    if (!chave || !item.cidade || !item.estado) {
      semLocalizacao.push(item);
      continue;
    }
    const situacao = situacoesPorCliente.get(item.id) ?? SITUACAO_NEUTRA;
    const grupo = porChave.get(chave);
    if (grupo) {
      grupo.clientes.push(item);
      grupo.situacao = situacaoMaisUrgente(grupo.situacao, situacao);
      continue;
    }
    porChave.set(chave, { chave, cidade: item.cidade, estado: item.estado, clientes: [item], situacao });
  }

  return {
    grupos: [...porChave.values()].sort((a, b) => {
      const porUrgencia = ORDEM_NIVEL[a.situacao.nivel] - ORDEM_NIVEL[b.situacao.nivel];
      if (porUrgencia !== 0) return porUrgencia;
      const porTotal = b.clientes.length - a.clientes.length;
      if (porTotal !== 0) return porTotal;
      return `${a.cidade}, ${a.estado}`.localeCompare(`${b.cidade}, ${b.estado}`, 'pt-BR');
    }),
    semLocalizacao,
  };
}

export function tomDaSituacao(nivel: SituacaoClienteNivel): 'danger' | 'warning' | 'accent' | 'muted' {
  if (nivel === 'critico') return 'danger';
  if (nivel === 'atencao') return 'warning';
  if (nivel === 'informativo') return 'accent';
  return 'muted';
}
