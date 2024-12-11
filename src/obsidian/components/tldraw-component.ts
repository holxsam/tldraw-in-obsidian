import { MarkdownRenderChild, Menu, TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import BoundsTool from "src/components/BoundsTool";
import BoundsToolSelectedShapeIndicator from "src/components/BoundsToolSelectedShapesIndicator";
import EmbedTldrawToolBar from "src/components/EmbedTldrawToolBar";
import TldrawApp, { TldrawAppStoreProps } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import BoundsSelectorTool from "src/tldraw/tools/bounds-selector-tool";
import { ImageViewModeOptions, ViewMode } from "../helpers/TldrawAppEmbedViewController";
import { BoxLike, Store } from "tldraw";
import TLDataDocumentStoreManager from "../plugin/TLDataDocumentStoreManager";
import { showEmbedContextMenu } from "../helpers/show-embed-context-menu";
import { SnapshotPreviewSyncStore, TldrawImageSnapshot, TldrawImageSnapshotView } from "src/components/TldrawImageSnapshotView";
import { ComponentProps, createElement } from "react";
import { TldrAppControllerForMenu } from "../menu/create-embed-menu";
import { isObsidianThemeDark } from "src/utils/utils";
import { logClass, LOGGING_ENABLED } from "src/utils/logging";

const boundsSelectorToolIconName = `tool-${BoundsSelectorTool.id}`;

type DocumentStoreInstance = ReturnType<TLDataDocumentStoreManager['register']>;


function getEditorStoreProps(storeProps: TldrawAppStoreProps) {
    return storeProps.tldraw ? storeProps.tldraw : {
        store: storeProps.plugin.store
    }
}

export class TldrawMarkdownRenderChild extends MarkdownRenderChild {
    #storeInstance?: DocumentStoreInstance;
    #currentMenu?: Menu;
    #viewContentEl?: HTMLElement;
    #viewMode: ViewMode = 'image';
    #previewImage: {
        /**
         * The timeout that is used to update the preview.
         */
        refreshTimeout?: NodeJS.Timeout;
        /**
         * The number of milliseconds to use as the timeout delay for {@linkcode refreshTimeout}
         */
        refreshTimeoutDelay?: number;
        /**
         * Observes changes to the img src attribute.
         */
        observer?: MutationObserver;
        options: ImageViewModeOptions;
        placeHolderSizeInterval?: NodeJS.Timeout;
        /**
         * This is used so that the image does not have to re-render the snapshot everytime.
         * 
         * This should be set to undefined whenever the tldraw data changes.
        */
        rendered?: HTMLElement;
        size: TldrawMarkdownRenderChild['context']['initialEmbedValues']['imageSize'];
        snapshot?: TldrawImageSnapshot;
        /**
         * Call this to cancel the triggered snapshot callback when the workspace leaf is reshown.
         */
        cancelDeferredSnapshotCallback?: () => void,
        sizeCallback?: () => void;
        optionsCallback?: () => void;
        snapshotCallback?: () => void;
    };
    /**
     * Used with the `useSyncExternalStore` hook
     */
    #snapshotPreviewStore = {
        getPreviewSize: () => {
            return this.#previewImage.size;
        },
        getPreviewOptions: () => {
            return this.#previewImage.options;
        },
        /**
         * Will only recompute the snapshot if {@linkcode this.#previewImage.snapshot} is `undefined`
         * @returns A lazily computed snapshot.
         */
        getSnapshot: () => {
            return this.#previewImage.snapshot ??= (() => {
                const storeInstance = this.#storeInstance;
                const storeProps = !storeInstance ? undefined : getEditorStoreProps({ plugin: storeInstance.documentStore });
                return !storeProps ? undefined
                    : !storeProps.store ? storeProps.snapshot : (
                        storeProps.store instanceof Store
                            ? storeProps.store.getStoreSnapshot()
                            : storeProps.store.store?.getStoreSnapshot()
                    );
            })();
        },
        onPreviewSize: (cb) => {
            this.#previewImage.sizeCallback = cb;
            return () => {
                if (this.#previewImage.sizeCallback === cb) {
                    this.#previewImage.sizeCallback = undefined;
                }
            };
        },
        onPreviewOptions: (cb) => {
            this.#previewImage.optionsCallback = cb;
            return () => {
                if (this.#previewImage.optionsCallback === cb) {
                    this.#previewImage.optionsCallback = undefined;
                }
            };
        },
        onSnapshot: (cb) => {
            this.#previewImage.snapshotCallback = cb;
            return () => {
                if (this.#previewImage.snapshotCallback === cb) {
                    this.#previewImage.snapshotCallback = undefined;
                }
            };
        },
    } satisfies SnapshotPreviewSyncStore;

    plugin: TldrawPlugin;
    root?: Root;

    constructor(
        containerEl: HTMLElement,
        plugin: TldrawPlugin,
        public readonly context: {
            tFile: TFile,
            initialEmbedValues: {
                imageSize: { width: number, height: number },
                bounds?: BoxLike,
                showBg: boolean,
            },
            /**
             * Called whenever the bounds are updated using the {@linkcode BoundsSelectorTool}
             * @param bounds 
             * @returns 
             */
            onUpdatedBounds: (bounds?: BoxLike) => void,
            /**
             * 
             * @param cb Callback to invoke when the workspace leaf is visible again.
             * @returns Callback to cancel the invocation if not invoked yet.
             */
            deferUntilIsShown: (cb: () => void) => (() => void),
            isWorkspaceLeafShown: () => boolean,
        },
    ) {
        super(containerEl);
        this.plugin = plugin;
        this.#previewImage = {
            size: context.initialEmbedValues.imageSize,
            options: {
                assetUrls: {
                    fonts: plugin.getFontOverrides(),
                    icons: plugin.getIconOverrides(),
                },
                background: context.initialEmbedValues.showBg,
                bounds: context.initialEmbedValues.bounds,
                padding: plugin.settings.embeds.padding,
                darkMode: (() => {
                    const { themeMode } = plugin.settings;
                    if (themeMode === "dark") return true;
                    else if (themeMode === "light") return false;
                    else return isObsidianThemeDark();
                })(),
            },
        };
    }

    #updateHasShape() {
        this.#viewContentEl?.setAttr('data-has-shape',
            this.#storeInstance?.documentStore.store.query.record('shape').get() !== undefined
        );
    }

    #markSnapshotStale() {
        this.#previewImage.rendered = undefined;
        this.#previewImage.snapshot = undefined;
        this.triggerSnapshotCallback();
    }

    #dataUpdated() {
        this.#markSnapshotStale();
        this.#updateHasShape();
    }

    #setUpTldrawOptions(): ComponentProps<typeof TldrawApp> {
        const boundsSelectorIcon = this.plugin.getEmbedBoundsSelectorIcon();

        return {
            plugin: this.plugin,
            store: !this.#storeInstance ? undefined : { plugin: this.#storeInstance.documentStore },
            options: {
                // assetStore: documentStore.store.props.assets,
                onClickAwayBlur: (ev) => {
                    if (this.#currentMenu && this.#currentMenu.dom.contains(ev.targetNode)) return false;
                    Promise.resolve().then(() => {
                        this.#viewMode = 'image';
                        this.renderRoot();
                    });
                    return true;
                },
                isReadonly: true,
                components: {
                    InFrontOfTheCanvas: BoundsTool,
                    OnTheCanvas: BoundsToolSelectedShapeIndicator,
                    Toolbar: EmbedTldrawToolBar,
                },
                selectNone: true,
                iconAssetUrls: {
                    [boundsSelectorToolIconName]: boundsSelectorIcon,
                },
                initialTool: 'hand',
                initialBounds: this.#previewImage.options.bounds,
                zoomToBounds: true,
                tools: [
                    BoundsSelectorTool.create({
                        getInitialBounds: () => {
                            return this.#previewImage.options.bounds;
                        },
                        callback: (bounds) => this.context.onUpdatedBounds(bounds),
                    }),
                ],
                uiOverrides: {
                    tools: (editor, tools, _) => {
                        return {
                            ...tools,
                            [BoundsSelectorTool.id]: {
                                id: BoundsSelectorTool.id,
                                label: 'Select embed bounds',
                                icon: boundsSelectorToolIconName,
                                readonlyOk: true,
                                onSelect(_) {
                                    editor.setCurrentTool(BoundsSelectorTool.id)
                                },
                            }
                        }
                    },
                }
            },
        };
    }

    /**
     * Set the placeholder variables for the container if for some reason the component is unloaded.
     * 
     * We utilize these values in the CSS to maintain this placeholder size until the embed view is properly loaded.
     */
    #setPlaceHolderSize() {
        const container = this.containerEl;
        const viewContent = this.#viewContentEl;
        if (!viewContent) return;
        const { width, height } = viewContent.getBoundingClientRect();
        if (!width || !height) return;
        container.style.setProperty('--ptl-placeholder-width', `${width}px`);
        container.style.setProperty('--ptl-placeholder-height', `${height}px`);
    }

    #createViewContentEl() {
        return createTldrawEmbedView(this.containerEl, {
            file: this.context.tFile,
            controller: {
                getViewOptions: () => this.#previewImage.options,
                getViewMode: () => this.#viewMode,
                toggleBackground: () => {
                    this.setPreviewImageOptions({
                        ...this.#previewImage.options,
                        background: !this.#previewImage.options.background
                    });
                },
                toggleInteractive: () => {
                    if (this.#viewMode !== 'image') {
                        this.#viewMode = 'image';
                    } else {
                        this.#viewMode = 'interactive';
                    }
                    this.renderRoot();
                },
                setCurrentMenu: (menu) => {
                    this.#currentMenu?.hide();
                    this.#currentMenu = menu;
                },
                unsetMenu: (menu) => {
                    if (menu === this.#currentMenu) {
                        this.#currentMenu = undefined;
                    }
                }
            },
            plugin: this.plugin,
            showBgDots: this.plugin.settings.embeds.showBgDots,
        }).tldrawEmbedViewContent;
    }

    #observePreviewImage() {
        if (!this.#viewContentEl) return;

        this.#previewImage.observer?.disconnect();

        const mutationObserver = new MutationObserver((m) => {
            for (const mutation of m) {
                if (mutation.target.instanceOf(HTMLElement)) {
                    if (
                        mutation.type === 'attributes'
                        && mutation.target.instanceOf(HTMLImageElement)
                        && mutation.target.hasAttribute('src')
                        && mutation.target.parentElement !== null
                        && mutation.target.parentElement.hasClass('tl-container')
                    ) {
                        this.#previewImage.rendered = mutation.target.parentElement;
                    }
                }
            }
        });

        mutationObserver.observe(this.#viewContentEl, {
            childList: true,
            subtree: true,
            attributeFilter: ['src'],
        });

        this.#previewImage.observer = mutationObserver;

        // TODO: Replace this with something that does not poll the bounding rect
        clearInterval(this.#previewImage.placeHolderSizeInterval);
        this.#previewImage.placeHolderSizeInterval = setInterval(() => {
            this.#setPlaceHolderSize();
        }, 100);
    }

    #observePreviewImageDisconnect() {
        clearInterval(this.#previewImage.placeHolderSizeInterval)
        this.#previewImage.observer?.disconnect();
        this.#previewImage.observer = undefined;
    }

    #setRoot(createRoot?: () => Root) {
        this.root?.unmount();
        this.root = createRoot?.();
    }

    /**
     * The purpose of this method is to only notify "snapshot observers" that an image should be rendered when the
     * workspace leaf is visible to the user.
     * 
     * - If a "deferred snapshot" was already triggered, then cancel it.
     * - If the workspace leaf where the image preview is located is shown, then invoke the "snapshot callback"
     * - , else: defer triggering the snapshot callback until the workspace leaf is shown.
     */
    triggerSnapshotCallback() {
        this.#previewImage.cancelDeferredSnapshotCallback?.();
        this.#previewImage.cancelDeferredSnapshotCallback = undefined;
        if (this.context.isWorkspaceLeafShown()) {
            this.#previewImage.snapshotCallback?.();
        } else {
            this.#previewImage.cancelDeferredSnapshotCallback = (
                this.context.deferUntilIsShown(() => this.triggerSnapshotCallback())
            );
        }
    }

    refreshPreview() {
        clearTimeout(this.#previewImage.refreshTimeout);
        this.#previewImage.rendered = undefined;
        this.#previewImage.refreshTimeout = setTimeout(async () => {
            this.#previewImage.optionsCallback?.();
        }, this.#previewImage.refreshTimeoutDelay);
    }

    unloadStoreInstance() {
        this.#storeInstance?.unregister();
        this.#storeInstance = undefined;
    }

    updateEmbedValues({
        bounds,
        imageSize,
        showBg
    }: {
        bounds?: BoxLike,
        imageSize: { width: number, height: number },
        showBg: boolean,
    }) {
        this.#previewImage.size = imageSize;
        this.#previewImage.sizeCallback?.();

        if (this.#previewImage.options.background === showBg
            && this.#previewImage.options.bounds?.h === bounds?.h
            && this.#previewImage.options.bounds?.w === bounds?.w
            && this.#previewImage.options.bounds?.x === bounds?.x
            && this.#previewImage.options.bounds?.y === bounds?.y
        ) return;

        this.setPreviewImageOptions({
            ...this.#previewImage.options,
            background: showBg,
            bounds,
        });
    }

    updateBounds(bounds?: BoxLike) {
        this.setPreviewImageOptions({
            ...this.#previewImage.options,
            bounds,
        });
    }

    async awaitInitialLoad(ms: number) {
        // TODO: Modify this to be a promise that is resolved when the image preview has finished loading
        // instead of relying on a timeout
        return new Promise<void>((res, rej) => {
            if (this.isContentLoaded()) return res(void 0);
            setTimeout(() => {
                if (this.isContentLoaded()) {
                    return res(void 0);
                } else {
                    // @ts-ignore
                    if (this._loaded) {
                        return rej(new Error(`Error loading tldraw embed: Timeout of ${ms} ms reached.`));
                    } else {
                        return rej(new Error(`Component was unloaded before its initial load was finished.`));
                    }
                }
            }, ms)
        });
    }

    isContentLoaded() {
        return (
            this.#viewContentEl !== undefined
            && (
                // The image preview
                this.#viewContentEl.querySelector('.ptl-tldraw-image > div.tl-container > img[src]') !== null
                ||
                // The interactive mode canvas
                this.#viewContentEl.querySelector('.tldraw-view-root > div.tl-container') !== null
            )
        );
    }

    renderRoot() {
        const container = this.#viewContentEl;
        if (container) {
            this.#setRoot(() => createRoot(container));
        }
        this.root?.render(
            this.#viewMode === 'image' ? (
                createElement(TldrawImageSnapshotView, {
                    previewStore: this.#snapshotPreviewStore,
                    getPlaceHolderImage: () => this.#previewImage.rendered,
                })
            ) : (
                createElement(TldrawApp, this.#setUpTldrawOptions())
            )
        );
    }

    setPreviewImageOptions(options: ImageViewModeOptions) {
        this.#previewImage.options = options;
        this.refreshPreview();
    }

    async lazyLoadStoreInstance() {
        if (this.#storeInstance) return this.#storeInstance;
        const fileData = await this.plugin.app.vault.read(this.context.tFile);
        this.#storeInstance = this.plugin.tlDataDocumentStoreManager.register(this.context.tFile, () => fileData, () => {
            this.#dataUpdated();
        }, false);
        this.setPreviewImageOptions({
            ...this.#previewImage.options,
            assets: this.#storeInstance.documentStore.store.props.assets,
        });
        return this.#storeInstance;
    }

    async loadRoot() {
        LOGGING_ENABLED && logClass(TldrawMarkdownRenderChild, this.loadRoot, this);
        this.#updateHasShape();
        await this.lazyLoadStoreInstance();
        this.#observePreviewImage();
        this.renderRoot();
    }

    unloadRoot() {
        LOGGING_ENABLED && logClass(TldrawMarkdownRenderChild, this.unloadRoot, this);
        clearTimeout(this.#previewImage.refreshTimeout);
        this.#observePreviewImageDisconnect();
        this.#setPlaceHolderSize();
        this.#setRoot(undefined);
    }

    override onload(): void {
        try {
            this.#viewContentEl = this.#createViewContentEl();
            this.loadRoot();
        } catch (e) {
            this.unload();
            console.error('There was an error while mounting the tldraw app: ', e);
        }
    }

    override onunload(): void {
        this.unloadRoot();
        this.unloadStoreInstance();
        this.containerEl.empty();
    }
}

