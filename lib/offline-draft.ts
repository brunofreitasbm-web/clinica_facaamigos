"use client";

/**
 * Rascunho de evolução em IndexedDB (PRD §9.4 — "rascunho salvo
 * automaticamente… funciona offline"). Substitui o localStorage anterior:
 * localStorage não é confiável para um objeto que cresce (anexos, metas)
 * e alguns navegadores o limitam a ~5MB por origem, contra o teto bem
 * maior do IndexedDB.
 *
 * Sem dependência nova — wrapper mínimo sobre a API nativa. Degrada para um
 * mapa em memória (nunca lança) quando indexedDB não existe ou falha ao
 * abrir — Safari privado, navegador com bloqueio de dados de site, ou
 * captura de thumbnail/preview.
 */

const DB_NAME = "clinica-drafts";
const DB_VERSION = 1;
const STORE_NAME = "evolution";

const memoryFallback = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function saveDraft<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(key, value);
    return;
  }
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    memoryFallback.set(key, value);
  }
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) {
    return (memoryFallback.get(key) as T) ?? null;
  }
  try {
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return (memoryFallback.get(key) as T) ?? null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  memoryFallback.delete(key);
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Sem problema: pior caso, um rascunho antigo continua no IndexedDB e é
    // sobrescrito na próxima gravação com a mesma chave.
  }
}
