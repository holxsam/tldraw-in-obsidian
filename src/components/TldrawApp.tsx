import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	Box,
	DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	TLAssetStore,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawImage,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLStoreSnapshot,
	useActions,
} from "tldraw";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { uiOverrides } from "src/tldraw/ui-overrides";
import TldrawPlugin from "src/main";
import { Platform } from "obsidian";
import { TldrawAppViewModeController } from "src/obsidian/helpers/TldrawAppEmbedViewController";
import { useTldrawAppEffects } from "src/hooks/useTldrawAppHook";
import { useViewModeState } from "src/hooks/useViewModeController";
import { useClickAwayListener } from "src/hooks/useClickAwayListener";
import { TLDataDocumentStore } from "src/utils/document";
import useSnapshotFromStoreProps from "src/hooks/useSnapshotFromStoreProps";

type TldrawAppOptions = {
	controller?: TldrawAppViewModeController;
	isReadonly?: boolean,
	autoFocus?: boolean,
	assetStore?: TLAssetStore,
	focusOnMount?: boolean,
	initialImageSize?: { width: number, height: number },
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string,
	hideUi?: boolean,
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
	/**
	 * 
	 * @param snapshot The snapshot that is initially loaded into the editor.
	 * @returns 
	 */
	onInitialSnapshot?: (snapshot: TLStoreSnapshot) => void
};

/**
 * Whether to use native tldraw store props or the plugin based store props.
 */
export type TldrawAppStoreProps = {
	plugin?: undefined,
	/**
	 * Use the native tldraw store props.
	 */
	tldraw: TldrawEditorStoreProps,
} | {
	/**
	 * Use the plugin based store props.
	 */
	plugin: TLDataDocumentStore,
	tldraw?: undefined,
};

export type TldrawAppProps = {
	plugin: TldrawPlugin;
	/**
	 * If this value is undefined, then the tldraw document will not be persisted.
	 */
	store?: TldrawAppStoreProps,
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

function getEditorStoreProps(storeProps: TldrawAppStoreProps) {
	return storeProps.tldraw ? storeProps.tldraw : {
		store: storeProps.plugin.store
	}
}

const TldrawApp = ({ plugin, store, options: {
	assetStore,
	controller,
	focusOnMount = true,
	hideUi = false,
	initialImageSize,
	initialTool,
	isReadonly = false,
	onInitialSnapshot,
	selectNone = false,
	zoomToBounds = false,
} }: TldrawAppProps) => {
	const assetUrls = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: plugin.getIconOverrides(),
	})
	const overridesUi = React.useRef(uiOverrides(plugin))
	const overridesUiComponents = React.useRef(components(plugin))
	const [storeProps, setStoreProps] = React.useState(
		!store ? undefined : getEditorStoreProps(store)
	);
	const storeSnapshot = useSnapshotFromStoreProps(storeProps);

	const [editor, setEditor] = React.useState<Editor>();

	const [_onInitialSnapshot, setOnInitialSnapshot] = React.useState<typeof onInitialSnapshot>(() => onInitialSnapshot);
	const setAppState = React.useCallback((editor: Editor) => {
		setEditor(editor);
		if (_onInitialSnapshot) {
			_onInitialSnapshot(editor.store.getStoreSnapshot());
			setOnInitialSnapshot(undefined);
		}
	}, [_onInitialSnapshot])

	const { displayImage, imageSize, viewOptions: {
		bounds, ...viewOptionsOther
	} } = useViewModeState(editor, {
		controller,
		initialImageSize,
		onViewModeChanged(mode) {
			if (mode !== 'image') return;
			setEditor(undefined);
		},
		onStoreProps(storeProps) {
			setStoreProps(getEditorStoreProps(storeProps));
		},
	});

	const [isFocused, setIsFocused] = React.useState(false);

	const setFocusedEditor = (isMounting: boolean, editor?: Editor) => {
		const { currTldrawEditor } = plugin;
		if (currTldrawEditor !== editor) {
			if (currTldrawEditor) {
				currTldrawEditor.blur();
			}
			if (isMounting && !focusOnMount) {
				plugin.currTldrawEditor = undefined;
				return;
			}
			if (editor) {
				editor.focus()
				setIsFocused(true);
				plugin.currTldrawEditor = editor;
			}
		}
	}

	useTldrawAppEffects({
		bounds, editor, initialTool, isReadonly,
		selectNone, zoomToBounds,
		settingsProvider: plugin.settingsProvider,
		setFocusedEditor: (editor) => setFocusedEditor(true, editor),
	});

	const editorContainerRef = useClickAwayListener<HTMLDivElement>({
		enableClickAwayListener: isFocused,
		handler() {
			editor?.blur();
			nextFrame().then(() => controller?.onClickAway());
			setIsFocused(false);
			const { currTldrawEditor } = plugin;
			if (currTldrawEditor) {
				if (currTldrawEditor === editor) {
					plugin.currTldrawEditor = undefined;
				}
			}
		}
	});

	return displayImage ? (
		<div className="ptl-tldraw-image-container" style={{
			width: '100%',
			height: '100%'
		}}>
			{
				!storeSnapshot ? (
					<>No tldraw data to display</>
				) : (
					<div className="ptl-tldraw-image" style={{
						width: imageSize?.width || undefined,
						height: imageSize?.height || undefined
					}}>
						<TldrawImage
							snapshot={storeSnapshot}
							assets={assetStore}
							assetUrls={assetUrls.current}
							bounds={bounds === undefined ? undefined : Box.From(bounds)}
							{...viewOptionsOther}
						/>
					</div>
				)
			}
		</div>
	) : (
		<div
			className="tldraw-view-root"
			// e.stopPropagation(); this line should solve the mobile swipe menus bug
			// The bug only happens on the mobile version of Obsidian.
			// When a user tries to interact with the tldraw canvas,
			// Obsidian thinks they're swiping down, left, or right so it opens various menus.
			// By preventing the event from propagating, we can prevent those actions menus from opening.
			onTouchStart={(e) => e.stopPropagation()}
			ref={editorContainerRef}
			onFocus={(e) => {
				setFocusedEditor(false, editor);
			}}
			style={{
				width: '100%',
				height: '100%',
			}}
		>
			<Tldraw
				{...storeProps}
				assetUrls={assetUrls.current}
				hideUi={hideUi}
				overrides={overridesUi.current}
				components={overridesUiComponents.current}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={false}
				onMount={setAppState}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	plugin: TldrawPlugin,
	options: {
		app?: TldrawAppOptions,
		store?: TldrawAppStoreProps,
	} = {}
) => {
	const root = createRoot(node);
	root.render(
		<TldrawApp
			plugin={plugin}
			store={options.store}
			options={options.app ?? {}}
		/>
	);

	return root;
};

export default TldrawApp;
