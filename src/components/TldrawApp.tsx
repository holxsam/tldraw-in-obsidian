import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
	DefaultMainMenu,
	DefaultMainMenuContent,
	TLComponents,
	Tldraw,
	TldrawProps,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	createTLStore,
	defaultShapeUtils,
	useActions,
} from "@tldraw/tldraw";
import { TLUiOverrides } from "@tldraw/tldraw";
import { SerializedStore } from "@tldraw/store";
import { TLRecord } from "@tldraw/tldraw";
import { TldrawPluginSettings } from "../obsidian/TldrawSettingsTab";
import { useDebouncedCallback } from "use-debounce";
import { getSaveFileCopyAction, SAVE_FILE_COPY_ACTION } from "src/utils/file";
import { isObsidianThemeDark, safeSecondsToMs } from "src/utils/utils";

export const uiOverrides: TLUiOverrides = {
	tools(editor, tools, helpers) {
		// console.log(tools);
		// // this is how you would override the kbd shortcuts
		// tools.draw = {
		// 	...tools.draw,
		// 	kbd: "!q",
		// };
		return tools;
	},
	actions(editor, actions, { msg }) {
		actions[SAVE_FILE_COPY_ACTION] = getSaveFileCopyAction(
			editor,
			msg("document.default-name")
		);

		return actions;
	},
	// toolbar(editor, toolbar, { tools }) {
	// 	// console.log(toolbar);
	// 	// toolbar.splice(4, 0, toolbarItem(tools.card))
	// 	return toolbar;
	// },
	// keyboardShortcutsMenu(editor, keyboardShortcutsMenu, { tools }) {
	// 	// console.log(keyboardShortcutsMenu);
	// 	// const toolsGroup = keyboardShortcutsMenu.find(
	// 	// 	(group) => group.id === 'shortcuts-dialog.tools'
	// 	// ) as TLUiMenuGroup
	// 	// toolsGroup.children.push(menuItem(tools.card))
	// 	return keyboardShortcutsMenu;
	// },
	// contextMenu(editor, schema, helpers) {
	// 	// console.log({ schema });
	// 	// console.log(JSON.stringify(schema[0]));
	// 	return schema;
	// },
};

type TldrawAppOptions = {
	isReadonly?: boolean,
	autoFocus?: boolean,
	/**
	 * Whether or not to initially zoom to the bounds of the document when the component is mounted.
	 */
	zoomToBounds?: boolean,
	defaultFontOverrides?: NonNullable<TldrawProps['assetUrls']>['fonts']
};

export type TldrawAppProps = {
	settings: TldrawPluginSettings;
	initialData: SerializedStore<TLRecord>;
	setFileData: (data: SerializedStore<TLRecord>) => void;
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
		</TldrawUiMenuSubmenu>
	);
}

const TldrawApp = ({ settings, initialData, setFileData, options: {
	autoFocus = true,
	isReadonly = false,
	zoomToBounds = false,
	defaultFontOverrides
} }: TldrawAppProps) => {
	const saveDelayInMs = safeSecondsToMs(settings.saveFileDelay);

	const [store] = useState(() => createTLStore({
		shapeUtils: defaultShapeUtils,
		initialData,
	})
	);

	const debouncedSaveDataToFile = useDebouncedCallback((e: any) => {
		setFileData(store.serialize());
	}, saveDelayInMs);

	useEffect(() => {
		const removeListener = store.listen(debouncedSaveDataToFile, {
			scope: "document",
		});

		return () => {
			removeListener();
		};
	}, [store]);

	return (
		<div
			id="tldraw-view-root"
			// e.stopPropagation(); this line should solve the mobile swipe menus bug
			// The bug only happens on the mobile version of Obsidian.
			// When a user tries to interact with the tldraw canvas,
			// Obsidian thinks they're swiping down, left, or right so it opens various menus.
			// By preventing the event from propagating, we can prevent those actions menus from opening.
			onTouchStart={(e) => e.stopPropagation()}
		>
			<Tldraw
				assetUrls={{
					fonts: defaultFontOverrides
				}}
				overrides={uiOverrides}
				store={store}
				components={components}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={autoFocus}
				onMount={(editor) => {
					const {
						themeMode,
						gridMode,
						debugMode,
						snapMode,
						focusMode,
						toolSelected,
					} = settings;

					// NOTE: The API broke when updating Tldraw version and I don't know what to replace it with.
					// editor.focus();
					editor.setCurrentTool(toolSelected)

					let darkMode = true;
					if (themeMode === "dark") darkMode = true;
					else if (themeMode === "light") darkMode = false;
					else darkMode = isObsidianThemeDark();

					editor.user.updateUserPreferences({
						isDarkMode: darkMode,
						isSnapMode: snapMode,
					});

					editor.updateInstanceState({
						isReadonly: isReadonly,
						isGridMode: gridMode,
						isDebugMode: debugMode,
						isFocusMode: focusMode,
					});

					if (zoomToBounds) {
						editor.zoomToBounds(editor.getCurrentPageBounds()!, { duration: 0 });
					}
				}}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: SerializedStore<TLRecord>,
	setFileData: (data: SerializedStore<TLRecord>) => void,
	settings: TldrawPluginSettings,
	options: TldrawAppOptions = {}
) => {
	const root = createRoot(node);

	root.render(
		<TldrawApp
			setFileData={setFileData}
			initialData={initialData}
			settings={settings}
			options={options}
		/>
	);

	return root;
};

export default TldrawApp;
