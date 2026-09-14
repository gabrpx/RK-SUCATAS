export function formatCep(valor: string): string {
  const digits = valor.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function validarCep(cep: string): boolean {
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8;
}

export async function buscarCep(cep: string): Promise<{ cidade: string; uf: string } | null> {
  if (!validarCep(cep)) return null;
  const digits = cep.replace(/\D/g, '');
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { cidade: data.localidade, uf: data.uf };
  } catch {
    return null;
  }
}
