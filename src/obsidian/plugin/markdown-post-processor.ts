import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { createRootAndRenderTldrawApp } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { TldrawAppViewModeController } from "../helpers/TldrawAppEmbedViewController";
import { CustomMutationObserver } from "src/utils/debug-mutation-observer";
import { ConsoleLogParams, LOGGING_ENABLED, logFn } from "src/utils/logging";
import { parseTLDataDocument } from "src/utils/parse";
import { createTldrawAppViewModeController } from "../factories/createTldrawAppViewModeController";
import { Root } from "react-dom/client";
import { showEmbedContextMenu } from "../helpers/show-embed-context-menu";
import { ObsidianTLAssetStore } from "src/tldraw/asset-store";

/**
 * Processes the embed view for a tldraw white when including it in another obsidian note.
 * @param plugin 
 * @param element 
 * @param context 
 * @returns 
 */
export async function markdownPostProcessor(plugin: TldrawPlugin, element: HTMLElement, context: MarkdownPostProcessorContext) {
    const log = (...args: ConsoleLogParams) => !LOGGING_ENABLED ? () => { } : logFn(markdownPostProcessor, args[0], ...args.slice(1));
    log();

    // https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L739
    const embeddedItems = element.querySelectorAll(".internal-embed");

    if (embeddedItems.length !== 0) {
        return;
    }

    const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath);

    if (!(file instanceof TFile)) return;

    if (!context.frontmatter || context.frontmatter['tldraw-file'] !== true) {
        return;
    }

    //@ts-ignore
    const containerEl: HTMLElement = context.containerEl;

    const internalEmbedDiv: HTMLElement | undefined = (() => {
        let internalEmbedDiv: HTMLElement = containerEl;

        while (
            !internalEmbedDiv.hasClass("print") &&
            !internalEmbedDiv.hasClass("dataview") &&
            !internalEmbedDiv.hasClass("cm-preview-code-block") &&
            !internalEmbedDiv.hasClass("cm-embed-block") &&
            !internalEmbedDiv.hasClass("internal-embed") &&
            !internalEmbedDiv.hasClass("markdown-reading-view") &&
            !internalEmbedDiv.hasClass("markdown-embed") &&
            internalEmbedDiv.parentElement
        ) {
            internalEmbedDiv = internalEmbedDiv.parentElement;
        }

        if (
            internalEmbedDiv.hasClass("dataview") ||
            internalEmbedDiv.hasClass("cm-preview-code-block") ||
            internalEmbedDiv.hasClass("cm-embed-block")
        ) {
            return undefined;
        }

        return internalEmbedDiv;
    })();

    if (internalEmbedDiv === undefined) return; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/835



    const markdownEmbed = internalEmbedDiv.hasClass("markdown-embed");
    const markdownReadingView = internalEmbedDiv.hasClass("markdown-reading-view");
    const isMarkdownView = markdownEmbed || markdownReadingView;
    const isInternal = internalEmbedDiv.hasClass("internal-embed");
    if (isInternal && isMarkdownView) {
        const codeblock = element.querySelector("code.language-json");

        if (!codeblock) {
            // log(`not tldraw json code block`);
            // log('element', internalEmbedDiv);
            // log('element', element);
            // log('context', context);
            if (element.parentElement === containerEl) {
                containerEl.removeChild(element);
            }
            return;
        }

        log('tldraw json code block')
        log('element', internalEmbedDiv);
        log('element', element);
        log('context', context);

        internalEmbedDiv.empty()

        if (markdownEmbed) {
            internalEmbedDiv.removeClass("markdown-embed");
            internalEmbedDiv.removeClass("inline-embed");
            // TODO: Uncomment later when added prerendered tldraw view support.
            // internalEmbedDiv.addClass("media-embed");
            // internalEmbedDiv.addClass("image-embed");
        }

        const embedValues = parseEmbedValues(internalEmbedDiv, {
            showBgDefault: plugin.settings.embeds.showBg
        });
        const controller = createTldrawAppViewModeController({
            showBg: embedValues.showBg,
            initialBounds: embedValues.bounds,
        });

        const { tldrawEmbedViewContent } = createTldrawEmbedView(internalEmbedDiv, {
            file, plugin, controller,
            showBgDots: plugin.settings.embeds.showBgDots
        });

        const parent = internalEmbedDiv.parentElement;

        if (parent === null) throw Error(`${markdownPostProcessor.name}: No parent element for internalEmbedDiv.\n\n\tIt is needed to ensure the attached react root component is unmounted properly.`);

        await loadEmbedTldraw(tldrawEmbedViewContent, {
            controller, embedValues, file, internalEmbedDiv, parent, plugin
        });

        return;
    } else if (!isInternal && isMarkdownView) {
        throw new Error(`${markdownPostProcessor.name}: Unexpected`);
    }
    throw new Error(`${markdownPostProcessor.name}: Unexpected`);
}

