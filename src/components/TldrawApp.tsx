import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	BoxLike,
	DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLStateNodeConstructor,
	TLStoreSnapshot,
	TLUiAssetUrlOverrides,
	TLUiOverrides,
	useActions,
} from "tldraw";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { uiOverrides } from "src/tldraw/ui-overrides";
import TldrawPlugin from "src/main";
import { Platform } from "obsidian";
import { useTldrawAppEffects } from "src/hooks/useTldrawAppHook";
import { useClickAwayListener } from "src/hooks/useClickAwayListener";
import { TLDataDocumentStore } from "src/utils/document";

type TldrawAppOptions = {
	iconAssetUrls?: TLUiAssetUrlOverrides['icons'],
	isReadonly?: boolean,
	autoFocus?: boolean,
	focusOnMount?: boolean,
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string,
	initialBounds?: BoxLike,
	hideUi?: boolean,
	/**
	 * Whether to call `.selectNone` on the Tldraw editor instance when it is mounted.
	 */
	selectNone?: boolean,
	tools?: readonly TLStateNodeConstructor[],
	uiOverrides?: TLUiOverrides,
	components?: TLComponents,
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
	onInitialSnapshot?: (snapshot: TLStoreSnapshot) => void,
	/**
	 * 
	 * @param event 
	 * @returns `true` if the editor should be blurred.
	 */
	onClickAwayBlur?: (event: PointerEvent) => boolean,
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
	components: otherComponents,
	focusOnMount = true,
	hideUi = false,
	iconAssetUrls,
	initialBounds,
	initialTool,
	isReadonly = false,
	onClickAwayBlur,
	onInitialSnapshot,
	selectNone = false,
	tools,
	uiOverrides: otherUiOverrides,
	zoomToBounds = false,
} }: TldrawAppProps) => {
	const assetUrls = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: {
			...plugin.getIconOverrides(),
			...iconAssetUrls,
		},
	})
	const overridesUi = React.useRef({
		...uiOverrides(plugin),
		...otherUiOverrides
	})
	const overridesUiComponents = React.useRef({
		...components(plugin),
		...otherComponents
	})

	const storeProps = React.useMemo(() => !store ? undefined : getEditorStoreProps(store), [store])

	const [editor, setEditor] = React.useState<Editor>();

	const [_onInitialSnapshot, setOnInitialSnapshot] = React.useState<typeof onInitialSnapshot>(() => onInitialSnapshot);
	const setAppState = React.useCallback((editor: Editor) => {
		setEditor(editor);
		if (_onInitialSnapshot) {
			_onInitialSnapshot(editor.store.getStoreSnapshot());
			setOnInitialSnapshot(undefined);
		}
	}, [_onInitialSnapshot])

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
		bounds: initialBounds, editor, initialTool, isReadonly,
		selectNone, zoomToBounds,
		settingsProvider: plugin.settingsProvider,
		setFocusedEditor: (editor) => setFocusedEditor(true, editor),
	});

	const editorContainerRef = useClickAwayListener<HTMLDivElement>({
		enableClickAwayListener: isFocused,
		handler(ev) {
			const blurEditor = onClickAwayBlur?.(ev);
			if (blurEditor !== undefined && !blurEditor) return;
			editor?.blur();
			setIsFocused(false);
			const { currTldrawEditor } = plugin;
			if (currTldrawEditor) {
				if (currTldrawEditor === editor) {
					plugin.currTldrawEditor = undefined;
				}
			}
		}
	});

	return (
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
				tools={tools}
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
