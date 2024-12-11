import { Menu, MenuItem, TFile } from "obsidian";
import { TldrawAppViewModeController } from "../helpers/TldrawAppEmbedViewController";
import { MARKDOWN_ICON_NAME } from "src/utils/constants";
import TldrawPlugin from "src/main";
import { pluginMenuLabel } from ".";
import { BoxLike } from "tldraw";

export type TldrAppControllerForMenu = Pick<
    TldrawAppViewModeController, 'getViewMode' | 'toggleInteractive' | 'toggleBackground' | 'getViewOptions'
> & {
    setCurrentMenu: (menu: Menu) => void,
    unsetMenu: (menu: Menu) => void,
};

function background(menuItem: MenuItem, controller: TldrAppControllerForMenu) {
    return menuItem.setTitle('Show background')
        .setChecked(
            controller.getViewOptions().background ?? null
        )
        ;
}

function interactiveMode(menuItem: MenuItem, controller: TldrAppControllerForMenu) {
    return menuItem.setTitle('Interactive Mode')
        .setIcon('hand')
        .setChecked(
            controller.getViewMode() === 'interactive'
        )
        ;
}

function openMdNewTab(menuItem: MenuItem) {
    return menuItem
        .setIcon(MARKDOWN_ICON_NAME)
        .setTitle('Open as markdown (new tab)');
}

function editNewTab(menuItem: MenuItem) {
    return menuItem
        .setIcon('pencil')
        .setTitle('Edit drawing (new tab)');
}

function readOnlyNewTab(menuItem: MenuItem) {
    return menuItem
        .setIcon('eye')
        .setTitle('Read-only view (new tab)');
}

function boundsText(bounds: BoxLike) {
    const { w, h, x, y } = bounds;
    return `size=${w.toFixed(0)},${h.toFixed(0)};pos=${x.toFixed(0)},${y.toFixed(0)}`;
}

class _Menu extends Menu {
    constructor(
        public readonly controller: TldrAppControllerForMenu,
    ) { super(); }

    onload(): void {
        super.onload();
        this.controller.setCurrentMenu(this);
    }

    onunload(): void {
        super.onunload();
        this.controller.unsetMenu(this);
    }
}

export function createEmbedMenu({
    controller, plugin, selectEmbedLinkText, tFile
}: {
    controller: TldrAppControllerForMenu, plugin: TldrawPlugin,
    selectEmbedLinkText: (ev: MouseEvent) => void,
    tFile: TFile,
}) {
    const bounds = controller.getViewOptions().bounds;
    return new _Menu(controller).addItem((item) => pluginMenuLabel(item, {
        title: tFile.name
    })).addItem((item) => (
        background(item, controller).onClick(() => {
            controller.toggleBackground();
            background(item, controller);
        })
    )).addItem((item) => (
        interactiveMode(item, controller).onClick(() => {
            controller.toggleInteractive();
            interactiveMode(item, controller);
        })
    )).addItem((item) => (
        item.setTitle('Select embed link text')
            .setIcon('text-cursor')
            .onClick(selectEmbedLinkText)
    )).addSeparator().addItem((item) => (
        openMdNewTab(item).onClick(() => {
            plugin.openTldrFile(tFile, 'new-tab', 'markdown')
        })
    )).addItem((item) => (
        editNewTab(item).onClick(() => {
            plugin.openTldrFile(tFile, 'new-tab', 'tldraw-view');
        })
    )).addItem((item) => (
        readOnlyNewTab(item).onClick(() => (
            plugin.openTldrFile(tFile, 'new-tab', 'tldraw-read-only')
        ))
    )).addSeparator().addItem((item) => (
        item.setIsLabel(true)
            .setIcon('info')
            .setTitle(`Bounds: ${bounds ? boundsText(bounds) : '[No bounds set]'}`)
    )).addItem((item) => (
        item.setIcon('frame')
            .setTitle('Copy bounds')
            .setDisabled(bounds === undefined)
            .onClick(() => {
                if (bounds) {
                    window.navigator.clipboard.writeText(boundsText(bounds));
                }
            })
    ))
        ;
}