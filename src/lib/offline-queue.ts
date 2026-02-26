import type { OfflineCapture } from '@/lib/types';

const DB_NAME = 'campus-gallery-offline';
const DB_VERSION = 1;
const STORE_NAME = 'captures';
export const OFFLINE_QUEUE_CHANGED_EVENT = 'offline-queue-changed';

function emitQueueChanged(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
}

async function requestPersistentStorage(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== 'function') return;
    try {
        await storage.persist();
    } catch {
        // Best-effort only.
    }
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(
                new Error(
                    'Offline storage is unavailable in this browser context.',
                ),
            );
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(
                request.error ??
                    new Error('Unable to open offline storage database.'),
            );
        request.onblocked = () =>
            reject(
                new Error(
                    'Offline storage is blocked. Close other tabs of this app and try again.',
                ),
            );
    });
}

export async function addPendingCapture(payload: OfflineCapture): Promise<void> {
    await requestPersistentStorage();
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(payload);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    emitQueueChanged();
}

export async function getPendingCaptures(): Promise<OfflineCapture[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as OfflineCapture[]);
        request.onerror = () => reject(request.error);
    });
}

export async function removePendingCapture(id: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    emitQueueChanged();
}
