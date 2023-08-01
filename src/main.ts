import {
	MarkdownView,
	Plugin,
	TFile,
	ViewState,
	WorkspaceLeaf,
	addIcon,
	normalizePath,
	moment,
} from "obsidian";
import { TldrawView } from "./obsidian/TldrawView";
import {
	DEFAULT_SETTINGS,
	TldrawPluginSettings,
	SettingsTab,
} from "./obsidian/SettingsTab";
import { checkAndCreateFolder, getNewUniqueFilepath } from "./utils/utils";
import {
	FILE_EXTENSION,
	FRONTMATTER_KEY,
	PaneTarget,
	RIBBON_NEW_FILE,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	ViewTypes,
} from "./utils/constants";
import { createReactStatusBarViewMode } from "./components/StatusBarViewMode";
import { useStatusBarState } from "./utils/stores";
import { Root } from "react-dom/client";
import {
	frontmatterTemplate,
	getTLDataTemplate,
	codeBlockTemplate,
	tlFileTemplate,
} from "./utils/document";

export default class TldrawPlugin extends Plugin {
	statusBarRoot: HTMLElement;
	statusBarViewModeReactRoot: Root;
	settings: TldrawPluginSettings;
	leafFileViewModes: { [filename: string]: ViewTypes } = {};
	unsubscribeToViewModeState: () => void;

