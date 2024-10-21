import { debounce, TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_FILE,
} from "../utils/constants";
import TldrawPlugin from "../main";
import { getTLMetaTemplate } from "src/utils/document";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { migrateTldrawFileDataIfNecessary } from "src/utils/migrate/tl-data-to-tlstore";
import { tldrawFileToJson } from "src/utils/tldraw-file/tldraw-file-to-json";
import { TldrawFile } from "tldraw";
import { processInitialData } from "src/tldraw/helpers";
import { createRawTldrawFile } from "src/utils/tldraw-file";
import { safeSecondsToMs } from "src/utils/utils";
import { logClass } from "src/utils/logging";

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

		this.register(() => storeInstance.unregister());

		this.setStore({ plugin: storeInstance.documentStore });
	}

	clear(): void { }
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

		this.register(() => documentStore.store.dispose());

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
