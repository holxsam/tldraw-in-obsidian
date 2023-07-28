import {
	ItemView,
	MarkdownView,
	TFile,
	TextFileView,
	WorkspaceLeaf,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { OtldrawApp } from "./OtldrawApp";
import { Root, createRoot } from "react-dom/client";
import TldrawPlugin, { FRONTMATTER_KEY } from "./main";

export const VIEW_TYPE_TLDRAW = "otldraw-view"; // custom view type
export const VIEW_TYPE_MARKDOWN = "markdown"; // NOT ACTUALLY A CUSTOM VIEW TYPE, its built in from obsidian

export class OtldrawView extends TextFileView {
	plugin: TldrawPlugin;
	reactRoot: Root;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		console.log("OTLdrawView contructor");
		super(leaf);
		this.plugin = plugin;

		const entryPoint = this.containerEl.children[1];
		this.reactRoot = createRoot(entryPoint);
	}

	onload() {
		console.log("OTLdrawView onload()");

		// this.reactRoot = createRoot(this.containerEl.children[1]);
		this.reactRoot.render(
			<React.StrictMode>
				<OtldrawApp />
				{/* <div>{this.getViewData()}</div> */}
			</React.StrictMode>
		);
	}

	onunload(): void {
		console.log("OTLdrawView onunload()");

		this.reactRoot.unmount();
	}

	getViewType() {
		return VIEW_TYPE_TLDRAW;
	}

	getDisplayText() {
		// let basename = "";
		// if (this.file?.basename) {
		// 	basename = this.file.basename;
		// }

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
