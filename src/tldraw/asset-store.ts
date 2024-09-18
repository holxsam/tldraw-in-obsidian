import { Notice, TFile } from "obsidian";
import TldrawPlugin from "src/main";
import { createAttachmentFilepath } from "src/utils/utils";
import { FileHelpers, TLAsset, TLAssetContext, TLAssetStore } from "tldraw";

const blockRefAsset = 'obsidian.blockref.';

/**
 * Replaces the default tldraw asset store with one that saves assets to the attachment folder.
 * 
 * See more:
 * 
 * https://tldraw.dev/examples/data/assets/hosted-images
 */
export class ObsidianTLAssetStore implements TLAssetStore {
    private plugin: TldrawPlugin;
    private tldrawFile: TFile;
    private db: TldrawAssetsViewIndexedDB;
    /**
     * <block reference id, asset base64 URI string>
     * 
     * We utilize a base64 data URI string here instead of a non-data URI because the TldrawImage component will display an image error without it.
     */
    private resolvedCache = new Map<string, string>();
    /**
     * Store the asset as a link in the markdown file.
     */
    private storeAsset?: (id: string, tFile: TFile) => Promise<void>;

    constructor(plugin: TldrawPlugin, tFile: TFile, {
        persistenceKey, storeAsset
    }: {
        persistenceKey: string,
        storeAsset: ObsidianTLAssetStore['storeAsset']
    }) {
        this.plugin = plugin;
        this.tldrawFile = tFile;
        this.storeAsset = storeAsset

        this.upload = this.upload.bind(this);
        this.resolve = this.resolve.bind(this);

        this.db = new TldrawAssetsViewIndexedDB(persistenceKey)
    }

    async upload(asset: TLAsset, file: File): Promise<string> {
        if (!this.storeAsset) throw new Error('storeAsset callback was not provided.');

        const blockRefId = window.crypto.randomUUID();
        const objectName = `${blockRefId}-${file.name}`.replace(/\W/g, '-')
        const ext = file.type.split('/').at(1);

        const {
            filename,
            folder
        } = await createAttachmentFilepath(!ext ? objectName : `${objectName}.${ext}`, this.tldrawFile, this.plugin.app.fileManager);

        const tFile = await this.plugin.app.vault.createBinary(`${folder}/${filename}`,
            await file.arrayBuffer()
        );
        await this.storeAsset(blockRefId, tFile);

        const assetDataUri = await FileHelpers.blobToDataUrl(file);
        const assetSrc = `asset:${blockRefAsset}${blockRefId}`;
        this.resolvedCache.set(assetSrc, assetDataUri);
        return assetSrc;
    }

    async resolve(asset: TLAsset, ctx: TLAssetContext): Promise<null | string> {
        const assetSrc = asset.props.src;
        if (!assetSrc) return null;

        if (!assetSrc.startsWith('asset:')) return assetSrc;

        const assetUri = this.resolvedCache.get(assetSrc);

        if (assetUri) return assetUri;

        const assetId = assetSrc.split(':').at(1);

        if (!assetId) return null;

        if (!assetId.startsWith(blockRefAsset)) {
            return this.getFromIndexedDB(assetSrc as `asset:${string}`);
        }

        const blockRefId = assetId.slice(blockRefAsset.length);

        const blocks = this.plugin.app.metadataCache.getFileCache(this.tldrawFile)?.blocks;
        if (!blocks) return null;

        const assetBlock = blocks[blockRefId];
        if (!assetBlock) {
            new Notice(`Asset block not found: ${blockRefId}`);
            return null;
        }

        const assetBlockContents = (await this.plugin.app.vault.cachedRead(this.tldrawFile))
            .substring(assetBlock.position.start.offset, assetBlock.position.end.offset);
        const insideBrackets = /\[\[(.*?)\]\]/;
        const link = assetBlockContents.match(insideBrackets)?.at(1);

        if (!link) {
            new Notice(`Asset block does not reference a link: ${blockRefId}`);
            return null;
        }

        const assetFile = this.plugin.app.metadataCache.getFirstLinkpathDest(link, this.tldrawFile.path);

        if (!assetFile) {
            new Notice(`Asset block link did not reference a known file: ${blockRefId} (${link})`);
            return null;
        }

        const assetData = await this.plugin.app.vault.readBinary(assetFile);
        const assetFileBlob = new Blob([assetData]);
        const assetDataUri = await FileHelpers.blobToDataUrl(assetFileBlob);
        this.resolvedCache.set(assetSrc, assetDataUri)
        return assetDataUri;
    }

    async getFromIndexedDB(assetSrc: `asset:${string}`): Promise<string | null> {
        await this.db.openDb();
        const blob = await this.db.getAsset(assetSrc)
        if (!blob) return null;
        return URL.createObjectURL(blob);
    }
}

// const vars from tldraw source code: packages/editor/src/lib/utils/sync/LocalIndexedDb.ts
const STORE_PREFIX = 'TLDRAW_DOCUMENT_v2'
const DB_VERSION = 4;
const ASSETS_STORE_NAME = 'assets';
class TldrawAssetsViewIndexedDB {
    db?: IDBDatabase;
    dbName: string;
    constructor(persistenceKey: string,) {
        this.dbName = STORE_PREFIX + persistenceKey;
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
}
