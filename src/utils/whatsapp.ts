// Monta links de conversa no WhatsApp (wa.me) a partir de um telefone
// brasileiro salvo em qualquer formato. Números são guardados só com dígitos
// (ver onlyDigits em formatters), mas aqui aceitamos formatado também.

// Normaliza pro formato que o wa.me espera: só dígitos, com DDI 55 na frente.
// A decisão de prefixar o 55 é por TAMANHO, não por "começa com 55": um número
// local de 10–11 dígitos (DDD + fixo/celular) sempre recebe o DDI — inclusive
// os do DDD 55 (Santa Maria/RS), que senão seriam confundidos com DDI. Só quem
// já tem 12–13 dígitos começando com 55 é tratado como já internacionalizado.
export function normalizarTelefoneBR(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length >= 12 && digitos.startsWith('55')) return digitos;
  return `55${digitos}`;
}

// Retorna a URL wa.me pronta pra abrir a conversa, opcionalmente com uma
// mensagem pré-preenchida. Null quando não há número utilizável — quem chama
// usa isso pra decidir entre mostrar o botão de WhatsApp ou o de cadastrar número.
export function linkWhatsapp(telefone: string | null | undefined, mensagem?: string): string | null {
  const numero = normalizarTelefoneBR(telefone);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
