import { SuggestModal, TAbstractFile, TFile, TFolder } from "obsidian";
import TldrawPlugin from "src/main";
import { getDir } from "src/utils/path";

export class FileSearchModal extends SuggestModal<TFile | TFolder> {
    plugin: TldrawPlugin;

    readonly initialValue?: string;
    /**
     * If undefined then any extension, otherwise only if included.
    */
    readonly extensions?: string[];
    readonly selectDir: boolean;
    private readonly setSelection: (file: TAbstractFile) => void;
    private readonly onEmptyStateText: (searchPath: string) => string;

    /**
     * This function is present at runtime in the web developer console in Obsidian, but not in the type definition for some reason.
     */
    declare updateSuggestions: () => void;

    private searchRes: {
        searchPath: string,
        currDir?: TFolder,
        results: (TFolder | TFile)[],
    } = {
            searchPath: '',
            results: [],
        };

    private searchResolver?: (res: typeof this.searchRes) => void;

    constructor(plugin: TldrawPlugin, options: {
        initialValue?: string,
        extensions?: FileSearchModal['extensions'],
        onEmptyStateText: FileSearchModal['onEmptyStateText'],
        setSelection: FileSearchModal['setSelection'],
        /**
         * default value is false
         */
        selectDir?: boolean
    }) {
        super(plugin.app);
        this.plugin = plugin;
        this.extensions = options.extensions;
        this.onEmptyStateText = options.onEmptyStateText;
        this.setSelection = options.setSelection;
        this.initialValue = options.initialValue;
        this.selectDir = options.selectDir ?? false;
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
                currDir: dir,
                results: this.filterSearchPath(dir, searchPath)
            })
        }
        res({
            searchPath,
            results: !(dir instanceof TFolder)
                ? []
                : this.filterSearchPath(dir, searchPath),
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
                const suggestions = r.results.sort((a, b) => (
                    a instanceof TFolder && b instanceof TFolder ||
                        a instanceof TFile && b instanceof TFolder
                        ? a.path.localeCompare(b.path)
                        : a instanceof TFolder
                            ? -1
                            : 1
                ))
                return res(
                    r.currDir === undefined || !this.selectDir ? suggestions : [
                        r.currDir,
                        ...suggestions
                    ]
                );
            }

            this.searchResolver = resolver;
            if (lastResolver) {
                lastResolver(this.searchRes);
            }
            this.searchPath(query, resolver);
        });
    }

    renderSuggestion(file: TFile | TFolder, el: HTMLElement) {
        if (file.path === this.searchRes?.currDir?.path) {
            el.createEl("div", { text: `Use this directory (${file.path})` });
            return;
        }
        const { searchPath } = this.searchRes;
        const parsedSearchDir = getDir(searchPath);
        const searchDir = parsedSearchDir.length === 0
            ? searchPath : parsedSearchDir;
        const text = searchPath.length === 0 || searchDir === '/'
            ? `${file.path}${file instanceof TFolder ? '/' : ''}`
            : `...${file.path.substring(searchDir.length)}${file instanceof TFolder ? '/' : ''}`;
        el.createEl("div", { text });
    }

    onChooseSuggestion(value: TFile | TFolder, evt: MouseEvent | KeyboardEvent) {
        this.setSelection(value);
        this.close();
    }

    selectSuggestion(value: TFile | TFolder, evt: MouseEvent | KeyboardEvent): void {
        if (value instanceof TFile || value.path === this.searchRes?.currDir?.path) {
            this.onChooseSuggestion(value, evt);
            return;
        }

        this.changeInputValue(`${value.path}/`);
    }

    onNoSuggestion(): void {
        this.emptyStateText = this.onEmptyStateText(this.searchRes.searchPath);
        return super.onNoSuggestion();
    }

    filterSearchPath(tFolder: TFolder, searchPath: string) {
        return filterSearchPath(tFolder, searchPath, this.extensions);
    }
}

function filterSearchPath(tFolder: TFolder, searchPath: string, extensions?: string[]) {
    return tFolder.children.map((e) => (
        !(e instanceof TFolder) && !(e instanceof TFile)
            ? undefined
            : e instanceof TFolder
                ? e
                : extensions === undefined
                    ? e
                    : extensions.includes(e.extension)
                        ? e
                        : undefined
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
