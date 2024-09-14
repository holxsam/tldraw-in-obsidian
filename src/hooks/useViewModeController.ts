import { Editor } from "tldraw";
import { useEffect, useState } from "react";
import { TldrawAppViewModeController, ImageViewModeOptions, ViewMode } from "src/obsidian/helpers/TldrawAppEmbedViewController";
import { TLDataDocument } from "src/utils/document";

export function useViewModeState(editor: Editor | undefined,
    {
        controller, initialImageSize, onFileModified, onViewModeChanged
    }: {
        controller?: TldrawAppViewModeController,
        // initialBounds?: BoxLike,
        initialImageSize?: { width: number, height: number },
        /**
         * Called before the view mode is set.
         */
        onViewModeChanged: (mode: ViewMode) => void,
        onFileModified: (newInitialData: TLDataDocument) => void,
    },
) {
    const [imageSize, setImageSize] = useState<undefined | { width: number, height: number }>(initialImageSize);
    const [displayImage, setDisplayImage] = useState<boolean>(controller?.getViewMode() === 'image')
    const [viewOptions, setImageViewOptions] = useState<ImageViewModeOptions>(controller?.getViewOptions() ?? {})

    useEffect(() => {
        const removeViewModeImageListener = controller?.setOnChangeHandlers({
            onViewMode: (mode) => {
                onViewModeChanged(mode);
                setDisplayImage(mode === 'image')
                const bounds = editor?.getViewportPageBounds();
                if (bounds) {
                    controller?.setImageBounds(bounds)
                }
            },
            onImageBounds: (bounds) => setImageViewOptions({
                ...viewOptions,
                bounds,
            }),
            onImageSize: setImageSize,
            onViewOptions: (o) => {
                setImageViewOptions({
                    ...o,
                })
            },
            onFileModified,
        });
        return () => {
            removeViewModeImageListener?.();
        }
    }, [editor]);

    return {
        displayImage,
        imageSize,
        viewOptions,
    }
}
