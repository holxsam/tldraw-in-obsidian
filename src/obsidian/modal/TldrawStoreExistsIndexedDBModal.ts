import { ButtonComponent, Modal, TFile } from "obsidian";
import { TldrawView } from "../TldrawView";
import { StoreSnapshot, TLRecord } from "tldraw";
import { TLDataDocumentStore } from "src/utils/document";
import { createRootAndRenderTldrawApp, TldrawAppProps } from "src/components/TldrawApp";
import { Root } from "react-dom/client";
import { tldrawStoreIndexedDBName } from "src/tldraw/indexeddb-store";

export class TldrawStoreConflictResolveFileUnloaded extends Error { }
export class TldrawStoreConflictResolveCanceled extends Error {
    constructor(
        private readonly view: TldrawView,
        private readonly tFile: TFile,
        private readonly documentStore: TLDataDocumentStore,
    ) { super(TldrawStoreConflictResolveCanceled.name); }

    reshowModal() {
        return TldrawStoreExistsIndexedDBModal.showResolverModal(this.view, this.tFile, this.documentStore);
    }
}

export default class TldrawStoreExistsIndexedDBModal extends Modal {
    private markdownStorePreview: HTMLElement;
    private indexedDBStorePreview: HTMLElement;
    private markdownTldrawRoot?: Root;
    private indexedDBTldrawRoot?: Root;
    private replaceButton?: ButtonComponent;

    static showResolverModal(view: TldrawView, tFile: TFile, documentStore: TLDataDocumentStore): Promise<StoreSnapshot<TLRecord> | undefined> {
        return new Promise((res, rej) => {
            new TldrawStoreExistsIndexedDBModal(
                view, tFile, documentStore, res, rej
            ).open();
        });
    }

    constructor(
        private readonly view: TldrawView,
        private readonly tFile: TFile,
        private readonly documentStore: TLDataDocumentStore,
        private readonly res: (snapshot?: StoreSnapshot<TLRecord>) => void,
        private readonly rej: (reason?: unknown) => void
    ) {
        super(view.app);

        view.registerOnUnloadFile(() => {
            this.close();
            rej(new TldrawStoreConflictResolveFileUnloaded());
        });

        this.setTitle(`Conflict resolver - ${tFile.path}`);

        const compareEl = this.contentEl.createDiv({
            cls: 'ptl-compare-tldraw-container'
        });

        compareEl.createDiv({
            cls: 'ptl-compare-tldraw'
        }, (div) => {
            div.createEl('b', { text: `Markdown Store - ${tFile.path}` });
            new ButtonComponent(div).setButtonText('Use this version').onClick(() => {
                res();
                this.close();
            })
            this.markdownStorePreview = div.createDiv({
                cls: 'ptl-markdown-preview',
                attr: {
                    style: 'height: 100%;'
                }
            });
        });

        compareEl.createDiv({
            cls: 'ptl-compare-tldraw'
        }, (div) => {
            div.createEl('b', { text: `IndexedDB Store - ${tldrawStoreIndexedDBName(documentStore.meta.uuid)}` });
            this.replaceButton = new ButtonComponent(div).setButtonText('Loading snapshot').setDisabled(true);
            this.indexedDBStorePreview = div.createDiv({
                cls: 'ptl-indexed-db-preview',
                attr: {
                    style: 'height: 100%;'
                }
            });
        });
    }

    reset() {
        this.markdownTldrawRoot?.unmount();
        this.markdownTldrawRoot = undefined;
        this.indexedDBTldrawRoot?.unmount();
        this.indexedDBTldrawRoot = undefined;
    }

    onOpen(): void {
        super.onOpen();
        this.reset();

        const sharedAppProps = {
            assetStore: this.documentStore.store.props.assets,
            isReadonly: true,
            inputFocus: true,
            selectNone: true,
            hideUi: true,
            initialTool: 'hand',
            zoomToBounds: true,
        } satisfies TldrawAppProps['options'];

        this.markdownTldrawRoot = createRootAndRenderTldrawApp(
            this.markdownStorePreview,
            this.view.plugin,
            {
                store: { plugin: this.documentStore },
                app: sharedAppProps,
            }
        );
        this.indexedDBTldrawRoot = createRootAndRenderTldrawApp(
            this.indexedDBStorePreview,
            this.view.plugin,
            {
                store: {
                    tldraw: {
                        persistenceKey: this.documentStore.meta.uuid,
                        // We use share the same asset store since some assets may have been stored in the markdown.
                        assets: sharedAppProps.assetStore,
                    }
                },
                app: {
                    ...sharedAppProps,
                    onInitialSnapshot: (snapshot) => {
                        this.replaceButton?.setButtonText('Replace with this version').onClick(() => {
                            this.res(snapshot);
                            this.close();
                        }).setDisabled(false);
                        // this.replaceAndDeleteButton?.setButtonText('Replace with this version and DELETE this version').onClick(async () => {
                        //     // TODO: Check if any assets are stored in the snapshot or indexed db, and ask the user if they want to transfer those as vault files well.
                        //     this.res(snapshot);
                        //     try {
                        //         // await TldrawStoreViewIndexedDB.delete(this.documentStore.meta.uuid);
                        //         this.close();
                        //     } catch (e) {
                        //         new Notice('Unable to delete indexed db (see developer console for more details)');
                        //         console.error(e);
                        //     }
                        // }).setDisabled(false);
                    },
                },
            }
        );
    }

    onClose(): void {
        this.reset();
        this.rej(new TldrawStoreConflictResolveCanceled(
            this.view, this.tFile, this.documentStore
        ));
        super.onClose();
    }
}
