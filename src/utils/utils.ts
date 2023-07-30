import {
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
