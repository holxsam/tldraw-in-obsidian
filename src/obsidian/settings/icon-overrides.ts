import { ExtraButtonComponent, Notice, TextComponent, Setting, TFolder, TFile } from "obsidian";
import { FileSearchModal } from "../modal/FileSearchModal";
import { updateIconOverrides } from "../plugin/settings";
import TldrawPlugin from "src/main";
import { IconTypes } from "src/types/tldraw";
import { iconTypes } from "./constants";
import { iconExtensions } from "./constants";

export function createIconOverridesSettingsEl(plugin: TldrawPlugin, containerEl: HTMLElement) {
    const currentValue = () => Object.entries(plugin.settings.icons?.overrides ?? {})
        .filter((e): e is [typeof e[0], NonNullable<typeof e[1]>] => e[1] !== undefined);
    let resetButton: undefined | ExtraButtonComponent;
    const saveIconSettings = async (updates: {
        [iconName in IconTypes]?: string | null
    } | null) => {
        plugin.settings.icons = updates === null ? undefined : {
            overrides: updateIconOverrides(
                plugin.settings.icons?.overrides, updates
            )
        }
        await plugin.saveSettings();

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
                            const updates: NonNullable<Parameters<typeof saveIconSettings>[0]> = {};
                            for (const child of file.children) {
                                if (!(child instanceof TFile)) continue;

                                if ((iconExtensions as readonly string[]).includes(child.extension)
                                    && (iconTypes as readonly string[]).includes(child.basename)
                                ) {
                                    updates[child.basename] = child.path;
                                }

                            }
                            await saveIconSettings(updates);

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
                    await saveIconSettings(null)
                })
        })

    const newIconOverrideSetting = (icon: IconTypes) => {
        const currentValue = () => plugin.settings.icons?.overrides?.[icon];
        let resetButton: undefined | ExtraButtonComponent;
        const setIcon = async (iconPath: string | null) => {
            if (iconPath !== null && iconPath.length === 0) {
                iconPath = null;
            }
            await saveIconSettings({ [icon]: iconPath });
            if (iconPath) {
                new Notice(`Updated icon override for "${icon}" to "${iconPath}"`);
            } else {
                new Notice(`Reset icon "${icon}" to default.`);
            }
            textInput?.setValue(currentValue() ?? '')
            resetButton?.setDisabled(currentValue() === undefined)
        }
        let textInput: undefined | TextComponent;
        const current = currentValue();
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
                        initialValue: currentValue(),
                        onEmptyStateText: (searchPath) => (
                            `No folders or icons found at "${searchPath}"`
                        ),
                        setSelection: (file) => setIcon(file.path),
                    }).open()
                })
            })
            .addExtraButton((button) => {
                resetButton = button.setIcon('rotate-ccw')
                    .setTooltip('Use default')
                    .setDisabled(current === undefined)
                    .onClick(async () => {
                        await setIcon(null)
                    })
            })
    }

    containerEl.createEl("h2", { text: "Individual icon overrides." });
    containerEl.createEl('p', {
        text:  'Click an icon name to view the default in your web browser. All of the default icons are hosted on '
    }, (el) => {
        el.createEl('a', {
            text: 'tldraw\'s GitHub repository',
            href: 'https://github.com/tldraw/tldraw/tree/main/assets/icons/icon'
        })
        el.appendText('.')
    })

    for (const icon of iconTypes) {
        const setting = newIconOverrideSetting(icon);
        setting.nameEl.createEl('a', {
            text: icon,
            href: `https://github.com/tldraw/tldraw/blob/main/assets/icons/icon/${icon}.svg`
        });
    }
}