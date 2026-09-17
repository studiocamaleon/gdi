import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { usePlanificacion, type DatosPlanificacion } from "./use-planificacion";
import { simularFlujo } from "@/lib/flujo-produccion";

vi.mock("@/components/navigation/config-regional-provider", () => ({
  useConfigRegional: () => ({ zonaHoraria: "America/Argentina/Buenos_Aires" }),
}));
vi.mock("@/components/notificaciones/notificaciones-provider", () => ({
  useCambiosSistema: () => {},
}));
vi.mock("@/lib/flujo-produccion", async (original) => ({
  ...(await original<typeof import("@/lib/flujo-produccion")>()),
  simularFlujo: vi.fn(() => ({
    porItem: new Map(),
    llegadasPorEstacion: new Map(),
    traza: [],
  })),
}));

describe("inicio del Gantt a escala", () => {
  it("no ejecuta un cálculo grande durante el render del servidor ni muestra fechas ficticias", () => {
    const datos = {
      initialItems: [
        {
          id: "grande",
          pasos: Array.from({ length: 1000 }, (_, i) => ({ id: String(i) })),
        },
      ],
      estaciones: [],
      diasNoLaborables: [],
      duracionesFamilias: [],
      consultadoEl: "2026-09-11T15:00:00Z",
    } as unknown as DatosPlanificacion;
    function Estado() {
      const p = usePlanificacion(datos);
      return (
        <span>
          {String(p.calculando)} / {String(p.sinSimulacion)}
        </span>
      );
    }
    vi.mocked(simularFlujo).mockClear();
    expect(renderToStaticMarkup(<Estado />)).toContain("true / true");
    expect(simularFlujo).not.toHaveBeenCalled();
  });
});
