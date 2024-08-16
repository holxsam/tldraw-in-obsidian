import { normalizePath, SuggestModal, TFile, TFolder } from "obsidian";
import TldrawPlugin from "src/main";

const fontTypes = [
    'otf',
    'ttf',
    'woff',
    'woff2'
] as const;

export class FontSearchModal extends SuggestModal<TFile | TFolder> {
    plugin: TldrawPlugin;

    readonly initialValue?: string;
    private readonly setFont: (font: string) => void;

    /**
     * This function is present at runtime in the web developer console in Obsidian, but not in the type definition for some reason.
     */
    declare updateSuggestions: () => void;

    private searchRes: {
        searchPath: string,
        results: (TFolder | TFile)[],
    } = {
            searchPath: '',
            results: [],
        };

    private searchResolver?: (res: typeof this.searchRes) => void;

    constructor(plugin: TldrawPlugin, options: {
        initialValue?: string,
        setFont: (fontPath: string) => void
    }) {
        super(plugin.app);
        this.plugin = plugin;
        this.setFont = options.setFont;
        this.initialValue = options.initialValue;
    }

    onOpen(): void {
        super.onOpen();

        if (this.initialValue) {
            this.changeInputValue(this.initialValue)
        }
    }

    /**
     * Search a path for font assets
     */
    searchPath = debounce((searchPath: string, res: (result: typeof this.searchRes) => void) => {
        const searchPathDir = getDir(searchPath);
        const searchDir = searchPathDir.length === 0
            ? '/' : searchPathDir;
        const dir = this.app.vault.getAbstractFileByPath(searchDir);

        if (searchPath.endsWith('/')) {
            const dir = this.app.vault.getAbstractFileByPath(searchPath.slice(0, searchPath.length - 1));
            if (!(dir instanceof TFolder)) {
                return res({ searchPath, results: [], })
            }
            return res({
                searchPath,
                results: filterSearchPath(dir, searchPath)
            })
        }
        res({
            searchPath,
            results: !(dir instanceof TFolder)
                ? []
                : filterSearchPath(dir, searchPath),
        });
    }, 100);

    async changeInputValue(value: string) {
        this.inputEl.value = value;
        this.updateSuggestions();
    }

    getSuggestions(query: string): Promise<(TFile | TFolder)[]> {
        const lastResolver = this.searchResolver;
        return new Promise<(TFile | TFolder)[]>((res) => {
            const resolver: typeof this.searchResolver = (r) => {
                this.searchResolver = undefined;
                this.searchRes = r;
                return res(r.results);
            }

            this.searchResolver = resolver;
            if (lastResolver) {
                lastResolver(this.searchRes);
            }
            this.searchPath(query, resolver);
        });
    }

    renderSuggestion(file: TFile | TFolder, el: HTMLElement) {
        const { searchPath } = this.searchRes;
        const parsedSearchDir = getDir(searchPath);
        const searchDir = parsedSearchDir.length === 0
            ? searchPath : parsedSearchDir;
        const text = searchPath.length === 0
            ? `${file.path}${file instanceof TFolder ? '/' : ''}`
            : `...${file.path.substring(searchDir.length)}${file instanceof TFolder ? '/' : ''}`;
        el.createEl("div", { text });
    }

    onChooseSuggestion(value: TFile | TFolder, evt: MouseEvent | KeyboardEvent) {
        this.setFont(value.path);
        this.close();
    }

    selectSuggestion(value: TFile | TFolder, evt: MouseEvent | KeyboardEvent): void {
        if (value instanceof TFile) {
            this.onChooseSuggestion(value, evt);
            return;
        }

        this.changeInputValue(`${value.path}/`);
    }

    onNoSuggestion(): void {
        this.emptyStateText = `No folders or fonts at "${this.searchRes.searchPath}".`;
        return super.onNoSuggestion();
    }
}

function filterSearchPath(tFolder: TFolder, searchPath: string) {
    return tFolder.children.map((e) => (
        !(e instanceof TFolder) && !(e instanceof TFile)
            ? undefined
            : e instanceof TFolder ? e : (
                fontTypes as readonly string[]
            ).includes(e.extension) ? e : undefined
    )).filter((e) => e !== undefined)
        .filter((e) => e.path.startsWith(searchPath));
}

function debounce<T extends [unknown, ...unknown[]]>(/** callback to debounce */ cb: (...args: T) => void, /** milliseconds */ wait: number) {
    let timeout: undefined | NodeJS.Timeout;
    return function (...args: T) {
        clearTimeout(timeout);
        timeout = setTimeout(() => cb(...args), wait);
    };
}

function getDir(path: string): string {
    const normalized = normalizePath(path);
    const dir = normalized.slice(0, normalized.lastIndexOf('/'));
    return dir.length === 0
            ? '/' : dir;
}