import { JsonObject, SerializedStore, TldrawFile, TLRecord, TLStore } from "tldraw";
import {
	TLDATA_DELIMITER_END,
	TLDATA_DELIMITER_START,
	TLDRAW_VERSION,
} from "./constants";
import { tldrawFileToJson } from "./tldraw-file/tldraw-file-to-json";

export type TldrawPluginMetaData = {
	"plugin-version": string;
	"tldraw-version": string;
	/**
	 * Should be different for each drawing in the vault.
	 */
	uuid: string;
};

export type TldrawDocumentOverrides = {
	isDarkMode: boolean
};

export type TLDataMaybeSerializedStore<T = unknown> = T & ({
	raw: SerializedStore<TLRecord>;
	store?: undefined
} | {
	store: TLStore,
	raw?: undefined
});

export type TLExistingDataDocument = TLDataMaybeSerializedStore<{
	meta: TldrawPluginMetaData;
}>;

export type TLDataDocument = TLExistingDataDocument | {
	meta: TldrawPluginMetaData;
	store?: undefined
	raw?: undefined
};

export type TLData = {
	meta: TldrawPluginMetaData;
	raw: JsonObject;
};

export const getTLMetaTemplate = (
	pluginVersion: string,
	uuid: string = window.crypto.randomUUID(),
) => ({
	uuid,
	"plugin-version": pluginVersion,
	"tldraw-version": TLDRAW_VERSION,
});

export const getTLDataTemplate = (
	pluginVersion: string,
	tldrawFile: TldrawFile,
	uuid: string,
): TLData => ({
	meta: getTLMetaTemplate(pluginVersion, uuid),
	raw: tldrawFileToJson(tldrawFile),
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
