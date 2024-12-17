import { Editor, TldrawFile } from "tldraw";
import * as React from "react";
import TldrawPlugin from "src/main";
import { TldrawPluginMetaData } from "src/utils/document";
import { isObsidianThemeDark } from "src/utils/utils";

export type SetTldrawFileData = (data: {
    meta: TldrawPluginMetaData
    tldrawFile: TldrawFile
}) => void;

export function useTldrawAppEffects({
    editor, initialTool, isReadonly, settingsProvider, selectNone,
    onEditorMount,
    setFocusedEditor,
}: {
    editor?: Editor,
    initialTool?: string,
    isReadonly: boolean,
    settingsProvider: TldrawPlugin['settingsProvider'],
    selectNone: boolean,
    setFocusedEditor: (editor: Editor) => void,
    onEditorMount?: (editor: Editor) => void,
}) {
    const [settings, setSettings] = React.useState(() => settingsProvider.getCurrent());

    React.useEffect(() => {
        const removeListener = settingsProvider.listen(() => {
            const newSettings = settingsProvider.getCurrent();
            setSettings({
                ...newSettings
            });
        });
        return () => {
            removeListener();
        }
    }, [
        /**
         * If the settings provider changes, then we need to recalculate the effect.
         */
        settingsProvider
    ])

    React.useEffect(() => {
        if (!editor) return;

        if (selectNone) {
            editor.selectNone();
        }

        const {
            themeMode,
            gridMode,
            debugMode,
            snapMode,
            focusMode,
            toolSelected,
        } = settings;

        editor.setCurrentTool(initialTool ?? toolSelected)

        let darkMode = true;
        if (themeMode === "dark") darkMode = true;
        else if (themeMode === "light") darkMode = false;
        else darkMode = isObsidianThemeDark();

        editor.user.updateUserPreferences({
            colorScheme: darkMode ? 'dark' : 'light',
            isSnapMode: snapMode,
        });

        editor.updateInstanceState({
            isReadonly: isReadonly,
            isGridMode: gridMode,
            isDebugMode: debugMode,
            isFocusMode: focusMode,
        });

        setFocusedEditor(editor);
        onEditorMount?.(editor);
        // NOTE: These could probably be utilized for storing assets as files in the vault instead of tldraw's default indexedDB.
        // editor.registerExternalAssetHandler
        // editor.registerExternalContentHandler
    }, [editor]);
}
