import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	TLComponents,
	TLStore,
	Tldraw,
	TldrawFile,
	TldrawProps,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	createTLStore,
	defaultShapeUtils,
	useActions,
} from "@tldraw/tldraw";
import { useDebouncedCallback } from "use-debounce";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION } from "src/utils/file";
import { isObsidianThemeDark, safeSecondsToMs } from "src/utils/utils";
import { uiOverrides } from "src/tldraw/ui-overrides";
import { TLDataDocument, TldrawPluginMetaData } from "src/utils/document";
import { createRawTldrawFile } from "src/utils/tldraw-file";
import TldrawPlugin from "src/main";

type TldrawAppOptions = {
	isReadonly?: boolean,
	autoFocus?: boolean,
	inputFocus?: boolean,
	hideUi?: boolean,
	/**
	 * Whether to call `.selectNone` on the Tldraw editor instance when it is mounted.
	 */
	selectNone?: boolean,
	/**
	 * Whether or not to initially zoom to the bounds of the document when the component is mounted.
	 */
	zoomToBounds?: boolean,
	defaultFontOverrides?: NonNullable<TldrawProps['assetUrls']>['fonts']
};

export type SetTldrawFileData = (data: {
	meta: TldrawPluginMetaData
	tldrawFile: TldrawFile
}) => void;

export type TldrawAppProps = {
	plugin: TldrawPlugin;
	initialData: TLDataDocument;
	setFileData: SetTldrawFileData;
	options: TldrawAppOptions
};

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/apps/examples/src/examples/custom-main-menu/CustomMainMenuExample.tsx
const components: TLComponents = {
	MainMenu: () => (
		<DefaultMainMenu>
			<LocalFileMenu />
			<DefaultMainMenuContent />
		</DefaultMainMenu>
	),
};

function LocalFileMenu() {
	const actions = useActions();

	return (
		<TldrawUiMenuSubmenu id="file" label="menu.file">
			<TldrawUiMenuItem {...actions[SAVE_FILE_COPY_ACTION]} />
			<TldrawUiMenuItem {...actions[OPEN_FILE_ACTION]} />
		</TldrawUiMenuSubmenu>
	);
}

const TldrawApp = ({ plugin, initialData, setFileData, options: {
	autoFocus = true,
	hideUi = false,
	inputFocus = false,
	isReadonly = false,
	selectNone = false,
	zoomToBounds = false,
	defaultFontOverrides
} }: TldrawAppProps) => {
	const saveDelayInMs = safeSecondsToMs(plugin.settings.saveFileDelay);

	const [{ meta, store },
		/**
		 * #NOTE: Could be used to reuse the same tldraw instance while changing the document over to a new one.
		 */
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		setMetaStore
	] = useState<{
		meta: TldrawPluginMetaData,
		store: TLStore,
	}>(() => {
		if (initialData.store) {
			return initialData;
		}

		return {
			meta: initialData.meta,
			store: createTLStore({
				shapeUtils: defaultShapeUtils,
				initialData: initialData.raw,
			})
		}
	});

	const debouncedSaveDataToFile = useDebouncedCallback((e: unknown) => {
		setFileData({
			meta,
			tldrawFile: createRawTldrawFile(store)
		});
	}, saveDelayInMs);

	useEffect(() => {
		const removeListener = store.listen(debouncedSaveDataToFile, {
			scope: "document",
		});

		return () => {
			removeListener();
		};
	}, [store]);

	const editorRef = React.useRef<Editor | null>(null);
	return (
		<div
			className="tldraw-view-root"
			// e.stopPropagation(); this line should solve the mobile swipe menus bug
			// The bug only happens on the mobile version of Obsidian.
			// When a user tries to interact with the tldraw canvas,
			// Obsidian thinks they're swiping down, left, or right so it opens various menus.
			// By preventing the event from propagating, we can prevent those actions menus from opening.
			onTouchStart={(e) => e.stopPropagation()}
			onBlur={!inputFocus ?  undefined : () => {
				editorRef.current?.selectNone()
				editorRef.current?.blur()
			}}
			onFocus={!inputFocus ? undefined : () => editorRef.current?.focus()}
		>
			<Tldraw
				assetUrls={{
					fonts: defaultFontOverrides
				}}
				hideUi={hideUi}
				overrides={uiOverrides(plugin)}
				store={store}
				components={components}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={autoFocus}
				onMount={(editor) => {
					editorRef.current = editor;
					if(selectNone) {
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

					// NOTE: The API broke when updating Tldraw version and I don't know what to replace it with.
					// editor.focus();
					editor.setCurrentTool(toolSelected)

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

					const bounds = editor.getCurrentPageBounds();
					if (zoomToBounds && bounds) {
						editor.zoomToBounds(bounds, { animation: { duration: 0 } });
					}
				}}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: TLDataDocument,
	setFileData: SetTldrawFileData,
	plugin: TldrawPlugin,
	options: TldrawAppOptions = {}
) => {
	const root = createRoot(node);

	root.render(
		<TldrawApp
			setFileData={setFileData}
			initialData={initialData}
			plugin={plugin}
			options={options}
		/>
	);

	return root;
};

export default TldrawApp;
