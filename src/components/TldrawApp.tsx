import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	Box,
	createTLStore,
	DefaultMainMenu,
	DefaultMainMenuContent,
	defaultShapeUtils,
	Editor,
	TLAssetStore,
	TLComponents,
	Tldraw,
	TldrawFile,
	TldrawImage,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLStore,
	useActions,
} from "tldraw";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { uiOverrides } from "src/tldraw/ui-overrides";
import { TLDataDocument, TldrawPluginMetaData } from "src/utils/document";
import TldrawPlugin from "src/main";
import { Platform } from "obsidian";
import { TldrawAppViewModeController } from "src/obsidian/helpers/TldrawAppEmbedViewController";
import { SetTldrawFileData, useTldrawAppEffects } from "src/hooks/useTldrawAppHook";
import { useViewModeState } from "src/hooks/useViewModeController";

type TldrawAppOptions = {
	controller?: TldrawAppViewModeController;
	isReadonly?: boolean,
	autoFocus?: boolean,
	assetStore?: TLAssetStore,
	inputFocus?: boolean,
	initialImageSize?: { width: number, height: number },
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string,
	hideUi?: boolean,
	/**
	 * If this value is undefined, then the UUID in {@linkcode TLDataDocument.meta} of {@linkcode TldrawAppProps.initialData} will be used.
	 */
	persistenceKey?: string,
	/**
	 * Whether to call `.selectNone` on the Tldraw editor instance when it is mounted.
	 */
	selectNone?: boolean,
	/**
	 * Whether or not to initially zoom to the bounds when the component is mounted.
	 * 
	 * If {@linkcode TldrawAppOptions.initialBounds} is not provided, then the page bounds are used.
	 */
	zoomToBounds?: boolean,
};

export type TldrawAppProps = {
	plugin: TldrawPlugin;
	/**
	 * The data that is initially loaded onto the {@link Tldraw} or {@link TldrawImage} image component.
	 */
	initialData: {
		meta: TldrawPluginMetaData,
		initialSnapshot: ReturnType<TLStore['getStoreSnapshot']>,
	};
	setFileData: (tldrawFile: TldrawFile) => void;
	options: TldrawAppOptions;
};

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/apps/examples/src/examples/custom-main-menu/CustomMainMenuExample.tsx
const components = (plugin: TldrawPlugin): TLComponents => ({
	MainMenu: () => (
		<DefaultMainMenu>
			<LocalFileMenu plugin={plugin} />
			<DefaultMainMenuContent />
		</DefaultMainMenu>
	),
});

function LocalFileMenu(props: { plugin: TldrawPlugin }) {
	const actions = useActions();

	return (
		<TldrawUiMenuSubmenu id="file" label="menu.file">
			{
				Platform.isMobile
					? <></>
					: <TldrawUiMenuItem  {...actions[SAVE_FILE_COPY_ACTION]} />
			}
			<TldrawUiMenuItem {...actions[SAVE_FILE_COPY_IN_VAULT_ACTION]} />
			<TldrawUiMenuItem {...actions[OPEN_FILE_ACTION]} />
		</TldrawUiMenuSubmenu>
	);
}