	async onload() {
		// console.log("main.ts onload()");

		this.manifest.version;
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
		this.addRibbonIcon(TLDRAW_ICON_NAME, RIBBON_NEW_FILE, () =>
			this.createAndOpenUntitledTldrFile("current-tab")
		);

		// status bar:
		this.statusBarRoot = this.addStatusBarItem();
		this.statusBarViewModeReactRoot = createReactStatusBarViewMode(
			this.statusBarRoot
		);
		this.setStatusBarViewModeVisibility(false);

		// REGISTER EVENTS:
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, source) => {
				const file = source.file;
				const leaf = this.app.workspace.getLeaf(false);

				if (!leaf || !(file instanceof TFile)) return;
				if (!this.isTldrawFile(file)) return;

				menu.addItem((item) => {
					item.setIcon(TLDRAW_ICON_NAME)
						.setSection("close")
						.setTitle("View as Tldraw")
						.onClick(() => {
							this.updateViewMode(VIEW_TYPE_TLDRAW, leaf, file);
						});
				});
			})
		);

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
			this.app.workspace.on("active-leaf-change", (leaf) => {
				// always set this to false on a leaf change to prevent it from showing on non tldr files
				this.setStatusBarViewModeVisibility(false);

				// guard clause:
				if (!leaf) return;

				const leafViewState = leaf.getViewState();
				const leafViewMode = leafViewState.type;

				// recent leaf, is the most recently active leaf before this "leaf" (the one passed in by the function)
				const recentLeaf = this.app.workspace.getMostRecentLeaf();
				const recentFile = this.app.workspace.getActiveFile();

				// These nested if statements is a crude attempt to solve a bug caused by clicking
				// on a tldraw file more than once in a row in the file explorer.
				// For example, clicking a tldraw file named "file 1" twice in a row in the file explorer (without clicking other files or any where else) would cause the the file to display in the markdown view mode even if it was supposed to be displayed in the tldraw view mode. Focus the tab that the file would correct this issue but may be confusing/disorienting to users.
				// Note that clicking "file 1" then "file 2" then back to "file 1" would NOT cause this bug.
				// The solution is to find as many conditions that the bug happens on
				// then force focus the leaf that contains the file when those conditions pass.
				if (recentLeaf && recentFile) {
					const recentLeafViewState = recentLeaf.getViewState();

					const correctViewMode = this.getLeafFileViewMode(
						recentLeaf,
						recentFile
					);

					if (
						// this bug only pops up when leafViewMode is "file-explorer":
						leafViewMode === "file-explorer" &&
						// to guard against falsy values because the correctViewMode could be undefined the first time a file is opened:
						correctViewMode &&
						// when theres a mismatch this what the view should be versus what is current is
						correctViewMode !== recentLeafViewState.type
					) {
						// simply focus the leaf again to correct the view mode:
						this.app.workspace.setActiveLeaf(recentLeaf, {
							focus: true,
						});
					}
				}

				const validViewType =
					leafViewMode === VIEW_TYPE_TLDRAW ||
					leafViewMode === VIEW_TYPE_MARKDOWN;

				// guard clause:
				if (!validViewType) return;

				const fileFromState = leafViewState.state.file as string;
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

		// REGISTER COMMANDS:
		this.addCommand({
			id: "toggle-view-mode",
			name: "Toggle View Mode",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "d" }],
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;

				const fileIsTldraw = this.isTldrawFile(file);
				if (checking) return fileIsTldraw;

				const leaf = this.app.workspace.getLeaf(false);
				const currentViewMode = this.getLeafFileViewMode(leaf, file);
				const oppositeViewMode =
					currentViewMode === VIEW_TYPE_MARKDOWN
						? VIEW_TYPE_TLDRAW
						: VIEW_TYPE_MARKDOWN;
				this.updateViewMode(oppositeViewMode, leaf, file);
			},
		});

		this.addCommand({
			id: "new-tldraw-file-current-tab",
			name: "Create New Tldrawing in CURRENT TAB",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("current-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-new-tab",
			name: "Create New Tldrawing in NEW TAB",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("new-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-split-tab ",
			name: "Create New Tldrawing in SPLIT TAB",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("split-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-new-window",
			name: "Create New Tldrawing in NEW WINDOW",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("new-window");
			},
		});

		// this adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingsTab(this.app, this));

		// switches to the tldraw view mode on initial launch
		this.switchToTldrawViewAfterLoad();
	}

	onunload() {
		// console.log("main.ts unonload()");
		this.unsubscribeToViewModeState();
		this.statusBarViewModeReactRoot.unmount();
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
		await leaf.setViewState({
			type: VIEW_TYPE_MARKDOWN,
			state: leaf.view.getState(),
		} as ViewState);
	}

	public async setTldrawView(leaf: WorkspaceLeaf) {
		await leaf.setViewState({
			type: VIEW_TYPE_TLDRAW,
			state: leaf.view.getState(),
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

	public async createFile(
		filename: string,
		foldername?: string,
		data?: string
	): Promise<TFile> {
		const folderpath = normalizePath(foldername || this.settings.folder);
		await checkAndCreateFolder(folderpath, this.app.vault); //create folder if it does not exist
		const fname = getNewUniqueFilepath(
			this.app.vault,
			filename,
			folderpath
		);

		return await this.app.vault.create(fname, data ?? "");
	}

	public createTldrFile = async (filename: string, foldername?: string) => {
		// adds the markdown extension if the filename does not already include it:
		filename = filename.endsWith(FILE_EXTENSION)
			? filename
			: filename + FILE_EXTENSION;

		// constructs the markdown content thats a template:
		const tlData = getTLDataTemplate(this.manifest.version, {});
		const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: true`);
		const codeblock = codeBlockTemplate(tlData);
		const fileData = tlFileTemplate(frontmatter, codeblock);

		return await this.createFile(filename, foldername, fileData);
	};

	public createUntitledTldrFile = async () => {
		const { newFilePrefix, newFileTimeFormat, folder } = this.settings;

		const date =
			newFileTimeFormat.trim() !== ""
				? moment().format(newFileTimeFormat)
				: "";

		// if both the prefix and the date is empty as contentation
		// then we have to use the defaults to name the file
		let filename = newFilePrefix + date;
		if (filename.trim() === "")
			filename =
				DEFAULT_SETTINGS.newFilePrefix +
				moment().format(DEFAULT_SETTINGS.newFileTimeFormat);

		return await this.createTldrFile(filename, folder);
	};

	public openTldrFile = async (file: TFile, location: PaneTarget) => {
		let leaf: WorkspaceLeaf;

		if (location === "current-tab")
			leaf = this.app.workspace.getLeaf(false);
		else if (location === "new-tab")
			leaf = this.app.workspace.getLeaf(true);
		else if (location === "new-window")
			leaf = this.app.workspace.getLeaf("window");
		else if (location === "split-tab")
			leaf = this.app.workspace.getLeaf("split");
		else leaf = this.app.workspace.getLeaf(false);

		await leaf.openFile(file);

		this.updateViewMode(VIEW_TYPE_TLDRAW, leaf, file);
	};

	public createAndOpenUntitledTldrFile = async (location: PaneTarget) => {
		const file = await this.createUntitledTldrFile();
		this.openTldrFile(file, location);
	};

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

	public isTldrawFile(file: TFile) {
		if (!file) return false;
		const fileCache = file
			? this.app.metadataCache.getFileCache(file)
			: null;
		return (
			!!fileCache?.frontmatter && !!fileCache.frontmatter[FRONTMATTER_KEY]
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
