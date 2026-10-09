import { afterEach, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generarPdfTomo, type SegmentoTomoPdf } from "./tomo-pdf";
const listar = vi.hoisted(() => vi.fn());
vi.mock("./archivos-api", () => ({ listarArchivos: listar }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const segmento: SegmentoTomoPdf = {
  nombre: "Original.pdf",
  paginas: 1,
  faz: 2,
  origenItemIds: ["item-propio"],
};
it("usa el acceso privado existente, valida la descarga y une también archivos de una OT guardada", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  listar.mockResolvedValue([
    { id: "archivo-propio", nombre: "Original.pdf", bytes: bytes.length },
  ]);
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(new Uint8Array(bytes))),
    );
  vi.stubGlobal("fetch", fetcher);
  const r = await generarPdfTomo([segmento, segmento]);
  expect(r).toMatchObject({ paginas: 4, blancos: 2 });
  expect(listar).toHaveBeenCalledExactlyOnceWith("ORDEN_ITEM", "item-propio");
  expect(fetcher).toHaveBeenCalledWith(
    "/api/backend/archivos/archivo-propio/contenido",
    { cache: "no-store", signal: undefined },
  );
});
it("no intenta leer contenido si el API niega el acceso a los originales", async () => {
  listar.mockRejectedValue(new Error("Sin permiso"));
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(generarPdfTomo([segmento])).rejects.toThrow("Sin permiso");
  expect(fetcher).not.toHaveBeenCalled();
});
it("no elige arbitrariamente entre archivos homónimos", async () => {
  listar.mockResolvedValue([
    { id: "a", nombre: "Original.pdf" },
    { id: "b", nombre: "Original.pdf" },
  ]);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(generarPdfTomo([segmento])).rejects.toThrow("identificar");
  expect(fetcher).not.toHaveBeenCalled();
});
it("rechaza la descarga incompleta y respeta cancelación", async () => {
  listar.mockResolvedValue([{ id: "a", nombre: "Original.pdf", bytes: 500 }]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("%PDF")));
  await expect(generarPdfTomo([segmento])).rejects.toThrow("incompleta");
  const control = new AbortController();
  control.abort();
  await expect(generarPdfTomo([segmento], control.signal)).rejects.toThrow();
});
