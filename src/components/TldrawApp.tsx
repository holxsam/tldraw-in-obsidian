import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	BoxLike,
	DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	TLComponents,
	TLStore,
	Tldraw,
	TldrawFile,
	TldrawImage,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	createTLStore,
	defaultShapeUtils,
	useActions,
} from "tldraw";
import { useDebouncedCallback } from "use-debounce";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { safeSecondsToMs } from "src/utils/utils";
import { uiOverrides } from "src/tldraw/ui-overrides";
import { TLDataDocument, TldrawPluginMetaData } from "src/utils/document";
import { createRawTldrawFile } from "src/utils/tldraw-file";
import TldrawPlugin from "src/main";
import { Platform } from "obsidian";
import { TldrawAppViewModeController } from "src/obsidian/helpers/TldrawAppEmbedViewController";
import { useTldrawAppHook } from "src/hooks/useTldrawAppHook";

type TldrawAppOptions = {
	controller?: TldrawAppViewModeController;
	isReadonly?: boolean,
	autoFocus?: boolean,
	inputFocus?: boolean,
	initialBounds?: BoxLike,
	initialImageSize?: { width: number, height: number },
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string,
	hideUi?: boolean,
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

export type SetTldrawFileData = (data: {
	meta: TldrawPluginMetaData
	tldrawFile: TldrawFile
}) => void;

export type TldrawAppProps = {
	plugin: TldrawPlugin;
	initialData: TLDataDocument;
	setFileData: SetTldrawFileData;
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
	autoFocus = true,
	controller,
	hideUi = false,
	initialBounds,
	initialImageSize,
	initialTool,
	inputFocus = false,
	isReadonly = false,
	persistenceKey,
	selectNone = false,
	zoomToBounds = false,
} }: TldrawAppProps) => {
	const saveDelayInMs = safeSecondsToMs(plugin.settings.saveFileDelay);

	const storeMetaRef = React.useRef<{
		meta: TldrawPluginMetaData,
		store: TLStore,
	}>((() => {
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
	})());

	const debouncedSaveDataToFile = useDebouncedCallback((e: unknown) => {
		const { meta, store } = storeMetaRef.current;
		setFileData({
			meta,
			tldrawFile: createRawTldrawFile(store)
		});
	}, saveDelayInMs);

	const editorRef = React.useRef<Editor | null>(null);
	const {
		onMount,
		viewModeState: { displayImage, imageSize, viewOptions, }
	} = useTldrawAppHook({
		debouncedSaveDataToFile, editorRef, initialTool, isReadonly, plugin,
		storeMetaRef, selectNone, zoomToBounds,
		viewMode: {
			controller,
			initialBounds,
			initialImageSize,
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
			onBlur={!inputFocus ? undefined : () => {
				editorRef.current?.selectNone()
				editorRef.current?.blur()
			}}
			onFocus={!inputFocus ? undefined : () => editorRef.current?.focus()}
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
							snapshot={storeMetaRef.current.store.getStoreSnapshot()}
							padding={0}
							assetUrls={{
								fonts: plugin.getFontOverrides(),
								icons: plugin.getIconOverrides(),
							}}
							{...viewOptions}
						/>
					</div>
				</div>
			) : (
				<div
					onTouchStart={(e) => e.stopPropagation()}
					style={{
						width: '100%',
						height: '100%',
					}}
				>
					{
						persistenceKey === undefined
							?
							<Tldraw
								assetUrls={{
									fonts: plugin.getFontOverrides(),
									icons: plugin.getIconOverrides(),
								}}
								hideUi={hideUi}
								overrides={uiOverrides(plugin)}
								store={storeMetaRef.current.store}
								components={components(plugin)}
								// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
								autoFocus={autoFocus}
								onMount={onMount}
							/>
							: <Tldraw
								persistenceKey={persistenceKey}
								snapshot={storeMetaRef.current.store.getStoreSnapshot()}
								assetUrls={{
									fonts: plugin.getFontOverrides(),
									icons: plugin.getIconOverrides(),
								}}
								hideUi={hideUi}
								overrides={uiOverrides(plugin)}
								components={components(plugin)}
								autoFocus={autoFocus}
								onMount={onMount}
							/>
					}
				</div>
			)}
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	initialData: TLDataDocument,
	setFileData: SetTldrawFileData,
	plugin: TldrawPlugin,
	options: TldrawAppOptions = {}
) => {
	const root = createRoot(node);

	root.render(
		<TldrawApp
			setFileData={setFileData}
			initialData={initialData}
			plugin={plugin}
			options={options}
		/>
	);

	return root;
};

export default TldrawApp;
