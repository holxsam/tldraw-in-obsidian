import { ButtonComponent, MarkdownPostProcessorContext, TFile } from "obsidian";
import { createRootAndRenderTldrawApp } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { TldrawAppViewModeController } from "../helpers/TldrawAppEmbedViewController";
import { MARKDOWN_ICON_NAME, TLDRAW_ICON_NAME } from "src/utils/constants";
import { CustomMutationObserver } from "src/utils/debug-mutation-observer";
import { ConsoleLogParams, LOGGING_ENABLED, logFn } from "src/utils/logging";
import { parseTLDataDocument } from "src/utils/parse";
import { createTldrawAppViewModeController } from "../factories/createTldrawAppViewModeController";
import { interactiveViewModeToggle, backgroundViewOptionsToggle } from "../helpers/tldraw-view-header";
import { Root } from "react-dom/client";

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

        const controller = createTldrawAppViewModeController();

        const { tldrawEmbedView, tldrawEmbedViewContent, viewHeader } = createTldrawEmbedView(internalEmbedDiv, {
            file, plugin, controller
        });

        const parent = internalEmbedDiv.parentElement;

        if (parent === null) throw Error(`${markdownPostProcessor.name}: No parent element for internalEmbedDiv.\n\n\tIt is needed to ensure the attached react root component is unmounted properly.`);

        let reactRoot: undefined | Root;

        // https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L710C3-L731C6
        //timer to avoid the image flickering when the user is typing
        let timer: NodeJS.Timeout | null = null;

        const activateReactRoot = async () => {
            if (timer) {
                clearTimeout(timer);
            }
            try {
                reactRoot = await createReactTldrawAppRoot(internalEmbedDiv, {
                    controller, file, plugin, tldrawEmbedViewContent
                })
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
            };

            const { target, attributeName } = m[0]
            if (!(target instanceof HTMLElement) || !(["alt", "width", "height"] as (string | null)[]).contains(attributeName)) {
                return;
            }

            if (timer) {
                clearTimeout(timer);
            }

            const { bounds, imageSize } = parseEmbedValues(target)

            controller.setImageSize(imageSize)

            if (bounds === undefined) return;

            timer = setTimeout(async () => {
                console.log(m[0])
                controller.setImageBounds({
                    ...bounds.pos,
                    ...bounds.size,
                });
            }, 500);
        }

        const observer = new CustomMutationObserver(markdownObserverFn, "markdownPostProcessorObserverFn");
        observer.observe(internalEmbedDiv, { attributes: true });

        const observerParent = new CustomMutationObserver(function markdownParentObserverFn(m) {
            // log(`${markdownParentObserverFn.name} watching`, m, parent);
            if (!parent.contains(internalEmbedDiv)) {
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

        await activateReactRoot();
        return;
    } else if (!isInternal && isMarkdownView) {
        throw new Error(`${markdownPostProcessor.name}: Unexpected`);
    }
    throw new Error(`${markdownPostProcessor.name}: Unexpected`);
}


function createTldrawViewHeader(embedViewContent: HTMLElement, {
    controller, file, plugin, selectEmbedText
}: {
    controller: Pick<
        TldrawAppViewModeController, 'getViewMode' | 'toggleInteractive' | 'toggleBackground' | 'getViewOptions'
    >,
    file: TFile,
    plugin: TldrawPlugin,
    selectEmbedText: (ev: MouseEvent) => void
}) {
    const tldrawViewHeader = embedViewContent.createDiv({
        cls: ['ptl-embed-context-bar'],
    });

    const tldrawTitle = tldrawViewHeader.createDiv({
        cls: ['ptl-embed-title-bar']
    }, (el) => {
        el.onClickEvent((ev) => {
            selectEmbedText(ev);
            ev.stopPropagation();
        })
    })

    tldrawTitle.innerText = file.name;

    const actionBar = tldrawViewHeader.createDiv({ cls: 'ptl-embed-action-bar' })

    const updateList: (() => void)[] = [
        backgroundViewOptionsToggle(actionBar, controller)[1],
        interactiveViewModeToggle(actionBar, controller)[1],
    ];

    new ButtonComponent(actionBar)
        .setClass('clickable-icon')
        .setIcon(MARKDOWN_ICON_NAME)
        .setTooltip('Open as markdown').onClick(() => {
            plugin.openTldrFile(file, 'new-tab', 'markdown')
        });

    new ButtonComponent(actionBar)
        .setClass('clickable-icon')
        .setIcon(TLDRAW_ICON_NAME)
        .setTooltip('Edit').onClick(() => {
            plugin.openTldrFile(file, 'new-tab')
        });

    new ButtonComponent(actionBar)
        .setClass('clickable-icon')
        .setIcon('view')
        .setTooltip('Read-only view').onClick((ev) => {
            plugin.openTldrFile(file, 'new-tab', 'tldraw-read-only')
        });

    return [tldrawViewHeader, () => {
        updateList.forEach((e) => e());
    }] as const;
}

function createTldrawEmbedView(internalEmbedDiv: HTMLElement, {
    file, plugin, controller
}: {
    file: TFile,
    plugin: TldrawPlugin,
    controller: TldrawAppViewModeController
}) {
    const tldrawEmbedView = internalEmbedDiv.createDiv({ cls: 'ptl-markdown-embed' },)

    const tldrawEmbedViewContent = tldrawEmbedView.createDiv({ cls: 'ptl-view-content' })

    const [viewHeader, updateHeader] = createTldrawViewHeader(tldrawEmbedView, {
        file, plugin, controller: {
            toggleBackground: () => {
                return controller.toggleBackground();
            },
            toggleInteractive: () => {
                viewHeader.hide();
                controller.toggleInteractive();
                internalEmbedDiv.focus();
            },
            getViewMode: () => {
                return controller.getViewMode();
            },
            getViewOptions: () => {
                return controller.getViewOptions();
            }
        },
        selectEmbedText: (ev) => {
            internalEmbedDiv.dispatchEvent(new MouseEvent('click', {
                bubbles: ev.bubbles,
                cancelable: ev.cancelable,
                clientX: ev.clientX,
                clientY: ev.clientY
            }))
        }
    })
    viewHeader.hide();

    // Prevent the Obsidian editor from selecting the embed link with the editing cursor when a user interacts with the view.
    tldrawEmbedView.addEventListener('click', (ev) => {
        ev.stopPropagation();
    })

    internalEmbedDiv.addEventListener('focusin', () => {
        if (controller.getViewMode() === 'interactive') return;
        viewHeader.show();
    })

    internalEmbedDiv.addEventListener('focusout', (event) => {
        if (event.relatedTarget instanceof Node) {
            if (event.relatedTarget instanceof HTMLTextAreaElement) {
                return;
            }
            if (event.target === internalEmbedDiv && internalEmbedDiv.contains(event.relatedTarget)) {
                return;
            }
            if (internalEmbedDiv.contains(event.relatedTarget)) {
                return;
            }
        }

        controller.setViewMode('image');
        updateHeader();
        viewHeader.hide();
    })

    return {
        tldrawEmbedView,
        tldrawEmbedViewContent,
        viewHeader,
    }
}

function parseEmbedValues(el: HTMLElement, defaults = {
    pos: { x: 0, y: 0 },
    size: {
        w: Number.NaN,
        h: Number.NaN
    },
}) {
    const alt = el.attributes.getNamedItem('alt')?.value ?? '';
    const altSplit = alt.split(';').map((e) => e.trim())
    const altEntries = altSplit.map((e) => e.split('='))
    const altNamedProps: Partial<Record<string, string>> = Object.fromEntries(altEntries);

    const posValue = altNamedProps['pos']?.split(',').map((e) => Number.parseInt(e)) ?? [];
    const pos = { x: posValue.at(0) ?? defaults.pos.x, y: posValue.at(1) ?? defaults.pos.y }

    const sizeValue = altNamedProps['size']?.split(',').map((e) => Number.parseInt(e)) ?? [];
    const size = { w: sizeValue.at(0) ?? defaults.size.w, h: sizeValue.at(1) ?? defaults.size.h }
    const bounds = Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(size.w) || Number.isNaN(size.h)
        ? undefined
        : { pos, size };
    const imageSize = {
        width: Number.parseInt(el.attributes.getNamedItem('width')?.value ?? ''),
        height: Number.parseInt(el.attributes.getNamedItem('height')?.value ?? ''),
    };
    return {
        bounds,
        imageSize,
    };
}

async function createReactTldrawAppRoot(internalEmbedDiv: HTMLElement, {
    controller, file, plugin, tldrawEmbedViewContent
}: {
    file: TFile,
    plugin: TldrawPlugin,
    tldrawEmbedViewContent: HTMLElement,
    controller: TldrawAppViewModeController,
}) {
    const fileData = await plugin.app.vault.read(file);
    const parsedData = parseTLDataDocument(plugin.manifest.version, fileData);
    const { bounds, imageSize } = parseEmbedValues(internalEmbedDiv)
    return createRootAndRenderTldrawApp(tldrawEmbedViewContent,
        parsedData,
        (_) => {
            console.log('Ignore saving file due to read only mode.');
        },
        plugin,
        {
            isReadonly: true,
            controller,
            inputFocus: true,
            selectNone: true,
            initialTool: 'hand',
            initialBounds: bounds === undefined ? undefined : {
                ...bounds.pos,
                ...bounds.size,
            },
            initialImageSize: imageSize,
            zoomToBounds: true,
        }
    );
}