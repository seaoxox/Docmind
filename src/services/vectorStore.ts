import type { ChunkImage } from '../types';

export interface StoredChunk {
  id: string;
  text: string;
  source: string;
  embedding: number[];
  headingPath: string[];
  image?: ChunkImage;
}

const DB_NAME = 'docmind-vector-store';
const DB_VERSION = 1;
const CHUNKS_STORE = 'chunks';
const META_STORE = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearChunks(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    tx.objectStore(CHUNKS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function putChunks(chunks: StoredChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const store = tx.objectStore(CHUNKS_STORE);
    for (const chunk of chunks) store.put(chunk);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllChunks(): Promise<StoredChunk[]> {
  const db = await openDB();
  const result = await new Promise<StoredChunk[]>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readonly');
    const req = tx.objectStore(CHUNKS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredChunk[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function countChunks(): Promise<number> {
  const db = await openDB();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readonly');
    const req = tx.objectStore(CHUNKS_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return count;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await openDB();
  const result = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => resolve(req.result ? (req.result as { key: string; value: string }).value : null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
