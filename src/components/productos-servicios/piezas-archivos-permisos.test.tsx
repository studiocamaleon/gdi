// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PiezasArchivosProducto } from "./piezas-archivos-producto";
const api = vi.hoisted(() => ({ subir: vi.fn(), inspeccionar: vi.fn() }));
vi.mock("@/lib/archivos-api", () => ({ subirArchivo: api.subir }));
vi.mock("@/lib/geometrias-producto-api", () => ({
  inspeccionarArchivoProducto: api.inspeccionar,
  guardarInterpretacionesProducto: vi.fn(),
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it.each([true, false])(
  "cargar un SVG elige el ámbito correcto (cotización=%s)",
  async (paraCotizacion) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    // Cortar después de verificar la solicitud evita simular el editor de capas.
    api.subir.mockResolvedValue({ id: "archivo-ficticio" });
    api.inspeccionar.mockRejectedValue(new Error("Inspección simulada"));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <PiezasArchivosProducto
            productoId="producto-ficticio"
            fuentes={[]}
            onChange={vi.fn()}
            paraCotizacion={paraCotizacion}
          />,
        ),
      );
      const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
      const file = new File(["<svg/>"], "pieza.svg", { type: "image/svg+xml" });
      Object.defineProperty(input, "files", { value: [file] });
      await act(async () =>
        input.dispatchEvent(new Event("change", { bubbles: true })),
      );
      expect(api.subir).toHaveBeenCalledWith(file, {
        scope: paraCotizacion ? "DISENO_COTIZACION" : "PRODUCTO",
        entidadId: "producto-ficticio",
        calcularHash: true,
      });
      expect(api.inspeccionar).toHaveBeenCalledWith(
        "producto-ficticio",
        "archivo-ficticio",
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
