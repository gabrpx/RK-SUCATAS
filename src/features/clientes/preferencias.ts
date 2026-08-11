// Preferência de ordenação padrão da lista de Clientes. Fica em localStorage
// (mesmo padrão de src/features/frete/presets.ts): é preferência de quem usa
// a tela, não dado do negócio — não vale tabela no banco nem sincronizar
// entre aparelhos. Toda troca de ordenação já sobrescreve isso, então vira o
// padrão sozinho na próxima visita, sem precisar de um botão "salvar".

export type OrdenacaoClientes = 'recentes' | 'nome' | 'maior_gasto' | 'mais_compras' | 'ultima_compra';

const CHAVE_ORDENACAO = 'rk_clientes_ordenacao_padrao';

const ORDENACOES_VALIDAS: OrdenacaoClientes[] = ['recentes', 'nome', 'maior_gasto', 'mais_compras', 'ultima_compra'];

export const preferenciasClientes = {
  lerOrdenacaoPadrao(): OrdenacaoClientes {
    try {
      const valor = localStorage.getItem(CHAVE_ORDENACAO);
      return valor && ORDENACOES_VALIDAS.includes(valor as OrdenacaoClientes) ? (valor as OrdenacaoClientes) : 'recentes';
    } catch {
      return 'recentes';
    }
  },
  salvarOrdenacaoPadrao(valor: OrdenacaoClientes) {
    try {
      localStorage.setItem(CHAVE_ORDENACAO, valor);
    } catch {
      // Storage cheio ou indisponível — a tela funciona igual, só não lembra.
    }
  },
};