async function loadEmbedTldraw(tldrawEmbedViewContent: HTMLElement, {
    controller, embedValues, file, internalEmbedDiv, parent, plugin,
}: {
    controller: TldrawAppViewModeController,
    embedValues: ReturnType<typeof parseEmbedValues>,
    file: TFile,
    internalEmbedDiv: HTMLElement,
    parent: HTMLElement,
    plugin: TldrawPlugin,
}) {
    let reactRoot: undefined | Root;

    // https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L710C3-L731C6
    //timer to avoid the image flickering when the user is typing
    let timer: NodeJS.Timeout | null = null;

    const parseData = async () => {
        const fileData = await plugin.app.vault.read(file);
        return parseTLDataDocument(plugin.manifest.version, fileData);
    }

    const fileListener = plugin.tldrawFileListeners.addListener(file, async () => {
        if (!parent.isConnected) {
            fileListener.remove();
            return;
        }
        controller.setUpdatedData(await parseData())
    }, { immediatelyPause: true });

    const activateReactRoot = async () => {
        if (timer) {
            clearTimeout(timer);
        }
        try {
            fileListener.isPaused = true;
            const parsedData = await parseData();
            reactRoot = await createReactTldrawAppRoot({
                assetStore: new ObsidianTLAssetStore(plugin, file, {
                    persistenceKey: parsedData.meta.uuid,
                    storeAsset: undefined,
                }),
                controller, parsedData, plugin, tldrawEmbedViewContent, embedValues
            })
            fileListener.isPaused = false;
            // log(`React root loaded.`);
        } catch (e) {
            console.error('There was an error while mounting the tldraw app: ', e);
        }
    }

    const markdownObserverFn: MutationCallback = (m) => {
        // log(`${markdownObserverFn.name}`, m)

        if (reactRoot === undefined) {
            // log('Reactivating observer parent and react root');
            activateReactRoot().then(() => {
                observerParent.observe(parent, { childList: true });
            })
            return;
        }

        const { target, attributeName } = m[0]
        if (!(target instanceof HTMLElement) || !(["alt", "width", "height"] as (string | null)[]).contains(attributeName)) {
            return;
        }

        if (timer) {
            clearTimeout(timer);
        }

        const { bounds, imageSize, showBg } = parseEmbedValues(target, {
            showBgDefault: plugin.settings.embeds.showBg
        })

        timer = setTimeout(async () => {
            controller.setShowBackground(showBg);
            controller.setImageSize(imageSize)
            controller.setImageBounds(bounds);
        }, 500);
    }

    const observer = new CustomMutationObserver(markdownObserverFn, "markdownPostProcessorObserverFn");
    observer.observe(internalEmbedDiv, { attributes: true });

    const observerParent = new CustomMutationObserver(function markdownParentObserverFn(m) {
        // log(`${markdownParentObserverFn.name} watching`, m, parent);
        if (!parent.contains(internalEmbedDiv)) {
            fileListener.isPaused = true;
            // log(`${markdownParentObserverFn.name}: Unmounting react root`);
            reactRoot?.unmount();
            reactRoot = undefined;
            if (timer) {
                clearTimeout(timer);
            }
            observerParent.disconnect();
            return;
        }
    }, "markdownPostProcessorObserverFn");
    observerParent.observe(parent, { childList: true });

    new CustomMutationObserver(function (m) {
        if (parent.isConnected) return;
        fileListener.remove();
    }, 'markdownTldrawFileListener').observe(parent, { childList: true })

    await activateReactRoot();
}

