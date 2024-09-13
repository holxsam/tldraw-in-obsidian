import { Editor, TldrawFile } from "tldraw";
import * as React from "react";
import { useViewModeState } from "src/hooks/useViewModeController";
import TldrawPlugin from "src/main";
import { TldrawPluginMetaData } from "src/utils/document";
import { isObsidianThemeDark, safeSecondsToMs } from "src/utils/utils";
import { useDebouncedCallback } from "use-debounce";
import { createRawTldrawFile } from "src/utils/tldraw-file";

export type SetTldrawFileData = (data: {
    meta: TldrawPluginMetaData
    tldrawFile: TldrawFile
}) => void;

export function useTldrawAppEffects({
    editor, bounds, initialTool, isReadonly, settingsProvider, selectNone, setFileData, zoomToBounds
}: {
    editor?: Editor,
    bounds: ReturnType<typeof useViewModeState>['viewOptions']['bounds']
    initialTool?: string,
    isReadonly: boolean,
    settingsProvider: TldrawPlugin['settingsProvider'],
    selectNone: boolean,
    zoomToBounds: boolean,
    setFileData?: (tldrawFile: TldrawFile) => void,
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

    const safeSeconds = safeSecondsToMs(settings.saveFileDelay);

    const debouncedSaveDataToFile = useDebouncedCallback((e: unknown) => {
        const { store } = editor ?? {};
        if (!setFileData || !store) return;
        setFileData(createRawTldrawFile(store));
    }, safeSeconds);

    React.useEffect(() => {
        const { store } = editor ?? {};
        if (!store) return;

        const removeListener = store.listen(debouncedSaveDataToFile, {
            scope: "document",
        });

        return () => {
            removeListener();
        }
    }, [debouncedSaveDataToFile, editor]);

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

        // setStoreSnapshot(store.getStoreSnapshot());
    }, [editor]);
}
