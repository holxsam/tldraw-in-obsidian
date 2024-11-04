import { MetadataCache, TFile } from "obsidian";

export function getFrontMatterList(metadataCache: MetadataCache, tFile: TFile, key: string) {
    const frontMatter = metadataCache.getFileCache(tFile)?.frontmatter;
    if(!frontMatter) return undefined;
    return !Array.isArray(frontMatter[key]) ? undefined : frontMatter[key];
}
