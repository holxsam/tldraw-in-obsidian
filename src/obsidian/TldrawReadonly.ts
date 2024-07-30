import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import {  TldrawAppProps } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { TLDRAW_ICON_NAME, VIEW_TYPE_TLDRAW, VIEW_TYPE_TLDRAW_READ_ONLY } from "src/utils/constants";
import { parseTLData } from "src/utils/parse";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { logClass } from "src/utils/logging";
import { SerializedStore, TLRecord } from "@tldraw/tldraw";

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

        this.addAction(TLDRAW_ICON_NAME, "Edit", () => {
            this.plugin.updateViewMode(VIEW_TYPE_TLDRAW);
        });
    }

    async onLoadFile(file: TFile): Promise<void> {
        const fileData = await this.app.vault.read(file);
        const parsedData = parseTLData(this.plugin.manifest.version, fileData);
        await this.setTlData(parsedData);
    }

    protected setFileData(data: SerializedStore<TLRecord>): void {
        logClass(TldrawReadonly, this.setFileData, 'Ignore saving file due to read only mode.');
    }

    protected override getTldrawOptions(): TldrawAppProps['options'] {
        return {
            ...super.getTldrawOptions(),
            isReadonly: true,
        }
    }
}