import { Editor, MarkdownPostProcessorContext, TFile } from "obsidian";
import TldrawPlugin from "src/main";
import { CustomMutationObserver } from "src/utils/debug-mutation-observer";
import { ConsoleLogParams, LOGGING_ENABLED, logFn } from "src/utils/logging";
import { BoxLike } from "tldraw";
import { TldrawMarkdownRenderChild } from "../components/tldraw-component";

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

    // Inspired by: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L575

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
    const isCanvas = internalEmbedDiv.hasClass("canvas-node-content");
    const isEmbed = isInternal || isCanvas;
    if (isEmbed && isMarkdownView) {
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

        const component = await loadEmbedTldraw({
            embedValues, file, internalEmbedDiv, plugin,
        });

        context.addChild(component);

        const awaitInitialLoad = () => component.awaitInitialLoad(2500).catch(errorLoading);
        const errorLoading = (e: unknown) => {
            // const errorDiv = internalEmbedDiv.createDiv();
            // errorDiv.createEl('p', {
            //     text: e instanceof Error ? e.message : 'Error'
            // });
            // new ButtonComponent(errorDiv).setButtonText('Reload').onClick(() => {
            //     errorDiv.remove();
            //     if (component.isContentLoaded()) return;
            //     component.unload();
            //     component.load();
            //     awaitInitialLoad();
            // });
        };

        return awaitInitialLoad();
    } else if (!isEmbed && isMarkdownView) {
        throw new Error(`${markdownPostProcessor.name}: Unexpected`);
    }
    throw new Error(`${markdownPostProcessor.name}: Unexpected`);
}

async function loadEmbedTldraw({
    embedValues, file, internalEmbedDiv, plugin,
}: {
    embedValues: ReturnType<typeof parseEmbedValues>,
    file: TFile,
    internalEmbedDiv: HTMLElement,
    plugin: TldrawPlugin,
}) {
    const parent = internalEmbedDiv.parentElement;
    const workspaceLeafEl = internalEmbedDiv.closest('.workspace-leaf');
    if (parent === null || !(workspaceLeafEl instanceof HTMLElement)) throw Error(`${markdownPostProcessor.name}: No parent element for internalEmbedDiv.\n\n\tIt is needed to ensure the attached react root component is unmounted properly.`);
    const deferrables = new Set<() => void>();
    const component = new TldrawMarkdownRenderChild(
        internalEmbedDiv,
        plugin,
        {
            tFile: file,
            initialEmbedValues: embedValues,
            onUpdatedBounds: (bounds) => {
                if (
                    'cmView' in internalEmbedDiv
                    && typeof internalEmbedDiv.cmView === 'object'
                    && internalEmbedDiv.cmView
                    && 'widget' in internalEmbedDiv.cmView
                ) {
                    const widget = internalEmbedDiv.cmView.widget as InternalEmbedWidget;
                    // @ts-ignore
                    const editor = widget.editor.owner.editor as Editor;
                    updateEmbedBounds(widget, bounds, editor);
                } else {
                    console.warn("No active editor; setting the controller's bounds instead.");
                    component.updateBounds(bounds);
                }
            },
            deferUntilIsShown: (cb) => {
                deferrables.add(cb);
                return () => {
                    deferrables.delete(cb);
                }
            },
            isWorkspaceLeafShown: () => workspaceLeafEl.isShown()
        }
    );

    await component.loadRoot();

    const observer = new CustomMutationObserver((m) => {
        if (component?.root === undefined) {
            component.loadRoot().then(() => {
                observerParent.observe(parent, { childList: true });
            });
            return;
        }

        const { target, attributeName } = m[0]
        if (!(target instanceof HTMLElement) || !(["alt", "width", "height"] as (string | null)[]).contains(attributeName)) {
            return;
        }

        component.updateEmbedValues(parseEmbedValues(target, {
            showBgDefault: plugin.settings.embeds.showBg
        }));
    }, "markdownPostProcessorObserverFn");
    observer.observe(internalEmbedDiv, { attributes: true });

    const observerParent = new CustomMutationObserver(function markdownParentObserverFn(m) {
        if (!parent.contains(internalEmbedDiv)) {
            component.unloadRoot()
            observerParent.disconnect();
            return;
        }
    }, "markdownPostProcessorObserverFn");
    observerParent.observe(parent, { childList: true });

    /**
     * This observer is interested in the style attribute of the workspace leaf element since it includes
     * display: none; whenever the leaf is behind a tab.
     */
    const workspaceLeafElObserver = new MutationObserver((_) => {
        if (workspaceLeafEl.isShown() && deferrables.size) {
            const _deferrables = [...deferrables];
            deferrables.clear();
            for (const deferrable of _deferrables) {
                deferrable();
            }
        }
    });
    workspaceLeafElObserver.observe(workspaceLeafEl, { attributeFilter: ['style'] })

    return component;
}

function parseAltText(altText: string): Partial<Record<string, string>> {
    const altSplit = altText.split(';').map((e) => e.trim())
    const altEntries = altSplit.map((e) => e.split('='))
    return Object.fromEntries(altEntries);
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
    const altNamedProps = parseAltText(alt);

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

function replaceBoundsProps(bounds: BoxLike | undefined, props: Partial<Record<string, string>>) {
    if (bounds) {
        props['pos'] = `${bounds.x.toFixed(0)},${bounds.y.toFixed(0)}`;
        props['size'] = `${bounds.w.toFixed(0)},${bounds.h.toFixed(0)}`;
    } else {
        delete props['pos'];
        delete props['size'];
    }
    return props;
}

type InternalEmbedWidget = {
    start: number,
    end: number,
    /**
     * The filename of the embed
     */
    href: string,
    /**
     * This is corresponds to the "alt", "width", and "height" attribute of the internaleEmbedDiv.
     * 
     * ```js
     * `${alt}|${width}x${height}`
     * ```
     */
    title: string,
};

function updateEmbedBounds(widget: InternalEmbedWidget, bounds: BoxLike | undefined, editor: Editor) {
    const token = editor.getClickableTokenAt(editor.offsetToPos(widget.end));

    if (!token || token.type !== 'internal-link') {
        console.warn(`No internal link token at end position ${widget.end}`, widget);
        return;
    }

    if (widget.href !== token.text) {
        console.warn(`Internal link token does not match the provided widget`, {
            widget, token,
        });
        return;
    }

    updateEmbedBoundsAtInternalLink(token, bounds, editor);
}

type InternalLinkToken = Extract<ReturnType<Editor['getClickableTokenAt']>, {
    type: 'internal-link'
}>;

function updateEmbedBoundsAtInternalLink(token: InternalLinkToken, bounds: BoxLike | undefined, editor: Editor) {
    const [altText, ...rest] = token.displayText.split('|');
    editor.replaceRange(
        [
            token.text,
            Object.entries(replaceBoundsProps(bounds, parseAltText(altText)))
                .filter(([key, value]) => key.length > 0 && value !== undefined)
                .map(
                    ([key, value]) => `${key}=${value}`
                ).join(';'),
            ...rest
        ].join('|'),
        token.start,
        token.end
    );
}
