// Tabelas de apoio (substituem o "select" do Notion): categorias de peça e
// modelos de moto compatíveis. Compartilhadas entre Estoque e Vendas.

export interface Categoria {
  id: string;
  nome: string;
  parent_id: string | null;
  ordem: number;
  // Categoria do Mercado Livre usada da última vez pra uma peça desta
  // categoria interna (migration_043) — sugestão pra pré-preencher a próxima
  // publicação, nunca uma trava. Ausente em payload antigo em cache.
  mercadolivre_categoria_id_padrao?: string | null;
}

// Árvore por parent_id: Marca (raiz) > Cilindrada (filho) > Modelo (neto,
// com ano) > Variação por ano (bisneto, opcional — ex: "Carburada" 2004-2008,
// "Mix" 2009-2013, "Injetada" 2013 em diante, todas filhas do mesmo Modelo).
// Mesma lógica de Categoria — um item pode ser vinculado a qualquer nível (só
// marca, marca+cilindrada, o modelo exato, ou a variação exata). `ano` aceita
// ano único ("2015") ou período em texto livre ("2004-2008", "2013+").
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
  // 'fiado' marca formas de pagamento que não são recebidas na hora (ex:
  // "PENDÊNCIA") — usado pela aba Fiado pra saber quais vendas acompanhar,
  // sem depender do nome digitado (ver migration_030).
  natureza: 'avista' | 'fiado';
}
