import { TLUiOverrides } from "@tldraw/tldraw";
import { Platform } from "obsidian";
import TldrawPlugin from "src/main";
import { getSaveFileCopyAction, getSaveFileCopyInVaultAction, importFileAction, OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";

export function uiOverrides(plugin: TldrawPlugin): TLUiOverrides {
	return {
		tools(editor, tools, helpers) {
			// console.log(tools);
			// // this is how you would override the kbd shortcuts
			// tools.draw = {
			// 	...tools.draw,
			// 	kbd: "!q",
			// };
			return tools;
		},
		actions: (editor, actions, { msg, addDialog }) => {
			const defaultDocumentName = msg("document.default-name");

			if (!Platform.isMobile) {
				actions[SAVE_FILE_COPY_ACTION] = getSaveFileCopyAction(
					editor,
					defaultDocumentName
				);
			}

			actions[SAVE_FILE_COPY_IN_VAULT_ACTION] = getSaveFileCopyInVaultAction(
				editor,
				defaultDocumentName,
				plugin
			);

			actions[OPEN_FILE_ACTION] = importFileAction(plugin, addDialog);
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
	}
}
