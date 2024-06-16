import { Root } from "react-dom/client";

/**
 * Wraps the react root in an iframe. The iframe ensures tldraw's context menu are visible when near the edge of the react root.
 * 
 * #ISSUE: Cannot open the obsidian command palette when inside this iframe.
 * 
 * #ISSUE cont'd: Workaround this by forwarding keyboard events, but when closing the command palette an error is thrown:
 *   
 * ```
 * app.js:1 Uncaught TypeError: n.instanceOf is not a function
 * at app.js:1:1456955
 * ```
 * 
 * @param tldrawContainer 
 * @param createReactRoot 
 * @param useIframe 
 * @returns 
 */
export default function wrapReactRoot(
    tldrawContainer: Element,
    createReactRoot: (entryPoint: Element) => Root,
): Promise<Root> {
    return new Promise((res) => {
        tldrawContainer.createEl('iframe', {
            attr: {
                src: 'about:blank'
            }
        }, async (el) => {
            el.style.height = '100%'
            el.style.width = '100%'
            el.addEventListener('load', (ev) => {
                el.contentDocument!.addEventListener('keydown', (ev) => {
                    ev.stopPropagation(); // Don't think this is necessary, but just do it anyways.

                    const fakedEvent = new KeyboardEvent('keydown', {
                        isComposing: ev.isComposing,
                        repeat: ev.repeat,
                        key: ev.key,
                        code: ev.code,
                        ctrlKey: ev.ctrlKey,
                        bubbles: ev.bubbles,
                        shiftKey: ev.shiftKey,
                        metaKey: ev.metaKey,
                        view: ev.win
                    });

                    el.dispatchEvent(fakedEvent);
                })

                const reactEntrypoint = tldrawContainer.createDiv({
                    attr: {
                        id: 'react-entrypoint'
                    }
                });

                const styles = el.doc.head.children;

                const head = el.contentWindow!.document.head;

                for (let i = 0; i < styles.length; i++) {
                    head.appendChild(styles[i].cloneNode(true));
                }

                const body = el.contentWindow!.document.body;
                body.append(reactEntrypoint);

                reactEntrypoint.style.height = '100%'

                res(createReactRoot(reactEntrypoint));
            })
        });
    });
}
