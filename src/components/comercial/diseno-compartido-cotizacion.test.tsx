// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisenoCompartidoCotizacion } from "./diseno-compartido-cotizacion";
import { normalizarFuenteVectorial } from "@/lib/productos-servicios-api";
import type { FuenteVectorialCotizada } from "./geometrias-vectoriales-cotizacion";

vi.mock("@/lib/productos-servicios-api", () => ({
  normalizarFuenteVectorial: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
  vi.clearAllMocks();
});
const svg = '<svg viewBox="0 0 100 50"><path d="M0 0H100V50H0Z"/></svg>';
const fuente: FuenteVectorialCotizada = {
  schemaVersion: 1,
  nombreArchivo: "cartel-ficticio.svg",
  svg,
  anchoFinalMm: 1000,
  altoFinalMm: 500,
  relacionAltoAncho: 0.5,
};
async function montar(inicial?: FuenteVectorialCotizada) {
  const cambio = vi.fn();
  const ocupado = vi.fn();
  function Prueba() {
    const [value, setValue] = useState(inicial);
    return (
      <DisenoCompartidoCotizacion
        titulo="Diseño del cartel"
        value={value}
        onChange={(next) => {
          cambio(next);
          setValue(next);
        }}
        onProcesandoChange={ocupado}
      />
    );
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => root.render(<Prueba />));
  return { cambio, ocupado };
}
async function subir(nombre: string) {
  const input =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    value: [{ name: nombre, text: async () => "archivo ficticio" }],
    configurable: true,
  });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
async function ancho(valor: string) {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
describe("diseño completo compartido entre materiales", () => {
  it("pide una medida y carga todo el SVG manteniendo su proporción", async () => {
    vi.mocked(normalizarFuenteVectorial).mockResolvedValue({
      formatoOrigen: "SVG",
      nombreArchivo: "cartel-ficticio.svg",
      svg,
      anchoSugeridoMm: 1000,
      altoSugeridoMm: 500,
      relacionAltoAncho: 0.5,
      unidadDetectada: null,
      diagnosticos: [],
    });
    const { cambio } = await montar();
    await ancho("170");
    await subir("cartel-ficticio.svg");
    expect(cambio).toHaveBeenLastCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
        svg,
        anchoFinalMm: 1700,
        altoFinalMm: 850,
      }),
    );
    expect(container.textContent).toContain("Alto proporcional: 85 cm");
    expect(container.textContent).not.toContain("Por producto");
    await ancho("200");
    expect(cambio).toHaveBeenLastCalledWith(
      expect.objectContaining({ anchoFinalMm: 2000, altoFinalMm: 1000 }),
    );
  });
  it("toma las medidas físicas del DXF sin reemplazarlas por el ancho anterior", async () => {
    vi.mocked(normalizarFuenteVectorial).mockResolvedValue({
      formatoOrigen: "DXF",
      nombreArchivo: "cartel-ficticio.dxf",
      svg,
      anchoSugeridoMm: 1700,
      altoSugeridoMm: 850,
      relacionAltoAncho: 0.5,
      unidadDetectada: "mm",
      medidasOriginales: { ancho: 1700, alto: 850 },
      diagnosticos: [],
    });
    const { cambio } = await montar(fuente);
    await subir("cartel-ficticio.dxf");
    expect(cambio).toHaveBeenLastCalledWith(
      expect.objectContaining({
        anchoFinalMm: 1700,
        altoFinalMm: 850,
        unidadOrigen: "mm",
        importacionDxf: expect.objectContaining({ anchoUnidades: 1700 }),
      }),
    );
  });
  it("conserva el diseño anterior cuando falla la carga y bloquea una medida vacía", async () => {
    vi.mocked(normalizarFuenteVectorial).mockRejectedValue(
      new Error("Archivo inválido"),
    );
    const { cambio, ocupado } = await montar(fuente);
    await subir("fallido.svg");
    expect(cambio).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Archivo inválido",
    );
    await ancho("");
    expect(ocupado).toHaveBeenLastCalledWith(true);
    expect(
      container
        .querySelector('input[type="number"]')
        ?.getAttribute("aria-invalid"),
    ).toBe("true");
  });
});
