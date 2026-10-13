// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ init: vi.fn() }));

it("hidrata sin consultas previas ni HTML extra y consulta la configuración una vez en StrictMode", async () => {
  vi.resetModules();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
  vi.stubGlobal("fetch", fetch);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const onRecoverableError = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root | undefined;

  try {
    const { MonitoreoCliente } = await import("./monitoreo-cliente");
    const app = (
      <StrictMode>
        <main>Aplicación ficticia</main>
        <MonitoreoCliente />
      </StrictMode>
    );
    container.innerHTML = renderToString(app);
    const contenidoServidor = container.firstChild;
    expect(container.innerHTML).toBe("<main>Aplicación ficticia</main>");
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      root = hydrateRoot(container, app, { onRecoverableError });
      expect(fetch).not.toHaveBeenCalled();
    });

    expect(container.firstChild).toBe(contenidoServidor);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/observabilidad/config",
      expect.objectContaining({ cache: "no-store" }),
    );
  } finally {
    if (root) await act(async () => root!.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
