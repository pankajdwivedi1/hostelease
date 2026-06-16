/**
 * ============================================================
 * PWA Installation ID Utility
 * ============================================================
 * Generates a unique, persistent UUID for this device/PWA installation.
 *
 * STORAGE STRATEGY (Dual-Layer):
 *   1. localStorage  — Fast access, survives page refresh
 *   2. IndexedDB     — More persistent, survives localStorage clear
 *
 * KEY BEHAVIOR (Android Chrome PWA):
 *   - Installed PWA has its OWN isolated storage partition
 *   - "Clear Browsing Data" in Chrome does NOT affect installed PWA storage
 *   - ID is only deleted when: PWA uninstalled OR factory reset
 *
 * This is the same principle used by Google Pay / PhonePe for device binding.
 * ============================================================
 */

const STORAGE_KEY = "hosteleaze_installation_id";
const DB_NAME = "hosteleaze_device_db";
const DB_STORE = "device_store";
const DB_VERSION = 1;

// ─── Generate a cryptographically random UUID ─────────────────────────────────
function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromDB(db: IDBDatabase): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToDb(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.put(id, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ─── localStorage helpers (safe, won't throw in SSR) ─────────────────────────
function getFromLocalStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveToLocalStorage(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota errors
  }
}

// ─── Main export: Get or create the installation ID ──────────────────────────
/**
 * Returns the persistent installation ID for this device.
 * Creates one if it doesn't exist and syncs it across all storage layers.
 *
 * IMPORTANT: Only call from client-side code (useEffect, event handlers).
 */
export async function getInstallationId(): Promise<string> {
  // Step 1: Check localStorage (fastest)
  let id = getFromLocalStorage();
  if (id) return id;

  // Step 2: Check IndexedDB (survives localStorage clear)
  try {
    const db = await openDB();
    id = await getFromDB(db);
    if (id) {
      // Re-sync to localStorage since it was missing
      saveToLocalStorage(id);
      await db.close();
      return id;
    }
    // Step 3: Neither found — generate new ID
    id = generateUUID();
    saveToLocalStorage(id);
    await saveToDb(db, id);
    await db.close();
    return id;
  } catch {
    // IndexedDB not available (private mode, etc.) — use localStorage only
    if (!id) {
      id = generateUUID();
      saveToLocalStorage(id);
    }
    return id!;
  }
}

/**
 * Clears the installation ID from all storage layers.
 * Call this ONLY when admin explicitly resets the student's device binding.
 */
export async function clearInstallationId(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(STORAGE_KEY);
    db.close();
  } catch {}
}

/**
 * Checks if the app is running as an installed PWA (standalone mode).
 * Returns false if opened in a regular browser tab.
 */
export function isPWAInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}
