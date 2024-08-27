import {
	TLUiActionItem,
	TLDRAW_FILE_EXTENSION,
	serializeTldrawJsonBlob,
	Editor,
	useDefaultHelpers,
} from "@tldraw/tldraw";
import TldrawPlugin from "src/main";
import { migrateTldrawFileDataIfNecessary } from "./migrate/tl-data-to-tlstore";
import { TFile } from "obsidian";
// import { shouldOverrideDocument } from "src/components/file-menu/shouldOverrideDocument";

export const SAVE_FILE_COPY_ACTION = "save-file-copy";
export const OPEN_FILE_ACTION = 'open-file';

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/packages/tldraw/src/lib/utils/export/exportAs.ts#L57
export const downloadFile = (file: File) => {
	const link = document.createElement("a");
	const url = URL.createObjectURL(file);
	link.href = url;
	link.download = file.name;
	link.click();
	URL.revokeObjectURL(url);
};

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/apps/dotcom/src/utils/useFileSystem.tsx#L111
export function getSaveFileCopyAction(
	editor: Editor,
	defaultDocumentName: string
): TLUiActionItem {
	return {
		id: SAVE_FILE_COPY_ACTION,
		label: "action.save-copy",
		readonlyOk: true,
		async onSelect() {
			const defaultName = `${defaultDocumentName}${TLDRAW_FILE_EXTENSION}`;

			const blobToSave = await serializeTldrawJsonBlob(editor);

			try {
				const file = new File([blobToSave], defaultName, {
					type: blobToSave.type,
				});
				downloadFile(file);
			} catch (e) {
				// user cancelled
				return;
			}
		},
	};
}

export function importFileAction(plugin: TldrawPlugin,
	addDialog: ReturnType<typeof useDefaultHelpers>['addDialog']
): TLUiActionItem {
	return {
		id: OPEN_FILE_ACTION,
		label: "action.open-file",
		readonlyOk: true,
		async onSelect(source) {
			// const shouldOverwrite = await shouldOverrideDocument(addDialog);
			// if (!shouldOverwrite) return;
			const tFile = await importTldrawFile(plugin);
			await plugin.openTldrFile(tFile, 'new-tab');

			// await parseAndLoadDocument(editor, await file.text(), msg, addToast)
		},
	};
}

export async function importTldrawFile(plugin: TldrawPlugin, attachTo?: TFile) {
	if ('showOpenFilePicker' in window) {
		const [file] = await window.showOpenFilePicker({
			id: 'tldraw-open-file',
			startIn: 'downloads',
			types: [
				{
					description: 'Tldraw Document',
					accept: {
						'text/tldr': ['.tldr']
					}
				}
			],
			excludeAcceptAllOption: true,
		});

		return plugin.createUntitledTldrFile({
			attachTo,
			tlStore: migrateTldrawFileDataIfNecessary(await (
				await file.getFile()
			).text())
		})
	} else {
		throw new Error('Unable to open file picker.');
	}
}
