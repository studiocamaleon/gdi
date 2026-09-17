import { describe, expect, it } from "vitest";
import { simularFlujo } from "./flujo-produccion";
import { simularFlujo as simularApi } from "../../apps/api/src/eta/motor/flujo-produccion";
import { exhibidorControlado } from "../../apps/api/test/fixtures/f6-planificacion/exhibidor-controlado";
import { contextoAtencion, leerAtencionPlanificada } from "./agenda-atencion";

function escenario() {
  const e = exhibidorControlado().taller,
    plantilla = e.items[0],
    paso = plantilla.pasos[0];
  const equipo = e.estaciones[0].equipoProduccion!;
  e.estaciones = ["a", "b", "c"].map((id) => ({
    ...e.estaciones[0],
    id,
    equipoProduccion: equipo,
    maquinas: [
      {
        id,
        centroCostoId: null,
        operacionMaquina:
          id === "b" ? ("con_operario" as const) : ("autonoma" as const),
      },
    ],
  }));
  e.items = ["a", "b", "c"].map((id) => ({
    ...plantilla,
    id,
    ordenId: id,
    pasos: [
      {
        ...paso,
        id,
        maquinaId: id,
        duracionEstimadaMin: id === "a" ? 180 : id === "b" ? 120 : 150,
        planificadoDesde:
          id === "b"
            ? "2026-09-09T13:00:00.000Z"
            : id === "c"
              ? "2026-09-09T12:00:00.000Z"
              : undefined,
        planificadoHasta: id === "b" ? "2026-09-09T15:00:00.000Z" : undefined,
        demandaHumana: {
          version: 1,
          verificada: true,
          fases:
            id === "b"
              ? [{ minutos: 120, personas: 1 }]
              : [
                  { minutos: 30, personas: 1 },
                  {
                    minutos: id === "a" ? 120 : 90,
                    personas: 0,
                    operacionMaquina: true,
                  },
                  { minutos: 30, personas: 1 },
                ],
        },
      },
    ],
  }));
  return e as unknown as Parameters<typeof simularFlujo>[0];
}

describe("agenda aceptada con esperas entre fases", () => {
  it("conserva horas, intervalos y capacidad después de persistir JSON; coincide en navegador y API", () => {
    const e = escenario(),
      original = simularFlujo(e);
    const items = e.items.map((i) => ({
      ...i,
      pasos: i.pasos.map((p) => {
        const t = original.traza.find((t) => t.pasoId === p.id)!;
        return {
          ...p,
          planificadoDesde: t.inicio.toISOString(),
          planificadoHasta: t.fin.toISOString(),
          atencionPlanificada: JSON.parse(
            JSON.stringify(t.atencionPlanificada),
          ),
        };
      }),
    }));
    const consulta = simularFlujo({ ...e, items });
    expect(consulta).toEqual(simularApi({ ...e, items }));
    for (const t of original.traza) {
      const despues = consulta.traza.find((r) => r.pasoId === t.pasoId)!;
      expect([
        despues.inicio,
        despues.fin,
        despues.tramosOperacion,
        despues.reservasHumanas,
      ]).toEqual([t.inicio, t.fin, t.tramosOperacion, t.reservasHumanas]);
    }
    const eventos = consulta.traza
      .flatMap((t) =>
        (t.reservasHumanas ?? []).flatMap((r) => [
          [r.inicio, r.personas],
          [r.fin, -r.personas],
        ]),
      )
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let carga = 0;
    for (const [, n] of eventos) {
      carga += n;
      expect(carga).toBeLessThanOrEqual(1);
    }
    expect(carga).toBe(0);
  });

  it("invalida los intervalos guardados si cambia el equipo, sus horas, el modo de máquina o las fases", () => {
    const e = escenario(),
      t = simularFlujo(e).traza[0],
      p = t.atencionPlanificada!;
    expect(leerAtencionPlanificada(p, p.contexto, p.inicio, p.fin)).toEqual(p);
    const config = JSON.parse(p.contexto);
    for (const cambio of [
      { ...config, equipo: { ...config.equipo, personas: 2 } },
      { ...config, equipo: { ...config.equipo, calendario: { dias: {} } } },
      {
        ...config,
        demanda: { ...config.demanda, fases: [{ minutos: 180, personas: 1 }] },
      },
      { ...config, preparacionMin: 15 },
    ])
      expect(
        leerAtencionPlanificada(p, JSON.stringify(cambio), p.inicio, p.fin),
      ).toBeNull();
    expect(
      leerAtencionPlanificada(
        { ...p, reservas: [{ inicio: p.inicio - 1, fin: p.fin, personas: 1 }] },
        p.contexto,
        p.inicio,
        p.fin,
      ),
    ).toBeNull();
  });

  it("invalida la agenda personal anterior a la política de dotación estable", () => {
    const e = escenario();
    for (const est of e.estaciones) {
      est.planificacionPorEmpleados = true;
      est.empleados = [
        {
          id: "ana",
          nombreCompleto: "Ana",
          sector: "Taller",
          activo: true,
          calendario: est.calendario,
        },
      ];
    }
    const p = simularFlujo(e).traza[0].atencionPlanificada!;
    expect(leerAtencionPlanificada(p, p.contexto, p.inicio, p.fin)).toEqual(p);
    const anterior = JSON.parse(p.contexto);
    expect(anterior.politicaPersonal).toBe("misma-dotacion-por-paso-v1");
    delete anterior.politicaPersonal;
    expect(
      leerAtencionPlanificada(
        { ...p, contexto: JSON.stringify(anterior) },
        p.contexto,
        p.inicio,
        p.fin,
      ),
    ).toBeNull();
  });

  it("el orden de claves de JSONB no invalida una configuración equivalente", () => {
    const e = escenario(),
      est = e.estaciones[0];
    const args = {
      demanda: {
        version: 1 as const,
        verificada: true,
        fases: [{ minutos: 20, personas: 1 }],
      },
      equipo: est.equipoProduccion,
      calendario: est.calendario!,
      preparacionMin: 5,
      zona: e.zona!,
      noLaborables: new Set(["2026-09-15", "2026-09-14"]),
    };
    expect(contextoAtencion(args)).toBe(
      contextoAtencion({
        ...args,
        calendario: {
          dias: Object.fromEntries(
            Object.entries(args.calendario.dias).reverse(),
          ) as typeof args.calendario.dias,
        },
        noLaborables: new Set(["2026-09-14", "2026-09-15"]),
      }),
    );
  });
});
