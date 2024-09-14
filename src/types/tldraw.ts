import { TldrawProps } from "tldraw";
import { iconTypes } from "src/obsidian/settings/constants";

export type IconTypes = typeof iconTypes[number] | string & NonNullable<unknown>;
export type FontOverrides = NonNullable<TldrawProps['assetUrls']>['fonts'];
export type IconOverrides = Partial<Record<IconTypes, string>>;
