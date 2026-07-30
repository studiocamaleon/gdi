/**
 * E.3.1 — El motor de pendientes es el guion del wizard de ruta: estos
 * tests fijan QUÉ se pregunta y cuándo, forma por forma. La invariante
 * madre: un paso bien declarado devuelve lista vacía.
 */
import { describe, expect, it } from "vitest";
import {
  pendientesDePaso,
  resumenPendientes,
  type FamiliaParaPendientes,
} from "./pendientes-paso";
import type { UpsertConfigPasoPayload } from "./productos-servicios-api";

const FAMILIA_MANUAL: FamiliaParaPendientes = {
  codigo: "bordado-uuid",
  relacionMaquinaSoportada: ["M-0"],
  slotsRequeridos: [],
  defaults: {
    centroCostoId: "cc-taller",
    productividadHora: 45,
    tiempoFijoMin: null,
    demasiaMm: null,
    solapePanelMm: null,
  },
};

function cfgBase(extra: Partial<UpsertConfigPasoPayload> = {}): UpsertConfigPasoPayload {
  return {
    rutaPasoId: "rp-1",
    modoActivacion: "OPCIONAL",
    modoTiempo: "T-2",
    mecanismoCantidad: "DIRECT_FROM_JOBCONTEXT",
    ...extra,
  };
}

