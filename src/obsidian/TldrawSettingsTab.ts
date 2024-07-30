import { clamp, msToSeconds } from "src/utils/utils";
import TldrawPlugin from "../main";
import {
	App,
	ExtraButtonComponent,
	MomentFormatComponent,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
} from "obsidian";
import {
	DEFAULT_SAVE_DELAY,
	MAX_SAVE_DELAY,
	MIN_SAVE_DELAY,
} from "src/utils/constants";
import { FontSearchModal } from "./settings/FontSearchModal";
import { updateFontOverrides } from "./plugin/settings";

export type ThemePreference = "match-theme" | "dark" | "light";

export interface TldrawPluginSettings {
	folder: string;
	saveFileDelay: number; // in seconds
	newFilePrefix: string;
	newFileTimeFormat: string;
	toolSelected: string;
	themeMode: ThemePreference;
	gridMode: boolean;
	snapMode: boolean;
	debugMode: boolean;
	focusMode: boolean;
	fonts?: {
		overrides?: {
			draw?: string,
			monospace?: string,
			sansSerif?: string,
			serif?: string,
		}
	}
}

export const DEFAULT_SETTINGS = {
	folder: "tldraw",
	saveFileDelay: 0.5,
	newFilePrefix: "Tldraw ",
	newFileTimeFormat: "YYYY-MM-DD h.mmA",
	toolSelected: "select",
	themeMode: "light",
	gridMode: false,
	snapMode: false,
	debugMode: false,
	focusMode: false,
} as const satisfies TldrawPluginSettings;

export class TldrawSettingsTab extends PluginSettingTab {
	plugin: TldrawPlugin;

