import { clamp, msToSeconds } from "src/utils/utils";
import TldrawPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";
import {
	DEFAULT_SAVE_DELAY,
	MAX_SAVE_DELAY,
	MIN_SAVE_DELAY,
} from "src/utils/constants";

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
}

export const DEFAULT_SETTINGS: TldrawPluginSettings = {
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
};

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

		const timeFormatSetting = new Setting(containerEl)
			.setName("New file time format")
			.setDesc(
				"When creating a new tldraw file, this represents the time format that will get appended to the file name. Can be left empty, however if both the Prefix and Time Format are empty, it will use the defaults to name the file. The meanings of each token can be found on "
			)
			.addText((text) =>
				text
					.setPlaceholder("Time Format")
					.setValue(this.plugin.settings.newFileTimeFormat)
					.onChange(async (value) => {
						this.plugin.settings.newFileTimeFormat = value;
						await this.plugin.saveSettings();
					})
			);

		timeFormatSetting.descEl.createEl("a", {
			href: "https://momentjs.com/docs/#/displaying/format/",
			text: "moment.js.",
		});

		timeFormatSetting.descEl.createEl("code", {
			cls: "ptl-default-code",
			text: `DEFAULT: [${DEFAULT_SETTINGS.newFileTimeFormat}]`,
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
	}
}
