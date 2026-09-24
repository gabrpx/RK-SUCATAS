/** Rota pública apenas para validação visual; não participa da navegação do app. */
export function ehRotaEstoquePreview(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/estoque-preview';
}
