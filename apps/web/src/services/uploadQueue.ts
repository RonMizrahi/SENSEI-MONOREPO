// Offline upload queue — stores audio blobs in IndexedDB until connectivity returns.
// Falls back to an in-memory store when IndexedDB is unavailable (tests, private mode).

export interface PendingUpload {
  id: string
  fileName: string
  mimeType: string
  patientId: string
  sessionDate: string
  meetingId?: string
  createdAt: number
  blob: Blob
}

const DB_NAME = 'sensei_uploads_v1';
const STORE = 'pending';

let memoryStore: PendingUpload[] = [];

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  }));
}

export async function enqueueUpload(
  item: Omit<PendingUpload, 'id' | 'createdAt'>,
): Promise<string> {
  const entry: PendingUpload = { ...item, id: newId(), createdAt: Date.now() };
  if (!hasIndexedDB()) {
    memoryStore = [...memoryStore, entry];
    return entry.id;
  }
  await withStore('readwrite', (s) => s.put(entry));
  return entry.id;
}

export async function listPendingUploads(): Promise<PendingUpload[]> {
  if (!hasIndexedDB()) {
    return [...memoryStore].sort((a, b) => a.createdAt - b.createdAt);
  }
  const rows = await withStore<PendingUpload[]>('readonly', (s) => s.getAll());
  return (rows || []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePendingUpload(id: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryStore = memoryStore.filter((x) => x.id !== id);
    return;
  }
  await withStore('readwrite', (s) => s.delete(id));
}

export async function countPendingUploads(): Promise<number> {
  const all = await listPendingUploads();
  return all.length;
}

/** Test helper — clears the in-memory fallback store. */
export function clearMemoryUploadQueue(): void {
  memoryStore = [];
}
