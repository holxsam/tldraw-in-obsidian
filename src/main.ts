import {
	App,
	Editor,
	MarkdownView,
	Menu,
	Modal,
	Plugin,
	TFile,
	ViewState,
	WorkspaceLeaf,
	addIcon,
} from "obsidian";
import { TldrawView } from "./TldrawView";
import {
	DEFAULT_SETTINGS,
	TldrawPluginSettings,
	TldrawSettingTab,
} from "./settings";
import {
	frontmatterTemplate,
	tldrawDataTemplate,
	tldrawMarkdownTemplate,
} from "./utils";
import {
	FRONTMATTER_KEY,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
} from "./constants";

export default class TldrawPlugin extends Plugin {
	settings: TldrawPluginSettings;
	file_view_modes: { [filename: string]: string } = {};

	async onload() {
		console.log("main.ts onload()");

		this.registerView(
			VIEW_TYPE_TLDRAW,
			(leaf) => new TldrawView(leaf, this)
		);

		await this.loadSettings();

		addIcon(TLDRAW_ICON_NAME, TLDRAW_ICON);

		// this creates an icon in the left ribbon.
		this.addRibbonIcon(
			TLDRAW_ICON_NAME,
			"New tldraw file",
			async (e: MouseEvent) => {
				this.createTldrFile();
			}
		);

		// registers events:
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (!leaf || !(file instanceof TFile)) return;
				if (!this.isTldrawFile(file)) return;

				const id = this.getTabFileId(file);
				const viewMode = this.file_view_modes[id] ?? VIEW_TYPE_TLDRAW;

				if (viewMode === VIEW_TYPE_TLDRAW) {
					menu.addItem((item) => {
						item.setTitle("View as Markdown")
							.setIcon(TLDRAW_ICON_NAME)
							.setSection("close")
							.onClick(() => {
								this.setTabFileViewMode(VIEW_TYPE_MARKDOWN);
								this.setMarkdownView(leaf);
							});
					});
				} else {
					menu.addItem((item) => {
						item.setTitle("View as Tldraw")
							.setIcon(TLDRAW_ICON_NAME)
							.setSection("close")
							.onClick(() => {
								this.setTabFileViewMode(VIEW_TYPE_TLDRAW);
								this.setTldrawView(leaf);
							});
					});
				}

				// @ts -ignore: unexposed type declarations (this api may change and break this code)
				// menu.items.unshift(menu.items.pop()); // add the menu item on top
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", () => {
				console.log("editor-menu");
			})
		);

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				console.log("file-open");

				if (!file || !this.isTldrawFile(file)) return;

				const id = this.getTabFileId(file);
				const viewMode = this.file_view_modes[id];

				if (viewMode === VIEW_TYPE_MARKDOWN) {
					console.log("MARKDOWN VIEW");
					this.setTabFileViewMode(VIEW_TYPE_MARKDOWN);
					this.setMarkdownView(this.app.workspace.getLeaf(false));
				} else {
					console.log("TLDRAW VIEW");
					this.setTabFileViewMode(VIEW_TYPE_TLDRAW);
					this.setTldrawView(this.app.workspace.getLeaf(false));
				}
			})
		);

		// this adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TldrawSettingTab(this.app, this));

		// switches to the tldraw view mode on initial launch
		this.switchToTldrawViewAfterLoad();
	}

	onunload() {
		console.log("main.ts unonload()");
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TLDRAW);
	}

	public getTabFileId(file?: TFile) {
		const leaf = this.app.workspace.getLeaf(false);

		// @ts-ignore: leaf.id exists but the typescript declarations don't say so
		const tabId = leaf.id as string;

		const filePath = file
			? file.path
			: this.app.workspace.getActiveFile()?.path ?? "";

		return `${tabId}-${filePath}`;
	}

	public setTabFileViewMode(viewMode: string) {
		const tabFileId = this.getTabFileId();
		this.file_view_modes[tabFileId] = viewMode;
	}

	async createTldrFile() {
		console.log("createTldrFile");
		const rand = Math.floor(Math.random() * 10000);
		const paddedNum = `${rand}`.padStart(5, "0");
		const filename = `tldraw-${paddedNum}.tldr.md`;

		// constructs the markdown content thats a template:
		const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: parsed`);
		const tldrData = tldrawDataTemplate(JSON.stringify({ a: 1, b: 2 }));
		const fileData = tldrawMarkdownTemplate(frontmatter, tldrData);

		// console.log("filename", filename);
		// console.log(this.app.vault.getRoot().path);

		const file = await this.app.vault.create(filename, fileData);
		return file;
	}

	private switchToTldrawViewAfterLoad() {
		console.log("switchToTldrawViewAfterLoad()");
		this.app.workspace.onLayoutReady(() => {
			console.log("ready");
			let leaf: WorkspaceLeaf;
			for (leaf of this.app.workspace.getLeavesOfType("markdown")) {
				if (
					leaf.view instanceof MarkdownView &&
					this.isTldrawFile(leaf.view.file)
				) {
					this.setTabFileViewMode(VIEW_TYPE_TLDRAW);
					this.setTldrawView(leaf);
				}
			}
		});
	}

	public isTldrawFile(f: TFile) {
		if (!f) return false;
		const fileCache = f ? this.app.metadataCache.getFileCache(f) : null;
		return (
			!!fileCache?.frontmatter && !!fileCache.frontmatter[FRONTMATTER_KEY]
		);
	}

	public async setMarkdownView(leaf: WorkspaceLeaf) {
		const state = leaf.view.getState();

		await leaf.setViewState({
			type: VIEW_TYPE_TLDRAW,
			state: { file: null },
		});

		await leaf.setViewState(
			{
				type: VIEW_TYPE_MARKDOWN,
				state,
				popstate: true,
			} as ViewState,
			{ focus: true }
		);
	}

	public async setTldrawView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: VIEW_TYPE_TLDRAW,
			state: leaf.view.getState(),
			popstate: true,
		} as ViewState);
	}

	async activateView() {
		// this.app.workspace.detachLeavesOfType(OTLDRAW_VIEW_TYPE);

		await this.app.workspace.getLeaf(false).setViewState({
			type: VIEW_TYPE_TLDRAW,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TLDRAW)[0]
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
