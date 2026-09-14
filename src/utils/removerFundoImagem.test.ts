import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// removerFundoImagem.ts agora só orquestra um pool de Web Workers — a lógica
// de remoção em si (removeBackground + composição em branco) roda dentro do
// worker e é testada em removerFundoImagem.worker.test.ts. Aqui o que importa
// é: falar com o Worker certo, devolver a resposta dele, e não deixar mais de
// MAX_WORKERS rodando ao mesmo tempo.
class FakeWorker {
  static instancias: FakeWorker[] = [];
  mensagensPostadas: { id: string; entrada: unknown }[] = [];
  private ouvintes: ((evento: { data: any }) => void)[] = [];

  constructor() {
    FakeWorker.instancias.push(this);
  }

  addEventListener(_tipo: 'message', cb: (evento: { data: any }) => void) {
    this.ouvintes.push(cb);
  }

  removeEventListener(_tipo: 'message', cb: (evento: { data: any }) => void) {
    this.ouvintes = this.ouvintes.filter((o) => o !== cb);
  }

  postMessage(mensagem: { id: string; entrada: unknown }) {
    this.mensagensPostadas.push(mensagem);
  }

  // Simula a resposta assíncrona do worker de verdade.
  responder(resposta: { id: string; sucesso: boolean; blob: Blob | null }) {
    this.ouvintes.forEach((cb) => cb({ data: resposta }));
  }
}

async function importarComWorkerFake() {
  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
  FakeWorker.instancias = [];
  vi.resetModules();
  return import('./removerFundoImagem');
}

describe('removerFundoImagem (pool de workers)', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    FakeWorker.instancias = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sucesso: manda a foto pro worker e devolve { sucesso: true, blob } da resposta dele', async () => {
    const { removerFundoImagem } = await importarComWorkerFake();
    const blobEsperado = new Blob(['sem-fundo'], { type: 'image/jpeg' });

    const promessa = removerFundoImagem('https://exemplo.com/foto.jpg');

    expect(FakeWorker.instancias).toHaveLength(1);
    const worker = FakeWorker.instancias[0];
    expect(worker.mensagensPostadas).toHaveLength(1);
    const idEnviado = worker.mensagensPostadas[0].id;
    worker.responder({ id: idEnviado, sucesso: true, blob: blobEsperado });

    const resultado = await promessa;
    expect(resultado).toEqual({ sucesso: true, blob: blobEsperado });
  });

  it('falha: resposta do worker com sucesso:false vira { sucesso: false, blob: null } sem lançar', async () => {
    const { removerFundoImagem } = await importarComWorkerFake();

    const promessa = removerFundoImagem('https://exemplo.com/foto.jpg');
    const worker = FakeWorker.instancias[0];
    const idEnviado = worker.mensagensPostadas[0].id;
    worker.responder({ id: idEnviado, sucesso: false, blob: null });

    await expect(promessa).resolves.toEqual({ sucesso: false, blob: null });
  });

  it('paralelismo limitado: a 3ª chamada concorrente não cria um 3º worker, espera um dos 2 liberar', async () => {
    const { removerFundoImagem } = await importarComWorkerFake();

    const p1 = removerFundoImagem('foto-1.jpg');
    const p2 = removerFundoImagem('foto-2.jpg');
    const p3 = removerFundoImagem('foto-3.jpg');

    // Só 2 workers criados pras 3 chamadas simultâneas — a 3ª ficou na fila.
    expect(FakeWorker.instancias).toHaveLength(2);

    const [worker1, worker2] = FakeWorker.instancias;
    expect(worker1.mensagensPostadas).toHaveLength(1);
    expect(worker2.mensagensPostadas).toHaveLength(1);

    const blob1 = new Blob(['1'], { type: 'image/jpeg' });
    worker1.responder({ id: worker1.mensagensPostadas[0].id, sucesso: true, blob: blob1 });
    await p1;

    // Ao liberar, o worker1 (reciclado, não um novo) pega a 3ª tarefa da fila.
    expect(FakeWorker.instancias).toHaveLength(2);
    expect(worker1.mensagensPostadas).toHaveLength(2);

    const blob3 = new Blob(['3'], { type: 'image/jpeg' });
    worker1.responder({ id: worker1.mensagensPostadas[1].id, sucesso: true, blob: blob3 });
    const blob2 = new Blob(['2'], { type: 'image/jpeg' });
    worker2.responder({ id: worker2.mensagensPostadas[0].id, sucesso: true, blob: blob2 });

    await expect(p2).resolves.toEqual({ sucesso: true, blob: blob2 });
    await expect(p3).resolves.toEqual({ sucesso: true, blob: blob3 });
  });
});
