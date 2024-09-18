import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {
	TLDATA_DELIMITER_END,
	TLDATA_DELIMITER_START,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_FILE,
} from "../utils/constants";
import TldrawPlugin from "../main";
import { replaceBetweenKeywords } from "src/utils/utils";
import { TLDataDocument, getTLDataTemplate, getTLMetaTemplate } from "src/utils/document";
import { parseTLDataDocument } from "src/utils/parse";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { TldrawAppProps } from "src/components/TldrawApp";
import { migrateTldrawFileDataIfNecessary } from "src/utils/migrate/tl-data-to-tlstore";
import { tldrawFileToJson } from "src/utils/tldraw-file/tldraw-file-to-json";
import { SetTldrawFileData } from "src/hooks/useTldrawAppHook";

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
		// All this initialization is done here because this.data is null in onload() and the constructor().
		// However, setViewData() gets called by obsidian right after onload() with its data parameter having the file's data (yay)
		// so we can somewhat safely do initialization stuff in this function.
		// Its worth nothing that at this point this.data is also available but it does not hurt to use what is given
		const initialData = this.getTldrawData(data);
		this.setTlData(initialData);
	}

	clear(): void { }

	getTldrawData = (rawFileData?: string): TLDataDocument => {
		rawFileData ??= this.data;

		return parseTLDataDocument(this.plugin.manifest.version, rawFileData);
	};

	protected override setFileData: SetTldrawFileData = async (data) => {
		const tldrawData = getTLDataTemplate(
			this.plugin.manifest.version,
			data.tldrawFile,
			data.meta.uuid
		);

		// If you do not use `null, "\t"` as arguments for stringify(),
		// Obsidian will lag when you try to open the file in markdown view.
		// It may have to do with if you don't format the string,
		// it'll be a really long line and that lags the markdown view.
		const stringifiedData = JSON.stringify(tldrawData, null, "\t");

		const result = replaceBetweenKeywords(
			this.data,
			TLDATA_DELIMITER_START,
			TLDATA_DELIMITER_END,
			stringifiedData
		);

		// Do this to prevent the data from being reset by Obsidian.
		this.data = result;
		// saves the new data to file:
		if (!this.file) return;
		await this.app.vault.modify(this.file, result);
	};

	protected storeAsset = async (id: string, assetFile: TFile): Promise<void> => {
		const { file } = this;
		if (!file) return;

		const internalLink = this.plugin.app.fileManager.generateMarkdownLink(assetFile, file.path);
		const linkBlock = `${internalLink}\n^${id}`;

		// Set to the result of "process" to prevent the data from being reset by Obsidian.
		this.data = await this.plugin.app.vault.process(file, (data) => {
			const { start, end } = this.plugin.app.metadataCache.getFileCache(file)?.frontmatterPosition ?? {
				start: { offset: 0 }, end: { offset: 0 }
			};

			const frontmatter = data.slice(start.offset, end.offset)
			const rest = data.slice(end.offset);
			return `${frontmatter}\n${linkBlock}\n${rest}`;
		});
	}
}


export class TldrawFileView extends TldrawView {
	private static isTldrFile(tFile: TFile | null): tFile is TFile & {
		extension: 'tldr'
	} {
		return tFile !== null && tFile.extension === 'tldr';
	}

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
		this.setTlData({
			meta: getTLMetaTemplate(this.plugin.manifest.version),
			...(
				data.length === 0
					? { raw: undefined }
					: { store: migrateTldrawFileDataIfNecessary(data) }
			)
		});
	}

	protected override getTldrawOptions(): TldrawAppProps["options"] {
		return {
			...super.getTldrawOptions(),
			persistenceKey: this.file?.path,
			// Since TldrawFileView is only meant to be used with .tldr files we disable the Obsidian based asset store.
			assetStore: undefined,
		}
	}

	protected override setFileData: SetTldrawFileData = async (data) => {
		if (!TldrawFileView.isTldrFile(this.file)) return;
		await this.app.vault.modify(this.file, JSON.stringify(
			tldrawFileToJson(data.tldrawFile))
		);
	}
}
