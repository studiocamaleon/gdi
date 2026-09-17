import { describe, expect, it } from "vitest";
import type { Archivo } from "./archivos";
import type { EstadoDocumentalOrden } from "./desarrollo-documental-api";
import {
  actualizarAdjuntosGenerales,
  contarArchivosDeOrden,
} from "./archivos-presentacion";

const archivo = (id: string): Archivo => ({
  id,
  scope: "CAMPANA",
  nombre: `${id}.pdf`,
  mimeType: "application/pdf",
  bytes: 100,
  publico: false,
  descripcion: null,
  autogeneradoPor: null,
  esImagen: false,
  createdAt: "2026-09-15",
  subidoPor: "Diseño",
});
const gate = (
  id: string,
  archivoId: string | null,
): EstadoDocumentalOrden["gates"][number] => ({
  id,
  nombre: "Control de impresión",
  tipoAprobacion: "CLIENTE",
  paso: null,
  cumplido: Boolean(archivoId),
  documento: { id: "arte", nombre: "Arte final", proposito: "PRINT" },
  revisionLiberada: archivoId
    ? {
        id: "v1",
        numero: 1,
        liberadaEl: null,
        liberadaPorNombre: null,
        archivo: { id: archivoId, nombre: "Arte.pdf" },
      }
    : null,
});

describe("biblioteca de archivos unificada", () => {
  it("conserva archivos de todas las revisiones cuando el uploader agrega o elimina adjuntos", () => {
    const actuales = [archivo("v1"), archivo("obsoleta"), archivo("brief")];
    const ids = new Set(["v1", "obsoleta"]);
    const subida = actualizarAdjuntosGenerales(
      actuales,
      [archivo("brief"), archivo("nuevo")],
      ids,
    );
    expect(subida.map((a) => a.id)).toEqual([
      "v1",
      "obsoleta",
      "brief",
      "nuevo",
    ]);
    const borrado = actualizarAdjuntosGenerales(
      subida,
      [archivo("nuevo")],
      ids,
    );
    expect(borrado.map((a) => a.id)).toEqual(["v1", "obsoleta", "nuevo"]);
    expect(actuales.map((a) => a.id)).toEqual(["v1", "obsoleta", "brief"]);
  });

  it("tolera la superposición mientras un adjunto se incorpora a una revisión", () => {
    const result = actualizarAdjuntosGenerales(
      [archivo("v1")],
      [archivo("v1"), archivo("nuevo")],
      new Set(["v1"]),
    );
    expect(result.map((a) => a.id)).toEqual(["v1", "nuevo"]);
  });

  it("cuenta archivos físicos y no controles, incluyendo los del taller y de cada ítem", () => {
    const adjuntos = {
      documento: [archivo("brief")],
      items: [{ itemId: "i1", nombre: "Cartel", archivos: [archivo("arte")] }],
    };
    const controles: EstadoDocumentalOrden = {
      orden: { id: "ot", numero: "60" },
      gates: [
        gate("g1", "arte"),
        gate("g2", "arte"),
        gate("g3", "plano"),
        gate("g4", null),
      ],
    };
    expect(contarArchivosDeOrden(adjuntos, controles)).toBe(3);
    expect(contarArchivosDeOrden(adjuntos, null)).toBe(2);
  });
});
