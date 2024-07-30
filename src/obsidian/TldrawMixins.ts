import { FileView } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";
import wrapReactRoot from "src/utils/wrap-react-root";
import { TLData } from "src/utils/document";
import { createRootAndRenderTldrawApp, TldrawAppProps } from "src/components/TldrawApp";
import { SerializedStore, TLRecord } from "@tldraw/tldraw";

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

        protected abstract setFileData(data: SerializedStore<TLRecord>): void;

        /**
         * Adds the entry point `tldraw-view-content` for the {@linkcode reactRoot},
         * and the "View as markdown" action button.
         */
        override onload(): void {
            this.contentEl.addClass("tldraw-view-content");

            this.addAction(MARKDOWN_ICON_NAME, "View as markdown", () => {
                this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
            });
        }

        /**
         * Removes the previously added entry point `tldraw-view-content`, and unmounts {@linkcode reactRoot}.
         */
        override onunload(): void {
            this.contentEl.removeClass("tldraw-view-content");
            this.reactRoot?.unmount();
        }

        protected getTldrawOptions(): TldrawAppProps['options'] {
            return {
                defaultFontOverrides: this.plugin.getFontOverrides(),
            };
        }

        private createReactRoot(entryPoint: Element, tldata: TLData) {
            return createRootAndRenderTldrawApp(
                entryPoint,
                tldata.raw,
                this.setFileData,
                this.plugin.settings,
                this.getTldrawOptions()
            );
        }

        private setReactRoot(root: Root) {
            this.reactRoot?.unmount();
            this.reactRoot = root;
        }

        /**
         * Set the data to be rendered inside the react root element.
         * @param tldata 
         * @returns 
         */
        protected async setTlData(tldata: TLData, useIframe = false) {
            const tldrawContainer = this.containerEl.children[1];
            if (!useIframe) {
                this.setReactRoot(this.createReactRoot(tldrawContainer, tldata));
                return;
            }
            this.setReactRoot(await wrapReactRoot(
                tldrawContainer, (entryPoint) => this.createReactRoot(entryPoint, tldata)
            ))
        }
    }

    return _TldrawLoadableMixin;
}
