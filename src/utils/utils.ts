import { TLDRAW_DATA_DELIMITER } from "./constants";

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

export const tldrawDataTemplate = (data: string) => {
	let str = "";
	str += `\`\`\`json ${TLDRAW_DATA_DELIMITER}`;
	str += "\n";
	str += `${data}\n`;
	str += "```";
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
