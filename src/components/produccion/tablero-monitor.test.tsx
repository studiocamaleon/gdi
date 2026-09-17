import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TableroMonitor } from "./tablero-monitor";

describe("cabecera del monitor de producción", () => {
  it("muestra segundos en el horario del taller sin anunciar cada tick al lector de pantalla", () => {
    const html = renderToStaticMarkup(<TableroMonitor zona="America/Argentina/Rio_Gallegos"
      actualizadoEl={new Date("2026-09-14T17:12:30Z")} conexion="en_vivo"
      error={false} refreshing={false} onRefresh={() => {}} />);
    expect(html).toContain("14:12:30");
    expect(html).toContain('aria-live="off"');
    expect(html).toContain("En vivo");
    expect(html).toContain("Control de producción");
  });
  it("no inventa una hora de sincronización cuando no se pudieron cargar los datos", () => {
    const html = renderToStaticMarkup(<TableroMonitor zona="UTC" actualizadoEl={null}
      conexion="conectando" error refreshing={false} onRefresh={() => {}} />);
    expect(html).toContain("Sin sincronizar");
    expect(html).toContain("Datos sin actualizar");
    expect(html).not.toContain("En vivo");
  });
});
