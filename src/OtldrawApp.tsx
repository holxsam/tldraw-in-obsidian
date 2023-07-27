import * as React from "react";
import { Tldraw } from "@tldraw/tldraw";
import {
	TLUiMenuGroup,
	TLUiOverrides,
	menuItem,
	toolbarItem,
} from "@tldraw/tldraw";
import { TldrawPluginSettings } from "./settings";

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

export const OtldrawApp = ({
	settings,
}: {
	settings?: TldrawPluginSettings;
}) => {
	return (
		<div id="tldraw-view-root">
			<Tldraw overrides={uiOverrides} />
			{/* <pre>{JSON.stringify(settings, null, 2)}</pre> */}
		</div>
	);
};