function createTldrawEmbedView(internalEmbedDiv: HTMLElement, {
    file, plugin, controller, showBgDots,
}: {
    file: TFile,
    plugin: TldrawPlugin,
    controller: TldrAppControllerForMenu,
    showBgDots: boolean,
}) {
    const tldrawEmbedView = internalEmbedDiv.createDiv({ cls: 'ptl-markdown-embed' },)

    const tldrawEmbedViewContent = tldrawEmbedView.createDiv({
        cls: 'ptl-view-content', attr: {
            'data-showBgDots': showBgDots,
        }
    })

    // Prevent the Obsidian editor from selecting the embed link with the editing cursor when a user interacts with the view.
    tldrawEmbedView.addEventListener('click', (ev) => {
        if (controller.getViewMode() === 'interactive') {
            ev.stopPropagation();
        }
    })

    tldrawEmbedView.addEventListener('dblclick', (ev) => {
        if (controller.getViewMode() === 'image') {
            plugin.openTldrFile(file, 'new-tab', 'tldraw-view');
            ev.stopPropagation();
        }
    })

    tldrawEmbedViewContent.addEventListener('contextmenu', (ev) => {
        if (ev.button === 2) {
            showEmbedContextMenu(ev, {
                plugin, controller, focusContainer: internalEmbedDiv,
                tFile: file
            })
        }
        // Prevent default: On mobile without this the embed image view will zoom in, which is unwanted behavior when showing the context menu.
        ev.preventDefault()
    })


    {// Mobile
        let longPressTimer: NodeJS.Timer | undefined;
        tldrawEmbedViewContent.addEventListener('touchstart', (ev) => {
            clearTimeout(longPressTimer)
            longPressTimer = setTimeout(() => showEmbedContextMenu(ev, {
                plugin, controller, focusContainer: tldrawEmbedView,
                tFile: file
            }), 500)
        }, { passive: true })

        tldrawEmbedViewContent.addEventListener('touchmove', (ev) => {
            clearTimeout(longPressTimer)
        }, { passive: true });

        tldrawEmbedViewContent.addEventListener('touchend', (ev) => {
            clearTimeout(longPressTimer);
        }, { passive: true });
    }

    return {
        tldrawEmbedView,
        tldrawEmbedViewContent,
    }
}