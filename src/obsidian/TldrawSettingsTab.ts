import { clamp, msToSeconds } from "src/utils/utils";
import TldrawPlugin from "../main";
import {
	App,
	DropdownComponent,
	ExtraButtonComponent,
	MomentFormatComponent,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
	TFile,
	TFolder,
} from "obsidian";
import {
	DEFAULT_SAVE_DELAY,
	MAX_SAVE_DELAY,
	MIN_SAVE_DELAY,
} from "src/utils/constants";
import { FileSearchModal } from "./modal/FileSearchModal";
import { FontOverrides, FontTypes, IconNames, IconOverrides } from "src/types/tldraw";
import { createIconOverridesSettingsEl } from "./settings/icon-overrides";
import { defaultFonts, fontExtensions } from "./settings/constants";
import IconsSettingsManager from "./settings/IconsSettingsManager";
import FontsSettingsManager from "./settings/FontsSettingsManager";
import DownloadManagerModal from "./modal/DownloadManagerModal";
import { DownloadInfo } from "src/utils/fetch/download";
import { validateFolderPath } from "./helpers/app";

export type ThemePreference = "match-theme" | "dark" | "light";

export const destinationMethods = ['attachments-folder', 'colocate', 'default-folder'] as const;

export type DestinationMethod = typeof destinationMethods[number];

export const destinationMethodsRecord = {
	'colocate': 'Colocate file',
	'default-folder': 'Use default folder',
	'attachments-folder': 'Use attachments folder',
} satisfies Record<DestinationMethod, string>;

export type FileDestinationsSettings = {
	/**
	 * The location where tldraw assets will be downloaded in
	 */
	assetsFolder: string;
	/**
	 * Whether to show an input to confirm the path of the new file.
	 * 
	 * By default, the input will be filled in with the path defined by {@linkcode FileDestinationsSettings.destinationMethod}
	 * 
	 * The modal will also show the following options:
	 * 
	 * - Colocate file, if there is an active file view
	 * - Default attachment folder as defined in the Obsidian settings
	 * - {@linkcode FileDestinationsSettings.defaultFolder}
	 */
	confirmDestination: boolean;
	/**
	 * The default folder to save new tldraw files in.
	 */
	defaultFolder: string,
	/**
	 * 
	 * # `colocate`
	 * If this is true then create new tldraw files in the same folder as the active note or file view.
	 * 
	 * If there is no active note or file view, then root directory is used.
	 * 
	 * # `attachments-folder`
	 * Use the attachments folder defined in the Obsidian "Files and links" settings. 
	 * 
	 */
	destinationMethod: DestinationMethod,
	/**
	 * When the colocate destination method is used, this folder will be used as its subfolder.
	 */
	colocationSubfolder: string,
};

/**
 * These are old settings, the properties have been marked as deprecated to assist the programmer migrate these settings.
 */
type DeprecatedFileDestinationSettings = {
	/**
	 * @deprecated Migrate to {@linkcode TldrawPluginSettings.fileDestinations}
	 * The location where tldraw assets will be downloaded in
	 */
	assetsFolder?: string;
	/**
	 * @deprecated Migrate to {@linkcode TldrawPluginSettings.fileDestinations}
	 */
	folder?: string;
	/**
	 * @deprecated Migrate to {@linkcode TldrawPluginSettings.fileDestinations}
	 * Use the attachments folder defined in the Obsidian "Files and links" settings. 
	 */
	useAttachmentsFolder?: boolean;
};

export interface TldrawPluginSettings extends DeprecatedFileDestinationSettings {
	fileDestinations: FileDestinationsSettings;
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
		overrides?: FontOverrides
	},
	icons?: {
		overrides?: IconOverrides
	}
	embeds: {
		/**
		 * Default value to control whether to show the background for markdown embeds
		 */
		showBg: boolean
		/**
		 * Default value to control whether to show the background dotted pattern for markdown embeds
		 */
		showBgDots: boolean;
	};
}

export const DEFAULT_SETTINGS = {
	saveFileDelay: 0.5,
	newFilePrefix: "Tldraw ",
	newFileTimeFormat: "YYYY-MM-DD h.mmA",
	toolSelected: "select",
	themeMode: "light",
	gridMode: false,
	snapMode: false,
	debugMode: false,
	focusMode: false,
	fileDestinations: {
		confirmDestination: true,
		assetsFolder: "tldraw/assets",
		destinationMethod: "colocate",
		defaultFolder: "tldraw",
		colocationSubfolder: "",
	},
	embeds: {
		showBg: true,
		showBgDots: true,
	},
} as const satisfies Partial<TldrawPluginSettings>;

