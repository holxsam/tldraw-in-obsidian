import { Box, BoxLike, Editor } from "@tldraw/tldraw";
import * as React from "react";
import { useEffect, useState } from "react";
import { TldrawAppViewModeController, ImageViewModeOptions } from "src/obsidian/helpers/TldrawAppEmbedViewController";

function maybeBox(boxLike?: BoxLike) {
    return boxLike === undefined ? undefined : Box.From(boxLike);
}

export function useViewModeState(
    editorRef: ReturnType<typeof React.useRef<Editor | null>>,
    {
        controller, initialBounds, initialImageSize
    }: {
        controller?: TldrawAppViewModeController,
        initialBounds?: BoxLike,
        initialImageSize?: { width: number, height: number },
    }
) {
    const [bounds, setImageBounds] = useState<BoxLike | undefined>(maybeBox(initialBounds))
    const [imageSize, setImageSize] = useState<undefined | { width: number, height: number }>(initialImageSize);
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
            onImageSize: setImageSize,
            onViewOptions: (o) => {
                setImageViewOptions({
                    ...o,
                })
            }
        });
        return () => {
            removeViewModeImageListener?.();
        }
    }, []);

    return {
        displayImage,
        imageSize,
        viewOptions: {
            ...viewOptions,
            bounds: maybeBox(bounds)
        },
    }
}
