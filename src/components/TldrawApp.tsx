import { useEffect, useState, useCallback } from "react";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	Tldraw,
	createTLStore,
	defaultShapes,
	useTLStore,
} from "@tldraw/tldraw";
import { TLUiOverrides } from "@tldraw/tldraw";
import { TldrawPluginSettings } from "../obsidian/SettingsTab";
import { useDebouncedCallback } from "use-debounce";

export const uiOverrides: TLUiOverrides = {
	tools(editor, tools) {
		tools.draw = {
			...tools.draw,
			kbd: "!q",
		};
		return tools;
	},
	actions(editor, schema, helpers) {
		// console.log(schema);

		return schema;
	},
	// toolbar(_app, toolbar, { tools }) {
	// 	toolbar.splice(4, 0, toolbarItem(tools.card))
	// 	return toolbar
	// },
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
	settings?: TldrawPluginSettings;
	initialData: any;
	setFileData: (data: string) => void;
}) => {
	const [store] = useState(() =>
		createTLStore({
			shapes: defaultShapes,
			initialData,
		})
	);

	const debouncedSaveDataToFile = useDebouncedCallback(() => {
		// if you do not use `null, "\t"` as arguments for stringify(),
		// obsidian will lag when you try to open the file in markdown view
		setFileData(JSON.stringify(store.serialize(), null, "\t"));
	}, 1000);

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
			<Tldraw overrides={uiOverrides} store={store} />
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: any,
	updateFileData: (data: any) => void
) => {
	const root = createRoot(node);

	root.render(
		<React.StrictMode>
			<TldrawApp setFileData={updateFileData} initialData={initialData} />
		</React.StrictMode>
	);

	return root;
};

export default TldrawApp;
