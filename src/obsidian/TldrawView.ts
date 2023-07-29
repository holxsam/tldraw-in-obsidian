import { TextFileView, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import { VIEW_TYPE_TLDRAW } from "../utils/constants";
import { createRootAndRenderTldrawApp } from "../components/TldrawApp";
import TldrawPlugin from "../main";

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

		const entryPoint = this.containerEl.children[1];
		this.reactRoot = createRootAndRenderTldrawApp(entryPoint);
	}

	onunload(): void {
		console.log("TLdrawView onunload()");

		this.reactRoot.unmount();
	}

	getViewType() {
		return VIEW_TYPE_TLDRAW;
	}

	getDisplayText() {
		return this.file ? this.file.basename : "";
	}

	getViewData(): string {
		console.log("getViewData()");

		// const t = this.app.metadataCache.getFileCache(this.file);
		// console.log(t);

		// throw new Error("Method not implemented.");

		return this.data;
	}

	setViewData(data: string, clear: boolean): void {
		// throw new Error("Method not implemented.");

		console.log("setViewData()");
	}

	clear(): void {
		console.log("clear()");
		// throw new Error("Method not implemented.");
	}
}
