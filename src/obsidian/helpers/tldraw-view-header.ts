import { ButtonComponent } from "obsidian";
import { TldrawAppViewModeController } from "./TldrawAppEmbedViewController";

export function interactiveViewModeToggle(container: HTMLElement, controller: TldrawAppViewModeController) {
    const updateButton = () => {
        const showBackground = controller.getViewOptions().background === true;
        backgroundToggle.setTooltip(showBackground
            ? 'Hide background'
            : 'Show background'
        );

        if (showBackground) {
            backgroundToggle.setCta()
        } else {
            backgroundToggle.removeCta()
        }
    }
    const backgroundToggle = new ButtonComponent(container)
        .setButtonText('Background')
        .setClass('clickable-icon').onClick(() => {
            controller.toggleBackground();
            updateButton();
        });
    updateButton();

    return [backgroundToggle, updateButton] as const;
}

export function backgroundViewOptionToggle(container: HTMLElement, controller: TldrawAppViewModeController) {
    const updateButton = () => {
        const isImage = controller.getViewMode() === 'image';
        interactToggle.setTooltip(isImage
            ? 'Interact with embed'
            : 'Exit interactive mode'
        );

        if (isImage) {
            interactToggle.removeCta()
        } else {
            interactToggle.setCta()
        }
    }
    const interactToggle = new ButtonComponent(container)
        .setIcon('hand')
        .setClass('clickable-icon').onClick(() => {
            controller.toggleInteractive();
            updateButton();
        });
    updateButton();

    return [interactToggle, updateButton] as const;
}
