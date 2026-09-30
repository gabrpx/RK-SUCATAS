export type AbaVendasPreview = "Visão geral" | "Vendas" | "Movimentações" | "Pendências";
export type PeriodoVendasPreview = "Hoje" | "30 dias" | "Este mês";
export type MeioPagamentoDemo = string;
export type CanalVendaDemo = "Balcão" | "WhatsApp" | "Mercado Livre";

export interface PagamentoRecebidoDemo {
  meio: MeioPagamentoDemo;
  valor: number;
  ocorridoEm: string;
}

export interface VendaDemo {
  id: string;
  cliente: string;
  item: string;
  unidade: string;
  ocorridoEm: string;
  valor: number;
  recebido: number | null;
  pagamentos: PagamentoRecebidoDemo[];
  canal: CanalVendaDemo;
  grau: "A" | "B" | "C" | "—";
  temComprovantePix?: boolean;
}

export interface MovimentoDemo {
  id: string;
  titulo: string;
  detalhe: string;
  ocorridoEm: string;
  tipo: "entrada" | "saída";
  valor: number;
  metodo: string;
  origem: "Venda" | "Recebimento" | "Conta paga" | "Lançamento manual";
}

export interface PendenciaDemo {
  id: string;
  tipo: "A receber" | "A pagar";
  nome: string;
  origem: string;
  total: number;
  pago: number;
  pagamentos?: PagamentoRecebidoDemo[];
  venceEm: string | null;
  criadaEm: string;
  recorrencia?: "Semanal" | "Mensal" | "Anual";
  lembreteTratado?: boolean;
}

export function parseDataLocal(value: string): Date {
  const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return data ? new Date(Number(data[1]), Number(data[2]) - 1, Number(data[3])) : new Date(value);
}

const hoje = new Date(2026, 8, 29, 12, 0, 0);
const haDias = (dias: number, hora = 12) => {
  const data = new Date(hoje);
  data.setDate(data.getDate() - dias);
  data.setHours(hora, 0, 0, 0);
  return data.toISOString();
};

const pagamento = (meio: MeioPagamentoDemo, valor: number, dias: number, hora = 12): PagamentoRecebidoDemo => ({
  meio,
  valor,
  ocorridoEm: haDias(dias, hora),
});

