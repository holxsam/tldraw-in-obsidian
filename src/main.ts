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
	TldrawSettingsTab,
} from "./obsidian/TldrawSettingsTab";
import {
	checkAndCreateFolder,
	getNewUniqueFilepath,
	isValidViewType,
} from "./utils/utils";
import {
	FILE_EXTENSION,
	FRONTMATTER_KEY,
	MARKDOWN_ICON,
	MARKDOWN_ICON_NAME,
	PaneTarget,
	RIBBON_NEW_FILE,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
	ViewType,
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
import { around } from "monkey-around";
import { TldrawReadonly } from "./obsidian/TldrawReadonly";
import { pluginBuild } from "./utils/decorators/plugin";
import { markdownPostProcessor } from "./obsidian/plugin/markdown-post-processor";

@pluginBuild
export default class TldrawPlugin extends Plugin {
	// status bar stuff:
	statusBarRoot: HTMLElement;
	statusBarViewModeReactRoot: Root;
	unsubscribeToViewModeState: () => void;
	transientUpdate: boolean = false;

	// keeps track of what view mode each tab-file combo should be in:
	leafFileViewModes: { [leafFileId: string]: ViewType } = {};

	// misc:
	settings: TldrawPluginSettings;

	async onload() {
		this.registerView(
			VIEW_TYPE_TLDRAW,
			(leaf) => new TldrawView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_TLDRAW_READ_ONLY,
			(leaf) => new TldrawReadonly(leaf, this)
		);

		// settings:
		await this.loadSettings();
		this.addSettingTab(new TldrawSettingsTab(this.app, this));

		// icons:
		addIcon(TLDRAW_ICON_NAME, TLDRAW_ICON);
		addIcon(MARKDOWN_ICON_NAME, MARKDOWN_ICON);

		// this creates an icon in the left ribbon:
		this.addRibbonIcon(TLDRAW_ICON_NAME, RIBBON_NEW_FILE, () =>
			this.createAndOpenUntitledTldrFile("current-tab")
		);

		// status bar:
		this.statusBarRoot = this.addStatusBarItem();
		this.statusBarViewModeReactRoot = createReactStatusBarViewMode(
			this.statusBarRoot
		);
		this.setStatusBarViewModeVisibility(false);

		// subscribe to status bar state within react via zustand:
		this.unsubscribeToViewModeState = useStatusBarState.subscribe(
			(state) => state,
			async (state, prevState) => {
				if (
					state.view.mode !== prevState.view.mode &&
					state.view.source === "react"
				)
					await this.updateViewMode(state.view.mode);
			}
		);

		// registers all events needed:
		this.registerEvents();

		// registers all commands:
		this.registerCommands();

		// switches to the tldraw view mode on initial launch
		this.switchToTldrawViewAfterLoad();

		// Change how tldraw files are displayed when reading the document, e.g. when it is embed in another Obsidian document.
		this.registerMarkdownPostProcessor((e, c) => markdownPostProcessor(this, e, c))
	}

	onunload() {
		this.unsubscribeToViewModeState();
		this.statusBarViewModeReactRoot.unmount();
	}

	private registerEvents() {
		const self = this;
		// Monkey patch WorkspaceLeaf to open Tldraw drawings with TldrawView by default
		// inspired from https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/f79181c76a9d6ef9f17ecdfd054aa0e6d7564d1f/src/main.ts#L1649C9-L1649C9
		this.register(
			around(WorkspaceLeaf.prototype, {
				setViewState(next) {
					return function (state: ViewState, ...rest: any[]) {
						const leaf: WorkspaceLeaf = this;
						const rstate = state.state; // "real" state
						const filePath = rstate?.file as string;
						const viewType = state.type;
						const validViewType = isValidViewType(viewType);

						if (validViewType && filePath) {
							const matr = !!rstate.manuallyTriggered;
							const cache =
								self.app.metadataCache.getCache(filePath);

							if (
								cache?.frontmatter &&
								cache.frontmatter[FRONTMATTER_KEY]
							) {
								const view = matr ? viewType : VIEW_TYPE_TLDRAW;
								const newState = { ...state, type: view };

								const file =
									self.app.vault.getAbstractFileByPath(
										filePath
									);

								if (file instanceof TFile) {
									self.setLeafFileViewMode(view, leaf, file);
									self.updateStatusBarViewMode(view);
								}

								return next.apply(this, [newState, ...rest]);
							}
						}
						return next.apply(this, [state, ...rest]);
					};
				},
			})
		);

		// adds a menu item to the context menu:
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
						.onClick(async () => {
							await this.updateViewMode(VIEW_TYPE_TLDRAW, leaf);
						});
				});
			})
		);

		// adds a menu item to the file menu (three dots) depending on view mode
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				if (!leaf || !(file instanceof TFile)) return;
				if (!this.isTldrawFile(file)) return;

				const { type } = leaf.getViewState();
				const viewMode = this.getLeafFileViewMode(leaf, file) || type; // current view mode
				const isMDMode = viewMode === VIEW_TYPE_MARKDOWN;

				const view = isMDMode ? VIEW_TYPE_TLDRAW : VIEW_TYPE_MARKDOWN; // opposite view mode
				const icon = isMDMode ? TLDRAW_ICON_NAME : MARKDOWN_ICON_NAME;
				const title = isMDMode ? "View as Tldraw" : "View as Markdown";

				menu.addItem((item) => {
					item.setIcon(icon)
						.setSection("tldraw")
						.setTitle(title)
						.onClick(async () => {
							await this.updateViewMode(view, leaf);
						});
				});
			})
		);

		// handles how this plugin decides what view mode the file should be displayed in
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", async (leaf) => {
				// always set this to false on a leaf change to prevent it from showing on non tldr files
				this.setStatusBarViewModeVisibility(false);

				// guard clause:
				if (!leaf) return;
				const leafViewState = leaf.getViewState();
				const leafViewMode = leafViewState.type;
				const validViewType = isValidViewType(leafViewMode);

				// more guard clause:
				if (!validViewType) return;
				const fileFromState = leafViewState.state.file as string;
				const file = this.app.workspace.getActiveFile();

				// even more guard clauses:
				if (!file || !fileFromState) return;
				if (fileFromState !== file.path || !this.isTldrawFile(file))
					return;

				// update the status bar:
				const viewMode = this.getLeafFileViewMode(leaf, file);
				this.setStatusBarViewModeVisibility(true);
				this.updateStatusBarViewMode(viewMode);
			})
		);
	}

	private registerCommands() {
		this.addCommand({
			id: "toggle-view-mode",
			name: "Toggle view mode",
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
				this.updateViewMode(oppositeViewMode, leaf);
			},
		});

		this.addCommand({
			id: "new-tldraw-file-current-tab",
			name: "Create a new drawing in the current tab",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("current-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-new-tab",
			name: "Create a new drawing in a new tab",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("new-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-split-tab ",
			name: "Create a new drawing in split tab",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("split-tab");
			},
		});

		this.addCommand({
			id: "new-tldraw-file-new-window",
			name: "Create a new drawing in a new window",
			callback: async () => {
				await this.createAndOpenUntitledTldrFile("new-window");
			},
		});
	}

	public setStatusBarViewModeVisibility(visible: boolean) {
		if (visible)
			this.statusBarRoot.removeClass("ptl-hide-statusbar-viewmode");
		else this.statusBarRoot.addClass("ptl-hide-statusbar-viewmode");
	}

	public updateStatusBarViewMode(view: ViewType) {
		useStatusBarState.setState({ view: { mode: view, source: "plugin" } });
	}

	public setMarkdownView = async (leaf: WorkspaceLeaf) => {
		await leaf.setViewState({
			type: VIEW_TYPE_MARKDOWN,
			state: { ...leaf.view.getState(), manuallyTriggered: true },
		} as ViewState);
	};

	public setTldrawView = async (leaf: WorkspaceLeaf) => {
		await leaf.setViewState({
			type: VIEW_TYPE_TLDRAW,
			state: { ...leaf.view.getState(), manuallyTriggered: true },
		} as ViewState);
	};

	public setTldrawViewPreview = async (leaf: WorkspaceLeaf) => {
		await leaf.setViewState({
			type: VIEW_TYPE_TLDRAW_READ_ONLY,
			state: { ...leaf.view.getState(), manuallyTriggered: true },
		} as ViewState);
	};

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
		viewMode: ViewType,
		leaf?: WorkspaceLeaf,
		file?: TFile
	) {
		const id = this.getLeafFileId(leaf, file);
		this.leafFileViewModes[id] = viewMode;
	}

	public async updateViewMode(view: ViewType, leaf?: WorkspaceLeaf) {
		view ??= VIEW_TYPE_TLDRAW;
		leaf ??= this.app.workspace.getLeaf(false);

		// guard clause to prevent changing the view if the view is already correct:
		const { type } = leaf?.getViewState();
		if (type === view) return;

		// these functions will actually change the view mode:
		switch(view) {
			case VIEW_TYPE_TLDRAW:
				await this.setTldrawView(leaf)
			break;
			case VIEW_TYPE_TLDRAW_READ_ONLY:
				await this.setTldrawViewPreview(leaf)
			break;
			default: 
				await this.setMarkdownView(leaf);
		}
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
		await this.updateViewMode(VIEW_TYPE_TLDRAW, leaf);
	};

	public createAndOpenUntitledTldrFile = async (location: PaneTarget) => {
		const file = await this.createUntitledTldrFile();
		this.openTldrFile(file, location);
	};

	public isTldrawFile(file: TFile) {
		if (!file) return false;
		const fcache = file ? this.app.metadataCache.getFileCache(file) : null;
		return !!fcache?.frontmatter && !!fcache.frontmatter[FRONTMATTER_KEY];
	}

	private switchToTldrawViewAfterLoad() {
		this.app.workspace.onLayoutReady(() => {
			for (let leaf of this.app.workspace.getLeavesOfType("markdown")) {
				if (
					leaf.view instanceof MarkdownView &&
					leaf.view.file &&
					this.isTldrawFile(leaf.view.file)
				) {
					this.updateViewMode(VIEW_TYPE_TLDRAW, leaf);
				}
			}
		});
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
