import { FileView } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";
import wrapReactRoot from "src/utils/wrap-react-root";
import { TLData } from "src/utils/document";

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

        /**
         * 
         * @param entryPoint The intended element to mount the react app to.
         * @param tldata 
         */
        protected abstract createReactRoot(entryPoint: Element, tldata: TLData): Root;

        /**
         * Adds the entry point `tldraw-view-content` for the {@linkcode reactRoot},
         * and the "View as markdown" action button.
         */
        onload(): void {
            this.contentEl.addClass("tldraw-view-content");

            this.addAction(MARKDOWN_ICON_NAME, "View as markdown", () => {
                this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
            });
        }

        /**
         * Removes the previously added entry point `tldraw-view-content`, and unmounts {@linkcode reactRoot}.
         */
        onunload(): void {
            this.contentEl.removeClass("tldraw-view-content");
            this.reactRoot?.unmount();
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
