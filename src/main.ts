import {
	MarkdownView,
	Plugin,
	TFile,
	ViewState,
	WorkspaceLeaf,
	addIcon,
} from "obsidian";
import { TldrawView } from "./obsidian/TldrawView";
import {
	DEFAULT_SETTINGS,
	TldrawPluginSettings,
	SettingsTab,
} from "./obsidian/SettingsTab";
import {
	frontmatterTemplate,
	tldrawDataTemplate,
	tldrawMarkdownTemplate,
} from "./utils/utils";
import {
	FRONTMATTER_KEY,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	ViewTypes,
} from "./utils/constants";
import { createReactStatusBarViewMode } from "./components/StatusBarViewMode";
import { useStatusBarState } from "./utils/stores";

export default class TldrawPlugin extends Plugin {
	statusBarRoot: HTMLElement;
	settings: TldrawPluginSettings;
	leafFileViewModes: { [filename: string]: ViewTypes } = {};
	unsubscribeToViewModeState: () => void;

	async onload() {
		console.log("main.ts onload()");

		this.registerView(
			VIEW_TYPE_TLDRAW,
			(leaf) => new TldrawView(leaf, this)
		);

		await this.loadSettings();

		addIcon(TLDRAW_ICON_NAME, TLDRAW_ICON);

		this.unsubscribeToViewModeState = useStatusBarState.subscribe(
			(state) => state.viewMode,
			(viewMode, prevViewMode) => {
				if (viewMode !== prevViewMode) this.updateViewMode(viewMode);
			}
		);

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
			// console.log("active leaf", this.app.workspace.getLeaf(false).id);
			// console.log(this.leafFileViewModes);
		});

		// status bar:
		this.statusBarRoot = this.addStatusBarItem();
		createReactStatusBarViewMode(this.statusBarRoot);
		this.setStatusBarViewModeVisibility(false);

		// registers events:
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (!leaf || !(file instanceof TFile)) return;
				if (!this.isTldrawFile(file)) return;

				const { type } = leaf.getViewState();
				const viewMode = this.getLeafFileViewMode(leaf, file) || type;

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
				this.setStatusBarViewModeVisibility(false);

				// guard clause:
				if (!leaf) return;

				const { type, state } = leaf.getViewState();
				const validViewType =
					type === VIEW_TYPE_TLDRAW || type === VIEW_TYPE_MARKDOWN;

				// guard clause:
				if (!validViewType) return;

				const fileFromState = state.file;
				const file = this.app.workspace.getActiveFile();

				// guard clauses:
				if (!file || !fileFromState) return;
				if (fileFromState !== file.path || !this.isTldrawFile(file))
					return;

				this.setStatusBarViewModeVisibility(true);
				const viewMode = this.getLeafFileViewMode(leaf, file);
				this.updateViewMode(viewMode);
			})
		);

		// this adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));

		// switches to the tldraw view mode on initial launch
		this.switchToTldrawViewAfterLoad();
	}

	onunload() {
		console.log("main.ts unonload()");
		this.unsubscribeToViewModeState();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TLDRAW);
	}

	public setStatusBarViewModeVisibility(visible: boolean) {
		if (visible)
			this.statusBarRoot.removeClass("hide-status-bar-view-mode");
		else this.statusBarRoot.addClass("hide-status-bar-view-mode");
	}

	public updateStatusBarViewMode(view: ViewTypes) {
		useStatusBarState.setState({ viewMode: view });
	}

	public async setMarkdownView(leaf: WorkspaceLeaf) {
		// still not sure why this piece code was here but I feel like it might be something I overlooked but since I don't fully understand it, I'm just going to comment it out
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

	/**
	 * the leafFileViewMode ID is a combination of the leaf (or tab) id and the file in that tab's path. This is how we can look up what view mode each leaf-file combo has been set.
	 * @param leaf
	 * @param file
	 * @returns
	 */
	public getLeafFileId(leaf?: WorkspaceLeaf, file?: TFile | null) {
		leaf ??= this.app.workspace.getLeaf(false);
		file ??= this.app.workspace.getActiveFile();

		// @ts-ignore: leaf.id exists but the typescript declarations don't say so
		const leafId = leaf.id as string;
		const filePath = file?.path ?? "";

		return `${leafId}-${filePath}`;
	}

	public getLeafFileViewMode(leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file);
		const viewMode = this.leafFileViewModes[id];
		return viewMode;
	}

	public setLeafFileViewMode(
		viewMode: ViewTypes,
		leaf?: WorkspaceLeaf,
		file?: TFile
	) {
		const id = this.getLeafFileId(leaf, file);
		this.leafFileViewModes[id] = viewMode;
	}

	public updateViewMode(view: ViewTypes, leaf?: WorkspaceLeaf, file?: TFile) {
		view ??= VIEW_TYPE_TLDRAW;
		leaf ??= this.app.workspace.getLeaf(false);

		// update state:
		this.setLeafFileViewMode(view, leaf, file);
		this.updateStatusBarViewMode(view);

		// guard clause to prevent changing the view if the view is already correct:
		const { type } = leaf?.getViewState();
		if (type === view) return;

		// these functions will actually change the view mode:
		if (view === VIEW_TYPE_TLDRAW) this.setTldrawView(leaf);
		else this.setMarkdownView(leaf);
	}

	async createTldrFile() {
		const rand = Math.floor(Math.random() * 10000);
		const paddedNum = `${rand}`.padStart(5, "0");
		const filename = `tldraw-${paddedNum}.tldr.md`;

		// constructs the markdown content thats a template:
		const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: parsed`);
		const tldrData = tldrawDataTemplate(null);
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
