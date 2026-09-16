import { describe, expect, it } from "vitest";
import {
  initialNavigationLoadingState,
  isNavigationLoading,
  navigationLoadingReducer as reduce,
} from "./navigation-loading-state";

describe("carga de navegación y módulos", () => {
  it("mantiene el indicador al cambiar la URL si el módulo todavía está cargando", () => {
    const id = Symbol();
    let state = reduce(initialNavigationLoadingState, { type: "route-start" });
    state = reduce(state, { type: "module-start", id });
    state = reduce(state, { type: "route-end" });
    expect(isNavigationLoading(state)).toBe(true);
    state = reduce(state, { type: "module-end", id });
    expect(isNavigationLoading(state)).toBe(false);
  });

  it("espera al último fallback sin depender del orden de montaje", () => {
    const first = Symbol();
    const second = Symbol();
    let state = reduce(initialNavigationLoadingState, {
      type: "module-start",
      id: first,
    });
    state = reduce(state, { type: "module-start", id: second });
    state = reduce(state, { type: "module-end", id: first });
    state = reduce(state, { type: "module-end", id: first });
    expect(isNavigationLoading(state)).toBe(true);
    state = reduce(state, { type: "module-end", id: second });
    expect(isNavigationLoading(state)).toBe(false);
  });

  it("muestra la carga de acceso directo aunque no se haya pulsado un enlace", () => {
    const id = Symbol();
    const state = reduce(initialNavigationLoadingState, {
      type: "module-start",
      id,
    });
    expect(isNavigationLoading(state)).toBe(true);
    expect(isNavigationLoading(reduce(state, { type: "module-end", id }))).toBe(
      false,
    );
  });

  it("termina una navegación rápida sin fallbacks y admite la siguiente", () => {
    let state = reduce(initialNavigationLoadingState, { type: "route-start" });
    state = reduce(state, { type: "route-end" });
    expect(isNavigationLoading(state)).toBe(false);
    state = reduce(state, { type: "route-start" });
    expect(isNavigationLoading(state)).toBe(true);
    expect(initialNavigationLoadingState.modules.size).toBe(0);
  });
});
