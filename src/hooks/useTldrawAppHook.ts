import { Editor, TldrawFile } from "tldraw";
import * as React from "react";
import { useViewModeState } from "src/hooks/useViewModeController";
import TldrawPlugin from "src/main";
import { TldrawPluginMetaData } from "src/utils/document";
import { isObsidianThemeDark } from "src/utils/utils";

export type SetTldrawFileData = (data: {
    meta: TldrawPluginMetaData
    tldrawFile: TldrawFile
}) => void;

export function useTldrawAppEffects({
    editor, bounds, initialTool, isReadonly, settingsProvider, selectNone,
    setFocusedEditor, zoomToBounds
}: {
    editor?: Editor,
    bounds: ReturnType<typeof useViewModeState>['viewOptions']['bounds']
    initialTool?: string,
    isReadonly: boolean,
    settingsProvider: TldrawPlugin['settingsProvider'],
    selectNone: boolean,
    zoomToBounds: boolean,
    setFocusedEditor: (editor: Editor) => void,
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
        setFocusedEditor(editor);

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

        const zoomBounds = bounds ?? editor.getCurrentPageBounds();
        if (zoomToBounds && zoomBounds) {
            editor.zoomToBounds(zoomBounds, {
                // Define an inset to 0 so that it is consistent with TldrawImage component
                inset: 0,
                animation: { duration: 0 }
            });
        }

        // NOTE: These could probably be utilized for storing assets as files in the vault instead of tldraw's default indexedDB.
        // editor.registerExternalAssetHandler
        // editor.registerExternalContentHandler
    }, [editor]);
}
