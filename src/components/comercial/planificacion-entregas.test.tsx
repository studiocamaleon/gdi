import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorPlan } from "./planificacion-entregas";

vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => true,
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useConfigRegional: () => ({
    moneda: { codigo: "ARS", decimales: 2 },
    zonaHoraria: "America/Argentina/Buenos_Aires",
  }),
}));

describe("apertura del editor de entregas", () => {
  it.each([true, false])("renderiza sin plan ni selección mientras carga (previa=%s)", (previa) => {
    const html = renderToStaticMarkup(
      <EditorPlan path="/plan-qa" cantidad={200} puede previa={previa} onGuardada={() => {}} />,
    );
    expect(html).toContain("Cargando distribución");
    expect(html).not.toContain("Guardar distribución");
  });

  it("puede reabrirse con entregas locales antes de recibir el plan del servidor", () => {
    const html = renderToStaticMarkup(
      <EditorPlan path="/plan-qa" cantidad={200} puede previa editadoInicial
        iniciales={[{ clave: "entrega-1", cantidad: 200, fechaSolicitada: "2026-10-01" }]}
        onGuardada={() => {}} />,
    );
    expect(html).toContain("Cargando distribución");
    expect(html).toContain("Eliminar distribución");
  });
});
