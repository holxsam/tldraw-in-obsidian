import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { createRootAndRenderTldrawApp } from "src/components/TldrawApp";
import TldrawPlugin from "src/main";
import { CustomMutationObserver } from "src/utils/debug-mutation-observer";
import { ConsoleLogParams, LOGGING_ENABLED, logFn } from "src/utils/logging";
import { parseTLData } from "src/utils/parse";

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

        internalEmbedDiv.addClass('tldraw-markdown-view');

        if (markdownEmbed) {
            const tldrawViewHeader = internalEmbedDiv.createDiv({
                cls: ['tldraw-view-header'],
            });

            tldrawViewHeader.style.display = 'flex';
            tldrawViewHeader.style.justifyContent = 'space-between';
            tldrawViewHeader.style.alignItems = 'baseline';

            const tldrawTitle = tldrawViewHeader.createDiv({
                cls: ['embed-title', 'markdown-embed-title']
            })

            tldrawTitle.innerText = file.name;

            tldrawViewHeader.createEl('button', {
                cls: ['clickable'],
                text: 'Edit',
            }, (el) => {
                el.addEventListener('click', async (ev) => {
                    plugin.openTldrFile(file, 'new-tab')
                })
            });

            internalEmbedDiv.removeClass("markdown-embed");
            internalEmbedDiv.removeClass("inline-embed");
            // TODO: Uncomment later when added prerendered tldraw view support.
            // internalEmbedDiv.addClass("media-embed");
            // internalEmbedDiv.addClass("image-embed");
        }

        const tldrawViewContent = internalEmbedDiv.createDiv({
            cls: ['tldraw-view-content'],
        }, (el) => {
            el.style.height = '300px';
            // Prevent the Obsidian editor from selecting the embed link with the editing cursor when a user interacts with the view.
            el.addEventListener('click', (ev) => ev.stopPropagation());
            el.addEventListener('focus', function tldrawFocusListener() {
                log(`${tldrawFocusListener.name}`)
            });
        });


        const parent = internalEmbedDiv.parentElement;

        if (parent === null) throw Error(`${markdownPostProcessor.name}: No parent element for internalEmbedDiv.\n\n\tIt is needed to ensure the attached react root component is unmounted properly.`);

        const fileData = await plugin.app.vault.read(file);
        const parsedData = parseTLData(plugin.manifest.version, fileData);
        log('tldrawViewContent', tldrawViewContent);
        log('parsedData', parsedData);

        const reactRoot = createRootAndRenderTldrawApp(tldrawViewContent,
            parsedData.raw,
            (_) => {
                console.log('Ignore saving file due to read only mode.');
            },
            plugin.settings,
            {
                isReadonly: true
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
