/**
 * El test de PARIDAD del editor declarativo (decisión del usuario:
 * detallado congelado + este test como guardián). El censo de
 * docs/editor-declarativo-diseno.md §2 vive acá como constante: si el
 * esquema y el censo divergen — una opción censada sin declarar, o una
 * declarada que el censo no conoce — el test rompe. Agregar un campo al
 * editor exige tocar AMBOS: acto consciente, nunca olvido.
 */
import { describe, expect, it } from "vitest";
import {
  ESQUEMA_PASO,
  SECCIONES_MIGRADAS,
  opcionesDeSeccion,
  type ContextoOpcion,
} from "./schema";
import type { FamiliaListItem } from "../productos-servicios";
import type { UpsertConfigPasoPayload } from "../productos-servicios-api";

// ── El censo, por sección (espejo del doc §2, claves canónicas) ───────
const CENSO: Record<string, string[]> = {
  activacion: [
    "activacion.nombre",
    "activacion.cuando",
    "activacion.regla",
    "activacion.coejecucion",
    "activacion.multiplicadores",
  ],
  // Sub-fases B-D: al migrar una sección, sus claves se listan acá y la
  // sección entra en SECCIONES_MIGRADAS. Mientras tanto, el detallado
  // congelado es la única fuente para ellas.
};

const SECCIONES_PENDIENTES = [
  "quien",
  "tiempo",
  "maquina",
  "materiales",
  "oficio",
  "ajustes",
];

function ctxBase(extra?: {
  cfg?: Partial<UpsertConfigPasoPayload>;
  familia?: Partial<FamiliaListItem>;
  otros?: Array<{ id: string; nombre: string }>;
}): ContextoOpcion {
  return {
    cfg: {
      rutaPasoId: "rp-1",
      modoActivacion: "OPCIONAL",
      ...extra?.cfg,
    } as UpsertConfigPasoPayload,
    familia: {
      codigo: "trabajo_manual",
      nombre: "Trabajo manual",
      modosActivacionSoportados: [
        "OBLIGATORIO",
        "OPCIONAL",
        "CONDICIONAL",
        "NO_EJECUTAR",
      ],
      modoActivacionDefault: "OPCIONAL",
      multiplicadoresSoportados: [],
      ...extra?.familia,
    } as FamiliaListItem,
    paramsPaso: {},
    otrosPasos: extra?.otros ?? [],
  };
}

describe("paridad esquema ↔ censo", () => {
  it("toda clave del censo migrado está declarada, y ninguna de más", () => {
    for (const seccion of SECCIONES_MIGRADAS) {
      const declaradas = ESQUEMA_PASO.filter(
        (op) => op.seccion === seccion,
      ).map((op) => op.clave);
      expect(declaradas.sort()).toEqual((CENSO[seccion] ?? []).sort());
    }
  });

  it("ninguna opción declara una sección fuera de las migradas", () => {
    const fueraDeLugar = ESQUEMA_PASO.filter(
      (op) => !SECCIONES_MIGRADAS.includes(op.seccion),
    );
    expect(fueraDeLugar.map((op) => op.clave)).toEqual([]);
  });

  it("las secciones pendientes siguen pendientes (migrarlas = acto consciente)", () => {
    for (const seccion of SECCIONES_PENDIENTES) {
      expect(SECCIONES_MIGRADAS).not.toContain(seccion);
    }
  });

  it("claves únicas y con formato seccion.campo", () => {
    const claves = ESQUEMA_PASO.map((op) => op.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const clave of claves) {
      expect(clave).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });
});

describe("sección Activación", () => {
  it("la activación fijada por la familia se dice en el resumen", () => {
    const ctx = ctxBase({
      cfg: { modoActivacion: "OBLIGATORIO" },
      familia: { modosActivacionSoportados: ["OBLIGATORIO"] },
    });
    const cuando = ESQUEMA_PASO.find((op) => op.clave === "activacion.cuando")!;
    expect(cuando.resumen(ctx)).toBe("Siempre — fijado por el paso");
    // Y las pills ofrecen sólo lo soportado + apagar por ruta.
    const control = cuando.control;
    if (control.tipo !== "pills") throw new Error("esperaba pills");
    expect(control.opciones(ctx).map((o) => o.value)).toEqual([
      "OBLIGATORIO",
      "NO_EJECUTAR",
    ]);
  });

  it("la regla sólo aparece en modo condicional, y sin regla queda sin-definir", () => {
    const regla = ESQUEMA_PASO.find((op) => op.clave === "activacion.regla")!;
    expect(regla.visible(ctxBase())).toBe(false);
    const ctxCond = ctxBase({ cfg: { modoActivacion: "CONDICIONAL" } });
    expect(regla.visible(ctxCond)).toBe(true);
    expect(regla.origenValor(ctxCond)).toBe("sin-definir");
    expect(regla.pendiente).toBe("regla_condicional");
  });

  it("co-ejecución resume los pasos arrastrados por nombre", () => {
    const ctx = ctxBase({
      cfg: { requiereRutaPasoIds: ["rp-2"] },
      otros: [
        { id: "rp-2", nombre: "Refuerzo perimetral" },
        { id: "rp-3", nombre: "Ojales" },
      ],
    });
    const co = ESQUEMA_PASO.find(
      (op) => op.clave === "activacion.coejecucion",
    )!;
    expect(co.resumen(ctx)).toBe("Arrastra: Refuerzo perimetral");
    expect(co.visible(ctxBase())).toBe(false); // sin otros pasos, no aplica
  });

  it("multiplicadores: sólo visible si la familia los soporta; aplicar escribe activos", () => {
    const mult = ESQUEMA_PASO.find(
      (op) => op.clave === "activacion.multiplicadores",
    )!;
    expect(mult.visible(ctxBase())).toBe(false);
    const ctx = ctxBase({ familia: { multiplicadoresSoportados: ["caras"] } });
    expect(mult.visible(ctx)).toBe(true);
    expect(mult.resumen(ctx)).toBe("Sin multiplicadores");
    const control = mult.control;
    if (control.tipo !== "toggles") throw new Error("esperaba toggles");
    expect(control.aplicar(ctx, ["caras"])).toEqual({
      tipo: "config",
      patch: { multiplicadoresActivos: ["caras"] },
    });
  });

  it("opcionesDeSeccion respeta visibilidad", () => {
    const claves = opcionesDeSeccion("activacion", ctxBase()).map(
      (op) => op.clave,
    );
    // Sin otros pasos ni multiplicadores ni modo condicional: 2 opciones.
    expect(claves).toEqual(["activacion.nombre", "activacion.cuando"]);
  });
});
