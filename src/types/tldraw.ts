import { TldrawProps } from "tldraw";
import { defaultFonts, iconTypes } from "src/obsidian/settings/constants";

export type FontTypes = keyof typeof defaultFonts;
export type IconNames = typeof iconTypes[number];
export type FontOverrides = NonNullable<TldrawProps['assetUrls']>['fonts'];
export type IconOverrides = Partial<Record<IconNames, string>>;
