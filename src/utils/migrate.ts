import { createTLSchema } from "@tldraw/tldraw";
import { TLDRAW_VERSION } from "./constants";
import { TLData, getTLDataTemplate } from "./document";

/** 
 * If someone used version `<=1.0.5` of this plugin, then the save data of the whiteboard
 * is no longer compatible, it will not load. A migration is needed.
 * 
 * Since the only other version of `Tldraw` this plugin used was `2.0.0-alpha.14`, this
 * function checks if the file contains that version and migrates it to be compatible.
 * 
 * #TODO: We will need take into account more migrations between different tldraw versions.
 * 
 * #TODO cont'd: It would be cool if we can figure out a way to do this automatically instead of having to serialize the schema for each version manually.
 * 
 * @param currentPluginVersion 
 * @param tldata 
 * @returns 
 */
export function migrateIfNecessary(currentPluginVersion: string, tldata: TLData): TLData {
    const currAppVersion = TLDRAW_VERSION;
    const currFileVersion = tldata.meta["tldraw-version"];

    if (currFileVersion !== "2.0.0-alpha.14") {
        return tldata;
    }

    console.log(`Tldraw migration:\n\tCurrent file version: ${currFileVersion}\n\tCurrent app version: ${currAppVersion}`);

    const migrationResult = createTLSchema().migrateStoreSnapshot({
        // Obtained from running `tldraw.editor.store.schema.serialize()` in the Obsidian Developer Console with the previous plugin version installed.
        schema: {
            "schemaVersion": 1,
            "storeVersion": 4,
            "recordVersions": {
                "asset": {
                    "version": 1,
                    "subTypeKey": "type",
                    "subTypeVersions": {
                        "image": 2,
                        "video": 2,
                        "bookmark": 0
                    }
                },
                "camera": {
                    "version": 1
                },
                "document": {
                    "version": 2
                },
                "instance": {
                    "version": 17
                },
                "instance_page_state": {
                    "version": 3
                },
                "page": {
                    "version": 1
                },
                "shape": {
                    "version": 3,
                    "subTypeKey": "type",
                    "subTypeVersions": {
                        "group": 0,
                        "embed": 4,
                        "bookmark": 1,
                        "image": 2,
                        "text": 1,
                        "draw": 1,
                        "geo": 6,
                        "line": 0,
                        "note": 4,
                        "frame": 0,
                        "arrow": 1,
                        "highlight": 0,
                        "video": 1
                    }
                },
                "instance_presence": {
                    "version": 4
                },
                "pointer": {
                    "version": 1
                }
            }
        },
        store: tldata.raw
    });

    if (migrationResult.type === 'error') {
        throw Error('Tldraw migration failed.');
    }

    return getTLDataTemplate(currentPluginVersion, migrationResult.value);
}
