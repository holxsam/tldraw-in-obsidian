import * as React from "react";
import { createRoot } from "react-dom/client";
import { VIEW_TYPE_MARKDOWN, VIEW_TYPE_TLDRAW } from "../utils/constants";
import { useStatusBarState } from "../utils/stores";

const StatusBarViewMode = () => {
	const viewMode = useStatusBarState((state) => state.viewMode);
	const setViewMode = useStatusBarState((state) => state.updateViewMode);

	const a = viewMode === VIEW_TYPE_TLDRAW ? "ptl-viewmode-active" : "";
	const b = viewMode === VIEW_TYPE_MARKDOWN ? "ptl-viewmode-active" : "";

	const setTldrawView = () => setViewMode(VIEW_TYPE_TLDRAW);
	const setMarkdownView = () => setViewMode(VIEW_TYPE_MARKDOWN);

	return (
		<div className="ptl-statusbar-viewmode-box">
			<span>View:</span>
			<div className="ptl-statusbar-viewmode-btn-box">
				<button
					type="button"
					title="View as Tldraw"
					className={`ptl-viewmode-btn ${a}`}
					onClick={setTldrawView}
				>
					TL
				</button>
				<button
					type="button"
					title="View as Markdown"
					className={`ptl-viewmode-btn ${b}`}
					onClick={setMarkdownView}
				>
					MD
				</button>
			</div>
		</div>
	);
};

export const createReactStatusBarViewMode = (htmlElement: HTMLElement) => {
	const root = createRoot(htmlElement);

	root.render(
		<React.StrictMode>
			<StatusBarViewMode />
		</React.StrictMode>
	);

	return root;
};

export default StatusBarViewMode;