export const vendasDemoIniciais: VendaDemo[] = [
  { id: "V-2841", cliente: "Mariana Costa", item: "Farol dianteiro Honda CG 160", unidade: "UN-1842", ocorridoEm: haDias(0, 14), valor: 285, recebido: 285, pagamentos: [pagamento("Pix", 285, 0, 14)], canal: "WhatsApp", grau: "A", temComprovantePix: true },
  { id: "V-2840", cliente: "Rafael Mendes", item: "Retrovisor esquerdo Fazer 250", unidade: "UN-1798", ocorridoEm: haDias(0, 13), valor: 92, recebido: 40, pagamentos: [pagamento("Pix", 24, 0, 13), pagamento("Dinheiro", 16, 0, 13)], canal: "Balcão", grau: "B", temComprovantePix: true },
  { id: "V-2839", cliente: "Balcão", item: "Kit relação Yamaha Factor 150", unidade: "UN-1781", ocorridoEm: haDias(0, 11), valor: 318, recebido: 318, pagamentos: [pagamento("Cartão de débito", 318, 0, 11)], canal: "Balcão", grau: "A" },
  { id: "V-2838", cliente: "João Pedro Lima", item: "Roda traseira Titan 160", unidade: "UN-1760", ocorridoEm: haDias(0, 10), valor: 450, recebido: 450, pagamentos: [pagamento("Dinheiro", 450, 0, 10)], canal: "Balcão", grau: "B" },
  { id: "V-2837", cliente: "André Luiz", item: "Carburador Honda CG 125", unidade: "UN-1731", ocorridoEm: haDias(2, 16), valor: 385, recebido: 385, pagamentos: [pagamento("Pix", 385, 2, 16)], canal: "Mercado Livre", grau: "B", temComprovantePix: true },
  { id: "V-2836", cliente: "Lucas Ferreira", item: "Banco completo Fazer 250", unidade: "UN-1702", ocorridoEm: haDias(5, 15), valor: 520, recebido: 520, pagamentos: [pagamento("Cartão de crédito", 520, 5, 15)], canal: "WhatsApp", grau: "A" },
  { id: "V-2835", cliente: "Pedro Santos", item: "Conjunto de carenagem Titan 160", unidade: "UN-1690", ocorridoEm: haDias(1, 15), valor: 1170, recebido: 1170, pagamentos: [pagamento("Pix", 1170, 1, 15)], canal: "Mercado Livre", grau: "A", temComprovantePix: true },
  { id: "V-2834", cliente: "Bruno Alves", item: "Escapamento CG 150", unidade: "UN-1676", ocorridoEm: haDias(2, 10), valor: 640, recebido: 640, pagamentos: [pagamento("Dinheiro", 640, 2, 10)], canal: "WhatsApp", grau: "B" },
  { id: "V-2833", cliente: "Paulo Roberto", item: "Tanque Fazer 250", unidade: "UN-1659", ocorridoEm: haDias(3, 15), valor: 1280, recebido: 1280, pagamentos: [pagamento("Cartão de débito", 1280, 3, 15)], canal: "Balcão", grau: "C" },
  { id: "V-2832", cliente: "Matheus Souza", item: "Painel completo CG 160", unidade: "UN-1643", ocorridoEm: haDias(4, 12), valor: 1160, recebido: 1160, pagamentos: [pagamento("Pix", 1160, 4, 12)], canal: "Balcão", grau: "A", temComprovantePix: true },
  { id: "V-2831", cliente: "Felipe Rocha", item: "Par de rodas Pop 110", unidade: "UN-1627", ocorridoEm: haDias(5, 11), valor: 770, recebido: 770, pagamentos: [pagamento("Dinheiro", 770, 5, 11)], canal: "Mercado Livre", grau: "B" },
  { id: "V-2830", cliente: "Eduardo Lima", item: "Motor de partida XRE 300", unidade: "UN-1601", ocorridoEm: haDias(6, 14), valor: 1350, recebido: 1350, pagamentos: [pagamento("Cartão de crédito", 1350, 6, 14)], canal: "Balcão", grau: "C" },
];

