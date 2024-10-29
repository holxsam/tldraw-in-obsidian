import { ExtraButtonComponent, Notice, TextComponent, Setting, TFolder, TFile } from "obsidian";
import { FileSearchModal } from "../modal/FileSearchModal";
import TldrawPlugin from "src/main";
import { IconNames } from "src/types/tldraw";
import { iconTypes } from "./constants";
import { iconExtensions } from "./constants";
import { TLDRAW_VERSION } from "src/utils/constants";
import IconsSettingsManager from "./IconsSettingsManager";
import { DownloadInfo } from "src/utils/fetch/download";

export function createIconOverridesSettingsEl(plugin: TldrawPlugin, containerEl: HTMLElement,
    manager: IconsSettingsManager, downloadIcon: (icon: IconNames, config: DownloadInfo) => void
) {
    const currentValue = () => Object.entries(manager.overrides)
        .filter((e): e is [typeof e[0], NonNullable<typeof e[1]>] => e[1] !== undefined);
    let resetButton: undefined | ExtraButtonComponent;
    const _saveIconSettings = async (updates: {
        [iconName in IconNames]?: string | null
    } | null) => {
        await manager.saveIconSettings(updates);
        resetButton?.setDisabled(currentValue().length === 0);
    }

    new Setting(containerEl)
        .setName('Use icon set')
        .setDesc('Select a folder to load an icon set from. This option will only update an override if an icon name in the provided folder matches one of the names below.')
        .addButton((button) => {
            button.setIcon('file-search').onClick(() => {
                new FileSearchModal(plugin, {
                    setSelection: async (file) => {
                        if (file instanceof TFolder) {
                            const updates: NonNullable<Parameters<typeof _saveIconSettings>[0]> = {};
                            for (const child of file.children) {
                                if (!(child instanceof TFile)) continue;

                                if ((iconExtensions as readonly string[]).includes(child.extension)
                                    && (iconTypes as readonly string[]).includes(child.basename)
                                ) {
                                    updates[child.basename as IconNames] = child.path;
                                }

                            }
                            await _saveIconSettings(updates);

                            new Notice(`Updated icon overrides for ${Object.entries(updates).length}`);
                        }
                    },
                    selectDir: true,
                    extensions: [],
                    onEmptyStateText: (searchPath) => (
                        `No folders found at "${searchPath}"`
                    )
                }).open()
            })
        })
        .addExtraButton((button) => {
            resetButton = button.setIcon('rotate-ccw')
                .setTooltip('Clear all overrides')
                .setDisabled(currentValue().length === 0)
                .onClick(async () => {
                    await _saveIconSettings(null)
                })
        })

    const newIconOverrideSetting = (icon: IconNames) => {
        const currentValue = () => manager.overrides[icon];
        let resetButton: undefined | ExtraButtonComponent;
        const setIcon = async (iconPath: string | null) => manager.setIconPath(icon, iconPath);

        manager.onChanged(icon, () => {
            textInput?.setValue(currentValue() ?? '')
            resetButton?.setDisabled(currentValue() === undefined)
        })

        let textInput: undefined | TextComponent;
        const current = currentValue();
        const config = manager.getDownloadConfig(icon);
        return new Setting(containerEl)
            .addText((text) => {
                textInput = text
                    .setValue(current ?? '')
                    .setPlaceholder('[ DEFAULT ]')
                textInput.inputEl.readOnly = true;
            })
            .addButton((button) => {
                button.setIcon('file-search').onClick(() => {
                    new FileSearchModal(plugin, {
                        extensions: [...iconExtensions],
                        initialSearchPath: currentValue(),
                        onEmptyStateText: (searchPath) => (
                            `No folders or icons found at "${searchPath}"`
                        ),
                        setSelection: (file) => {
                            if (!(file instanceof TFile)) {
                                const path = typeof file === 'string' ? file : file.path;
                                new Notice(`"${path}" is not a valid file.`);
                                return;
                            }
                            return setIcon(file.path);
                        },
                    }).open()
                })
            })
            .addExtraButton((button) => {
                button.setIcon('download')
                    .setTooltip(`Download from ${config.url}`)
                    .onClick(() => downloadIcon(icon, config))
            })
            .addExtraButton((button) => {
                resetButton = button.setIcon('rotate-ccw')
                    .setTooltip('Use default')
                    .setDisabled(current === undefined)
                    .onClick(async () => {
                        await setIcon(null)
                    })
            });
    }

    containerEl.createEl("h2", { text: "Individual icon overrides." });
    containerEl.createEl('p', {
        text: 'Click an icon name to view the default in your web browser. All of the default icons are available to browse on '
    }, (el) => {
        const href = `https://github.com/tldraw/tldraw/tree/v${TLDRAW_VERSION}/assets/icons/icon`;
        el.createEl('a', {
            text: 'tldraw\'s GitHub repository',
            href,
            title: href
        })
        el.appendText('.')
    })

    for (const icon of iconTypes) {
        const setting = newIconOverrideSetting(icon);
        const href = `https://github.com/tldraw/tldraw/blob/v${TLDRAW_VERSION}/assets/icons/icon/${icon}.svg`;
        setting.nameEl.createEl('a', {
            text: icon,
            href,
            title: href
        });
    }
}