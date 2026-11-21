import { beforeEach, expect, it, vi } from "vitest";
import type { Archivo } from "./archivos";
import { eliminarArchivo, listarArchivos, subirArchivo } from "./archivos-api";
import { subirArchivosPendientesDeItem } from "./archivos-pendientes-item";

vi.mock("./archivos-api", () => ({
  subirArchivo: vi.fn(),
  listarArchivos: vi.fn(),
  eliminarArchivo: vi.fn(),
}));

const file = new File(["referencia ficticia"], "Referencia.pdf");
const copiado = { jobContext: { _centroCopiado: { paginas: 1 } } };
const anterior: Archivo = {
  id: "original", scope: "ORDEN_ITEM", nombre: file.name,
  mimeType: "application/pdf", bytes: 18, esImagen: false, publico: false,
  descripcion: null, autogeneradoPor: "centro-copiado",
  createdAt: "2026-11-20", subidoPor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarArchivos).mockResolvedValue([anterior, { ...anterior, id: "adjunto", autogeneradoPor: null }]);
});

it("adjunta las referencias de trabajos a medida sin marcarlas como originales para imprimir", async () => {
  await subirArchivosPendientesDeItem("producto", { jobContext: { trabajoMedida: {} } }, [file]);
  expect(subirArchivo).toHaveBeenCalledWith(file, { scope: "ORDEN_ITEM", entidadId: "producto" });
  expect(listarArchivos).not.toHaveBeenCalled();
  expect(eliminarArchivo).not.toHaveBeenCalled();
});

it("en copiado reemplaza únicamente el original de igual nombre, después de subir", async () => {
  await subirArchivosPendientesDeItem("producto", copiado, [file]);
  expect(subirArchivo).toHaveBeenCalledWith(file, expect.objectContaining({ autogeneradoPor: "centro-copiado" }));
  expect(eliminarArchivo).toHaveBeenCalledExactlyOnceWith("original");
  expect(subirArchivo).toHaveBeenCalledBefore(vi.mocked(eliminarArchivo));
});

it("conserva el original si falla la subida", async () => {
  vi.mocked(subirArchivo).mockRejectedValueOnce(new Error("Subida interrumpida"));
  await expect(subirArchivosPendientesDeItem("producto", copiado, [file])).rejects.toThrow("Subida interrumpida");
  expect(eliminarArchivo).not.toHaveBeenCalled();
});
