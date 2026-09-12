import { describe, expect, it } from "vitest";
import { itemHipoteticoDesdeCotizacion } from "./eta-cotizacion";
import { estimarDemoraNuevos } from "./flujo-produccion";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { restaurarJson } from "../../apps/api/src/common/json-compartido";
import type { CotizarResponse } from "./productos-servicios-api";
import type { Estacion } from "./estaciones";
const p = (id: string, min: number, activado = true) => ({
  rutaPasoId: id,
  familiaCodigo: id,
  activado,
  tiempo: { totalMin: min },
});
const g = (claves: string[], aristas: [string, string][] = []) => ({
  nodos: claves.map((clave) => ({ clave: `ruta:${clave}` })),
  aristas: aristas.map(([a, b]) => ({
    desdeClave: `ruta:${a}`,
    haciaClave: `ruta:${b}`,
  })),
});
const compuesto = () => ({
  pasos: [p("pre", 15), p("omitido", 0, false), p("armado", 30)],
  grafoProduccion: g(["pre", "omitido", "armado"], [["pre", "omitido"]]),
  componentesFabricados: [
    {
      codigo: "cuerpo",
      pasos: [p("corte", 60)],
      grafoProduccion: g(["corte"]),
      nodosPredecesoresClaves: ["ruta:omitido"],
      nodoIncorporacionClave: "ruta:armado",
    },
  ],
});
const estacion = (id: string): Estacion => ({
  id,
  nombre: id,
  descripcion: "",
  activo: true,
  etapa: "impresion",
  icono: null,
  capacidadConcurrente: 1,
  tiempoPreparacionMin: null,
  calendario: {
    dias: {
      lun: [{ desde: "08:00", hasta: "17:00" }],
      mar: [{ desde: "08:00", hasta: "17:00" }],
      mie: [{ desde: "08:00", hasta: "17:00" }],
      jue: [{ desde: "08:00", hasta: "17:00" }],
      vie: [{ desde: "08:00", hasta: "17:00" }],
      sab: null,
      dom: null,
    },
  },
  familias: [id],
  empleados: [],
  maquinas: [],
  createdAt: "",
  updatedAt: "",
});

