// Tabelas de apoio (substituem o "select" do Notion): categorias de peça e
// modelos de moto compatíveis. Compartilhadas entre Estoque e Vendas.

export interface Categoria {
  id: string;
  nome: string;
}

export interface ModeloMoto {
  id: string;
  nome: string;
  marca?: string | null;
}

export interface FormaPagamento {
  id: string;
  nome: string;
}