export class TldrawSettingsTab extends PluginSettingTab {
	plugin: TldrawPlugin;
	fontsSettingsManager: FontsSettingsManager;
	iconsSettingsManager: IconsSettingsManager;
	downloadManagerModal: DownloadManagerModal;

	constructor(app: App, plugin: TldrawPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.fontsSettingsManager = new FontsSettingsManager(this.plugin);
		this.iconsSettingsManager = new IconsSettingsManager(this.plugin);
		this.downloadManagerModal = new DownloadManagerModal(this.app);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.fileSettings();
		this.startUpSettings();
		this.embedsSettings();
		this.assetsSettings();
	}

	fileSettings() {
		const { containerEl } = this;
		containerEl.createEl("h1", { text: "File" });

		const updateDestinationMethodEl = (setting: Setting) => {
			setting.descEl.empty();
			setting.setDesc("The method to use for all new tldraw files.")
			let destination = '';
			switch (this.plugin.settings.fileDestinations.destinationMethod) {
				case "attachments-folder":
					destination = this.app.vault.config.attachmentFolderPath ?? '/';
					setting.descEl.createDiv({
						text: "Use the location defined in the \"Files and links\" options tab for newly created tldraw files if they are embed as an attachment."
					});
					break;
				case "colocate":
					destination = './' + this.plugin.settings.fileDestinations.colocationSubfolder;
					setting.descEl.createDiv({
						text: "Place files in the same directory as the active note/file. You can also optionally define a subfolder within that directory below."
					});
					break;
				case "default-folder":
					destination = this.plugin.settings.fileDestinations.defaultFolder;
					setting.descEl.createDiv({
						text: "Use the default folder from below."
					});
					break;
			}

			setting.descEl.createEl("code", {
				cls: "ptl-default-code",
				text: `Destination: ${destination}`
			});
		}
		let _dropdown: undefined | DropdownComponent;
		const updateDestinationMethod = async (method: DestinationMethod) => {
			this.plugin.settings.fileDestinations.destinationMethod = method;
			await this.plugin.saveSettings();
			updateDestinationMethodEl(destinationMethodSetting);
			_dropdown?.setValue(method);
		}
		const destinationMethodSetting = new Setting(containerEl)
			.setName("File destination method")
			.addDropdown((dropdown) => _dropdown = dropdown.addOptions(destinationMethodsRecord)
				.setValue(this.plugin.settings.fileDestinations.destinationMethod)
				.onChange(async (value) => {
					if (!(destinationMethods as readonly string[]).includes(value)) return;
					await updateDestinationMethod(value as DestinationMethod);
				})
			)
			.addExtraButton((button) => button.setIcon('reset')
				.onClick(() => updateDestinationMethod(DEFAULT_SETTINGS.fileDestinations.destinationMethod))
			).then(updateDestinationMethodEl)

		new Setting(containerEl)
			.setName('Colocation subfolder')
			.setDesc('The folder to use when using the colocation destination. Leave this blank to use the same folder as the current active file.')
			.addText((text) => text
				.setValue(this.plugin.settings.fileDestinations.colocationSubfolder)
				.onChange(async (value) => {
					const folder = value === '' ? '' : validateFolderPath(this.app, value)
					if (folder !== '' && !folder) return;
					this.plugin.settings.fileDestinations.colocationSubfolder = folder instanceof TFolder
						? folder.path : folder
						;
					await this.plugin.saveSettings();
					updateDestinationMethodEl(destinationMethodSetting);
				})
			);

		new Setting(containerEl)
			.setName("Default folder")
			.setDesc(`The folder to create new tldraw files in when the destination method is set to ${destinationMethodsRecord['default-folder']
				}, and the folder to show when the "Confirm destination" option is toggled.`)
			.addText((text) =>
				text
					.setPlaceholder("root")
					.setValue(this.plugin.settings.fileDestinations.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.fileDestinations.defaultFolder = value;

						await this.plugin.saveSettings();
						updateDestinationMethodEl(destinationMethodSetting);
					})
			);

