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

    constructor(plugin: TldrawPlugin, tFile: TFile, storeAsset: ObsidianTLAssetStore['storeAsset']) {
        this.plugin = plugin;
        this.tldrawFile = tFile;
        this.storeAsset = storeAsset

        this.upload = this.upload.bind(this);
        this.resolve = this.resolve.bind(this);
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
        this.resolvedCache.set(blockRefId, assetDataUri);
        return `asset:${blockRefAsset}${blockRefId}`;
    }

    async resolve(asset: TLAsset, ctx: TLAssetContext): Promise<null | string> {
        const assetId = asset.props.src?.split(':').at(1);
        if (!assetId) return null;

        if(!assetId.startsWith(blockRefAsset)) return asset.props.src;

        const blockRefId = assetId.slice(blockRefAsset.length);

        const assetUri = this.resolvedCache.get(blockRefId);

        if (assetUri) return assetUri;

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
        this.resolvedCache.set(blockRefId, assetDataUri)
        return assetDataUri;
    }
}
