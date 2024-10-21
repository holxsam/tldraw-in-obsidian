import { FileView } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";
import wrapReactRoot from "src/utils/wrap-react-root";
import { createRootAndRenderTldrawApp, TldrawAppProps, TldrawAppStoreProps } from "src/components/TldrawApp";

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
            return {};
        }

        private createReactRoot(entryPoint: Element, store: TldrawAppStoreProps) {
            return createRootAndRenderTldrawApp(
                entryPoint,
                this.plugin,
                {
                    app: this.getTldrawOptions(),
                    store,
                }
            );
        }

        /**
         * Set the store to be used inside the react root element.
         * @param store 
         * @returns 
         */
        protected async setStore(store?: TldrawAppStoreProps, useIframe = false) {
            const tldrawContainer = this.tldrawContainer;
            this.reactRoot?.unmount();
            if (!store) return;
            if (!useIframe) {
                this.reactRoot = this.createReactRoot(tldrawContainer, store);
                return;
            }
            this.reactRoot = await wrapReactRoot(
                tldrawContainer, (entryPoint) => this.createReactRoot(entryPoint, store)
            );
        }

        protected viewAsMarkdownClicked() {
            this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN);
        }
    }

    return _TldrawLoadableMixin;
}