		new Setting(containerEl)
			.setName("Confirm destination")
			.setDesc("Show a pop-up modal that allows confirming or editing the destination and choosing another destination method.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.fileDestinations.confirmDestination)
				.onChange(async (confirm) => {
					this.plugin.settings.fileDestinations.confirmDestination = confirm;
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
	}

	startUpSettings() {
		const { containerEl } = this;
		containerEl.createEl("h1", { text: "Start up" });

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
	}

	embedsSettings() {
		const { containerEl } = this;
		containerEl.createEl("h1", { text: "Embeds" });

		containerEl.createEl('p', {
			text: 'Reload Obsidian to apply changes'
		})

		new Setting(containerEl)
			.setName("Show background")
			.setDesc(
				"Whether to show the background for a markdown embed by default"
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.embeds.showBg);
				cb.onChange(async (value) => {
					this.plugin.settings.embeds.showBg = value;
					await this.plugin.saveSettings();
				});
			});
		new Setting(containerEl)
			.setName("Show background dotted pattern")
			.setDesc(
				"Whether to show the background dotted pattern for a markdown embed by default"
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.embeds.showBgDots);
				cb.onChange(async (value) => {
					this.plugin.settings.embeds.showBgDots = value;
					await this.plugin.saveSettings();
				});
			});
	}

	downloadFont(font: FontTypes, config: DownloadInfo) {
		return this.downloadManagerModal.startDownload(config,
			async (tFile) => this.fontsSettingsManager.setFontPath(font, tFile.path)
		)
	}

	async downloadAllFonts() {
		const configs = this.fontsSettingsManager.getAllAssetsConfigs();
		for (const [font, downloadInfo] of configs) {
			await this.downloadFont(font, downloadInfo);
		}
	}

	downloadIcon(icon: IconNames, config: DownloadInfo) {
		return this.downloadManagerModal.startDownload(config,
			async (tFile) => this.iconsSettingsManager.setIconPath(icon, tFile.path)
		)
	}

	async downloadAllIcons() {
		const configs = this.iconsSettingsManager.getAllDownloadConfigs();
		for (const [icon, downloadInfo] of configs) {
			await this.downloadIcon(icon, downloadInfo);
		}
	}

	assetsSettings() {
		this.containerEl.createEl("h1", { text: "Assets" });

		const offlineFonts = new Setting(this.containerEl).setName('Offline assets')
			.setDesc('Download all assets offline use')
			.addButton((button) => button.setButtonText('Download all').onClick(async () => {
				await this.downloadAllFonts();
				await this.downloadAllIcons();
			}));

		offlineFonts.descEl.createEl("code", {
			cls: "ptl-default-code",
			text: `Vault folder: ${this.plugin.settings.fileDestinations.assetsFolder}`,
		});

		this.fontSettings();
		this.iconsSettings();
	}

	fontSettings() {
		const { containerEl, fontsSettingsManager } = this;
		containerEl.createEl("h2", { text: "Fonts" });

		const offlineFonts = new Setting(this.containerEl).setName('Offline fonts')
			.setDesc('Download all fonts for offline use')
			.addButton((button) => button.setButtonText('Download all').onClick(async () => {
				await this.downloadAllFonts();
			}));

		offlineFonts.descEl.createEl("code", {
			cls: "ptl-default-code",
			text: `Vault folder: ${this.plugin.settings.fileDestinations.assetsFolder}/fonts`,
		});

		containerEl.createEl("h2", { text: "Font assets overrides" });

		const newFontOverrideSetting = (args: {
			name: string,
			font: keyof typeof defaultFonts,
			appearsAs: string,
		}) => {
			const currentValue = () => fontsSettingsManager.overrides[args.font];
			let resetButton: undefined | ExtraButtonComponent;
			const setFont = async (fontPath: string | null) => fontsSettingsManager.setFontPath(args.font, fontPath)

			fontsSettingsManager.onChanged(args.font, () => {
				textInput?.setValue(currentValue() ?? '')
				resetButton?.setDisabled(currentValue() === undefined)
			});

			let textInput: undefined | TextComponent;
			const current = currentValue();
			const config = fontsSettingsManager.getDownloadConfig(args.font);
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
						new FileSearchModal(this.plugin, {
							extensions: [...fontExtensions],
							initialSearchPath: currentValue(),
							onEmptyStateText: (searchPath) => (
								`No folders or fonts at "${searchPath}".`
							),
							setSelection: (file) => {
								if (!(file instanceof TFile)) {
									const path = typeof file === 'string' ? file : file.path;
									new Notice(`"${path}" is not a valid file.`);
									return;
								}
								setFont(file.path);
							},
						}).open()
					})
				})
				.addExtraButton((button) => {
					button.setIcon('download')
						.setTooltip(`Download from ${config.url}`)
						.onClick(() => this.downloadFont(args.font, config))
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

	iconsSettings() {
		this.containerEl.createEl("h2", { text: "Icons" });

		const offlineIcons = new Setting(this.containerEl).setName('Offline icons')
			.setDesc('Download all icons for offline use')
			.addButton((button) => button.setButtonText('Download all').onClick(async () => {
				await this.downloadAllIcons();
			}));

		offlineIcons.descEl.createEl("code", {
			cls: "ptl-default-code",
			text: `Vault folder: ${this.plugin.settings.fileDestinations.assetsFolder}/icons`,
		});

		this.containerEl.createEl("h2", { text: "Icon assets overrides" });
		createIconOverridesSettingsEl(this.plugin, this.containerEl, this.iconsSettingsManager,
			(icon, config) => this.downloadIcon(icon, config)
		);
	}
}
