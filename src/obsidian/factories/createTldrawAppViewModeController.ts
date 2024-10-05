import { BoxLike } from "tldraw";
import { TldrawAppViewModeController, ViewMode, ImageViewModeOptions, OnChangeHandlers } from "../helpers/TldrawAppEmbedViewController";

export function createTldrawAppViewModeController(initialBounds?: BoxLike): TldrawAppViewModeController {
    return {
        viewMode: 'image',
        viewOptions: {
            // TODO: Create a plugin setting that allows the use of other image formats for previewing.
            format: 'svg',
            background: true,
            bounds: initialBounds,
            // FIXME: Image aspect ratio is ruined in reading mode when viewing with png format due to 300px height restriction on `.ptl-markdown-embed .ptl-view-content`
            // format: 'png',
            // preserveAspectRatio: '',
        },
        onChangeHandlers: undefined,
        onClickAway() {
            this.setViewMode('image')
        },
        getViewMode() {
            return this.viewMode;
        },
        getViewOptions() {
            return this.viewOptions;
        },
        setImageBounds(bounds) {
            this.viewOptions.bounds = bounds;
            this.onChangeHandlers?.onImageBounds(bounds);
        },
        setUpdatedData(tlDataDocument) {
            this.onChangeHandlers?.onFileModified(tlDataDocument);
        },
        setViewMode(viewMode) {
            this.viewMode = viewMode;
            this.onChangeHandlers?.onViewMode(viewMode);
        },
        setImageSize(size) {
            this.onChangeHandlers?.onImageSize(size);
        },
        setOnChangeHandlers(handlers) {
            this.onChangeHandlers = handlers;
            return () => {
                if (this.onChangeHandlers === handlers) {
                    this.onChangeHandlers = undefined;
                }
            }
        },
        toggleBackground() {
            this.viewOptions.background = !this.viewOptions.background;
            this.onChangeHandlers?.onViewOptions(this.viewOptions);
        },
        toggleInteractive() {
            if (this.viewMode !== 'image') {
                this.setViewMode('image');
            } else {
                this.setViewMode('interactive');
            }
        },
    } satisfies TldrawAppViewModeController & {
        viewMode: ViewMode,
        viewOptions: ImageViewModeOptions,
        onChangeHandlers?: OnChangeHandlers,
    } as TldrawAppViewModeController;
}