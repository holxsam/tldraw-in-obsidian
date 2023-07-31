import { clamp } from "src/utils/utils";
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
	saveFileDelayInMs: number;
	newFilePrefix: string;
	newFileTimeFormat: string;
	themeMode: ThemePreference;
	gridMode: boolean;
	snapMode: boolean;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: TldrawPluginSettings = {
	folder: "tldraw",
	saveFileDelayInMs: 1000,
	newFilePrefix: "Tldraw ",
	newFileTimeFormat: "YYYY-MM-DD h.mmA",
	themeMode: "light",
	gridMode: false,
	snapMode: false,
	debugMode: false,
};

export class SettingsTab extends PluginSettingTab {
	plugin: TldrawPlugin;

	constructor(app: App, plugin: TldrawPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const header = new Setting(containerEl).infoEl;

		header.createEl("h4", {
			text: "Tldraw Settings",
			cls: "tldraw-settings-header",
		});

		new Setting(containerEl)
			.setName("Save Folder")
			.setDesc("The directory that tldraw files will be created in.")
			.addText((text) =>
				text
					.setPlaceholder("root")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;

						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Save Delay")
			.setDesc(
				`The delay in milliseconds to automatically save after a change has been made to a tlraw drawing. Must be a value between ${MIN_SAVE_DELAY} and ${MAX_SAVE_DELAY}. Requires reloading any tldraw files you may have open in a tab. `
			)
			.addText((text) =>
				text
					.setPlaceholder("1000")
					.setValue(`${this.plugin.settings.saveFileDelayInMs}`)
					.onChange(async (value) => {
						const parsedValue = parseInt(value);

						this.plugin.settings.saveFileDelayInMs = clamp(
							isNaN(parsedValue)
								? DEFAULT_SAVE_DELAY
								: parsedValue,
							MIN_SAVE_DELAY,
							MAX_SAVE_DELAY
						);

						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("New File Prefix")
			.setDesc(
				"When creating a new tldraw file, the file name will automatically prepend the prefix. If left empty then 'Tldraw' will be used."
			)
			.addText((text) =>
				text
					.setPlaceholder("No time will be shown")
					.setValue(this.plugin.settings.newFilePrefix)
					.onChange(async (value) => {
						this.plugin.settings.newFilePrefix = value;
						await this.plugin.saveSettings();
					})
			);

		const timeFormatSetting = new Setting(containerEl)
			.setName("New File Time Format")
			.setDesc(
				"When creating a new tldraw file, this represents the time format that will get appended to the file name. The meanings of each token can be found here: "
			)
			.addText((text) =>
				text
					.setPlaceholder("No time will be shown")
					.setValue(this.plugin.settings.newFileTimeFormat)
					.onChange(async (value) => {
						this.plugin.settings.newFileTimeFormat = value;
						await this.plugin.saveSettings();
					})
			);

		timeFormatSetting.descEl.createEl("a", {
			href: "https://momentjs.com/docs/#/displaying/format/",
			text: "https://momentjs.com/docs/#/displaying/format/",
		});

		const themeSetting = new Setting(containerEl)
			.setName("Theme")
			.setDesc(
				"When opening a tldraw file, this setting decides what theme should be applied. Make sure you pick well as this setting also determines your personality."
			)
			.addDropdown((cb) => {
				cb.addOption("light", "Light Theme")
					.addOption("dark", "Dark Theme")
					.addOption("match-theme", "Match Theme")
					.setValue(this.plugin.settings.themeMode)
					.onChange(async (value) => {
						this.plugin.settings.themeMode =
							value as ThemePreference;
						await this.plugin.saveSettings();
					});
			});
		const descriptionEl = themeSetting.descEl.createEl("dl");
		descriptionEl.createEl("dt", {
			text: "Light Theme",
			cls: "theme-term",
		});
		descriptionEl.createEl("dd", {
			text: "The default theme which looks like a whiteboard for those who enjoy the smell of markers.",
			cls: "theme-definition",
		});
		descriptionEl.createEl("dt", { text: "Dark Theme", cls: "theme-term" });
		descriptionEl.createEl("dd", {
			text: "The dark theme looks like the a blackboard for those who don't mind white chalk on their hands.",
			cls: "theme-definition",
		});
		descriptionEl.createEl("dt", {
			text: "Match Theme",
			cls: "theme-term",
		});
		descriptionEl.createEl("dd", {
			text: "Matches the tldraw's theme with obsidian's theme for those who prefer consistency above all else.",
			cls: "theme-definition",
		});

		new Setting(containerEl)
			.setName("Grid Mode")
			.setDesc(
				"When opening a tldraw file, this setting determines whether grid mode should be enabled. Keep in mind that enabling grid mode will both show a grid and enforce snap-to-grid functionality."
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
				"When opening a tldraw file, this setting determines whether snap mode is enabled. Snap mode is a feature that places guides on shapes as you move them, ensuring they align with specific points or positions for precise placement."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.snapMode);
				cb.onChange(async (value) => {
					this.plugin.settings.snapMode = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Debug Mode")
			.setDesc(
				"When opening a tldraw file, this setting toggles the tldraw debug mode. Debug mode is useful for the developer."
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
