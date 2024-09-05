import { Editor, TLStore } from "@tldraw/tldraw";
import * as React from "react";
import { useViewModeState } from "src/hooks/useViewModeController";
import TldrawPlugin from "src/main";
import { TldrawPluginMetaData } from "src/utils/document";
import { isObsidianThemeDark } from "src/utils/utils";
import { DebouncedState } from "use-debounce";

export function useTldrawAppHook({
    debouncedSaveDataToFile, editorRef, initialTool, isReadonly, plugin, selectNone, storeMetaRef, viewMode, zoomToBounds
}: {
    editorRef: ReturnType<typeof React.useRef<Editor | null>>,
    storeMetaRef: ReturnType<typeof React.useRef<{
		meta: TldrawPluginMetaData,
		store: TLStore,
	}>>,
    debouncedSaveDataToFile: DebouncedState<(e: unknown) => void>,
    initialTool?: string,
    isReadonly: boolean,
    plugin: TldrawPlugin,
    selectNone: boolean,
    viewMode: Parameters<typeof useViewModeState>[1],
    zoomToBounds: boolean,
}) {
    const viewModeState = useViewModeState(editorRef, viewMode);
    const storeListenerDisposer = React.useRef<undefined | (() => void)>(undefined)

    const onMount = React.useCallback((editor: Editor) => {
        const { store } = editor;
        if(storeMetaRef.current) {
            storeMetaRef.current.store = store;
        }
        storeListenerDisposer.current?.();
        storeListenerDisposer.current = store.listen(debouncedSaveDataToFile, {
			scope: "document",
		});

        editorRef.current = editor;
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
        } = plugin.settings;

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

        const zoomBounds = viewModeState.bounds ?? editor.getCurrentPageBounds();
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
    }, [viewModeState]);

    return {
        onMount,
        viewModeState
    };
}