export const movimentosDemoIniciais: MovimentoDemo[] = [
  { id: "MV-091", titulo: "Farol dianteiro Honda CG 160", detalhe: "Venda V-2841 · Mariana Costa", ocorridoEm: haDias(0, 14), tipo: "entrada", valor: 285, metodo: "Pix", origem: "Venda" },
  { id: "MV-092", titulo: "Retrovisor esquerdo Fazer 250", detalhe: "1ª parte da venda V-2840 · Rafael Mendes", ocorridoEm: haDias(0, 13), tipo: "entrada", valor: 40, metodo: "Pix + dinheiro", origem: "Venda" },
  { id: "MV-090", titulo: "Recebimento de venda", detalhe: "V-2812 · Carlos Henrique", ocorridoEm: haDias(0, 14), tipo: "entrada", valor: 120, metodo: "Dinheiro", origem: "Recebimento" },
  { id: "MV-089", titulo: "Pagamento de frete", detalhe: "Transportadora · conta operacional", ocorridoEm: haDias(0, 12), tipo: "saída", valor: 68.5, metodo: "Pix", origem: "Conta paga" },
  { id: "MV-094", titulo: "Roda traseira Titan 160", detalhe: "Venda V-2838 · João Pedro Lima", ocorridoEm: haDias(0, 10), tipo: "entrada", valor: 450, metodo: "Dinheiro", origem: "Venda" },
  { id: "MV-088", titulo: "Kit relação Yamaha Factor 150", detalhe: "Venda V-2839 · Balcão", ocorridoEm: haDias(0, 11), tipo: "entrada", valor: 318, metodo: "Débito", origem: "Venda" },
  { id: "MV-087", titulo: "Compra de embalagens", detalhe: "Suprimentos · lançamento manual", ocorridoEm: haDias(0, 9), tipo: "saída", valor: 145, metodo: "Dinheiro", origem: "Lançamento manual" },
  { id: "MV-086", titulo: "Carburador Honda CG 125", detalhe: "Venda V-2837 · André Luiz", ocorridoEm: haDias(2, 16), tipo: "entrada", valor: 385, metodo: "Pix", origem: "Venda" },
  { id: "MV-085", titulo: "Banco completo Fazer 250", detalhe: "Venda V-2836 · Lucas Ferreira", ocorridoEm: haDias(5, 15), tipo: "entrada", valor: 520, metodo: "Crédito", origem: "Venda" },
  { id: "MV-084", titulo: "Conjunto de carenagem Titan 160", detalhe: "Venda V-2835 · Pedro Santos", ocorridoEm: haDias(1, 15), tipo: "entrada", valor: 1170, metodo: "Pix", origem: "Venda" },
  { id: "MV-083", titulo: "Escapamento CG 150", detalhe: "Venda V-2834 · Bruno Alves", ocorridoEm: haDias(2, 10), tipo: "entrada", valor: 640, metodo: "Dinheiro", origem: "Venda" },
  { id: "MV-082", titulo: "Tanque Fazer 250", detalhe: "Venda V-2833 · Paulo Roberto", ocorridoEm: haDias(3, 15), tipo: "entrada", valor: 1280, metodo: "Débito", origem: "Venda" },
  { id: "MV-081", titulo: "Painel completo CG 160", detalhe: "Venda V-2832 · Matheus Souza", ocorridoEm: haDias(4, 12), tipo: "entrada", valor: 1160, metodo: "Pix", origem: "Venda" },
  { id: "MV-080", titulo: "Par de rodas Pop 110", detalhe: "Venda V-2831 · Felipe Rocha", ocorridoEm: haDias(5, 11), tipo: "entrada", valor: 770, metodo: "Dinheiro", origem: "Venda" },
  { id: "MV-079", titulo: "Motor de partida XRE 300", detalhe: "Venda V-2830 · Eduardo Lima", ocorridoEm: haDias(6, 14), tipo: "entrada", valor: 1350, metodo: "Crédito", origem: "Venda" },
];

export const pendenciasDemoIniciais: PendenciaDemo[] = [
  { id: "P-102", tipo: "A receber", nome: "Rafael Mendes", origem: "Retrovisor Fazer 250 · V-2840", total: 92, pago: 40, pagamentos: [pagamento("Pix", 24, 0, 13), pagamento("Dinheiro", 16, 0, 13)], venceEm: null, criadaEm: haDias(0, 13) },
  { id: "P-101", tipo: "A receber", nome: "Carlos Henrique", origem: "Banco CG 160 · V-2812", total: 340, pago: 220, pagamentos: [pagamento("Pix", 220, 8)], venceEm: haDias(-2), criadaEm: haDias(8) },
  { id: "P-100", tipo: "A pagar", nome: "Oficina do Nando", origem: "Serviço de mecânica · ocorrência mensal", total: 780, pago: 0, venceEm: haDias(-1), criadaEm: haDias(10), recorrencia: "Mensal" },
  { id: "P-099", tipo: "A receber", nome: "Diego Almeida", origem: "Tanque CG 150 · V-2794", total: 520, pago: 0, venceEm: null, criadaEm: haDias(34) },
  { id: "P-098", tipo: "A pagar", nome: "Energia elétrica", origem: "Conta da empresa · ocorrência mensal", total: 410, pago: 0, venceEm: haDias(-4), criadaEm: haDias(18), recorrencia: "Mensal" },
];
