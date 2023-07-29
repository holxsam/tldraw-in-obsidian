import * as React from "react";
import { createRoot } from "react-dom/client";
import { Tldraw } from "@tldraw/tldraw";
import {
	TLUiMenuGroup,
	TLUiOverrides,
	menuItem,
	toolbarItem,
} from "@tldraw/tldraw";
import { TldrawPluginSettings } from "../obsidian/SettingsTab";

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

const TldrawApp = ({ settings }: { settings?: TldrawPluginSettings }) => {
	return (
		<div id="tldraw-view-root">
			<Tldraw overrides={uiOverrides} />
			{/* <pre>{JSON.stringify(settings, null, 2)}</pre> */}
		</div>
	);
};

export const createRootAndRenderTldrawApp = (node: Element) => {
	const root = createRoot(node);

	root.render(
		<React.StrictMode>
			<TldrawApp />
		</React.StrictMode>
	);

	return root;
};

export default TldrawApp;
