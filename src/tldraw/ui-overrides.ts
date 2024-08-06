import { TLUiOverrides } from "@tldraw/tldraw";
import { getSaveFileCopyAction, SAVE_FILE_COPY_ACTION } from "src/utils/file";

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
	actions(editor, actions, { msg, addDialog }) {
		actions[SAVE_FILE_COPY_ACTION] = getSaveFileCopyAction(
			editor,
			msg("document.default-name")
		);

        // actions[OPEN_FILE_ACTION] = importFileAction(editor, addDialog);

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
