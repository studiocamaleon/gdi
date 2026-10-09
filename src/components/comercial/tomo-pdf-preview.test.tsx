// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TomoPdfPreview } from "./tomo-pdf-preview";
const generar = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tomo-pdf", () => ({ generarPdfTomo: generar }));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    onPress,
    isDisabled,
    children,
  }: {
    onPress: () => void;
    isDisabled?: boolean;
    children: ReactNode;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    isOpen,
    children,
    onOpenChange,
  }: {
    isOpen: boolean;
    children: ReactNode;
    onOpenChange: (v: boolean) => void;
  }) =>
    isOpen ? (
      <section role="dialog">
        <button onClick={() => onOpenChange(false)}>Cerrar</button>
        {children}
      </section>
    ) : null,
}));
const el = document.createElement("div");
const root = createRoot(el);
const segmento = {
  nombre: "Manual.pdf",
  archivoNombre: "Manual.pdf",
  paginas: 3,
  paginasOriginales: 5,
  rangoPaginas: "1,3,5",
  faz: 2 as const,
};
afterEach(async () => {
  await act(async () => root.render(null));
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("prepara sólo al abrir, reutiliza la vista y revoca el PDF al cambiar los rangos", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const crear = vi.fn().mockReturnValue("blob:prueba"),
    revocar = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: crear, revokeObjectURL: revocar });
  generar.mockResolvedValue({
    bytes: new Uint8Array([37, 80, 68, 70]),
    paginas: 4,
    blancos: 1,
  });
  const render = async (rango = "1,3,5") =>
    act(async () =>
      root.render(
        <TomoPdfPreview
          nombre="Manual"
          segmentos={[{ ...segmento, rangoPaginas: rango }]}
        />,
      ),
    );
  await render();
  expect(generar).not.toHaveBeenCalled();
  await act(async () => el.querySelector("button")!.click());
  expect(el.querySelector("iframe")?.title).toBe("Vista previa de Manual");
  expect(el.querySelector("a")?.download).toBe("Manual.pdf");
  expect(el.textContent).toContain("4 páginas · 1 reversos en blanco");
  await act(async () =>
    el
      .querySelector('[role="dialog"] button')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  await act(async () => el.querySelector("button")!.click());
  expect(generar).toHaveBeenCalledTimes(1);
  await render("1-3");
  expect(revocar).toHaveBeenCalledWith("blob:prueba");
  expect(el.querySelector("iframe")).toBeNull();
  await act(async () => el.querySelector("button")!.click());
  expect(generar).toHaveBeenCalledTimes(2);
});
it("no ofrece unir Word ni mezclar simple y doble faz", async () => {
  await act(async () =>
    root.render(
      <TomoPdfPreview
        nombre="Tomo"
        segmentos={[{ ...segmento, archivoNombre: "Original.docx" }]}
      />,
    ),
  );
  expect(el.querySelector("button")!.disabled).toBe(true);
  await act(async () =>
    root.render(
      <TomoPdfPreview
        nombre="Tomo"
        segmentos={[segmento, { ...segmento, faz: 1 }]}
      />,
    ),
  );
  expect(el.querySelector("button")!.disabled).toBe(true);
  expect(generar).not.toHaveBeenCalled();
});
