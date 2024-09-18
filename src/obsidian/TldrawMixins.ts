import { FileView, TFile } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";
import wrapReactRoot from "src/utils/wrap-react-root";
import { TLDataDocument } from "src/utils/document";
import { createRootAndRenderTldrawApp, TldrawAppProps } from "src/components/TldrawApp";
import { SetTldrawFileData } from "src/hooks/useTldrawAppHook";
import { ObsidianTLAssetStore } from "src/tldraw/asset-store";

/**
 * Implements overrides for {@linkcode FileView.onload} and {@linkcode FileView.onunload}
 * as a mixin so that it could be reused.
 * 
 * @param Base 
 * @returns 
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TldrawLoadableMixin<T extends abstract new (...args: any[]) => FileView>(Base: T) {
    /**
     * #NOTE: may need to embed the react root in an iframe so that the right click context menus are positioned within the frame, and not partially hidden.
     */
    abstract class _TldrawLoadableMixin extends Base {
        abstract plugin: TldrawPlugin;
        abstract reactRoot?: Root;

        protected abstract setFileData: SetTldrawFileData;
        protected storeAsset?: (id: string, tFile: TFile) => Promise<void>;

        protected get tldrawContainer() { return this.containerEl.children[1]; }

        /**
         * Adds the entry point `tldraw-view-content` for the {@linkcode reactRoot},
         * and the "View as markdown" action button.
         */
        override onload(): void {
            this.contentEl.addClass("tldraw-view-content");

            this.addAction(MARKDOWN_ICON_NAME, "View as markdown", () => this.viewAsMarkdownClicked());
        }

        /**
         * Removes the previously added entry point `tldraw-view-content`, and unmounts {@linkcode reactRoot}.
         */
        override onunload(): void {
            this.contentEl.removeClass("tldraw-view-content");
            this.reactRoot?.unmount();
        }

        protected getTldrawOptions(): TldrawAppProps['options'] {
            if(!this.file) {
                throw new Error('There is no file associated with this tldraw view.');
            }
            return {
                assetStore: new ObsidianTLAssetStore(this.plugin, this.file, this.storeAsset)
            };
        }

        private createReactRoot(entryPoint: Element, tldata: TLDataDocument) {
            return createRootAndRenderTldrawApp(
                entryPoint,
                tldata,
                this.setFileData,
                this.plugin,
                this.getTldrawOptions()
            );
        }

        /**
         * Set the data to be rendered inside the react root element.
         * @param tldata 
         * @returns 
         */
        protected async setTlData(tldata: TLDataDocument, useIframe = false) {
            const tldrawContainer = this.tldrawContainer;
            this.reactRoot?.unmount();
            if (!useIframe) {
                this.reactRoot = this.createReactRoot(tldrawContainer, tldata);
                return;
            }
            this.reactRoot = await wrapReactRoot(
                tldrawContainer, (entryPoint) => this.createReactRoot(entryPoint, tldata)
            );
        }

        protected viewAsMarkdownClicked() {
            this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
        }
    }

    return _TldrawLoadableMixin;
}
