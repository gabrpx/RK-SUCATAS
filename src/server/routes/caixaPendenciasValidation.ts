interface PendenciaAtual {
  descricao: string;
  valor_total: number;
  data: string;
  cliente_id: string | null;
  status: 'aberta' | 'quitada';
}

type EdicaoPendencia = Partial<Pick<PendenciaAtual, 'descricao' | 'valor_total' | 'data' | 'cliente_id'>>;

type ResultadoEdicao =
  | { ok: true; payload: Record<string, string | number | null> }
  | { ok: false; status: 400 | 409; error: string };

const moeda = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function prepararEdicaoPendencia(body: EdicaoPendencia, atual: PendenciaAtual, recebido: number): ResultadoEdicao {
  if (atual.status === 'quitada') {
    return { ok: false, status: 409, error: 'Pendências quitadas não podem ser reabertas por esta edição.' };
  }

  const payload: Record<string, string | number | null> = {};
  if (body.descricao !== undefined) {
    const descricao = String(body.descricao).trim();
    if (!descricao) return { ok: false, status: 400, error: 'Descrição é obrigatória.' };
    payload.descricao = descricao;
  }

  if (body.data !== undefined) {
    const data = String(body.data);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || !parsed || parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
      return { ok: false, status: 400, error: 'Data inválida.' };
    }
    payload.data = data;
  }

  if (body.cliente_id !== undefined) payload.cliente_id = body.cliente_id || null;

  if (body.valor_total !== undefined) {
    const total = Number(body.valor_total);
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, status: 400, error: 'O valor total deve ser maior que zero.' };
    }
    if (total + 0.005 < recebido) {
      return { ok: false, status: 400, error: `O valor total não pode ser menor que o valor já recebido (${moeda(recebido)}).` };
    }
    payload.valor_total = total;
    payload.status = Math.abs(total - recebido) <= 0.005 ? 'quitada' : 'aberta';
  }

  if (!Object.keys(payload).length) return { ok: false, status: 400, error: 'Informe ao menos um campo para atualizar.' };
  return { ok: true, payload };
}
