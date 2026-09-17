import { describe, it, expect } from "vitest";
import { simularFlujo as front } from "./flujo-produccion";
import { simularFlujo as back } from "../../apps/api/src/eta/motor/flujo-produccion";
import { exhibidorControlado } from "../../apps/api/test/fixtures/f6-planificacion/exhibidor-controlado";
import { finConflictoReserva } from "./eta-reservas";

const fecha = (hora: number) =>
  new Date(
    `2026-09-09T${String(hora).padStart(2, "0")}:00:00-03:00`,
  ).toISOString();
const paso = (
  id: string,
  minutos: number,
  desde?: number,
  hasta?: number,
  maquinaId?: string,
) => ({
  id,
  indice: 0,
  nodoClave: id,
  esTerminal: true,
  nombre: id,
  familiaCodigo: "corte",
  centroCostoId: null,
  maquinaId,
  duracionEstimadaMin: minutos,
  estado: "pendiente" as const,
  iniciadoEl: null,
  tipoEjecucion: "interno",
  plazoProveedorDias: null,
  planificadoDesde: desde ? fecha(desde) : null,
  planificadoHasta: hasta ? fecha(hasta) : null,
});
const item = (p: ReturnType<typeof paso>) => ({
  id: p.id,
  ordenId: p.id,
  ordenNumero: p.id,
  ordenEstado: "pendiente",
  fechaEntrega: null,
  sinRuta: false,
  pasos: [p],
});
function correr(pasos: ReturnType<typeof paso>[], capacidad = 1) {
  const e = exhibidorControlado().taller;
  e.estaciones = [{ ...e.estaciones[0], capacidadConcurrente: capacidad }];
  // Estos casos aíslan los puestos físicos; disponen de igual dotación.
  e.estaciones[0].equipoProduccion = { ...e.estaciones[0].equipoProduccion!, personas: capacidad };
  e.items = pasos.map(item);
  const b = back(e),
    f = front(e as unknown as Parameters<typeof front>[0]);
  expect(f.traza).toEqual(b.traza);
  return b.traza;
}
describe("agenda publicada, mismo calendario en front y backend", () => {
  it("permite trabajo corto antes de una reserva y desplaza el largo después", () => {
    const t = correr([
      paso("reservado", 60, 10, 11),
      paso("a-corto", 60),
      paso("b-largo", 240),
    ]);
    expect(t.find((p) => p.pasoId === "a-corto")!.inicio.toISOString()).toBe(
      fecha(8),
    );
    expect(t.find((p) => p.pasoId === "reservado")!.inicio.toISOString()).toBe(
      fecha(10),
    );
    expect(t.find((p) => p.pasoId === "b-largo")!.inicio.toISOString()).toBe(
      fecha(11),
    );
  });
  it("respeta puestos concurrentes sin bloquear toda la estación por una reserva", () => {
    const t = correr([paso("reserva", 120, 10, 12), paso("a-largo", 240)], 2);
    expect(t.find((p) => p.pasoId === "a-largo")!.inicio.toISOString()).toBe(
      fecha(8),
    );
    expect(t.find((p) => p.pasoId === "reserva")!.inicio.toISOString()).toBe(
      fecha(10),
    );
  });
  it("una misma máquina física no corre dos operaciones aunque sobren puestos", () => {
    const t = correr(
      [
        paso("reserva", 120, 10, 12, "mesa-1"),
        paso("a-largo", 240, undefined, undefined, "mesa-1"),
      ],
      2,
    );
    expect(t.find((p) => p.pasoId === "a-largo")!.inicio.toISOString()).toBe(
      fecha(12),
    );
  });
  it("combina ocupación dinámica y reservas al contar los puestos", () => {
    const t = correr(
      [
        paso("reserva", 120, 10, 12),
        paso("a-largo", 240),
        paso("b-largo", 240),
      ],
      2,
    );
    expect(t.find((p) => p.pasoId === "reserva")!.inicio.toISOString()).toBe(
      fecha(10),
    );
    expect(t.find((p) => p.pasoId === "b-largo")!.inicio.toISOString()).toBe(
      fecha(12),
    );
  });
  it("los extremos son semiabiertos y no confunde intervalos sucesivos con simultáneos", () => {
    expect(
      finConflictoReserva(
        0,
        30,
        [
          { inicio: 10, fin: 20 },
          { inicio: 20, fin: 30 },
        ],
        2,
      ),
    ).toBeNull();
    expect(
      finConflictoReserva(20, 30, [{ inicio: 10, fin: 20 }], 1),
    ).toBeNull();
  });
});
