import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Plugin,
	WorkspaceLeaf,
} from "obsidian";
import { OTLDRAW_VIEW_TYPE, OtldrawView } from "./OtldrawView";
import {
	DEFAULT_SETTINGS,
	TldrawPluginSettings,
	TldrawSettingTab,
} from "./settings";

export default class TldrawPlugin extends Plugin {
	settings: TldrawPluginSettings;

	async onload() {
		console.log("main.ts onload()");
		this.registerView(
			OTLDRAW_VIEW_TYPE,
			(leaf) => new OtldrawView(leaf, this)
		);

		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"New tldraw file",
			async (evt: MouseEvent) => {
				this.createTldrFile();
			}
		);

		this.registerExtensions(["tldr"], OTLDRAW_VIEW_TYPE);
		// Registers events:

		// this.registerEvent(
		// 	this.app.workspace.on("file-menu", () => {
		// 		console.log("file-menu");
		// 	})
		// );

		// this.registerEvent(
		// 	this.app.workspace.on("file-open", (e) => {
		// 		console.log("file-open", e);
		// 	})
		// );

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TldrawSettingTab(this.app, this));
	}

	onunload() {
		console.log("main.ts unonload()");

		this.app.workspace.detachLeavesOfType(OTLDRAW_VIEW_TYPE);
	}

	async createTldrFile() {
		console.log("createTldrFile");
		const rand = Math.floor(Math.random() * 10000);
		const filename = `tldraw-${rand}.tldr`;

		console.log("filename", filename);
		console.log(this.app.vault.getRoot().path);

		const file = await this.app.vault.create(
			filename,
			JSON.stringify({ prop: "cool" })
		);

		return file;
	}

	async activateView() {
		// this.app.workspace.detachLeavesOfType(OTLDRAW_VIEW_TYPE);

		await this.app.workspace.getLeaf(false).setViewState({
			type: OTLDRAW_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(OTLDRAW_VIEW_TYPE)[0]
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
