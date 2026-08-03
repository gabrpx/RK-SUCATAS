// Tabelas de apoio (substituem o "select" do Notion): categorias de peça e
// modelos de moto compatíveis. Compartilhadas entre Estoque e Vendas.

export interface Categoria {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem: number;
}

// Árvore por parent_id: Marca (raiz) > Cilindrada (filho) > Modelo (neto,
// com ano). Mesma lógica de Categoria — um item pode ser vinculado a
// qualquer nível (só marca, marca+cilindrada, ou o modelo exato).
export interface ModeloMoto {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem: number;
  ano: string | null;
  imagem_url: string | null;
}

export interface FormaPagamento {
  id: string;
  nome: string;
}