describe("pendientesDePaso (E.3.1)", () => {
  it("LA invariante: un paso bien declarado no pregunta nada", () => {
    // Bordado con defaults (ritmo + centro) y config vacía → cero pendientes.
    expect(pendientesDePaso(cfgBase(), FAMILIA_MANUAL)).toEqual([]);
  });

  it("sin defaults, el mismo paso pide ritmo y centro (ambos bloqueantes)", () => {
    const sinDefaults = { ...FAMILIA_MANUAL, defaults: null };
    const pendientes = pendientesDePaso(cfgBase(), sinDefaults);
    expect(pendientes.map((p) => p.tipo).sort()).toEqual(["centro", "ritmo"]);
    expect(pendientes.every((p) => p.bloqueante)).toBe(true);
  });

  it("la config del producto cubre lo que el default no está", () => {
    const sinDefaults = { ...FAMILIA_MANUAL, defaults: null };
    const pendientes = pendientesDePaso(
      cfgBase({
        centroCostoId: "cc-x",
        paramsPasoJson: { productivityValue: 60 },
      }),
      sinDefaults,
    );
    expect(pendientes).toEqual([]);
  });

  it("NO_EJECUTAR apaga todas las preguntas", () => {
    const sinDefaults = { ...FAMILIA_MANUAL, defaults: null };
    expect(
      pendientesDePaso(cfgBase({ modoActivacion: "NO_EJECUTAR" }), sinDefaults),
    ).toEqual([]);
  });

  it("máquina: M-1 puro sin máquina bloquea; M-2 pide candidatas; perfil es sugerido", () => {
    const familiaMaquina: FamiliaParaPendientes = {
      codigo: "impresion_por_hoja",
      relacionMaquinaSoportada: ["M-1"],
      slotsRequeridos: [],
    };
    expect(
      pendientesDePaso(cfgBase({ modoTiempo: "T-3" }), familiaMaquina).map(
        (p) => p.tipo,
      ),
    ).toContain("maquina");

    const familiaEleccion = {
      ...familiaMaquina,
      relacionMaquinaSoportada: ["M-1", "M-2"],
    };
    expect(
      pendientesDePaso(cfgBase({ modoTiempo: "T-3" }), familiaEleccion).map(
        (p) => p.tipo,
      ),
    ).toContain("candidatas");

    const conMaquinaSinPerfil = pendientesDePaso(
      cfgBase({ modoTiempo: "T-3", maquinaM1Id: "maq-1" }),
      familiaMaquina,
    );
    expect(conMaquinaSinPerfil.map((p) => p.tipo)).toEqual(["perfil"]);
    expect(conMaquinaSinPerfil[0].bloqueante).toBe(false);
  });

  it("materiales: slot requerido sin configurar, fijo sin variante, elegible sin candidatos", () => {
    const familiaConSlot: FamiliaParaPendientes = {
      ...FAMILIA_MANUAL,
      slotsRequeridos: [
        { codigo: "papel", nombre: "Papel", requerido: true },
        { codigo: "tinta_maq", nombre: "Tinta", requerido: true, tipo: "CONSUMIBLE_MAQUINA" },
      ],
    };
    // Requerido sin configurar (la tinta de máquina NO cuenta: la cobra el perfil).
    const faltantes = pendientesDePaso(cfgBase(), familiaConSlot);
    expect(faltantes.map((p) => p.tipo)).toEqual(["material_slot"]);
    expect(faltantes[0].slotCodigo).toBe("papel");

    // Configurado en fijo pero sin variante.
    expect(
      pendientesDePaso(
        cfgBase({
          slotsMateriales: [
            { slotCodigo: "papel", modoSeleccion: "HARDCODED" } as never,
          ],
        }),
        familiaConSlot,
      ).map((p) => p.tipo),
    ).toEqual(["material_slot"]);

    // Comercial elige sin candidatos.
    expect(
      pendientesDePaso(
        cfgBase({
          slotsMateriales: [
            {
              slotCodigo: "papel",
              modoSeleccion: "COMERCIAL_ELIGE",
              candidatos: [],
            } as never,
          ],
        }),
        familiaConSlot,
      ).map((p) => p.tipo),
    ).toEqual(["material_slot"]);
  });

  it("tercerizado: sólo pregunta proveedor y precios — nada de producción", () => {
    const familiaTerc: FamiliaParaPendientes = {
      codigo: "troquelado-uuid",
      relacionMaquinaSoportada: ["M-0"],
      slotsRequeridos: [{ codigo: "papel", nombre: "Papel", requerido: true }],
      defaults: null,
    };
    // Sin proveedor y con la matriz vacía: dos bloqueantes, y NI ritmo ni
    // centro ni materiales (el proveedor pone todo eso).
    const pendientes = pendientesDePaso(
      cfgBase({ tercerizado: true, fuenteCostoTercerizado: "matriz" }),
      familiaTerc,
    );
    expect(pendientes.map((p) => p.tipo).sort()).toEqual([
      "grilla_tercerizado",
      "proveedor",
    ]);

    // Con proveedor + fuente fija con monto → nada pendiente.
    expect(
      pendientesDePaso(
        cfgBase({
          tercerizado: true,
          proveedorId: "prov-1",
          fuenteCostoTercerizado: "fijo",
          tercerizadoConfigJson: { costoFijo: 1500 },
        }),
        familiaTerc,
      ),
    ).toEqual([]);

    // Tarifa por magnitud sin tarifa → bloquea.
    expect(
      pendientesDePaso(
        cfgBase({
          tercerizado: true,
          proveedorId: "prov-1",
          fuenteCostoTercerizado: "tarifa_magnitud",
          tercerizadoConfigJson: {},
        }),
        familiaTerc,
      ).map((p) => p.tipo),
    ).toEqual(["grilla_tercerizado"]);
  });

  it("condicional sin regla bloquea (interno Y tercerizado)", () => {
    expect(
      pendientesDePaso(
        cfgBase({ modoActivacion: "CONDICIONAL" }),
        FAMILIA_MANUAL,
      ).map((p) => p.tipo),
    ).toEqual(["regla_condicional"]);
    expect(
      pendientesDePaso(
        cfgBase({
          modoActivacion: "CONDICIONAL",
          tercerizado: true,
          proveedorId: "prov-1",
          fuenteCostoTercerizado: "fijo",
          tercerizadoConfigJson: { costoFijo: 100 },
        }),
        FAMILIA_MANUAL,
      ).map((p) => p.tipo),
    ).toEqual(["regla_condicional"]);
  });

  it("T-1 sin máquina: pide duración salvo override o default", () => {
    const familiaT1: FamiliaParaPendientes = {
      ...FAMILIA_MANUAL,
      defaults: { ...FAMILIA_MANUAL.defaults!, productividadHora: null, tiempoFijoMin: null },
    };
    expect(
      pendientesDePaso(cfgBase({ modoTiempo: "T-1" }), familiaT1).map(
        (p) => p.tipo,
      ),
    ).toEqual(["tiempo_fijo"]);
    expect(
      pendientesDePaso(
        cfgBase({ modoTiempo: "T-1", tiempoFijoOverrideMin: 30 }),
        familiaT1,
      ),
    ).toEqual([]);
    const conDefault = {
      ...familiaT1,
      defaults: { ...familiaT1.defaults!, tiempoFijoMin: 25 },
    };
    expect(pendientesDePaso(cfgBase({ modoTiempo: "T-1" }), conDefault)).toEqual([]);
  });

  it("herencia sin origen: sugerido, no bloqueante (hay regla histórica)", () => {
    const pendientes = pendientesDePaso(
      cfgBase({ mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO" }),
      FAMILIA_MANUAL,
    );
    expect(pendientes.map((p) => p.tipo)).toEqual(["herencia_origen"]);
    expect(pendientes[0].bloqueante).toBe(false);
    // Con origen señalado (B.3.3) desaparece.
    expect(
      pendientesDePaso(
        cfgBase({
          mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO",
          mecanismoCantidadConfigJson: {
            origen: { rutaPasoId: "rp-0", capacidad: "pliegos" },
          },
        }),
        FAMILIA_MANUAL,
      ),
    ).toEqual([]);
  });

  it("resumenPendientes habla en humano y prioriza bloqueantes", () => {
    const sinDefaults = { ...FAMILIA_MANUAL, defaults: null };
    const pendientes = pendientesDePaso(cfgBase(), sinDefaults);
    expect(resumenPendientes(pendientes)).toBe(
      "Faltan: el ritmo de trabajo y el centro productivo",
    );
    expect(resumenPendientes([])).toBeNull();
    const soloSugerido = pendientesDePaso(
      cfgBase({ mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO" }),
      FAMILIA_MANUAL,
    );
    expect(resumenPendientes(soloSugerido)).toBe("Falta: de qué paso hereda");
  });
});
