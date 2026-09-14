// Remove o fundo da foto no próprio navegador (WASM, @imgly/background-removal)
// antes de anexar ao anúncio do Mercado Livre — peça com fundo branco vende
// mais. Processamento 100% client-side: sem rota nova no backend, sem custo
// por imagem, sem chave de API.
//
// A extração roda em src/utils/removerFundoImagem.worker.ts, dentro de um
// Web Worker — não na main thread. onnxruntime-web só evita bloquear quem
// chama session.run() quando device:'gpu' (WebGPU), que não é garantido em
// todo navegador/iOS; rodando no worker, o bloqueio fica isolado lá e a UI
// nunca trava, não importa o device. Este módulo é só o "cliente": mantém um
// pool de até MAX_WORKERS workers reaproveitados e enfileira o que passar
// disso — paralelismo suficiente pra ganhar velocidade sem afogar o celular.
//
// Nunca lança: se qualquer etapa falhar (lib não carrega, imagem não
// suportada, navegador sem WASM), devolve blob: null e deixa o chamador
// seguir com a foto original — mesmo contrato de comprimirImagem.ts.

export interface ResultadoRemocaoFundo {
  sucesso: boolean;
  /** null quando falhou — chamador mantém a foto original */
  blob: Blob | null;
}

const MAX_WORKERS = 2;

interface TarefaPendente {
  entrada: File | Blob | string;
  resolve: (resultado: ResultadoRemocaoFundo) => void;
}

const fila: TarefaPendente[] = [];
const workersOciosos: Worker[] = [];
let workersCriados = 0;
let proximoId = 0;

function criarWorker(): Worker {
  return new Worker(new URL('./removerFundoImagem.worker.ts', import.meta.url), { type: 'module' });
}

function obterWorkerDisponivel(): Worker | null {
  if (workersOciosos.length > 0) return workersOciosos.pop()!;
  if (workersCriados < MAX_WORKERS) {
    workersCriados++;
    return criarWorker();
  }
  return null;
}

function despacharProxima() {
  if (fila.length === 0) return;
  const worker = obterWorkerDisponivel();
  if (!worker) return; // todos os MAX_WORKERS ocupados — espera um liberar

  const tarefa = fila.shift()!;
  const id = String(proximoId++);

  const onMessage = (evento: MessageEvent<{ id: string; sucesso: boolean; blob: Blob | null }>) => {
    if (evento.data?.id !== id) return;
    worker.removeEventListener('message', onMessage as EventListener);
    workersOciosos.push(worker);
    tarefa.resolve({ sucesso: evento.data.sucesso, blob: evento.data.blob });
    despacharProxima();
  };

  worker.addEventListener('message', onMessage as EventListener);
  worker.postMessage({ id, entrada: tarefa.entrada });
}

export function removerFundoImagem(entrada: File | Blob | string): Promise<ResultadoRemocaoFundo> {
  return new Promise((resolve) => {
    fila.push({ entrada, resolve });
    despacharProxima();
  });
}
