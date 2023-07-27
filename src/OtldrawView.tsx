import { ItemView, TextFileView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { OtldrawApp } from "./OtldrawApp";
import { Root, createRoot } from "react-dom/client";
import TldrawPlugin from "./main";

export const OTLDRAW_VIEW_TYPE = "otldraw-view";

export class OtldrawView extends TextFileView {
	plugin: TldrawPlugin;
	reactRoot: Root;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		console.log("OTLdrawView contructor");
		super(leaf);
		this.plugin = plugin;

		const entryPoint = this.containerEl.children[1];

		console.log("entryPoint", entryPoint);

		// this.reactRoot = createRoot(entryPoint);
	}

	getViewType() {
		return OTLDRAW_VIEW_TYPE;
	}

	getDisplayText() {
		console.log(this.data);
		return "Tldraw";
	}

	onload() {
		console.log("OTLdrawView onload()");

		// this.reactRoot = createRoot(this.containerEl.children[1]);
		// this.reactRoot.render(
		// 	<React.StrictMode>
		// 		{/* <OtldrawApp /> */}
		// 		<div>hello</div>
		// 	</React.StrictMode>
		// );
	}

	onunload(): void {
		console.log("OTLdrawView onunload()");

		// this.reactRoot.unmount();
		// ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
	}

	// async onOpen() {
	// 	const root = createRoot(this.containerEl.children[1]);
	// 	root.render(
	// 		<React.StrictMode>
	// 			<OtldrawApp />
	// 		</React.StrictMode>
	// 	);
	// }

	// async onClose() {
	// 	ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
	// }

	getViewData(): string {
		throw new Error("Method not implemented.");
	}
	setViewData(data: string, clear: boolean): void {
		throw new Error("Method not implemented.");
	}
	clear(): void {
		throw new Error("Method not implemented.");
	}
}
