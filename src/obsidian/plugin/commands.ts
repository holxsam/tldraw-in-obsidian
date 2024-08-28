import TldrawPlugin from "src/main";
import { VIEW_TYPE_MARKDOWN, VIEW_TYPE_TLDRAW } from "src/utils/constants";
import { importTldrawFile } from "src/utils/file";

export function registerCommands(plugin: TldrawPlugin) {
    plugin.addCommand({
        id: "toggle-view-mode",
        name: "Toggle view mode",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (!file) return false;

            const fileIsTldraw = plugin.isTldrawFile(file);
            if (checking) return fileIsTldraw;

            const leaf = plugin.app.workspace.getLeaf(false);
            const currentViewMode = plugin.getLeafFileViewMode(leaf, file);
            const oppositeViewMode =
                currentViewMode === VIEW_TYPE_MARKDOWN
                    ? VIEW_TYPE_TLDRAW
                    : VIEW_TYPE_MARKDOWN;
            plugin.updateViewMode(oppositeViewMode, leaf);
        },
    });

    plugin.addCommand({
        id: "new-tldraw-file-current-tab",
        name: "Create a new drawing in the current tab",
        callback: async () => {
            await plugin.createAndOpenUntitledTldrFile("current-tab");
        },
    });

    plugin.addCommand({
        id: "new-tldraw-file-new-tab",
        name: "Create a new drawing in a new tab",
        callback: async () => {
            await plugin.createAndOpenUntitledTldrFile("new-tab");
        },
    });

    plugin.addCommand({
        id: "new-tldraw-file-split-tab ",
        name: "Create a new drawing in split tab",
        callback: async () => {
            await plugin.createAndOpenUntitledTldrFile("split-tab");
        },
    });

    plugin.addCommand({
        id: "new-tldraw-file-new-window",
        name: "Create a new drawing in a new window",
        callback: async () => {
            await plugin.createAndOpenUntitledTldrFile("new-window");
        },
    });

    plugin.addCommand({
        id: "new-tldraw-file-embed",
        name: "Create a new drawing and embed as attachment",
        editorCallback: async (editor, ctx) => {
            const { file } = ctx;
            if (file === null) {
                console.log(ctx)
                throw new Error('ctx.file was null');
            }
            const from = editor.getCursor('from');
            const to = editor.getCursor('to');
            const newFile = await plugin.createUntitledTldrFile({ attachTo: file });
            editor.replaceRange(`![[${newFile.path}]]`, from, to)
        },
    });

    plugin.addCommand({
        id: "import-new-tldraw-file-new-tab",
        name: "Import file as new document and open in a new tab",
        callback: async () => {
            const tFile = await importTldrawFile(plugin);
            await plugin.openTldrFile(tFile, 'new-tab');
        },
    });

    plugin.addCommand({
        id: "import-new-tldraw-file-embed",
        name: "Import file as new document and embed as attachment",
        editorCallback: async (editor, ctx) => {
            const { file } = ctx;
            if (file === null) {
                console.log(ctx)
                throw new Error('ctx.file was null');
            }
            const from = editor.getCursor('from');
            const to = editor.getCursor('to');
            const tFile = await importTldrawFile(plugin, file);
            editor.replaceRange(`![[${tFile.path}]]`, from, to)
        },
    });
}