import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";
import { ArchivosProduccionPanel } from "./archivos-produccion-panel";

const data: EstadoDocumentalOrden = {
  orden: { id: "ot", numero: "60" },
  gates: [
    {
      id: "g1",
      nombre: "Aprobación de color",
      tipoAprobacion: "COLOR_MUESTRA",
      paso: { id: "p1", nombre: "Impresión UV", estado: "PENDIENTE" },
      cumplido: false,
      documento: {
        id: "arte",
        nombre: "Arte final cenefa",
        proposito: "PRINT",
      },
      revisionLiberada: {
        id: "r1",
        numero: 1,
        liberadaEl: null,
        liberadaPorNombre: null,
        archivo: { id: "archivo-v1", nombre: "Cenefa.pdf" },
      },
    },
  ],
};

describe("archivos para producción dentro de Archivos", () => {
  it("mantiene visible un control incumplido aunque tenga una revisión liberada", () => {
    const html = renderToStaticMarkup(<ArchivosProduccionPanel data={data} />);
    expect(html).toContain("1 control pendiente");
    expect(html).toContain("Impresión UV");
    expect(html).toContain("/api/backend/archivos/archivo-v1/contenido");
    expect(html).not.toContain("Controles completos");
  });
  it("muestra el bloqueo cuando falta una revisión, conservando la descarga de otros controles", () => {
    const html = renderToStaticMarkup(
      <ArchivosProduccionPanel
        data={{
          ...data,
          gates: [
            ...data.gates,
            { ...data.gates[0], id: "g2", revisionLiberada: null },
          ],
        }}
      />,
    );
    expect(html).toContain("2 controles pendientes");
    expect(html).toContain("Producción bloqueada");
    expect(html).toContain("/api/backend/archivos/archivo-v1/contenido");
  });
  it("no ocupa espacio en órdenes sin controles ni confunde un error con ausencia de requisitos", () => {
    expect(
      renderToStaticMarkup(
        <ArchivosProduccionPanel data={{ ...data, gates: [] }} />,
      ),
    ).toBe("");
    const error = renderToStaticMarkup(<ArchivosProduccionPanel data={null} />);
    expect(error).toContain("No se pudieron consultar");
    expect(error).not.toContain("Controles completos");
  });
});
