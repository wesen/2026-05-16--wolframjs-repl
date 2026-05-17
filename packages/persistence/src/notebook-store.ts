/**
 * Notebook persistence — IndexedDB storage for saving and loading notebooks.
 */

const DB_NAME = "wolframjs-repl";
const DB_VERSION = 1;
const NOTEBOOKS_STORE = "notebooks";

export interface NotebookData {
  id: string;
  name: string;
  created: number;
  modified: number;
  cells: NotebookCell[];
}

export interface NotebookCell {
  id: string;
  inputIndex: number;
  code: string;
  output: unknown | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTEBOOKS_STORE)) {
        db.createObjectStore(NOTEBOOKS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNotebook(notebook: NotebookData): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readwrite");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  store.put({ ...notebook, modified: Date.now() });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadNotebook(id: string): Promise<NotebookData | null> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readonly");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  const request = store.get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function listNotebooks(): Promise<NotebookData[]> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readonly");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteNotebook(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(NOTEBOOKS_STORE, "readwrite");
  const store = tx.objectStore(NOTEBOOKS_STORE);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
