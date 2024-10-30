import { } from "obsidian";

declare module "obsidian" {
    interface App {
        /**
         * 
         * @param path A vault file path
         * @returns 
         */
        openWithDefaultApp: (path: string) => void
    }

    interface Workspace {
        /**
         * This isn't provided by the Obsidian API, but we can still call it.
         * 
         * Internally it does the following:
         * 
         * ```
         * this.trigger("quick-preview", file, data);
         * ```
         * 
         * This event can be captured by using {@linkcode Workspace.on} like so:
         * 
         * ```
         * app.workspace.on("quick-preview", (file, data) => {
         *   // Do something with `file` and `data`
         * });
         * ```
         * 
         * @param file 
         * @param data 
         * @returns 
         */
        onQuickPreview: (file: TFile, data: string) => void
    }

    interface Vault {
        config: {
            attachmentFolderPath?: '/' | `./${string}` | (string & NonNullable<unknown>)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface SuggestModal<T = unknown> {
        /**
         * This function is present at runtime in the web developer console in Obsidian, but not in the type definition for some reason.
         */
        updateSuggestions: () => void;
    }
}
