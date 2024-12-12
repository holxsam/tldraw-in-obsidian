import React, { ComponentProps, ContextType, createContext, CSSProperties, ReactNode, useMemo, useSyncExternalStore } from "react";
import { ImageViewModeOptions } from "src/obsidian/helpers/TldrawAppEmbedViewController";
import { Box, TldrawImage } from "tldraw";

export type TldrawImageSnapshot = ComponentProps<typeof TldrawImage>['snapshot'];
export type TldrawImageProps = Omit<ComponentProps<typeof TldrawImage>, 'snapshot'>;

const TldrawImageContext = createContext<
    undefined | {
        props: Omit<ComponentProps<typeof TldrawImage>, 'snapshot'>,
    }
>(undefined);

const defaultNoSnapshotFallback = <>No tldraw data to display</>;
const PluginTldrawImageContext = createContext<
    undefined | {
        /**
         * What to display when the snapshot is undefined.
         */
        fallback?: ReactNode,
        /**
         * The placeholder image to use if snapshot is undefined.
         */
        getPlaceHolderImage?: () => HTMLElement | undefined,
        props?: {
            style?: CSSProperties
        }
    }
>(
    {
        fallback: defaultNoSnapshotFallback
    }
);

function PluginTldrawImage({
    props, snapshot
}: {
    snapshot: TldrawImageSnapshot,
    props?: {
        style?: CSSProperties,
    }
}) {
    return (
        <div className="ptl-tldraw-image" {...{ ...props }}>
            <TldrawImageContext.Consumer>
                {
                    (value) => !value ? <></>
                        : <TldrawImage
                            snapshot={snapshot}
                            {...value.props}
                        />
                }
            </TldrawImageContext.Consumer>
        </div>
    );
}

function PluginTldrawImageContainer({
    snapshot, props
}: {
    snapshot?: ComponentProps<typeof TldrawImage>['snapshot'],
    props?: {
        style?: CSSProperties
    }
}) {
    return (
        <div className="ptl-tldraw-image-container" {...{ ...props }}>
            <PluginTldrawImageContext.Consumer>
                {
                    (value) => (
                        !value?.getPlaceHolderImage?.() ? (
                            !snapshot ? value?.fallback : (
                                <PluginTldrawImage snapshot={snapshot} props={value?.props} />
                            )
                        ) : (
                            () => {
                                const placeHolder = value.getPlaceHolderImage();
                                if (!placeHolder) return value?.fallback;
                                return (
                                    <div className="ptl-tldraw-image ptl-tldraw-image-placeholder" {...value?.props}
                                        ref={(ref) => {
                                            ref?.appendChild(placeHolder)
                                        }}
                                    />
                                )
                            }
                        )()
                    )
                }
            </PluginTldrawImageContext.Consumer>
        </div>
    )
}

function TldrawImageContextProviders({
    children,
    previewStore,
    getPlaceHolderImage,
}: {
    children: ReactNode,
    previewStore: SnapshotPreviewSyncStore,
    getPlaceHolderImage?: NonNullable<ContextType<typeof PluginTldrawImageContext>>['getPlaceHolderImage'],
}) {
    const previewSize = useSyncExternalStore(previewStore.onPreviewSize, previewStore.getPreviewSize);
    const previewOptions = useSyncExternalStore(previewStore.onPreviewOptions, previewStore.getPreviewOptions);
    const ptlTldrawImageContextValue = useMemo((): ContextType<typeof PluginTldrawImageContext> => (
        {
            fallback: defaultNoSnapshotFallback,
            getPlaceHolderImage,
            props: {
                style: previewSize === undefined ? undefined : {
                    width: previewSize.width || undefined,
                    height: previewSize.height || undefined,
                }
            }
        }
    ), [previewSize, getPlaceHolderImage])

    const tldrawImageContextValue = useMemo((): ContextType<typeof TldrawImageContext> => {
        const { bounds, ...rest } = previewOptions;
        return (
            {
                props: {
                    bounds: bounds === undefined ? undefined : Box.From(bounds),
                    ...rest,
                }
            }
        );
    }, [previewOptions]);

    return (
        <PluginTldrawImageContext.Provider value={ptlTldrawImageContextValue}>
            <TldrawImageContext.Provider key={tldrawImageContextValue?.props.pageId} value={tldrawImageContextValue}>
                {children}
            </TldrawImageContext.Provider>
        </PluginTldrawImageContext.Provider>
    );
}

type SnapshotSyncStore = {
    getSnapshot(): undefined | TldrawImageSnapshot,
    onSnapshot(cb: () => void): (() => void),
}

type SnapshotImagePreviewOptionsSyncStore = {
    getPreviewSize(): undefined | { width: number, height: number },
    onPreviewSize(cb: () => void): (() => void),
}

type SnapshotImagePreviewSizeSyncStore = {
    getPreviewOptions(): ImageViewModeOptions,
    onPreviewOptions(cb: () => void): (() => void),
}

export type SnapshotPreviewSyncStore = (
    SnapshotSyncStore
    & SnapshotImagePreviewSizeSyncStore
    & SnapshotImagePreviewOptionsSyncStore
);

export function TldrawImageSnapshotView({
    previewStore,
    getPlaceHolderImage,
}: {
    previewStore: SnapshotPreviewSyncStore,
    getPlaceHolderImage?: ComponentProps<typeof TldrawImageContextProviders>['getPlaceHolderImage'],
}) {
    const snapshot = useSyncExternalStore(previewStore.onSnapshot, previewStore.getSnapshot);
    return (
        <TldrawImageContextProviders previewStore={previewStore} getPlaceHolderImage={getPlaceHolderImage}>
            <PluginTldrawImageContainer snapshot={snapshot}
                props={{
                    style: {
                        width: '100%',
                        height: '100%',
                    }
                }}
            />
        </TldrawImageContextProviders>
    )
}
