// Lê uma variável de ambiente obrigatória. Lança um erro explícito na
// inicialização se ela não estiver definida, em vez de usar um fallback
// hardcoded silencioso.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}
