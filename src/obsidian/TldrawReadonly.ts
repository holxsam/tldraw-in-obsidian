import { FileView, Menu, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import { SetTldrawFileData, TldrawAppProps } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { PaneTarget, TLDRAW_ICON_NAME, VIEW_TYPE_TLDRAW, VIEW_TYPE_TLDRAW_FILE, VIEW_TYPE_TLDRAW_READ_ONLY, ViewType } from "src/utils/constants";
import { parseTLDataDocument } from "src/utils/parse";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { logClass } from "src/utils/logging";
import { TLDRAW_FILE_EXTENSION } from "@tldraw/tldraw";
import { getTLMetaTemplate } from "src/utils/document";
import { migrateTldrawFileDataIfNecessary } from "src/utils/migrate/tl-data-to-tlstore";
import { pluginMenuLabel } from "./menu";

export class TldrawReadonly extends TldrawLoadableMixin(FileView) {
    plugin: TldrawPlugin;
    reactRoot?: Root;

    constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.navigation = true;
    }

    getViewType(): string {
        return VIEW_TYPE_TLDRAW_READ_ONLY;
    }

    getDisplayText(): string {
        return `[Preview] ${super.getDisplayText()}`;
    }

    onload() {
        super.onload();
        this.addAction(TLDRAW_ICON_NAME, "Edit", async () => {
            const { file } = this;
            if (file !== null && file.path.endsWith(TLDRAW_FILE_EXTENSION)) {
                this.plugin.updateViewMode(VIEW_TYPE_TLDRAW_FILE);
            } else {
                this.plugin.updateViewMode(VIEW_TYPE_TLDRAW);
            }
        });
    }

    async onLoadFile(file: TFile): Promise<void> {
        const fileData = await this.app.vault.read(file);
        if (!file.path.endsWith(TLDRAW_FILE_EXTENSION)) {
            const parsedData = parseTLDataDocument(this.plugin.manifest.version, fileData);
            await this.setTlData(parsedData);
        } else {
            await this.setTlData({
                meta: getTLMetaTemplate(this.plugin.manifest.version),
                store: migrateTldrawFileDataIfNecessary(fileData)
            })
        }
    }

    override onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string): void {
        super.onPaneMenu(menu, source);
        const { file } = this;
        if (!file) return;

        menu.addItem((item) => pluginMenuLabel(item
            .setSection('tldraw')
        ))
            .addItem((item) => item
                .setIcon('external-link')
                .setSection('tldraw')
                .setTitle('Open in default app')
                .onClick(async () => {
                    await this.app.openWithDefaultApp(file.path);
                })
            )
    }

    protected override setFileData: SetTldrawFileData = () => {
        logClass(TldrawReadonly, this.setFileData, 'Ignore saving file due to read only mode.');
    }

    protected override getTldrawOptions(): TldrawAppProps['options'] {
        return {
            ...super.getTldrawOptions(),
            isReadonly: true,
        }
    }

    protected override viewAsMarkdownClicked(): void {
        const { file } = this;
        if (file !== null && file.path.endsWith(TLDRAW_FILE_EXTENSION)) {
            this.create(file, 'new-tab', 'markdown');
            return;
        }
        super.viewAsMarkdownClicked()
    }

    private async create(tFile: TFile, location: PaneTarget, viewType: ViewType) {
        // TODO: Add a dialog to confirm the creation of a file.
        const newFile = await this.plugin.createUntitledTldrFile({
            tlStore:
                // NOTE: Maybe this should be retreiving the current tlStore from the tldraw editor instead of re-reading the file.
                migrateTldrawFileDataIfNecessary(
                    await this.app.vault.read(tFile)
                )
        });
        await this.plugin.openTldrFile(newFile, location, viewType)
        new Notice(`Created a new file for editing "${newFile.path}"`)
    }
}
