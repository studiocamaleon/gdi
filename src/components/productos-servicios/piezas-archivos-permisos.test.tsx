// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PiezasArchivosProducto } from "./piezas-archivos-producto";
const api = vi.hoisted(() => ({
  subir: vi.fn(),
  inspeccionar: vi.fn(),
  guardar: vi.fn(),
}));
vi.mock("@/lib/archivos-api", () => ({ subirArchivo: api.subir }));
vi.mock("@/lib/geometrias-producto-api", () => ({
  inspeccionarArchivoProducto: api.inspeccionar,
  guardarInterpretacionesProducto: api.guardar,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
// La prueba recorre la carga y confirmación; las vistas geométricas se prueban aparte.
vi.mock("./pieza-vectorial-resumen", () => ({
  DatosArchivoPieza: () => null,
  MiniaturaPieza: () => null,
}));
vi.mock("./pieza-interpretacion-preview", () => ({
  PiezaInterpretacionPreview: () => null,
}));
vi.mock("./capas-fabricacion-selector", () => ({
  CapasFabricacionSelector: () => null,
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

it("importa un SVG de 50 piezas y permite seguir agregando diseños", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const entidades = Array.from({ length: 50 }, (_, i) => ({
    id: `pieza-${i}`,
    capa: "SVG",
    cerrada: true,
    apertura: 0,
    ancho: 10,
    alto: 10,
    area: 100,
    puntos: [
      { x: i * 20, y: 0 },
      { x: i * 20 + 10, y: 0 },
      { x: i * 20 + 10, y: 10 },
      { x: i * 20, y: 10 },
    ],
  }));
  api.subir.mockResolvedValue({ id: "archivo-ficticio" });
  api.inspeccionar.mockResolvedValue({
    formato: "SVG",
    unidadDeclarada: "mm",
    sugeridaId: entidades[0].id,
    avisos: [],
    entidades,
    piezas: entidades.map((e) => ({ exteriorId: e.id, interioresIds: [] })),
    piezasSugeridas: entidades.map((e) => e.id),
  });
  api.guardar.mockResolvedValue({
    fuentes: entidades.map((e) => ({
      schemaVersion: 2,
      nombreArchivo: "piezas.svg",
      svg: "<svg/>",
      anchoFinalMm: 10,
      altoFinalMm: 10,
      procedencia: { geometriaId: e.id, exteriorId: e.id },
    })),
  });
  const onChange = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <PiezasArchivosProducto
          productoId="producto-ficticio"
          fuentes={[]}
          onChange={onChange}
          paraCotizacion
        />,
      ),
    );
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["<svg/>"], "piezas.svg", { type: "image/svg+xml" })],
    });
    await act(async () =>
      input.dispatchEvent(new Event("change", { bubbles: true })),
    );
    const importar = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Importar 50 piezas",
    )!;
    expect(importar).toBeDefined();
    expect(importar.disabled).toBe(false);
    await act(async () => importar.click());
    expect(api.guardar).toHaveBeenCalledWith(
      "producto-ficticio",
      "archivo-ficticio",
      expect.objectContaining({ exteriorIds: entidades.map((e) => e.id) }),
    );
    const fuentes = onChange.mock.calls[0][0];
    expect(fuentes).toHaveLength(50);
    expect(new Set(fuentes.map((f: { id: string }) => f.id)).size).toBe(50);
    await act(async () =>
      root.render(
        <PiezasArchivosProducto
          productoId="producto-ficticio"
          fuentes={fuentes}
          onChange={onChange}
          paraCotizacion
        />,
      ),
    );
    expect(
      Array.from(host.querySelectorAll("button")).find(
        (b) => b.textContent === "Cargar archivos",
      )?.disabled,
    ).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}, 40000);
