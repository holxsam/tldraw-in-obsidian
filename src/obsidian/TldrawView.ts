import { debounce, TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_FILE,
} from "../utils/constants";
import TldrawPlugin from "../main";
import { getTLMetaTemplate, TLDataDocumentStore } from "src/utils/document";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { migrateTldrawFileDataIfNecessary } from "src/utils/migrate/tl-data-to-tlstore";
import { tldrawFileToJson } from "src/utils/tldraw-file/tldraw-file-to-json";
import { loadSnapshot, TldrawFile } from "tldraw";
import { processInitialData } from "src/tldraw/helpers";
import { createRawTldrawFile } from "src/utils/tldraw-file";
import { safeSecondsToMs } from "src/utils/utils";
import { logClass } from "src/utils/logging";
import { TldrawStoreIndexedDB } from "src/tldraw/indexeddb-store";
import TldrawStoreExistsIndexedDBModal, { TldrawStoreConflictResolveCanceled, TldrawStoreConflictResolveFileUnloaded } from "./modal/TldrawStoreExistsIndexedDBModal";

export class TldrawView extends TldrawLoadableMixin(TextFileView) {
	plugin: TldrawPlugin;
	reactRoot?: Root;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
	}

	getViewType() {
		return VIEW_TYPE_TLDRAW;
	}

	getDisplayText() {
		return this.file ? this.file.basename : "NO_FILE";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		if (!this.file) {
			// Bad state
			return;
		}
		// All this initialization is done here because this.data is null in onload() and the constructor().
		// However, setViewData() gets called by obsidian right after onload() with its data parameter having the file's data (yay)
		// so we can somewhat safely do initialization stuff in this function.
		// Its worth nothing that at this point this.data is also available but it does not hurt to use what is given
		const storeInstance = this.plugin.tlDataDocumentStoreManager.register(this.file,
			() => data,
			(data) => {
				this.data = data;
			},
			true
		);

		this.registerOnUnloadFile(() => storeInstance.unregister());

		this.checkConflictingData(this.file, storeInstance.documentStore).then(
			(snapshot) => this.loadStore(storeInstance.documentStore, snapshot)
		).catch((e) => {
			if (e instanceof TldrawStoreConflictResolveFileUnloaded) {
				// The FileView was unloaded before the conflict was resolved. Do nothing.
				return;
			} else if (e instanceof TldrawStoreConflictResolveCanceled) {
				// TODO: allow the modal to be recreated and shown.
				console.warn(e);
				return;
			}
			throw e;
		});
	}

	clear(): void { }

	/**
	 * Sets the view to use the {@linkcode documentStore}, and optionally replaces the data with {@linkcode snapshot}.
	 * @param documentStore Contains the store to load.
	 * @param snapshot If defined, then it will replace the store data in {@linkcode documentStore}
	 */
	loadStore(documentStore: TLDataDocumentStore, snapshot?: Awaited<ReturnType<typeof this.checkConflictingData>>) {
		if (snapshot) {
			loadSnapshot(documentStore.store, snapshot);
		}
		this.setStore({ plugin: documentStore });
	}

	/**
	 * Previous version of this plugin utilized a built-in feature of the tldraw package to synchronize drawings across workspace leafs.
	 * As a result, the tldraw store was persisted in the IndexedDB. Let's check if that is the case for this particular document and
	 * prompt the user to delete or ignore it.
	 * 
	 * @param documentStore 
	 * @returns A promise that resolves with undefined, or a snapshot that can be used to replace the contents of the store in {@linkcode documentStore}
	 */
	private async checkConflictingData(tFile: TFile, documentStore: TLDataDocumentStore) {
		if(TldrawStoreExistsIndexedDBModal.ignoreIndexedDBStoreModal(this.app.metadataCache, tFile)) {
			return;
		}
		const exists = await TldrawStoreIndexedDB.exists(documentStore.meta.uuid);
		if (!exists) {
			return;
		}
		return TldrawStoreExistsIndexedDBModal.showResolverModal(this, tFile, documentStore);
	}
}

/**
 * This view displays `.tldr` files.
 */
export class TldrawFileView extends TldrawLoadableMixin(TextFileView) {
	plugin: TldrawPlugin;
	reactRoot?: Root | undefined;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
	}

	private static isTldrFile(tFile: TFile | null): tFile is TFile & {
		extension: 'tldr'
	} {
		return tFile !== null && tFile.extension === 'tldr';
	}

	getViewData(): string { return this.data; }

	clear(): void { }

	override getViewType() {
		return VIEW_TYPE_TLDRAW_FILE;
	}

	override onload(): void {
		this.contentEl.addClass("tldraw-view-content");
	}

	override async onLoadFile(file: TFile): Promise<void> {
		if (!TldrawFileView.isTldrFile(file)) {
			this.tldrawContainer.createDiv({
				text: 'This file is not a ".tldr" file!'
			});
			return;
		}
		return super.onLoadFile(file);
	}

	override setViewData(data: string, clear: boolean): void {
		const documentStore = processInitialData({
			meta: getTLMetaTemplate(this.plugin.manifest.version),
			...(
				data.length === 0
					? { raw: undefined }
					: { store: migrateTldrawFileDataIfNecessary(data) }
			)
		});

		this.registerOnUnloadFile(() => documentStore.store.dispose());

		const removeListener = documentStore.store.listen(debounce(
			async () => {
				if (!TldrawFileView.isTldrFile(this.file)) {
					// This listener is no longer valid
					removeListener();
					return;
				}
				this.setFileData(createRawTldrawFile(documentStore.store))
			},
			safeSecondsToMs(this.plugin.settings.saveFileDelay),
			true
		), { scope: 'document' })

		this.setStore({ tldraw: { store: documentStore.store } });
	}

	protected setFileData = async (tldrawFile: TldrawFile) => {
		const data = JSON.stringify(tldrawFileToJson(tldrawFile));
		logClass(TldrawFileView, this.setFileData, 'setFileData');
		this.data = data;
		await this.save();
	}
}
