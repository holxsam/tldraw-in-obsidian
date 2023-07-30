import TldrawPlugin from "../main";
import { App, PluginSettingTab, Setting } from "obsidian";

export type ThemePreference = "match-theme" | "dark" | "light";

export interface TldrawPluginSettings {
	folder: string;
	newFileTheme: ThemePreference;
	newFileGrid: boolean;
	newFilePrefix: string;
	newFileTimeFormat: string;
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: TldrawPluginSettings = {
	newFileTheme: "match-theme",
	newFileGrid: false,
	folder: "tldraw",
	newFilePrefix: "Tldraw ",
	newFileTimeFormat: "YYYY-MM-DD h.mmA",
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
			.setName("New File Theme")
			.setDesc(
				"When creating a new tldraw file, this settings decides what theme should be applied."
			)
			.addDropdown((cb) => {
				cb.addOption("match-theme", "Match Theme")
					.addOption("dark", "Dark Theme")
					.addOption("light", "Light Theme")
					.setValue(this.plugin.settings.newFileTheme)
					.onChange(async (value) => {
						this.plugin.settings.newFileTheme =
							value as ThemePreference;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("New File Grid Mode")
			.setDesc(
				"When creating a new tldraw file, this setting decides whether grid mode should be on or off."
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.newFileGrid);
				cb.onChange(async (value) => {
					this.plugin.settings.newFileGrid = value;
					await this.plugin.saveSettings();
				});
			});

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

		new Setting(containerEl)
			.setName("New File Time Format")
			.setDesc(
				"When creating a new tldraw file, this represents the time format that will get appended to the file name. You can find the what each token mean here: https://momentjs.com/docs/#/displaying/format/"
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

		new Setting(containerEl)
			.setName("Debug Mode")
			.setDesc("Toggles the tldraw debug mode.")
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.debugMode);
				cb.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
