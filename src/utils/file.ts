import {
	TLUiActionItem,
	TLDRAW_FILE_EXTENSION,
	serializeTldrawJsonBlob,
	Editor,
} from "@tldraw/tldraw";

export const SAVE_FILE_COPY_ACTION = "save-file-copy";

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

			const blobToSave = await serializeTldrawJsonBlob(editor.store);

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
