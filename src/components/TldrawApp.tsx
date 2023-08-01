import { useEffect, useState, useCallback } from "react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	TLUiCustomMenuItem,
	Tldraw,
	createTLStore,
	defaultShapes,
} from "@tldraw/tldraw";
import { TLUiOverrides } from "@tldraw/tldraw";
import { SerializedStore } from "@tldraw/store";
import { TLRecord } from "@tldraw/tldraw";

import { TldrawPluginSettings } from "../obsidian/SettingsTab";
import { useDebouncedCallback } from "use-debounce";
import { isObsidianThemeDark, safeSecondsToMs } from "src/utils/utils";

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
	contextMenu(editor, schema, helpers) {
		// console.log({ schema });
		// console.log(JSON.stringify(schema[0]));
		return schema;
	},
};

export type TldrawAppProps = {
	settings: TldrawPluginSettings;
	initialData: SerializedStore<TLRecord>;
	setFileData: (data: SerializedStore<TLRecord>) => void;
};

const TldrawApp = ({ settings, initialData, setFileData }: TldrawAppProps) => {
	const saveDelayInMs = safeSecondsToMs(settings.saveFileDelay);

	const [store] = useState(() =>
		createTLStore({
			shapes: defaultShapes,
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
		<div id="tldraw-view-root">
			<Tldraw
				overrides={uiOverrides}
				store={store}
				onMount={(editor) => {
					const {
						themeMode,
						gridMode,
						debugMode,
						snapMode,
						focusMode,
						toolSelected,
					} = settings;

					editor.focus();
					editor.setSelectedTool(toolSelected);

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
						isFocusMode: focusMode,
					});
				}}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: SerializedStore<TLRecord>,
	setFileData: (data: SerializedStore<TLRecord>) => void,
	settings: TldrawPluginSettings
) => {
	const root = createRoot(node);

	root.render(
		<React.StrictMode>
			<TldrawApp
				setFileData={setFileData}
				initialData={initialData}
				settings={settings}
			/>
		</React.StrictMode>
	);

	return root;
};

export default TldrawApp;
