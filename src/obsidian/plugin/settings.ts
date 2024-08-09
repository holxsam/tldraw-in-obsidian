import { TldrawAppProps } from "src/components/TldrawApp";
import { TldrawPluginSettings } from "../TldrawSettingsTab";

type FontOverridesSettings = NonNullable<TldrawPluginSettings['fonts']>['overrides'];

export function processFontOverrides(
    overrides: FontOverridesSettings,
    getResourcePath: (font: string) => string
): TldrawAppProps['options']['defaultFontOverrides'] {
    if (overrides === undefined) return undefined;
    const { draw, monospace, sansSerif, serif } = overrides;

    const processed: NonNullable<FontOverridesSettings> = {};

    if (draw !== undefined) {
        processed.draw = getResourcePath(draw);
    }

    if (monospace !== undefined) {
        processed.monospace = getResourcePath(monospace);
    }

    if (sansSerif !== undefined) {
        processed.sansSerif = getResourcePath(sansSerif);
    }

    if (serif !== undefined) {
        processed.serif = getResourcePath(serif);
    }

    return processed;
}


function addIfDefined<T extends Record<string, unknown>>(object: T, key: keyof T, value: T[keyof T] | undefined) {
    if (value !== undefined) {
        object[key] = value;
    }
}

/**
 * If a value is null or length of 0, then it represents "update to default value".
 */
type FontOverridesSettingsUpdate = {
    [k in keyof NonNullable<FontOverridesSettings>]: NonNullable<FontOverridesSettings>[k] | null
}

function getFontOverrideOrUndefinedForDefault(
    font: keyof NonNullable<FontOverridesSettings>,
    original: FontOverridesSettings,
    updates: FontOverridesSettingsUpdate,
) {
    return updates[font] === null
        ? undefined
        : updates[font] ?? original?.[font];
}

export function updateFontOverrides(
    original: FontOverridesSettings,
    updates: FontOverridesSettingsUpdate
): FontOverridesSettings {
    const object: NonNullable<FontOverridesSettings> = {};
    addIfDefined(object,
        'draw', getFontOverrideOrUndefinedForDefault('draw', original, updates),
    )
    addIfDefined(object,
        'sansSerif', getFontOverrideOrUndefinedForDefault('sansSerif', original, updates),
    )
    addIfDefined(object,
        'serif', getFontOverrideOrUndefinedForDefault('serif', original, updates),
    )
    addIfDefined(object,
        'monospace', getFontOverrideOrUndefinedForDefault('monospace', original, updates),
    )
    return object;
}
