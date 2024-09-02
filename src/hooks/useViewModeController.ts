import { BoxLike, Editor } from "@tldraw/tldraw";
import * as React from "react";
import { useEffect, useState } from "react";
import { TldrawAppViewModeController, ImageViewModeOptions } from "src/obsidian/helpers/TldrawAppEmbedViewController";

export function useViewModeState(
    editorRef: ReturnType<typeof React.useRef<Editor | null>>,
    {
        controller, initialBounds
    }: {
        controller?: TldrawAppViewModeController,
        initialBounds?: BoxLike,
    }
) {
    const [bounds, setImageBounds] = useState<BoxLike | undefined>(initialBounds)
    const [displayImage, setDisplayImage] = useState<boolean>(controller?.getViewMode() === 'image')
    const [viewOptions, setImageViewOptions] = useState<ImageViewModeOptions>(controller?.getViewOptions() ?? {})

    useEffect(() => {
        const removeViewModeImageListener = controller?.setOnChangeHandlers({
            onViewMode: (mode) => {
                setDisplayImage(mode === 'image')
                const bounds = editorRef?.current?.getViewportPageBounds();
                if (bounds) {
                    controller.setImageBounds(bounds)
                }
            },
            onImageBounds: setImageBounds,
            onViewOptions: (o) => {
                setImageViewOptions({
                    ...o
                })
            }
        });
        return () => {
            removeViewModeImageListener?.();
        }
    }, []);

    return {
        bounds,
        displayImage,
        viewOptions,
    }
}
