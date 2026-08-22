// Setup global de teste (Vitest) — polyfills de APIs de observação que o jsdom
// não implementa: ResizeObserver, que react-use-measure (dependência do
// Expandable, Cult UI) precisa pra renderizar sem lançar erro; e
// IntersectionObserver, usado pelo `useInView` do motion no AnimatedNumber.
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

// No jsdom nada tem layout, então "está visível?" não tem resposta real. O
// polyfill responde que sim assim que o elemento é observado: é o que faz os
// números com `inView` chegarem ao valor final nos testes, em vez de ficarem
// parados no zero esperando um scroll que nunca acontece.
class IntersectionObserverPolyfill {
  constructor(private callback: (entries: unknown[], observer: unknown) => void) {}
  observe(target: Element) {
    this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // Cast necessário (diferente do ResizeObserver acima): a interface real tem
  // root/rootMargin/thresholds, que o polyfill não precisa implementar.
  globalThis.IntersectionObserver =
    IntersectionObserverPolyfill as unknown as typeof IntersectionObserver;
}
