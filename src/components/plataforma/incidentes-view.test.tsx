import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/observabilidad-cliente", () => ({
  reportarPruebaCliente: vi.fn(),
}));
import { IncidentesResultado } from "./incidentes-view";

describe("Estado visible del monitor", () => {
  const base = {
    actualizadoEl: null,
    incidentes: [],
    hayMas: false,
    enlace: "https://grafoprint.sentry.io/issues/",
  };
  it("no presenta un monitor caído como sistema sin errores", () => {
    const html = renderToStaticMarkup(
      <IncidentesResultado datos={{ ...base, conexion: "no_disponible" }} />,
    );
    expect(html).toContain("No pudimos actualizar");
    expect(html).not.toContain("Sin incidentes para estos filtros");
    expect(html).not.toContain("Incidentes encontrados");
  });
  it("distingue una consulta vacía confirmada de una conexión pendiente", () => {
    expect(
      renderToStaticMarkup(
        <IncidentesResultado datos={{ ...base, conexion: "conectado" }} />,
      ),
    ).toContain("Sin incidentes para estos filtros");
    expect(
      renderToStaticMarkup(
        <IncidentesResultado datos={{ ...base, conexion: "sin_configurar" }} />,
      ),
    ).toContain("Conexión pendiente");
  });
});
