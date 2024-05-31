import { TLDATA_DELIMITER_END, TLDATA_DELIMITER_START } from "./constants";
import { TLData, getTLDataTemplate } from "./document";
import { migrateIfNecessary } from "./migrate";
import { extractDataBetweenKeywords } from "./utils";

/**
 * Extracts and parses a file for Tldraw data.
 * 
 * @param fileData The file's raw data containing the Tldraw data.
 * @returns 
 */
export function parseTLData(pluginVersion: string, fileData: string): TLData {
    const extracted = extractDataBetweenKeywords(
        fileData,
        TLDATA_DELIMITER_START,
        TLDATA_DELIMITER_END
    );

    return extracted
        ? migrateIfNecessary(pluginVersion, JSON.parse(extracted))
        : getTLDataTemplate(pluginVersion, {});
}
