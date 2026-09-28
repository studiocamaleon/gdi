// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxRecuperacion } from "./inbox-recuperacion";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  router.refresh.mockClear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("recupera la ruta sin recargar toda la página y cancela el sondeo al salir", async () => {
  await act(async () => root.render(<InboxRecuperacion />));
  expect(router.refresh).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(router.refresh).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(router.refresh).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("interno");
  await act(async () => root.render(null));
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  window.dispatchEvent(new Event("online"));
  expect(router.refresh).toHaveBeenCalledTimes(2);
});
it("espera sin Internet o con la pestaña oculta y recupera al volver", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await act(async () => root.render(<InboxRecuperacion />));
  expect(container.textContent).toContain("Esperando conexión");
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(router.refresh).not.toHaveBeenCalled();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(router.refresh).toHaveBeenCalledOnce();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(router.refresh).toHaveBeenCalledOnce();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(router.refresh).toHaveBeenCalledTimes(2);
});
