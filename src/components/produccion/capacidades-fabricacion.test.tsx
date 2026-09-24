// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
import { DisenoVectorialCotizador } from "../comercial/diseno-vectorial-cotizador";
import { McpCard } from "../integraciones/credenciales-mcp";
import { PlantillaInstalacionPanel } from "./plantilla-instalacion-panel";
import { RecorridoCortePanel } from "./recorrido-corte-panel";
import { resolverConfiguracionEncastresVectoriales } from "@/lib/productos-servicios-api";

const api = vi.hoisted(() => ({
  getRecorridosGuardados: vi.fn().mockResolvedValue([]),
  getPreparacionesRecorridoCorte: vi.fn().mockResolvedValue([]),
  getPlantillaInstalacion: vi.fn(),
  regenerarPreparacionesRecorridoCorte: vi.fn(),
}));
vi.mock("@/lib/recorridos-vectoriales-api", async (original) => ({
  ...(await original<object>()),
  ...api,
}));
vi.mock("../navigation/permisos-provider", () => ({ usePuede: () => true }));

describe("herramientas avanzadas según el plan", () => {
  const fuente = {
    schemaVersion: 1 as const,
    nombreArchivo: "historico.svg",
    svg: "<svg/>",
    anchoFinalMm: 100,
  };
  const props = {
    value: fuente,
    analisis: null,
    cotizacionManual: { placas: 2, metrosCortePorPlaca: 3 },
    cantidad: 1,
    placa: null,
    configuracionEncastres: resolverConfiguracionEncastresVectoriales(null),
    onChange: vi.fn(),
    onCotizacionManualChange: vi.fn(),
  };
  it("conserva la cotización manual por placas cuando faltan las herramientas vectoriales", () => {
    const html = renderToStaticMarkup(
      <CapacidadesProvider capacidades={{ funciones: {} }}>
        <DisenoVectorialCotizador {...props} modoCotizacion="placas" />
      </CapacidadesProvider>,
    );
    expect(html).toContain("Placas totales del trabajo");
    expect(html).toContain("Corte por placa");
    expect(html).not.toContain("no está incluida");
  });
  it("conserva el nombre del archivo existente sin permitir un análisis nuevo", () => {
    const html = renderToStaticMarkup(
      <CapacidadesProvider capacidades={{ funciones: { analisis_vectorial: true, aprovechamiento_cotizacion: true, nesting_irregular: false } }}>
        <DisenoVectorialCotizador {...props} modoCotizacion="svg" />
      </CapacidadesProvider>,
    );
    expect(html).toContain("historico.svg");
    expect(html).toContain("no está incluida");
    expect(html).not.toContain('type="file"');
    expect(props.onChange).not.toHaveBeenCalled();
  });
  it("MCP no presenta las credenciales guardadas como una conexión operativa si está excluido", () => {
    const html = renderToStaticMarkup(
      <CapacidadesProvider capacidades={{ funciones: {} }}>
        <McpCard activas={2} onAbrir={() => {}} />
      </CapacidadesProvider>,
    );
    expect(html).toContain("No incluida en tu plan");
    expect(html).toContain("Administrar");
    expect(html).not.toContain("status-connected");
  });
  it("no genera plantillas al abrir producción y consulta los recorridos ya guardados", async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const el = document.createElement("div");
    const root = createRoot(el);
    try {
      await act(async () =>
        root.render(
          <CapacidadesProvider capacidades={{ funciones: {} }}>
            <RecorridoCortePanel itemId="item" />
            <PlantillaInstalacionPanel itemId="item" />
          </CapacidadesProvider>,
        ),
      );
      expect(api.getRecorridosGuardados).toHaveBeenCalledWith(
        "item",
        undefined,
      );
      expect(api.getPreparacionesRecorridoCorte).not.toHaveBeenCalled();
      expect(api.getPlantillaInstalacion).not.toHaveBeenCalled();
      expect(api.regenerarPreparacionesRecorridoCorte).not.toHaveBeenCalled();
      expect(el.textContent).toContain("No hay recorridos guardados");
      expect(el.textContent).not.toContain("Regenerar");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
