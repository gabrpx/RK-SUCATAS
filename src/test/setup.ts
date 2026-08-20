// Setup global de teste (Vitest) — hoje só o polyfill de ResizeObserver, que
// jsdom não implementa nativamente e que react-use-measure (dependência do
// Expandable, Cult UI) precisa pra renderizar sem lançar erro.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // Sem @ts-expect-error aqui: este repo roda tsc sem strict mode, então a
  // atribuição de um polyfill mínimo (sem a API completa de ResizeObserver)
  // já passa direto, sem erro de tipo pra suprimir.
  globalThis.ResizeObserver = ResizeObserverPolyfill;
}
