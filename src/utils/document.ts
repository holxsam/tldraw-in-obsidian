import { SerializedStore } from "@tldraw/store";
import { TLRecord } from "@tldraw/tldraw";
import {
	TLDATA_DELIMITER_END,
	TLDATA_DELIMITER_START,
	TLDRAW_VERSION,
} from "./constants";

export type TldrawPluginMetaData = {
	"plugin-version": string;
	"tldraw-version": string;
};

export type TLData = {
	meta: TldrawPluginMetaData;
	raw: SerializedStore<TLRecord>;
};

export const getTLDataTemplate = (
	pluginVersion: string,
	rawData: SerializedStore<TLRecord>
): TLData => ({
	meta: {
		"plugin-version": pluginVersion,
		"tldraw-version": TLDRAW_VERSION,
	},
	raw: rawData,
});

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

export const codeBlockTemplate = (data: TLData) => {
	let str = "";
	str += "```json" + ` ${TLDATA_DELIMITER_START}`;
	str += "\n";
	str += `${JSON.stringify(data, null, "\t")}\n`;
	str += `${TLDATA_DELIMITER_END} ` + "```";
	return str;
};

export const tlFileTemplate = (frontmatter: string, codeblock: string) => {
	let str = "";
	str += frontmatter;
	str += "\n\n";
	str += codeblock;
	return str;
};