describe("ETA del producto compuesto completo", () => {
  it("conecta preprensa → componente → armado aunque el habilitador esté omitido", () => {
    const r = itemHipoteticoDesdeCotizacion("item", compuesto());
    expect(r.motivoSinEstimar).toBeUndefined();
    expect(r.pasos.map((p) => p.familiaCodigo)).toEqual([
      "pre",
      "corte",
      "armado",
    ]);
    expect(r.pasos.map((p) => p.predecesoras)).toEqual([
      [],
      ["producto/ruta:pre"],
      ["producto/0:cuerpo/ruta:corte"],
    ]);
    const eta = estimarDemoraNuevos({
      nuevos: [r],
      enCola: [],
      estaciones: ["pre", "corte", "armado"].map(estacion),
      medianas: new Map(),
      ahora: new Date("2026-09-09T11:00:00Z"),
    }).get("item");
    expect(eta?.finEstimado?.toISOString()).toBe("2026-09-09T12:45:00.000Z");
  });
  it("el exhibidor de 150 incluye impresión y láser, no sólo 45 minutos del padre", () => {
    const captura = restaurarJson<{ result: CotizarResponse }>(
      JSON.parse(
        gunzipSync(
          readFileSync(
            new URL(
              "../../apps/api/test/fixtures/f4-persistencia/exhibidor-150-cotizacion.json.gz",
              import.meta.url,
            ),
          ),
        ).toString(),
      ),
    );
    const q = captura.result.cotizacion!;
    const r = itemHipoteticoDesdeCotizacion("exhibidor", q);
    expect(r.motivoSinEstimar).toBeUndefined();
    expect(r.pasos).toHaveLength(4);
    expect(
      r.pasos.reduce((s, p) => s + (p.duracionMin ?? 0), 0),
    ).toBeGreaterThan(1600);
    expect(r.pasos.map((p) => p.duracionMin)).toEqual([
      q.pasos.find((p) => p.activado)!.tiempo!.totalMin,
      ...q
        .componentesFabricados![0].pasos!.filter((p) => p.activado)
        .map((p) => p.tiempo!.totalMin),
      q.pasos.filter((p) => p.activado)[1].tiempo!.totalMin,
    ]);
    expect(r.pasos.filter((p) => p.maquinaId)).toHaveLength(2);
    const eta = estimarDemoraNuevos({
      nuevos: [r],
      enCola: [],
      estaciones: r.pasos.map((p) => ({
        ...estacion(p.familiaCodigo),
        maquinas: p.maquinaId ? [{ id: p.maquinaId, codigo: p.maquinaId, nombre: p.maquinaId, centroCostoId: p.centroCostoId }] : [],
      })),
      medianas: new Map(),
      ahora: new Date("2026-09-09T11:00:00Z"),
    }).get(r.id);
    expect(eta?.finEstimado?.toISOString()).toBe("2026-09-11T20:00:00.000Z");
  });
  it("conserva ramas paralelas y no serializa todos los componentes", () => {
    const q = compuesto();
    q.componentesFabricados.push({
      ...q.componentesFabricados[0],
      codigo: "frente",
      pasos: [p("laser", 90)],
      grafoProduccion: g(["laser"]),
    });
    const r = itemHipoteticoDesdeCotizacion("item", q);
    expect(r.pasos.at(-1)?.predecesoras).toHaveLength(2);
    const eta = estimarDemoraNuevos({
      nuevos: [r],
      enCola: [],
      estaciones: ["pre", "corte", "laser", "armado"].map(estacion),
      medianas: new Map(),
      ahora: new Date("2026-09-09T11:00:00Z"),
      tiempoEntrePasosMin: 5,
    }).get(r.id);
    expect(eta?.finEstimado?.toISOString()).toBe("2026-09-09T13:25:00.000Z");
  });
  it("admite pasos simples históricos y terceros, sin duplicar operaciones internas", () => {
    const r = itemHipoteticoDesdeCotizacion("i", {
      pasos: [
        {
          ...p("tercero", 30),
          tercerizado: true,
          plazoProveedorDias: 3,
          operacionesInternas: [{ duracionMin: 30 }],
        },
        p("manual", 0),
      ],
    });
    expect(r.pasos).toHaveLength(2);
    expect(r.pasos[0]).toMatchObject({
      duracionMin: 30,
      tercerizado: true,
      plazoProveedorDias: 3,
    });
    expect(r.pasos[1].predecesoras).toEqual([r.pasos[0].clave]);
  });
  it("no recomienda una fecha parcial si faltan nodos o aparece un ciclo", () => {
    const q = compuesto();
    q.componentesFabricados[0].nodoIncorporacionClave = "ruta:no-existe";
    expect(itemHipoteticoDesdeCotizacion("i", q).motivoSinEstimar).toBeTruthy();
    const ciclo = compuesto();
    ciclo.grafoProduccion.aristas.push({
      desdeClave: "ruta:armado",
      haciaClave: "ruta:pre",
    });
    expect(
      itemHipoteticoDesdeCotizacion("i", ciclo).motivoSinEstimar,
    ).toContain("circulares");
  });
  it("un trabajo compartido se cuenta una vez con todas las dependencias", () => {
    const q = compuesto();
    q.componentesFabricados.push({
      ...q.componentesFabricados[0],
      codigo: "frente",
    });
    const r = itemHipoteticoDesdeCotizacion("i", {
      ...q,
      analisisNestingCompuesto: {
        grupos: [
          {
            aplicacion: { aplicado: true },
            lote: {
              duracionEstimadaMin: 80,
              participantes: [
                {
                  componenteCodigo: "cuerpo",
                  rutaPasoId: "corte",
                  esPasoOperativo: true,
                },
                { componenteCodigo: "frente", rutaPasoId: "corte" },
              ],
            },
          },
        ],
      },
    });
    expect(r.motivoSinEstimar).toBeUndefined();
    expect(r.pasos.map((p) => p.duracionMin)).toEqual([15, 80, 30]);
    expect(r.pasos.at(-1)?.predecesoras).toEqual([r.pasos[1].clave]);
  });
});
