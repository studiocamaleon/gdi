import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeometriasVectorialesCotizacion } from "./geometrias-vectoriales-cotizacion";
import { PlanLotesCotizacion } from "../nesting/plan-lotes-cotizacion";
import type { CotizacionFabricacion } from "@/lib/plan-fabricacion-cotizacion";
import type { FuenteGuardada } from "@/lib/geometrias-producto-api";
import type { ConfiguracionGeometriasComerciales } from "@/lib/producto-geometrias";
const guardada = {
  schemaVersion: 2,
  nombreArchivo: "estante.dxf",
  svg: '<svg viewBox="0 0 100 170"/>',
  anchoFinalMm: 100,
  altoFinalMm: 170,
  relacionAltoAncho: 1.7,
  formatoOrigen: "DXF",
  procedencia: { geometriaId: "g", capa: "CORTE_3" },
  operaciones: [],
} as unknown as FuenteGuardada;
const config: ConfiguracionGeometriasComerciales = {
  version: 1,
  modo: "VECTORIAL",
  fuentes: [
    {
      id: "shelf",
      nombre: "Estante",
      requerida: true,
      predeterminada: guardada,
      permitirReemplazo: false,
    },
  ],
  permitirCotizacionManual: false,
};

describe("presentación compacta de fabricación", () => {
  it("conserva el detalle de capa pero no ofrece subir ni reemplazar un archivo fijo", () => {
    const html = renderToStaticMarkup(
      <GeometriasVectorialesCotizacion
        configuracion={config}
        values={{ shelf: guardada }}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("CORTE_3");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Reemplazar");
  });
  it("mantiene visible la acción de carga cuando falta un archivo obligatorio", () => {
    const html = renderToStaticMarkup(
      <GeometriasVectorialesCotizacion
        configuracion={{
          ...config,
          fuentes: [{ id: "shelf", nombre: "Estante", requerida: true }],
        }}
        values={{}}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("Falta el archivo obligatorio");
    expect(html).toContain("Seleccionar archivo");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("<tr hidden");
  });
  it("el resumen multiplica las copias del layout sin duplicar impresión y corte", () => {
    const n = { algorithm: "grid-2d-multi", cantidadCalculada: 3, unidad: "pliegos", aprovechamientoPct: 50, piezasAcomodadas: 3,
      substrates: [{ kind: "sheet", count: 3, widthMm: 860, heightMm: 564 }],
      placements: [{ pieceId: "estante", xMm: 5, yMm: 5, widthMm: 100, heightMm: 170, rotated: false }] };
    const c = { productoNombre: "Exhibidor", cantidadPedida: 3, componentesFabricados: [{ codigo: "c", productoId: "c", nombre: "Corrugado", jobContext: { disenosVectoriales: [{}] }, pasos: [
      { activado: true, rutaPasoId: "print", nombreVisible: "Impresión", nestingResult: n },
      { activado: true, rutaPasoId: "cut", nombreVisible: "Corte láser", familiaCodigo: "corte_laser", nestingResult: { ...n, placements: n.placements.map((p) => ({ ...p, meta: { layoutHeredadoDe: "print" } })) } },
    ] }] } as unknown as CotizacionFabricacion;
    const html = renderToStaticMarkup(<PlanLotesCotizacion cotizacion={c} />);
    expect(html).toContain("<b>3</b> placas");
    expect(html).toContain("<b>1</b> layout");
    expect(html).toContain("<b>3</b> piezas");
  });
  it("el estado pendiente no se presenta como calculando ni permite abrir un plan viejo", () => {
    const html = renderToStaticMarkup(
      <PlanLotesCotizacion esperado estado="pendiente" />,
    );
    expect(html).toContain("Pendiente de cálculo");
    expect(html).not.toContain("Calculando…");
    expect(html).not.toContain("Ver plan");
  });
});
