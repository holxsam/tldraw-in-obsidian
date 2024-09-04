import { ButtonComponent, MarkdownPostProcessorContext, TFile } from "obsidian";
import { createRootAndRenderTldrawApp } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { TldrawAppViewModeController } from "../helpers/TldrawAppEmbedViewController";
import { MARKDOWN_ICON_NAME, TLDRAW_ICON_NAME } from "src/utils/constants";
import { CustomMutationObserver } from "src/utils/debug-mutation-observer";
import { ConsoleLogParams, LOGGING_ENABLED, logFn } from "src/utils/logging";
import { parseTLDataDocument } from "src/utils/parse";
import { createTldrawAppViewModeController } from "../factories/createTldrawAppViewModeController";
import { backgroundViewOptionToggle, interactiveViewModeToggle } from "../helpers/tldraw-view-header";

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

        const tldrawEmbedView = createTldrawEmbedView(internalEmbedDiv, {
            file, plugin, controller
        });

        const tldrawEmbedViewContent = tldrawEmbedView.createDiv({
            cls: 'ptl-view-content'
        })

        const parent = internalEmbedDiv.parentElement;

        if (parent === null) throw Error(`${markdownPostProcessor.name}: No parent element for internalEmbedDiv.\n\n\tIt is needed to ensure the attached react root component is unmounted properly.`);

        const fileData = await plugin.app.vault.read(file);
        const parsedData = parseTLDataDocument(plugin.manifest.version, fileData);

        const reactRoot = createRootAndRenderTldrawApp(tldrawEmbedViewContent,
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
                // TODO: Create initial bounds from url params defined in the markdown link.
                // initialBounds: {
                //     x: 0, y: 0,
                //     h: 300, w: 300
                // },
                zoomToBounds: true,
            }
        );


        // https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L710C3-L731C6
        //timer to avoid the image flickering when the user is typing
        let timer: NodeJS.Timeout | null = null;

        const markdownObserverFn: MutationCallback = (m) => {
            log(`${markdownObserverFn.name}`)
            if (!(["alt", "width", "height"] as (string | null)[]).contains(m[0]?.attributeName)) {
                return;
            }

            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(async () => {
                timer = null;
                internalEmbedDiv.empty();
                // const imgDiv = await processInternalEmbed(internalEmbedDiv, file);
                // internalEmbedDiv.appendChild(imgDiv);
            }, 500);
        }

        const observer = new CustomMutationObserver(markdownObserverFn, "markdownPostProcessorObserverFn");
        observer.observe(internalEmbedDiv, { attributes: true });

        const observerParent = new CustomMutationObserver(function markdownParentObserverFn(m) {
            log(`${markdownParentObserverFn.name}`);
            if (!parent.contains(internalEmbedDiv)) {
                log(`${markdownParentObserverFn.name}: Unmounting react root`);
                reactRoot.unmount()
                if (timer) {
                    clearTimeout(timer);
                }
                observerParent.disconnect();
                return;
            }
        }, "markdownPostProcessorObserverFn");
        observerParent.observe(parent, { childList: true });
        return;
    } else if (!isInternal && isMarkdownView) {
        throw new Error(`${markdownPostProcessor.name}: Unexpected`);
    }
    throw new Error(`${markdownPostProcessor.name}: Unexpected`);
}


function createTldrawViewHeader(embedViewContent: HTMLElement, {
    controller, file, plugin, selectEmbedText
}: {
    controller: TldrawAppViewModeController,
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

    const updateList: (() => void )[] = [
        interactiveViewModeToggle(actionBar, controller)[1],
        backgroundViewOptionToggle(actionBar, controller)[1],
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
    return internalEmbedDiv.createDiv({
        cls: 'ptl-markdown-embed'
    }, (el) => {
        const [viewHeader, updateHeader] = createTldrawViewHeader(el, {
            file, plugin, controller,
            selectEmbedText: (ev) => {
                internalEmbedDiv.dispatchEvent(new MouseEvent('click', {
                    bubbles: ev.bubbles,
                    cancelable: ev.cancelable,
                    clientX: ev.clientX,
                    clientY: ev.clientY
                }))
            }
        })

        // Prevent the Obsidian editor from selecting the embed link with the editing cursor when a user interacts with the view.
        el.addEventListener('click', (ev) => ev.stopPropagation());

        viewHeader.hide();

        internalEmbedDiv.addEventListener('focusin', () => {
            updateHeader();
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
    })
}