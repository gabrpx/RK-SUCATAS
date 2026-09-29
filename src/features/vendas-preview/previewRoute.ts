/** Rota pública isolada para demonstrar a experiência unificada de Vendas. */
export function ehRotaVendasPreview(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/vendas-preview";
}
