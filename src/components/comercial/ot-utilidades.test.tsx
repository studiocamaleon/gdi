// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CopiarTelefonoCliente } from "./copiar-telefono-cliente";
import { DescargarArchivosButton } from "../archivos/descargar-archivos-button";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({ onPress, isDisabled, children, ...props }: any) => (
    <button
      disabled={isDisabled}
      onClick={onPress}
      aria-label={props["aria-label"]}
    >
      {children}
    </button>
  ),
}));
let el: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.restoreAllMocks();
});

it("copia el teléfono completo, no sólo el número sin prefijo", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  await act(async () =>
    root.render(<CopiarTelefonoCliente telefono="+1 202 555 0142" />),
  );
  await act(async () => el.querySelector("button")!.click());
  expect(writeText).toHaveBeenCalledWith("+1 202 555 0142");
  expect(mocks.success).toHaveBeenCalledWith("Teléfono copiado.");
});
it("no ofrece copiar si no hay teléfono y avisa si el navegador lo rechaza", async () => {
  await act(async () => root.render(<CopiarTelefonoCliente telefono={null} />));
  expect(el.querySelector("button")).toBeNull();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  await act(async () =>
    root.render(<CopiarTelefonoCliente telefono="+1 202 555 0142" />),
  );
  await act(async () => el.querySelector("button")!.click());
  expect(mocks.error).toHaveBeenCalled();
  expect(mocks.success).not.toHaveBeenCalled();
});
it.each(["orden", "item"] as const)(
  "descarga un único ZIP de %s después de comprobar acceso",
  async (tipo) => {
    mocks.request.mockResolvedValue({ cantidad: 2 });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.getAttribute("href")).toBe(
          `/api/backend/archivos/de-${tipo}/demo/zip`,
        );
        expect(this.download).toBe("archivos.zip");
      });
    await act(async () =>
      root.render(<DescargarArchivosButton tipo={tipo} id="demo" />),
    );
    await act(async () => el.querySelector("button")!.click());
    expect(mocks.request).toHaveBeenCalledWith(
      `/archivos/de-${tipo}/demo/zip?comprobar=1`,
    );
    expect(click).toHaveBeenCalledTimes(1);
  },
);
it("un rechazo del API no inicia una descarga ni anuncia éxito", async () => {
  mocks.request.mockRejectedValue(new Error("No hay archivos disponibles"));
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  await act(async () =>
    root.render(<DescargarArchivosButton tipo="orden" id="demo" />),
  );
  await act(async () => el.querySelector("button")!.click());
  expect(click).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("No hay archivos disponibles");
});
