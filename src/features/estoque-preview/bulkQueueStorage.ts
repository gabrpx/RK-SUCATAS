import type { BulkPieceDraft } from "./BulkInventoryComposer";

const STORAGE_VERSION = 1;
const DATABASE_NAME = "rk-sucatas-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "bulk-queues";
const LOCAL_STORAGE_PREFIX = `rk-sucatas:bulk-queue:v${STORAGE_VERSION}`;

interface BulkQueueRecord {
  key: string;
  version: number;
  updatedAt: string;
  fila: BulkPieceDraft[];
}

function storageKey() {
  if (typeof window === "undefined") return `${LOCAL_STORAGE_PREFIX}:anonymous`;
  try {
    const usuarioId = window.localStorage.getItem("user_id") || "anonymous";
    return `${LOCAL_STORAGE_PREFIX}:${usuarioId}`;
  } catch {
    return `${LOCAL_STORAGE_PREFIX}:anonymous`;
  }
}

function localStorageKey(key: string) {
  return `${key}:metadata`;
}

/**
 * localStorage fica apenas como cópia mínima. File não é serializável de forma
 * útil nele; o IndexedDB mantém os arquivos selecionados quando o navegador
 * oferece suporte a structured clone.
 */
function paraFallback(fila: BulkPieceDraft[]): BulkPieceDraft[] {
  return fila.map((item) => ({
    ...item,
    fotos: [],
    fotosPorUnidade: item.fotosPorUnidade?.map(() => []),
  }));
}

function lerFallback(key: string): BulkPieceDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(localStorageKey(key));
    if (!bruto) return [];
    const registro = JSON.parse(bruto) as Partial<BulkQueueRecord>;
    return registro.version === STORAGE_VERSION && Array.isArray(registro.fila) ? registro.fila : [];
  } catch {
    return [];
  }
}

function gravarFallback(key: string, fila: BulkPieceDraft[]) {
  if (typeof window === "undefined") return;
  try {
    const registro: BulkQueueRecord = {
      key,
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      fila: paraFallback(fila),
    };
    window.localStorage.setItem(localStorageKey(key), JSON.stringify(registro));
  } catch {
    // Safari privado e quotas excedidas não devem impedir o uso da fila em memória.
  }
}

function excluirFallback(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(localStorageKey(key));
  } catch {
    // O IndexedDB continua sendo a fonte primária quando disponível.
  }
}

function indexedDbDisponivel() {
  return typeof window !== "undefined" && "indexedDB" in window && Boolean(window.indexedDB);
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!indexedDbDisponivel()) {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir a fila local."));
  });
}

async function lerIndexedDb(key: string): Promise<BulkQueueRecord | null> {
  const banco = await abrirBanco();
  return new Promise<BulkQueueRecord | null>((resolve, reject) => {
    const request = banco.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as BulkQueueRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler a fila local."));
  }).finally(() => banco.close());
}

async function gravarIndexedDb(registro: BulkQueueRecord) {
  const banco = await abrirBanco();
  return new Promise<void>((resolve, reject) => {
    const request = banco.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(registro);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Não foi possível salvar a fila local."));
  }).finally(() => banco.close());
}

async function excluirIndexedDb(key: string) {
  const banco = await abrirBanco();
  return new Promise<void>((resolve, reject) => {
    const request = banco.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Não foi possível limpar a fila local."));
  }).finally(() => banco.close());
}

export function getBulkQueueStorageKey() {
  return storageKey();
}

export async function loadBulkQueue(key = storageKey()): Promise<BulkPieceDraft[]> {
  try {
    const registro = await lerIndexedDb(key);
    if (registro?.version === STORAGE_VERSION && Array.isArray(registro.fila)) return registro.fila;
  } catch {
    // Fallback abaixo cobre browsers sem IndexedDB e contextos privados.
  }
  return lerFallback(key);
}

export async function saveBulkQueue(fila: BulkPieceDraft[], key = storageKey()): Promise<void> {
  gravarFallback(key, fila);
  try {
    await gravarIndexedDb({ key, version: STORAGE_VERSION, updatedAt: new Date().toISOString(), fila });
  } catch {
    // O fallback já foi tentado; a fila em memória continua funcionando.
  }
}

export async function clearBulkQueue(key = storageKey()): Promise<void> {
  excluirFallback(key);
  try {
    await excluirIndexedDb(key);
  } catch {
    // Não há nada a fazer quando o armazenamento local está indisponível.
  }
}

