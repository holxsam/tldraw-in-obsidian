import { TldrawAppStoreProps } from "src/components/TldrawApp";
import { BoxLike, TldrawImageProps } from "tldraw";

export type ViewMode = 'image' | 'interactive';

export type OnChangeViewMode = (mode: ViewMode) => void;

export type OnChangeHandlers = {
    onViewMode: OnChangeViewMode;
    onImageBounds: (bounds?: BoxLike) => void;
    onImageSize: (size?: { width: number, height: number }) => void;
    onViewOptions: (options: ImageViewModeOptions) => void;
    onStoreProps: (storeProps: TldrawAppStoreProps) => void
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
    padding?: TldrawImageProps['padding'];
    preserveAspectRatio?: TldrawImageProps['preserveAspectRatio'];
};

export type TldrawAppViewModeController = {
    getViewMode: () => ViewMode;
    getViewOptions: () => ImageViewModeOptions;
    onClickAway: () => void;
    setStoreProps: (storeProps: TldrawAppStoreProps) => void;
    setShowBackground: (showBg: boolean) => void;
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
