import { TLDataDocument } from "src/utils/document";
import { BoxLike, TldrawImageProps } from "tldraw";

export type ViewMode = 'image' | 'interactive';

export type OnChangeViewMode = (mode: ViewMode) => void;

export type OnChangeHandlers = {
    onViewMode: OnChangeViewMode;
    onImageBounds: (bounds?: BoxLike) => void;
    onImageSize: (size?: { width: number, height: number }) => void;
    onViewOptions: (options: ImageViewModeOptions) => void;
    onFileModified: (newInitialData: TLDataDocument) => void
};

/**
 * The options when {@link ViewMode} is 'image'.
 */
export type ImageViewModeOptions = {
    /**
     * Whether to include the background of the drawing when it is embed
     */
    background?: TldrawImageProps['background'];
    bounds?: BoxLike;
    scale?: TldrawImageProps['scale'];
    format?: TldrawImageProps['format'];
    pageId?: TldrawImageProps['pageId'];
    darkMode?: TldrawImageProps['darkMode'];
    preserveAspectRatio?: TldrawImageProps['preserveAspectRatio'];
};

export type TldrawAppViewModeController = {
    getViewMode: () => ViewMode;
    getViewOptions: () => ImageViewModeOptions;
    setUpdatedData: (tlDataDocument: TLDataDocument) => void;
    setViewMode: (viewMode: ViewMode) => void;
    setImageBounds: (bounds?: BoxLike) => void;
    setImageSize: (size?: { width: number, height: number }) => void;
    /**
     * @returns A function that unsets on-change handlers.
     */
    setOnChangeHandlers: (handlers: OnChangeHandlers) => () => void;
    toggleBackground: () => void;
    toggleInteractive: () => void;
};
