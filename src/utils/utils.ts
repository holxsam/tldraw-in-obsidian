import {
	Notice,
	TAbstractFile,
	TFile,
	TFolder,
	Vault,
	normalizePath,
} from "obsidian";
import {
	FILE_EXTENSION,
	TLDRAW_DATA_DELIMITER_END,
	TLDRAW_DATA_DELIMITER_START,
} from "./constants";

export const frontmatterTemplate = (data: string) => {
	let str = "";
	str += "---\n";
	str += "\n";
	str += `${data}\n`;
	str += "tags: [tldraw]\n";
	str += "\n";
	str += "---\n";
	return str;
};

export const tldrawDataTemplate = (data: any) => {
	let str = "";
	str += "```json" + ` ${TLDRAW_DATA_DELIMITER_START}`;
	str += "\n";
	str += `${JSON.stringify(data)}\n`;
	str += `${TLDRAW_DATA_DELIMITER_END} ` + "```";
	return str;
};

export const tldrawMarkdownTemplate = (
	frontmatter: string,
	tldrawData: string
) => {
	let str = "";
	str += frontmatter;
	str += "\n";
	str += tldrawData;
	return str;
};

export const removeAllChildNodes = (parent: HTMLElement) => {
	while (parent.firstChild) {
		parent.removeChild(parent.firstChild);
	}
};

export const extractDataBetweenKeywords = (
	input: string,
	keyword1: string,
	keyword2: string
) => {
	const pattern = new RegExp(`${keyword1}(.*?)${keyword2}`, "s");
	const match = input.match(pattern);
	return match ? match[1] : null;
};

export const replaceBetweenKeywords = (
	input: string,
	keyword1: string,
	keyword2: string,
	replacement: string
) => {
	const regex = new RegExp(`${keyword1}[\\s\\S]*?${keyword2}`, "g");
	return input.replace(regex, `${keyword1}\n${replacement}\n${keyword2}`);
};

/**
 * Open or create a folderpath if it does not exist
 * @param folderpath
 */
export async function checkAndCreateFolder(folderpath: string, vault: Vault) {
	folderpath = normalizePath(folderpath);
	//@ts-ignore
	const folder = vault.getAbstractFileByPathInsensitive(folderpath);
	if (folder && folder instanceof TFolder) {
		return;
	}
	if (folder && folder instanceof TFile) {
		new Notice(
			`The folder cannot be created because it already exists as a file: ${folderpath}.`
		);
	}
	await vault.createFolder(folderpath);
}

/**
 * Create new file, if file already exists find first unique filename by adding a number to the end of the filename
 * @param filename
 * @param folderpath
 * @returns
 */
export function getNewUniqueFilepath(
	vault: Vault,
	filename: string,
	folderpath: string
): string {
	let fname = normalizePath(`${folderpath}/${filename}`);
	let file: TAbstractFile | null = vault.getAbstractFileByPath(fname);
	let i = 0;

	const extension = filename.endsWith(FILE_EXTENSION)
		? FILE_EXTENSION
		: filename.slice(filename.lastIndexOf("."));
	while (file) {
		fname = normalizePath(
			`${folderpath}/${filename.slice(
				0,
				filename.lastIndexOf(extension)
			)} (${i})${extension}`
		);
		i++;
		file = vault.getAbstractFileByPath(fname);
	}
	return fname;
}
