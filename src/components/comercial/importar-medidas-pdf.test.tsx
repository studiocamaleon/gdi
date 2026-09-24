// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ImportarMedidasPdf } from "./importar-medidas-pdf";
import type { LecturaArchivoResultado } from "@/lib/pdf-medidas";
const api = vi.hoisted(() => ({ leer: vi.fn() }));
vi.mock("@/lib/pdf-medidas", () => ({ leerMedidasPdf: api.leer }));
let el: HTMLDivElement, root: Root;
const confirmar = vi.fn();
const files = [
  new File(["a"], "a.pdf", { type: "application/pdf" }),
  new File(["b"], "b.pdf", { type: "application/pdf" }),
];
const paginas = files.map((f) => ({
  ok: true,
  archivoNombre: f.name,
  paginas: [
    {
      archivoNombre: f.name,
      pagina: 1,
      totalPaginas: 1,
      anchoMm: 100,
      altoMm: 200,
      orientacion: "vertical",
      medidaVisible: { anchoMm: 100, altoMm: 200 },
    },
  ],
}));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  api.leer.mockResolvedValue(paginas);
  confirmar.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const boton = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  )!;
const cargar = async () => {
  await act(async () =>
    root.render(<ImportarMedidasPdf onConfirmar={confirmar} />),
  );
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  await act(async () => {
    Object.defineProperty(input, "files", { value: files, configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const editar = async (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const arrastrar = async (
  target: Element,
  tipo: string,
  archivos = files,
  types = ["Files"],
) => {
  const event = new Event(tipo, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { files: archivos, types, dropEffect: "none" },
  });
  await act(async () => target.dispatchEvent(event));
  return event;
};
it("recibe varios PDF sobre los campos de medidas y revisa antes de incorporar", async () => {
  await act(async () => root.render(
    <ImportarMedidasPdf onConfirmar={confirmar}>
      {(importar) => <><input aria-label="Ancho" />{importar}</>}
    </ImportarMedidasPdf>,
  ));
  const zona = el.firstElementChild!;
  const campo = el.querySelector('input[aria-label="Ancho"]')!;
  expect((await arrastrar(zona, "dragenter")).defaultPrevented).toBe(true);
  await arrastrar(campo, "dragenter");
  await arrastrar(zona, "dragleave");
  expect(zona.hasAttribute("data-arrastrando")).toBe(true);
  expect(el.textContent).toContain("Soltá los PDF para revisar sus medidas");
  expect((await arrastrar(campo, "dragover")).defaultPrevented).toBe(true);
  expect((await arrastrar(campo, "drop")).defaultPrevented).toBe(true);
  expect(zona.hasAttribute("data-arrastrando")).toBe(false);
  expect(api.leer).toHaveBeenCalledExactlyOnceWith(files);
  expect(confirmar).not.toHaveBeenCalled();
  await act(async () => boton("Agregar 2 piezas").click());
  expect(confirmar.mock.calls[0][1]).toEqual(files);
});
it("no captura arrastres de texto ni activa importación en modalidades incompatibles", async () => {
  await act(async () => root.render(<ImportarMedidasPdf onConfirmar={confirmar} />));
  const zona = el.firstElementChild!;
  expect((await arrastrar(zona, "dragenter", [], ["text/plain"])).defaultPrevented).toBe(false);
  await arrastrar(zona, "drop", [], ["text/plain"]);
  expect(zona.hasAttribute("data-arrastrando")).toBe(false);
  await act(async () => root.render(<ImportarMedidasPdf habilitada={false} onConfirmar={confirmar} />));
  await arrastrar(zona, "dragenter");
  await arrastrar(zona, "drop");
  expect(zona.hasAttribute("data-arrastrando")).toBe(false);
  expect(api.leer).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("al salir de la zona quita el resaltado; al soltar archivos mixtos informa cuáles no son PDF", async () => {
  await act(async () => root.render(<ImportarMedidasPdf onConfirmar={confirmar} />));
  const zona = el.firstElementChild!;
  await arrastrar(zona, "dragenter");
  await arrastrar(zona, "dragleave");
  expect(zona.hasAttribute("data-arrastrando")).toBe(false);
  const imagen = new File(["imagen"], "foto.png", { type: "image/png" });
  api.leer.mockResolvedValue([
    { ok: false, archivoNombre: "foto.png", error: "No es un PDF" },
    paginas[0],
  ]);
  await arrastrar(zona, "drop", [imagen, files[0]]);
  expect(document.body.textContent).toContain("foto.png: No es un PDF");
  await act(async () => boton("Agregar 1 pieza").click());
  expect(confirmar.mock.calls[0][1]).toEqual([files[0]]);
});
it("revisa selección y escala antes de agregar; sólo conserva archivos confirmados", async () => {
  await cargar();
  expect(confirmar).not.toHaveBeenCalled();
  const checks =
    document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]');
  expect(checks.length).toBe(3);
  await act(async () => checks[2].click());
  await editar(
    document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!,
    "10",
  );
  expect(document.body.textContent).toContain("100 × 200 cm");
  await act(async () => boton("Agregar 1 pieza").click());
  expect(confirmar).toHaveBeenCalledOnce();
  expect(confirmar.mock.calls[0][0]).toEqual([
    expect.objectContaining({
      archivoNombre: "a.pdf",
      anchoMm: 100,
      altoMm: 200,
      anchoFinalMm: 1000,
      altoFinalMm: 2000,
    }),
  ]);
  expect(confirmar.mock.calls[0][1]).toEqual([files[0]]);
});
it("cancelar no incorpora medidas ni adjuntos", async () => {
  await cargar();
  await act(async () => boton("Cancelar").click());
  expect(confirmar).not.toHaveBeenCalled();
});
it("no permite confirmar escala inválida ni una selección vacía", async () => {
  await cargar();
  await editar(
    document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!,
    "0",
  );
  expect(boton("Agregar 2 piezas").disabled).toBe(true);
  await editar(
    document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!,
    "1",
  );
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click(),
  );
  expect(boton("Agregar 0 piezas").disabled).toBe(true);
});
it("un PDF inválido no descarta las páginas válidas de otro archivo", async () => {
  api.leer.mockResolvedValue([
    paginas[0],
    { ok: false, archivoNombre: "b.pdf", error: "No se pudo leer el PDF" },
  ]);
  await cargar();
  expect(document.body.textContent).toContain("b.pdf: No se pudo leer el PDF");
  await act(async () => boton("Agregar 1 pieza").click());
  expect(confirmar.mock.calls[0][1]).toEqual([files[0]]);
});
it("cancelar una lectura en curso descarta el resultado tardío", async () => {
  let terminar!: (v: LecturaArchivoResultado[]) => void;
  api.leer.mockImplementation(
    () =>
      new Promise((resolve) => {
        terminar = resolve;
      }),
  );
  await cargar();
  await act(async () => boton("Cancelar").click());
  await act(async () => terminar(paginas as LecturaArchivoResultado[]));
  expect(confirmar).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
