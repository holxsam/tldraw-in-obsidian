// const vars from tldraw source code: packages/editor/src/lib/utils/sync/LocalIndexedDb.ts
const STORE_PREFIX = 'TLDRAW_DOCUMENT_v2'
const DB_VERSION = 4;
const ASSETS_STORE_NAME = 'assets';

export function tldrawStoreIndexedDBName(persistenceKey: string) {
    return STORE_PREFIX + persistenceKey;
}

export class TldrawStoreIndexedDB {
    db?: IDBDatabase;
    dbName: string;
    constructor(persistenceKey: string,) {
        this.dbName = tldrawStoreIndexedDBName(persistenceKey);
    }

    openDb() {
        if (this.db) return;
        return new Promise<void>((res, rej) => {
            const dbReq = window.indexedDB.open(this.dbName, DB_VERSION);

            dbReq.onsuccess = () => {
                this.db = dbReq.result;
                res();
            }

            dbReq.onerror = () => {
                rej(dbReq.error);
            }
        });
    }

    close() {
        if (this.db) this.db.close();
    }

    getAsset(assetSrc: `asset:${string}`) {
        const { db } = this;
        if (db === undefined) {
            throw new Error('tldraw IndexedDB has not been opened yet.');
        }
        return new Promise<File | undefined>((res, rej) => {
            const transaction = db.transaction(ASSETS_STORE_NAME, 'readonly');
            let fileBlob: File | undefined;

            transaction.oncomplete = () => {
                res(fileBlob);
            }

            transaction.onerror = () => {
                rej(transaction.error);
            }

            const getRes = transaction.objectStore(ASSETS_STORE_NAME).get(assetSrc);

            getRes.onsuccess = () => {
                fileBlob = getRes.result;
            }
        });
    }

    static exists(persistenceKey: string): Promise<boolean> {
        return new Promise<boolean>((res, rej) => {
            const dbReq = window.indexedDB.open(tldrawStoreIndexedDBName(persistenceKey), DB_VERSION);

            dbReq.onsuccess = () => {
                const db = dbReq.result;
                db.close();
                res(true);
            }

            dbReq.onupgradeneeded = () => {
                dbReq.transaction!.abort();
                res(false);
            }

            dbReq.onerror = () => {
                rej(dbReq.error);
            }
        });
    }

    static delete(persistenceKey: string): Promise<void> {
        return new Promise<void>((res, rej) => {
            const dbName = tldrawStoreIndexedDBName(persistenceKey);
            const dbReq = window.indexedDB.deleteDatabase(dbName);

            dbReq.onsuccess = () => {
                res();
            }

            dbReq.onblocked = () => {
                rej(new Error(`Unable to delete indexed db (onblocked): ${dbName}`));
            }

            dbReq.onerror = () => {
                rej(dbReq.error);
            }
        });
    }
}
