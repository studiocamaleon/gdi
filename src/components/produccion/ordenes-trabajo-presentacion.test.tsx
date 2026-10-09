import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoListado } from "./ordenes-trabajo-presentacion";

describe("estado de borradores descartados", () => {
  it("distingue un borrador archivado de una orden cancelada", () => {
    expect(renderToStaticMarkup(<EstadoListado estado="cancelada" borradorDescartado />)).toContain("Borrador descartado");
    expect(renderToStaticMarkup(<EstadoListado estado="cancelada" />)).toContain("Cancelada");
  });
});
