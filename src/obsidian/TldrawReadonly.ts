import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import { createRootAndRenderTldrawApp } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { TLDRAW_ICON_NAME, VIEW_TYPE_TLDRAW, VIEW_TYPE_TLDRAW_READ_ONLY } from "src/utils/constants";
import { parseTLData } from "src/utils/parse";
import { TldrawLoadableMixin } from "./TldrawMixins";

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
        const entryPoint = this.containerEl.children[1];
        const fileData = await this.app.vault.read(file);
        const parsedData = parseTLData(this.plugin.manifest.version, fileData);

        if (this.reactRoot) this.reactRoot.unmount();

        this.reactRoot = createRootAndRenderTldrawApp(
            entryPoint,
            parsedData.raw,
            (_) => {
                console.log('Ignore saving file due to read only mode.');
            },
            this.plugin.settings,
            {
                isReadonly: true
            }
        );
    }
}