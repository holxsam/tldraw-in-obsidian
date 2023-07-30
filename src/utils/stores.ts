import { create } from "zustand";
import { unstable_batchedUpdates } from "react-dom";
import { VIEW_TYPE_TLDRAW, ViewTypes } from "./constants";
import { subscribeWithSelector } from "zustand/middleware";

export type StatusBarViewModeState = {
	viewMode: ViewTypes;
};

export type StatusBarViewModeAction = {
	updateViewMode: (viewMode: ViewTypes) => void;
};

export const useStatusBarState = create<
	StatusBarViewModeState & StatusBarViewModeAction
>()(
	subscribeWithSelector((set) => ({
		viewMode: VIEW_TYPE_TLDRAW,
		updateViewMode: (viewMode: ViewTypes) => set(() => ({ viewMode })),
	}))
);

export const safeUpdateStatusBarViewMode = (viewMode: ViewTypes) => {
	unstable_batchedUpdates(() => {
		useStatusBarState.getState().updateViewMode(viewMode);
	});
};
