/**
 * Used some code from https://tldraw.dev/examples/shapes/tools/screenshot-tool
 */
import * as React from "react";
import BoundsSelectorTool, {
    BoundsDraggingState,
    BOUNDS_BOX,
    BOUNDS_SHAPES_BOX,
    BOUNDS_USING_ASPECT_RATIO,
    BOUNDS_ASPECT_RATIO,
    BOUNDS_CURRENT_BOX,
    BOUNDS_SELECTOR_INITIALIZED
} from "src/tldraw/tools/bounds-selector-tool";
import { Box, Editor, useEditor, useValue } from "tldraw";

function calculateBoundingBoxInEditor(box: Box, editor: Editor) {
    const zoomLevel = editor.getZoomLevel()
    const { x, y } = editor.pageToViewport({ x: box.x, y: box.y })
    return new Box(x, y, box.w * zoomLevel, box.h * zoomLevel)
}

export default function BoundsTool() {
    const editor = useEditor();

    const toolInitialized = useValue(BOUNDS_SELECTOR_INITIALIZED, () => (
        editor.getStateDescendant<BoundsSelectorTool>(BoundsSelectorTool.id)?.boundsSelectorInitialized.get()
    ), [editor]);

    React.useEffect(
        () => {
            if (toolInitialized === undefined) {
                return;
            }
            if (!toolInitialized) {
                editor.getStateDescendant<BoundsSelectorTool>(BoundsSelectorTool.id)?.init();
            }
        },
        [toolInitialized]
    );

    const currentBox = useValue(BOUNDS_CURRENT_BOX,
        () => {
            const selectorTool = editor.getStateDescendant<BoundsSelectorTool>(BoundsSelectorTool.id);
            const box = selectorTool?.currentBounds.get()

            if (!box) return;

            return calculateBoundingBoxInEditor(box, editor);
        }, [editor],
    );

    const boundsBox = useValue(BOUNDS_BOX,
        () => {
            if (editor.getPath() !== BoundsSelectorTool.draggingStatePath) return null;

            const draggingState = editor.getStateDescendant<BoundsDraggingState>(BoundsSelectorTool.draggingStatePath)!;
            const box = draggingState.boundsBox.get()

            return calculateBoundingBoxInEditor(box, editor);
        }, [editor],
    );

    const shapesBox = useValue(BOUNDS_SHAPES_BOX,
        () => {
            if (editor.getPath() !== BoundsSelectorTool.draggingStatePath) return null;

            const draggingState = editor.getStateDescendant<BoundsDraggingState>(BoundsSelectorTool.draggingStatePath)!;
            const box = draggingState.shapesBox.get()

            if (!box) return null;

            return calculateBoundingBoxInEditor(box, editor);
        }, [editor],
    );

    const boundsUsingAspectRatio = useValue(BOUNDS_USING_ASPECT_RATIO, () => (
        editor.getStateDescendant<BoundsDraggingState>(BoundsSelectorTool.draggingStatePath)?.boundsUsingAspectRatio.get() ?? false
    ), [editor]);

    const boundsAspectRatio = useValue(BOUNDS_ASPECT_RATIO, () => (
        editor.getStateDescendant<BoundsSelectorTool>(BoundsSelectorTool.id)?.aspectRatio.get()
    ), [editor]);

    return (
        <>
            {
                !currentBox ? <></> : (
                    <div
                        className="ptl-embed-bounds-selection"
                        style={{
                            pointerEvents: 'none',
                            transform: `translate(${currentBox.x}px, ${currentBox.y}px)`,
                            width: currentBox.w,
                            height: currentBox.h,
                        }}
                        data-target-bounds={!boundsBox}
                    />
                )
            }
            {
                !boundsBox ? <></> : (
                    <div
                        className="ptl-embed-bounds-selection"
                        style={{
                            transform: `translate(${boundsBox.x}px, ${boundsBox.y}px)`,
                            width: boundsBox.w,
                            height: boundsBox.h,
                        }}
                        data-shade-bg={!shapesBox}
                        data-target-bounds={!shapesBox}
                    >
                        Hold Ctrl to use the bounds within the shapes.
                        <br />
                        Hold Shift to use an aspect ratio.
                        <br />
                        Press Alt to cycle through aspect ratios.
                        {
                            !boundsAspectRatio || !boundsUsingAspectRatio ? <></> : (
                                <>
                                    <br />
                                    Aspect ratio: {boundsAspectRatio.w}:{boundsAspectRatio.h}
                                </>
                            )
                        }
                    </div>
                )
            }
            {
                !shapesBox ? <></> : (
                    <div
                        className="ptl-embed-bounds-selection"
                        style={{
                            transform: `translate(${shapesBox.x}px, ${shapesBox.y}px)`,
                            width: shapesBox.w,
                            height: shapesBox.h,
                        }}
                        data-shade-bg={true}
                        data-target-bounds={true}
                    />
                )
            }
        </>
    );
}