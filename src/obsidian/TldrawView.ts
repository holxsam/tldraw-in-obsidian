import { TextFileView, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {
	TLDRAW_DATA_DELIMITER_END,
	TLDRAW_DATA_DELIMITER_START,
	VIEW_TYPE_TLDRAW,
} from "../utils/constants";
import { createRootAndRenderTldrawApp } from "../components/TldrawApp";
import TldrawPlugin from "../main";
import {
	extractDataBetweenKeywords,
	replaceBetweenKeywords,
} from "src/utils/utils";

export class TldrawView extends TextFileView {
	plugin: TldrawPlugin;
	reactRoot: Root;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		console.log("OTLdrawView contructor");
		super(leaf);
		this.plugin = plugin;
	}

	onload() {
		console.log("TLdrawView onload()");
	}

	onunload(): void {
		console.log("TLdrawView onunload()");
		this.reactRoot?.unmount();
	}

	getViewType() {
		return VIEW_TYPE_TLDRAW;
	}

	getDisplayText() {
		return this.file ? this.file.basename : "";
	}

	getViewData(): string {
		console.log("getViewData()");
		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		console.log("setViewData()");

		// All this initialization is done here because this.data is null in onload() and the constructor().
		// However, setViewData() gets called by obsidian right after onload() with its data parameter having the file's data (yay)
		// so we can somewhat safely do initialization stuff in this function.
		// Its worth nothing that at this point this.data is also available but it does not hurt to use what is given
		// Also be aware to NOT call this function DIRECTLY because it will create multiple react trees for one view
		const entryPoint = this.containerEl.children[1];
		const initialData = this.getTldrawData(data);
		this.reactRoot = createRootAndRenderTldrawApp(
			entryPoint,
			initialData,
			this.updateFileData,
			this.plugin.settings
		);
	}

	clear(): void {
		console.log("clear()");
	}

	getTldrawData = (rawFileData?: string) => {
		rawFileData ??= this.data;

		const extracted = extractDataBetweenKeywords(
			rawFileData,
			TLDRAW_DATA_DELIMITER_START,
			TLDRAW_DATA_DELIMITER_END
		);

		return extracted ? JSON.parse(extracted) : {};
	};

	updateFileData = (data: string) => {
		console.log("updateFileData()");

		const result = replaceBetweenKeywords(
			this.data,
			TLDRAW_DATA_DELIMITER_START,
			TLDRAW_DATA_DELIMITER_END,
			data
		);

		// saves the new data to file:
		this.data = result;
	};
}