	constructor(app: App, plugin: TldrawPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.containerEl.createEl("h1", { text: "File" });

		new Setting(containerEl)
			.setName("Save folder")
			.setDesc("The folder that tldraw files will be created in.")
			.addText((text) =>
				text
					.setPlaceholder("root")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;

						await this.plugin.saveSettings();
					})
			);

		const defaultDelay = msToSeconds(DEFAULT_SAVE_DELAY);
		const minDelay = msToSeconds(MIN_SAVE_DELAY);
		const maxDelay = msToSeconds(MAX_SAVE_DELAY);

		const saveDelaySetting = new Setting(containerEl)
			.setName("Save delay")
			.setDesc(
				`The delay in seconds to automatically save after a change has been made to a tlraw drawing. Must be a value between ${minDelay} and ${maxDelay} (1 hour). Requires reloading any tldraw files you may have open in a tab.`
			)
			.addText((text) =>
				text
					.setPlaceholder(`${defaultDelay}`)
					.setValue(`${this.plugin.settings.saveFileDelay}`)
					.onChange(async (value) => {
						const parsedValue = parseInt(value);

						this.plugin.settings.saveFileDelay = clamp(
							isNaN(parsedValue) ? defaultDelay : parsedValue,
							minDelay,
							maxDelay
						);

						await this.plugin.saveSettings();
					})
			);

		saveDelaySetting.descEl.createEl("code", {
			cls: "ptl-default-code",
			text: `DEFAULT: [${DEFAULT_SETTINGS.saveFileDelay}]`,
		});

		const filePrefixSettings = new Setting(containerEl)
			.setName("New file prefix")
			.setDesc(
				"When creating a new tldraw file, the file name will automatically prepend the prefix. Can be left empty, however if both the prefix and time format are empty, it will use the defaults to name the file."
			)
			.addText((text) =>
				text
					.setPlaceholder("Prefix")
					.setValue(this.plugin.settings.newFilePrefix)
					.onChange(async (value) => {
						this.plugin.settings.newFilePrefix = value;
						await this.plugin.saveSettings();
					})
			);

		filePrefixSettings.descEl.createEl("code", {
			text: `DEFAULT: [${DEFAULT_SETTINGS.newFilePrefix} ]`,
			cls: "ptl-default-code",
		});

		let dateFormatSampleEl!: MomentFormatComponent;
		const dateFormat = new Setting(containerEl)
			.setName("New file time format")
			.setDesc(
				"When creating a new tldraw file, this represents the time format that will get appended to the file name. It can be left empty, however if both the Prefix and Time Format are empty, it will use the defaults to name the file. "
			)
			.addMomentFormat((format: MomentFormatComponent) => {
				dateFormatSampleEl = format
					.setDefaultFormat(DEFAULT_SETTINGS.newFileTimeFormat)
					.setPlaceholder(DEFAULT_SETTINGS.newFileTimeFormat)
					.setValue(this.plugin.settings.newFileTimeFormat)
					.onChange(async (value) => {
						this.plugin.settings.newFileTimeFormat = value;
						await this.plugin.saveSettings();
					});
			});

		const referenceLink = dateFormat.descEl.createEl("a");
		referenceLink.setText("Date Format Reference");
		referenceLink.setAttr(
			"href",
			"https://momentjs.com/docs/#/displaying/format/"
		);

		const text = dateFormat.descEl.createDiv("text");
		text.setText("Preview: ");
		const sampleEl = text.createSpan("sample");
		dateFormatSampleEl.setSampleEl(sampleEl);
		dateFormat.addExtraButton((button) => {
			button
				.setIcon("reset")
				.setTooltip("reset")
				.onClick(async () => {
					this.plugin.settings.newFileTimeFormat =
						DEFAULT_SETTINGS.newFileTimeFormat;
					await this.plugin.saveSettings();
					this.display();
				});
		});

		this.containerEl.createEl("h1", { text: "Start up" });

		new Setting(containerEl)
			.setName("Theme")
			.setDesc(
				"When opening a tldraw file, this setting decides what theme should be applied."
			)
			.addDropdown((cb) => {
				cb.addOption("light", "Light theme")
					.addOption("dark", "Dark theme")
					.addOption("match-theme", "Match theme")
					.setValue(this.plugin.settings.themeMode)
					.onChange(async (value) => {
						this.plugin.settings.themeMode =
							value as ThemePreference;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Default tool")
			.setDesc(
				"When opening a tldraw file, this setting decides which tool should be selected."
			)
			.addDropdown((cb) => {
				cb.addOption("select", "Select")
					.addOption("hand", "Hand")
					.addOption("draw", "Draw")
					.addOption("text", "Text")
					.addOption("eraser", "Eraser")
					.addOption("highlight", "Highlight")
					.addOption("rectangle", "Rectangle")
					.addOption("ellipse", "Ellipse")
					.setValue(this.plugin.settings.toolSelected)
					.onChange(async (value) => {
						this.plugin.settings.toolSelected =
							value as ThemePreference;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Grid mode")
			.setDesc(
				"When opening tldraw files, this setting determines whether grid mode is enabled. Keep in mind that enabling grid mode will both show a grid and enforce snap-to-grid functionality."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.gridMode);
				cb.onChange(async (value) => {
					this.plugin.settings.gridMode = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Snap mode")
			.setDesc(
				"When opening tldraw files, this setting determines whether snap mode is enabled. Snap mode is a feature that places guides on shapes as you move them, ensuring they align with specific points or positions for precise placement."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.snapMode);
				cb.onChange(async (value) => {
					this.plugin.settings.snapMode = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Focus mode")
			.setDesc(
				"When opening tldraw files, this setting determines whether to launch tldraw in focus mode. Great if you like to use tldraw to quickly jot something down."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.focusMode);
				cb.onChange(async (value) => {
					this.plugin.settings.focusMode = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"When opening tldraw files, this setting toggles the tldraw debug mode. Debug mode is useful for the developer."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.debugMode);
				cb.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				});
			});

		{ // Fonts settings
			this.containerEl.createEl("h1", { text: "Fonts" });

			this.containerEl.createEl("h2", { text: "Default font overrides" });

			const saveFontSettings = async (updates: {
				draw?: string | null,
				sansSerif?: string | null,
				serif?: string | null,
				monospace?: string | null
			}) => {
				this.plugin.settings.fonts = {
					overrides: updateFontOverrides(
						this.plugin.settings.fonts?.overrides, updates
					)
				}
				await this.plugin.saveSettings();
			}

			const newFontOverrideSetting = (args: {
				name: string,
				font: keyof Parameters<typeof saveFontSettings>[0],
				appearsAs: string,
			}) => {
				const currentValue = () => this.plugin.settings.fonts?.overrides?.[args.font];
				let resetButton: undefined | ExtraButtonComponent;
				const setFont = async (fontPath: string | null) => {
					if (fontPath !== null && fontPath.length === 0) {
						fontPath = null;
					}
					await saveFontSettings({ [args.font]: fontPath });
					if (fontPath) {
						new Notice(`Updated font override for "${args.font}" to "${fontPath}"`);
					} else {
						new Notice(`Reset font "${args.font}" to default.`);
					}
					textInput?.setValue(currentValue() ?? '')
					resetButton?.setDisabled(currentValue() === undefined)
				}
				let textInput: undefined | TextComponent;
				const current = currentValue();
				return new Setting(containerEl)
					.setName(args.name)
					.setDesc(`Appears as "${args.appearsAs}" in the style panel.`)
					.addText((text) => {
						textInput = text
							.setValue(current ?? '')
							.setPlaceholder('[ DEFAULT ]')
						textInput.inputEl.readOnly = true;
					})
					.addButton((button) => {
						button.setIcon('file-search').onClick(() => {
							new FontSearchModal(this.plugin, {
								setFont,
								initialValue: currentValue(),
							}).open()
						})
					})
					.addExtraButton((button) => {
						resetButton = button.setIcon('rotate-ccw')
							.setTooltip('Use default')
							.setDisabled(current === undefined)
							.onClick(async () => {
								await setFont(null)
							})
					})
			}

			newFontOverrideSetting({
				name: 'Draw (handwriting) font',
				font: 'draw',
				appearsAs: 'draw',
			});
			newFontOverrideSetting({
				name: 'Sans-serif font',
				font: 'sansSerif',
				appearsAs: 'sans',
			});
			newFontOverrideSetting({
				name: 'Serif font',
				font: 'serif',
				appearsAs: 'serif',
			});
			newFontOverrideSetting({
				name: 'Monospace font',
				font: 'monospace',
				appearsAs: 'mono',
			});
		}
	}
}
