import { describe, it, expect } from "vitest";
import {
  accionesDisponiblesProduccion,
  asignacionPermiteEjecutar,
  completarSeriaInstantaneo,
  chipsDeclarar,
  type ControlAccionesProduccion,
} from "./acciones-produccion";

const base: ControlAccionesProduccion = {
  paso: {
    id: "p",
    nombre: "Impresión",
    estado: "pendiente",
    tipoEjecucion: "interno",
    modoRegistro: "cronometro",
    duracionEstimadaMin: 20,
    tiempoAcumuladoMin: 0,
    tramoAbierto: null,
  },
  canManage: true,
  canSupervise: false,
  esActual: true,
};
describe("controles compartidos entre Tablero y Colas", () => {
  it.each([
    ["pendiente", "cronometro", ["iniciar", "completar", "bloquear"]],
    ["en_curso", "cronometro", ["pausar", "completar", "bloquear"]],
    ["pausado", "cronometro", ["continuar", "completar", "bloquear"]],
    ["pendiente", "solo_completar", ["completar", "bloquear"]],
    ["en_curso", "solo_completar", ["completar", "bloquear"]],
    ["bloqueado", "cronometro", []],
    ["hecho", "cronometro", []],
  ] as const)(
    "%s en %s ofrece las acciones del recorrido",
    (estado, modoRegistro, esperado) => {
      expect(
        accionesDisponiblesProduccion({
          ...base,
          paso: { ...base.paso, estado, modoRegistro },
        }),
      ).toEqual(esperado);
    },
  );
  it("no habilita operaciones sin permiso, con dependencias, gates o tercerizadas", () => {
    expect(
      accionesDisponiblesProduccion({ ...base, canManage: false }),
    ).toEqual([]);
    expect(accionesDisponiblesProduccion({ ...base, esActual: false })).toEqual(
      [],
    );
    expect(
      accionesDisponiblesProduccion({
        ...base,
        paso: { ...base.paso, gatesOperativos: [{ estado: "PENDIENTE" }] },
      }),
    ).toEqual([]);
    expect(
      accionesDisponiblesProduccion({
        ...base,
        paso: { ...base.paso, tipoEjecucion: "tercerizado" },
      }),
    ).toEqual([]);
  });
  it("sólo el supervisor desbloquea o reabre y respeta las etapas siguientes", () => {
    expect(
      accionesDisponiblesProduccion({
        ...base,
        canSupervise: true,
        paso: { ...base.paso, estado: "bloqueado" },
      }),
    ).toEqual(["desbloquear"]);
    expect(
      accionesDisponiblesProduccion({
        ...base,
        canSupervise: true,
        paso: { ...base.paso, estado: "hecho" },
        reabrible: false,
      }),
    ).toEqual([]);
    expect(
      accionesDisponiblesProduccion({
        ...base,
        canSupervise: true,
        paso: { ...base.paso, estado: "hecho" },
        reabrible: true,
      }),
    ).toEqual(["reabrir"]);
  });
  it("consulta tiempo al completar pendiente, pausado o un inicio reciente, sin confundir tiempo autónomo", () => {
    expect(completarSeriaInstantaneo(base.paso)).toBe(true);
    expect(
      completarSeriaInstantaneo({
        ...base.paso,
        estado: "pausado",
        tiempoAcumuladoMin: 1.99,
      }),
    ).toBe(true);
    expect(
      completarSeriaInstantaneo({ ...base.paso, tiempoAcumuladoMin: 2 }),
    ).toBe(false);
    expect(
      completarSeriaInstantaneo({
        ...base.paso,
        modoRegistro: "solo_completar",
      }),
    ).toBe(false);
    const ahora = Date.parse("2026-09-11T15:00:00Z");
    expect(
      completarSeriaInstantaneo(
        {
          ...base.paso,
          estado: "en_curso",
          tiempoAcumuladoMin: 1,
          tramoAbierto: {
            inicioEl: "2026-09-11T14:59:00Z",
            esMio: true,
            usuarioNombre: "QA",
          },
        },
        ahora,
      ),
    ).toBe(false);
    expect(
      completarSeriaInstantaneo({
        ...base.paso,
        tiempoAcumuladoMin: 0.9,
        duracionEstimadaMin: null,
      }),
    ).toBe(true);
  });
  it("propone tiempos aproximados sin ceros ni duplicados", () => {
    expect(chipsDeclarar(20)).toEqual([10, 20, 40]);
    expect(chipsDeclarar(0.25)).toEqual([1]);
    expect(chipsDeclarar(null)).toEqual([]);
  });
});

it("habilita a asignados con reparto válido y conserva el control del tramo real ante un conflicto", () => {
  const paso = {
    mesaEsMia: false,
    tramoAbierto: null,
    asignacionPersonal: {
      origen: "automatica" as const,
      personas: [],
      franjas: [],
      esMia: true,
      conflicto: null as string | null,
    },
  };
  expect(asignacionPermiteEjecutar(paso)).toBe(true);
  expect(
    asignacionPermiteEjecutar({
      ...paso,
      asignacionPersonal: { ...paso.asignacionPersonal, esMia: false },
    }),
  ).toBe(false);
  const conflicto = {
    ...paso,
    asignacionPersonal: {
      ...paso.asignacionPersonal,
      conflicto: "Sin horario",
    },
  };
  expect(asignacionPermiteEjecutar(conflicto)).toBe(false);
  expect(
    asignacionPermiteEjecutar({
      ...conflicto,
      tramoAbierto: {
        inicioEl: "2026-09-14T12:00:00Z",
        usuarioNombre: "Ana",
        esMio: true,
      },
    }),
  ).toBe(true);
});
