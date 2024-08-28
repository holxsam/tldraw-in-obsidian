import { Editor } from "@tldraw/tldraw";
import { App, ButtonComponent, Modal, normalizePath, Notice, Setting, TFile } from "obsidian";
import TldrawPlugin from "src/main";
import { getDir, pathBasename } from "src/utils/path";
import { createRawTldrawFile } from "src/utils/tldraw-file";

type SaveFileModalOptions = {
    defaultName: string,
    editor: Editor
}

class SaveFileModal extends Modal {
    plugin: TldrawPlugin;
    options: SaveFileModalOptions;

    constructor(plugin: TldrawPlugin, options: SaveFileModalOptions) {
        super(plugin.app);
        this.plugin = plugin;
        this.options = options;
    }

    onOpen(): void {
        const { contentEl, options: { defaultName } } = this;
        const activeFilePath = this.app.workspace.getActiveFile()?.path ?? ''
        const defaultDir = getDir(activeFilePath);

        contentEl.createEl('h1', {
            text: 'Save file'
        })

        let saveSetting: Setting | undefined = undefined;

        const folderSetting = {
            folder: '',
            setting: new Setting(contentEl)
                .setName("Folder"),
            init() {
                this.setting.addText((text) => text
                    .setValue(defaultDir)
                    .onChange((value) => this.update(value))
                );
                this.update(defaultDir);
            },
            update(value: string) {
                value = normalizePath(value);
                if (value.length === 0) {
                    value = '/'
                }
                this.folder = value;
                this.setting.setDesc(`Using "${this.folder}"\n`)
                saveSetting?.setDesc(`Saving to "${folderSetting.folder}/${fileNameSetting.fileName}"`)
            }
        };

        folderSetting.init()

        const fileNameSetting = {
            fileName: '',
            setting: new Setting(contentEl)
                .setName("File name"),
            init() {
                this.setting.addText((text) => text
                    .setValue(defaultName)
                    .onChange((value) => this.update(value))
                )
                this.update(defaultName);
            },
            update(value: string) {
                value = pathBasename(normalizePath(value));
                if (value.length === 0) {
                    value = defaultName;
                }
                if (!value.endsWith('.tldr')) {
                    value += '.tldr';
                }
                this.fileName = value;
                this.setting.setDesc(`Using "${this.fileName}"`)
                saveSetting?.setDesc(`Saving to "${folderSetting.folder}/${fileNameSetting.fileName}"`)
            }
        };

        fileNameSetting.init();

        saveSetting = new Setting(contentEl)
            .setDesc(`Saving to "${folderSetting.folder}/${fileNameSetting.fileName}"`)
            .addButton((btn) =>
                btn
                    .setButtonText("Submit")
                    .setCta()
                    .onClick(() => {
                        const filePath = `${folderSetting.folder}/${fileNameSetting.fileName}`;
                        this.saveFile(filePath).catch((e) => {
                            console.log(e);
                            const notice = new Notice(`There was an error saving the file to "${filePath}".`);
                            notice.noticeEl.createDiv({
                                text: `${e}`
                            })
                        });
                    })
            );
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async saveFile(path: string) {
        const tFile = await this.plugin.app.vault.create(path,
            JSON.stringify(createRawTldrawFile(this.options.editor.store))
        )
        this.close()

        new FileSavedModal(this.app, this.plugin, tFile).open()
    }
}

class FileSavedModal extends Modal {
    tFile: TFile;
    plugin: TldrawPlugin;

    constructor(app: App, plugin: TldrawPlugin, tFile: TFile) {
        super(app);
        this.tFile = tFile;
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl, tFile } = this;
        contentEl.createEl('h1', {
            text: 'File saved'
        })

        contentEl.createEl('p', {
            text: `Created file "${tFile.path}"`
        })

        new ButtonComponent(contentEl)
            .setCta()
            .setButtonText('Open (system default)')
            .onClick(async () => {
                await this.app.openWithDefaultApp(tFile.path);
                this.close()
            })

        new ButtonComponent(contentEl)
            .setCta()
            .setButtonText('Open in new tab')
            .onClick(async () => {
                await this.plugin.app.workspace.getLeaf('tab').openFile(tFile);
                this.close()
            });
    }
}

export function showSaveFileModal(plugin: TldrawPlugin, options: SaveFileModalOptions) {
    new SaveFileModal(plugin, options).open()
}