/**
 * Local recording storage using IndexedDB.
 * Ensures recordings are never lost even if cloud upload/RLS is unavailable.
 */

export type LocalRecording = {
  id: string;
  title: string;
  duration_seconds: number;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  upload_status: "ready" | "failed" | "recording";
  blob: Blob;
  storage_path?: string;
  is_public?: boolean;
};

const DB_NAME = "connect_orbital_db";
const STORE_NAME = "local_recordings";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalRecording(rec: LocalRecording): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(rec);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[LocalRecordings] Failed to save to IndexedDB:", e);
  }
}

export async function getLocalRecordings(): Promise<LocalRecording[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as LocalRecording[]) || [];
        // Sort descending by created_at
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[LocalRecordings] Failed to read from IndexedDB:", e);
    return [];
  }
}

export async function getLocalRecording(id: string): Promise<LocalRecording | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as LocalRecording) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[LocalRecordings] Failed to get recording:", e);
    return null;
  }
}

export async function deleteLocalRecording(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[LocalRecordings] Failed to delete recording:", e);
  }
}