function createTldrawEmbedView(internalEmbedDiv: HTMLElement, {
    file, plugin, controller, showBgDots
}: {
    file: TFile,
    plugin: TldrawPlugin,
    controller: TldrawAppViewModeController,
    showBgDots: boolean,
}) {
    const tldrawEmbedView = internalEmbedDiv.createDiv({ cls: 'ptl-markdown-embed' },)

    const tldrawEmbedViewContent = tldrawEmbedView.createDiv({ cls: 'ptl-view-content', attr: {
        'data-showBgDots': showBgDots
    } })

    // Prevent the Obsidian editor from selecting the embed link with the editing cursor when a user interacts with the view.
    tldrawEmbedView.addEventListener('click', (ev) => {
        if (controller.getViewMode() === 'interactive') {
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
            longPressTimer = setTimeout(() => showEmbedContextMenu(undefined, {
                plugin, controller, focusContainer: tldrawEmbedView,
                tFile: file
            }), 500)
        }, { passive: true })

        tldrawEmbedViewContent.addEventListener('touchmove', (ev) => {
            clearTimeout(longPressTimer)
        });

        tldrawEmbedViewContent.addEventListener('touchend', (ev) => {
            clearTimeout(longPressTimer)
        });
    }

    return {
        tldrawEmbedView,
        tldrawEmbedViewContent,
    }
}

function parseEmbedValues(el: HTMLElement, {
    showBgDefault,
    imageBounds = {
        pos: { x: 0, y: 0 },
        size: {
            w: Number.NaN,
            h: Number.NaN
        },
    }
}: {
    showBgDefault: boolean,
    imageBounds?: {
        pos: { x: number, y: number },
        size: { w: number, h: number },
    }
}) {
    const alt = el.attributes.getNamedItem('alt')?.value ?? '';
    const altSplit = alt.split(';').map((e) => e.trim())
    const altEntries = altSplit.map((e) => e.split('='))
    const altNamedProps: Partial<Record<string, string>> = Object.fromEntries(altEntries);

    const posValue = altNamedProps['pos']?.split(',').map((e) => Number.parseFloat(e)) ?? [];
    const pos = { x: posValue.at(0) ?? imageBounds.pos.x, y: posValue.at(1) ?? imageBounds.pos.y }

    const sizeValue = altNamedProps['size']?.split(',').map((e) => Number.parseFloat(e)) ?? [];
    const size = { w: sizeValue.at(0) ?? imageBounds.size.w, h: sizeValue.at(1) ?? imageBounds.size.h }
    const bounds = Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(size.w) || Number.isNaN(size.h)
        ? undefined
        : { pos, size };
    const imageSize = {
        width: Number.parseFloat(el.attributes.getNamedItem('width')?.value ?? ''),
        height: Number.parseFloat(el.attributes.getNamedItem('height')?.value ?? ''),
    };

    const showBg = (() => {
        switch (altNamedProps['showBg']) {
            case 'true':
            case 'yes':
                return true;
            case 'false':
            case 'no':
                return false;
            default:
                return showBgDefault;
        }
    })()
    return {
        bounds: bounds === undefined ? undefined : {
            ...bounds.pos,
            ...bounds.size,
        },
        imageSize,
        showBg,
    };
}

type EmbedValues = ReturnType<typeof parseEmbedValues>;

async function createReactTldrawAppRoot({
    assetStore, controller, parsedData, plugin, tldrawEmbedViewContent, embedValues
}: {
    assetStore: ObsidianTLAssetStore,
    parsedData: ReturnType<typeof parseTLDataDocument>,
    plugin: TldrawPlugin,
    tldrawEmbedViewContent: HTMLElement,
    controller: TldrawAppViewModeController,
    embedValues: EmbedValues
}) {
    const { imageSize } = embedValues;
    return createRootAndRenderTldrawApp(tldrawEmbedViewContent,
        parsedData,
        (_) => {
            console.log('Ignore saving file due to read only mode.');
        },
        plugin,
        {
            assetStore,
            isReadonly: true,
            controller,
            inputFocus: true,
            selectNone: true,
            initialTool: 'hand',
            initialImageSize: imageSize,
            zoomToBounds: true,
        }
    );
}