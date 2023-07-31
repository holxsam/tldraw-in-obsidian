import { useEffect, useState, useCallback } from "react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	Tldraw,
	createTLStore,
	defaultShapes,
} from "@tldraw/tldraw";
import { TLUiOverrides } from "@tldraw/tldraw";
import { TldrawPluginSettings } from "../obsidian/SettingsTab";
import { useDebouncedCallback } from "use-debounce";
import { isObsidianThemeDark } from "src/utils/utils";

export const uiOverrides: TLUiOverrides = {
	tools(editor, tools) {
		// // this is how you would override the kbd shortcuts
		// tools.draw = {
		// 	...tools.draw,
		// 	kbd: "!q",
		// };
		return tools;
	},
	actions(editor, schema, helpers) {
		// console.log(schema);
		return schema;
	},
	toolbar(_app, toolbar, { tools }) {
		// toolbar.splice(4, 0, toolbarItem(tools.card))
		return toolbar;
	},
	keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools }) {
		// console.log(keyboardShortcutsMenu);
		// const toolsGroup = keyboardShortcutsMenu.find(
		// 	(group) => group.id === 'shortcuts-dialog.tools'
		// ) as TLUiMenuGroup
		// toolsGroup.children.push(menuItem(tools.card))
		return keyboardShortcutsMenu;
	},
};

const TldrawApp = ({
	settings,
	initialData,
	setFileData,
}: {
	settings: TldrawPluginSettings;
	initialData: any;
	setFileData: (data: string) => void;
}) => {
	const [store] = useState(() =>
		createTLStore({
			shapes: defaultShapes,
			initialData,
		})
	);
	

	const debouncedSaveDataToFile = useDebouncedCallback((e: any) => {
		// if you do not use `null, "\t"` as arguments for stringify(),
		// obsidian will lag when you try to open the file in markdown view
		setFileData(JSON.stringify(store.serialize(), null, "\t"));
	}, settings.saveFileDelayInMs);

	useEffect(() => {
		const removeListener = store.listen(debouncedSaveDataToFile, {
			scope: "document",
		});

		return () => {
			removeListener();
		};
	}, [store]);

	return (
		<div id="tldraw-view-root">
			<Tldraw
				overrides={uiOverrides}
				store={store}
				onMount={(editor) => {
					const { themeMode, gridMode, debugMode, snapMode } =
						settings;

					let darkMode = true;
					if (themeMode === "dark") darkMode = true;
					else if (themeMode === "light") darkMode = false;
					else darkMode = isObsidianThemeDark();

					editor.user.updateUserPreferences({
						isDarkMode: darkMode,
						isSnapMode: snapMode,
					});

					editor.updateInstanceState({
						isGridMode: gridMode,
						isDebugMode: debugMode,
					});
				}}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: any,
	updateFileData: (data: any) => void,
	settings: TldrawPluginSettings
) => {
	const root = createRoot(node);

	root.render(
		<React.StrictMode>
			<TldrawApp
				setFileData={updateFileData}
				initialData={initialData}
				settings={settings}
			/>
		</React.StrictMode>
	);

	return root;
};

export default TldrawApp;
