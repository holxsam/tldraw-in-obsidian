import { FileView } from "obsidian";
import { Root } from "react-dom/client";
import TldrawPlugin from "src/main";
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from "src/utils/constants";

/**
 * Implements overrides for {@linkcode FileView.onload} and {@linkcode FileView.onunload}
 * as a mixin so that it could be reused.
 * 
 * @param Base 
 * @returns 
 */
export function TldrawLoadableMixin<T extends abstract new (...args: any[]) => FileView>(Base: T) {
    abstract class _TldrawLoadableMixin extends Base {
        abstract plugin: TldrawPlugin;
        abstract reactRoot?: Root;

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
    }

    return _TldrawLoadableMixin;
}
