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
	removeAllChildNodes,
	tldrawDataTemplate,
	tldrawMarkdownTemplate,
} from "./utils";
import {
	FRONTMATTER_KEY,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	ViewTypes,
} from "./constants";

export default class TldrawPlugin extends Plugin {
	statusBar: HTMLElement;
	settings: TldrawPluginSettings;
	file_view_modes: { [filename: string]: ViewTypes } = {};

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

		this.addRibbonIcon("dice", "debug", async () => {
			console.log("--------------------");
			console.log("active leaf", this.app.workspace.getLeaf(false).id);
			console.log(this.file_view_modes);
		});

		// status bar:
		this.statusBar = this.addStatusBarItem();

		// registers events:
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (!leaf || !(file instanceof TFile)) return;
				if (!this.isTldrawFile(file)) return;

				const { type } = leaf.getViewState();
				const viewMode = this.getViewMode(leaf, file) || type;

				const oppositeViewMode =
					viewMode === VIEW_TYPE_TLDRAW
						? VIEW_TYPE_MARKDOWN
						: VIEW_TYPE_TLDRAW;

				const title =
					viewMode === VIEW_TYPE_TLDRAW
						? "View as Markdown"
						: "View as Tldraw";

				menu.addItem((item) => {
					item.setIcon(TLDRAW_ICON_NAME)
						.setSection("close")
						.setTitle(title)
						.onClick(() => {
							this.updateViewMode(oppositeViewMode, leaf, file);
						});
				});

				// @ts -ignore: unexposed type declarations (this api may change and break this code)
				// menu.items.unshift(menu.items.pop()); // add the menu item on top
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", () => {
				console.log("EDITOR-MENU");
			})
		);

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				console.log("FILE-OPEN");
			})
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (!leaf) return;

				const { type, state } = leaf.getViewState();
				const validViewType =
					type === VIEW_TYPE_TLDRAW || type === VIEW_TYPE_MARKDOWN;

				if (!validViewType) return;

				const fileFromState = state.file;
				const file = this.app.workspace.getActiveFile();

				if (
					!file ||
					!fileFromState ||
					fileFromState !== file.path || // is the same file
					!this.isTldrawFile(file)
				)
					return;

				const viewMode = this.getViewMode(leaf, file);

				this.updateViewMode(viewMode);
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

	public updateStatusBarViewMode(view: ViewTypes) {
		removeAllChildNodes(this.statusBar);
		const container = this.statusBar.createEl("div", {
			cls: "otldraw-status-bar-view-mode-container",
		});

		container.createEl("label", { text: "View:", cls: "" });

		const tldrawBtn = container.createEl("button", {
			type: "button",
			cls: `otldraw-status-bar-button ${
				view === VIEW_TYPE_TLDRAW ? "view-mode-highlight" : ""
			}`,
			text: "DRAW",
		});

		tldrawBtn.addEventListener("click", () => {
			this.updateViewMode(view);
		});

		const mdBtn = container.createEl("button", {
			type: "button",
			cls: `otldraw-status-bar-button ${
				view === VIEW_TYPE_MARKDOWN ? "view-mode-highlight" : ""
			}`,
			text: "MD",
		});

		mdBtn.addEventListener("click", () => {
			this.updateViewMode(view);
		});
	}

	public async setMarkdownView(leaf: WorkspaceLeaf) {
		// const state = leaf.view.getState();
		// await leaf.setViewState({
		// 	type: VIEW_TYPE_TLDRAW,
		// 	state: { file: null },
		// });
		await leaf.setViewState(
			{
				type: VIEW_TYPE_MARKDOWN,
				state: leaf.view.getState(),
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

	public getLeafFileId(leaf?: WorkspaceLeaf, file?: TFile) {
		const activeLeaf = leaf ?? this.app.workspace.getLeaf(false);
		const activeFile = file ?? this.app.workspace.getActiveFile();

		// @ts-ignore: activeLeaf.id exists but the typescript declarations don't say so
		const tabId = activeLeaf.id as string;
		const filePath = activeFile?.path ?? "";

		return `${tabId}-${filePath}`;
	}

	public getViewMode(leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file);
		const viewMode = this.file_view_modes[id];
		return viewMode;
	}

	public setLeafFileViewMode(
		viewMode: ViewTypes,
		leaf?: WorkspaceLeaf,
		file?: TFile
	) {
		const id = this.getLeafFileId(leaf, file);
		this.file_view_modes[id] = viewMode;
	}

	public updateViewMode(view: ViewTypes, leaf?: WorkspaceLeaf, file?: TFile) {
		view ??= VIEW_TYPE_TLDRAW;
		const activeLeaf = leaf ?? this.app.workspace.getLeaf(false);

		// update state:
		this.setLeafFileViewMode(view, activeLeaf, file);
		this.updateStatusBarViewMode(view);

		// guard clause to prevent changing the view if the view is already correct:
		const { type } = activeLeaf?.getViewState();
		if (type === view) return;

		// these functions will actually change the view mode:
		if (view === VIEW_TYPE_TLDRAW) this.setTldrawView(activeLeaf);
		else this.setMarkdownView(activeLeaf);
	}

	async createTldrFile() {
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
		this.app.workspace.onLayoutReady(() => {
			for (let leaf of this.app.workspace.getLeavesOfType("markdown")) {
				if (
					leaf.view instanceof MarkdownView &&
					this.isTldrawFile(leaf.view.file)
				) {
					this.updateViewMode(VIEW_TYPE_TLDRAW, leaf);
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

	async activateView() {
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
