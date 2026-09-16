/** La URL puede estar lista mientras siguen montados fallbacks de Suspense. */
export type NavigationLoadingState = {
  routePending: boolean;
  modules: ReadonlySet<symbol>;
};

type LoadingAction =
  | { type: "route-start" }
  | { type: "route-end" }
  | { type: "module-start"; id: symbol }
  | { type: "module-end"; id: symbol };

export const initialNavigationLoadingState: NavigationLoadingState = {
  routePending: false,
  modules: new Set(),
};

export function navigationLoadingReducer(
  state: NavigationLoadingState,
  action: LoadingAction,
): NavigationLoadingState {
  if (action.type === "route-start" || action.type === "route-end") {
    const routePending = action.type === "route-start";
    return state.routePending === routePending
      ? state
      : { ...state, routePending };
  }
  const modules = new Set(state.modules);
  if (action.type === "module-start") modules.add(action.id);
  else modules.delete(action.id);
  return { ...state, modules };
}

export function isNavigationLoading(state: NavigationLoadingState) {
  return state.routePending || state.modules.size > 0;
}