const TldrawApp = ({ plugin, initialData, setFileData, options: {
	assetStore,
	autoFocus = true,
	controller,
	hideUi = false,
	initialImageSize,
	initialTool,
	inputFocus = false,
	isReadonly = false,
	persistenceKey,
	selectNone = false,
	zoomToBounds = false,
} }: TldrawAppProps) => {
	const assetUrls = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: plugin.getIconOverrides(),
	})
	const overridesUi = React.useRef(uiOverrides(plugin))
	const overridesUiComponents = React.useRef(components(plugin))

	const [editor, setEditor] = React.useState<Editor>()
	const [storeSnapshot, setSnapshot] = React.useState(initialData.initialSnapshot);

	const setAppState = React.useCallback((editor: Editor) => {
		setEditor(editor);
	}, [])

	const { displayImage, imageSize, viewOptions: {
		bounds, ...viewOptionsOther
	} } = useViewModeState(editor, {
		controller,
		initialImageSize,
		onViewModeChanged(mode) {
			if (mode !== 'image') return;
			// We only want to update the snapshot if we are changing over to image mode.

			const { store } = editor ?? {};
			if (store) {
				setSnapshot(store.getStoreSnapshot());
			}

			// We do this, otherwise the view will start bugging out. Do not remove.
			setEditor(undefined);
		},
		onFileModified(newInitialData) {
			if (!displayImage) {
				console.log('New document data ignored when in interactive mode');
				// We are in the the Tldraw editor, i.e. "interactive" mode
				// The editor view is already kept in-sync when it is using the "persistenceKey" attribute in the Tldraw component,
				// therefore we do not need to update the snapshot in this case.
				return;
			}
			const newUUID = newInitialData.meta.uuid;
			const originalUUID = initialData.meta.uuid;
			if (newUUID !== originalUUID) {
				throw new Error(`Tldraw document UUID does not match the original: new - ${newUUID}, original - ${originalUUID}`);
			}
			setSnapshot(processInitialData(newInitialData).snapshot);
		},
	});

	useTldrawAppEffects({
		bounds, editor, initialTool, isReadonly,
		setFileData, selectNone, zoomToBounds,
		settingsProvider: plugin.settingsProvider,
	});

	return (
		<div
			className="tldraw-view-root"
			onBlur={!inputFocus ? undefined : (e) => {
				editor?.selectNone();
				editor?.blur();
			}}
			onFocus={!inputFocus ? undefined : (e) => {
				editor?.focus();
				// NOTE: Below is buggy... menus overlay on top of each other.
				// We stop propagation here so that we can still access the menus in the embed view when clicking within this div.
				// e.stopPropagation();
			}}
		>
			{displayImage ? (
				<div className="ptl-tldraw-image-container" style={{
					width: '100%',
					height: '100%'
				}}>
					<div className="ptl-tldraw-image" style={{
						width: imageSize?.width || undefined,
						height: imageSize?.height || undefined
					}}>
						<TldrawImage
							snapshot={storeSnapshot}
							padding={0}
							assets={assetStore}
							assetUrls={assetUrls.current}
							bounds={bounds === undefined ? undefined : Box.From(bounds)}
							{...viewOptionsOther}
						/>
					</div>
				</div>
			) : (
				<div
					// e.stopPropagation(); this line should solve the mobile swipe menus bug
					// The bug only happens on the mobile version of Obsidian.
					// When a user tries to interact with the tldraw canvas,
					// Obsidian thinks they're swiping down, left, or right so it opens various menus.
					// By preventing the event from propagating, we can prevent those actions menus from opening.
					onTouchStart={(e) => e.stopPropagation()}
					style={{
						width: '100%',
						height: '100%',
					}}
				>
					<Tldraw
						persistenceKey={persistenceKey ?? initialData.meta.uuid}
						snapshot={storeSnapshot}
						assetUrls={assetUrls.current}
						hideUi={hideUi}
						overrides={overridesUi.current}
						components={overridesUiComponents.current}
						assets={assetStore}
						// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
						autoFocus={autoFocus}
						onMount={setAppState}
					/>
				</div>
			)}
		</div>
	);
};

function processInitialData(initialData: TLDataDocument) {
	const { meta, store }: {
		meta: TldrawPluginMetaData,
		store: TLStore,
	} = (() => {
		if (initialData.store) {
			return initialData;
		}

		return {
			meta: initialData.meta,
			store: createTLStore({
				shapeUtils: defaultShapeUtils,
				initialData: initialData.raw,
			})
		}
	})();

	return {
		meta,
		snapshot: store.getStoreSnapshot()
	};
}

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: TLDataDocument,
	setFileData: SetTldrawFileData,
	plugin: TldrawPlugin,
	options: TldrawAppOptions = {}
) => {
	const { meta, snapshot } = processInitialData(initialData);
	const root = createRoot(node);

	root.render(
		<TldrawApp
			setFileData={(tldrawFile) => setFileData({
				meta,
				tldrawFile
			})}
			initialData={{
				meta,
				initialSnapshot: snapshot
			}}
			plugin={plugin}
			options={options}
		/>
	);

	return root;
};

export default TldrawApp;
