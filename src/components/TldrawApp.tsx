import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Tldraw, createTLStore, defaultShapeUtils } from "@tldraw/tldraw";
import { TLUiOverrides } from "@tldraw/tldraw";
import { SerializedStore } from "@tldraw/store";
import { TLRecord } from "@tldraw/tldraw";
import { TldrawPluginSettings } from "../obsidian/TldrawSettingsTab";
import { useDebouncedCallback } from "use-debounce";
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
	actions(editor, schema, helpers) {
		// console.log(schema);
		return schema;
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

export type TldrawAppProps = {
	settings: TldrawPluginSettings;
	initialData: SerializedStore<TLRecord>;
	setFileData: (data: SerializedStore<TLRecord>) => void;
	isReadonly?: boolean,
};

const TldrawApp = ({ settings, initialData, setFileData, isReadonly }: TldrawAppProps) => {
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
						isReadonly: isReadonly ?? false,
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
	settings: TldrawPluginSettings,
	options?: {
		isReadonly?: true
	}
) => {
	const root = createRoot(node);

	root.render(
		<TldrawApp
			setFileData={setFileData}
			initialData={initialData}
			settings={settings}
			isReadonly={options?.isReadonly}
		/>
	);

	return root;
};

export default TldrawApp;
