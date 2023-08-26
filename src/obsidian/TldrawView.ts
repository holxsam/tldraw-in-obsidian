import { TextFileView, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {
	MARKDOWN_ICON_NAME,
	TLDATA_DELIMITER_END,
	TLDATA_DELIMITER_START,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
} from "../utils/constants";
import { createRootAndRenderTldrawApp } from "../components/TldrawApp";
import TldrawPlugin from "../main";
import {
	extractDataBetweenKeywords,
	replaceBetweenKeywords,
} from "src/utils/utils";
import { SerializedStore } from "@tldraw/store";
import { TLRecord } from "@tldraw/tldraw";
import { TLData, getTLDataTemplate } from "src/utils/document";

export class TldrawView extends TextFileView {
	plugin: TldrawPlugin;
	reactRoot: Root;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
	}

	onload() {
		this.contentEl.addClass("tldraw-view-content");

		this.addAction(MARKDOWN_ICON_NAME, "View as markdown", () => {
			this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
		});
	}

	onunload(): void {
		this.contentEl.removeClass("tldraw-view-content");
		this.reactRoot?.unmount();
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
		const entryPoint = this.containerEl.children[1];
		const initialData = this.getTldrawData(data).raw;

		if (this.reactRoot) this.reactRoot.unmount();

		this.reactRoot = createRootAndRenderTldrawApp(
			entryPoint,
			initialData,
			this.setFileData,
			this.plugin.settings
		);
	}

	clear(): void {}

	getTldrawData = (rawFileData?: string): TLData => {
		rawFileData ??= this.data;

		const extracted = extractDataBetweenKeywords(
			rawFileData,
			TLDATA_DELIMITER_START,
			TLDATA_DELIMITER_END
		);

		const parsedData: TLData = extracted
			? JSON.parse(extracted)
			: getTLDataTemplate(this.plugin.manifest.version, {});

		return parsedData;
	};

	setFileData = async (data: SerializedStore<TLRecord>) => {
		const tldrawData = getTLDataTemplate(
			this.plugin.manifest.version,
			data
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

		// saves the new data to file:
		if (!this.file) return;
		await this.app.vault.modify(this.file, result);
	};
}
