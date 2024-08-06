import { TLDRAW_VERSION } from "./constants";
import { getTLMetaTemplate, TLData, TLExistingDataDocument, TLDataMaybeSerializedStore } from "./document";
import { tLDataToTLStore } from "./migrate/tl-data-to-tlstore";
import { migrationOld } from "./migrate/old";

/**
 * Handles migration of {@linkcode TLData} between different plugin versions.
 * @param currentPluginVersion 
 * @param tldata 
 * @returns 
 */
export function migrateIfNecessary(currentPluginVersion: string, tldata: TLData): TLExistingDataDocument {
    const currAppVersion = TLDRAW_VERSION;
    const currFileVersion = tldata.meta["tldraw-version"];

    let tldataRes: undefined | TLDataMaybeSerializedStore;

    if (currFileVersion !== "2.0.0-alpha.14") {
        tldataRes = {
            store: tLDataToTLStore(tldata)
        };
    } else {
        console.log(`Tldraw migration:\n\tCurrent file version: ${currFileVersion}\n\tCurrent app version: ${currAppVersion}`);
        tldataRes = {
            raw: migrationOld(tldata.raw)
        };
    }

    
    return {
        ...tldataRes,
        meta: getTLMetaTemplate(currentPluginVersion, tldata.meta.uuid),
    };
}
