import { describe, expect, it } from "vitest";
import { compararTareasEstacion } from "./tablero-produccion";

type Tarea = Parameters<typeof compararTareasEstacion>[0];
function tarea(id: string, fechaEntrega: string | null, planificadoDesde?: string): Tarea {
  return {
    isBlocked: false, overdue: false, isCurrent: false,
    item: { data: { id, fechaEntrega, ordenNumero: "OT-2026-0054", itemIndice: 0 } },
    step: { paso: { id: `paso-${id}`, indice: 0, planificadoDesde } },
  };
}
const ids = (tareas: Tarea[]) => tareas.sort(compararTareasEstacion).map(t => t.item.data.id);

describe("orden de la cola por estación", () => {
  it("ordena B, C y D por sus entregas aunque lleguen desordenados y tengan el mismo código de OT", () => {
    expect(ids([
      tarea("D", "2026-10-01"),
      tarea("B", "2026-09-21"),
      tarea("C", "2026-09-25"),
    ])).toEqual(["B", "C", "D"]);
  });

  it("conserva delante el trabajo en curso y las alertas operativas", () => {
    expect(ids([
      tarea("pendiente", "2026-09-21"),
      { ...tarea("bloqueado", "2026-10-01"), isBlocked: true },
      { ...tarea("vencido", "2026-09-08"), overdue: true },
      { ...tarea("en-curso", "2026-10-02"), isCurrent: true },
    ])).toEqual(["en-curso", "vencido", "bloqueado", "pendiente"]);
  });

  it("desempata una misma entrega por el inicio planificado, comparando instantes con zona horaria", () => {
    expect(ids([
      tarea("despues", "2026-09-21", "2026-09-15T13:00:00Z"),
      tarea("antes", "2026-09-21", "2026-09-15T09:00:00-03:00"),
    ])).toEqual(["antes", "despues"]);
  });

  it("las tareas sin fecha quedan detrás de las fechadas y los empates no cambian al refrescar", () => {
    const tareas = [tarea("sin-fecha", null), tarea("B", "2026-09-21"), tarea("A", "2026-09-21"), tarea("invalida", "fecha incorrecta")];
    const orden = ids([...tareas]);
    expect(orden.slice(0, 2)).toEqual(["A", "B"]);
    expect(ids([...tareas].reverse())).toEqual(orden);
    expect(compararTareasEstacion(tareas[0], tareas[0])).toBe(0);
  });
});
