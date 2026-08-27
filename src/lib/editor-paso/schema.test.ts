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
  MODO_ACTIVACION_CONSECUENCIA,
  SECCIONES_MIGRADAS,
  modosActivacionOfrecidos,
  opcionesDeSeccion,
  type ContextoOpcion,
} from "./schema";
import type { FamiliaListItem } from "../productos-servicios";
import type {
  LookupsConfigPaso,
  UpsertConfigPasoPayload,
  UpsertSlotMaterialPayload,
} from "../productos-servicios-api";
import type { SlotEnContexto } from "./schema";

// ── El censo, por sección (espejo del doc §2, claves canónicas) ───────
const CENSO: Record<string, string[]> = {
  // Sub-fase D — Tercerización: si la familia lo declara, no se
  // re-pregunta (aparece colapsado "— declarado en el paso"). Las filas
  // proveedor/fuente/plazo/tecnología/grilla del censo §2 viven DENTRO
  // del panel (una UI cohesiva = un control, como modo_color).
  quien: ["quien.tercerizado", "quien.proveedor"],
  activacion: [
    "activacion.nombre",
    "activacion.cuando",
    "activacion.regla",
    "activacion.coejecucion",
    "activacion.multiplicadores",
  ],
  // Árbol de tiempo (docs/tiempo-pasos-analisis-y-plan.md §4): ① origen →
  // ② forma (fijo/ritmo) → ③ ritmo_modo + magnitud; la capa comercial
  // (No/Puede/Debe) al FINAL — se apoya sobre el base, sólo "Debe" lo
  // suprime.
  tiempo: [
    "tiempo.origen",
    "tiempo.maquina_panel",
    "tiempo.forma",
    "tiempo.fijo_valor",
    "tiempo.centro",
    "tiempo.dotacion",
    "tiempo.ritmo_modo",
    "tiempo.productividad",
    "tiempo.batch",
    "tiempo.cantidad_operativa",
    "tiempo.herencia",
    "tiempo.calcular_segun",
    "tiempo.comercial",
    "tiempo.comercial_ayudas",
    // El "fijo + variable" del oficio y las variantes del mismo paso
    // (docs/cargos-por-paso-analisis-y-plan.md §7 y §8).
    "tiempo.extra",
    "tiempo.niveles",
  ],
  // Sub-fase B — Máquina y perfil: candidatas y modo de color usan LA UI
  // del detallado extraída como componentes. "Modo de color del producto"
  // y "modos permitidos" son UN control en la implementación (el bloque
  // del detallado); por candidata viven dentro de candidatas.
  maquina: [
    "maquina.maquina",
    "maquina.perfil",
    "maquina.complejidad",
    "maquina.candidatas",
    "maquina.cobertura",
    "maquina.modo_color",
  ],
  // Sub-fase C — Materiales: agregar es a nivel paso; el resto se evalúa
  // POR SLOT (ctx.slot). El rol del slot está PODADO del guiado (decisión
  // del usuario); "base + cantidad por base" es UNA clave (un control).
  materiales: [
    "materiales.agregar",
    "materiales.nombre",
    "materiales.quien",
    "materiales.material",
    "materiales.candidatos",
    "materiales.criterio",
    "materiales.consumo",
    "materiales.base",
    "materiales.herencia",
    "materiales.fuente_medida",
    "materiales.caras",
  ],
  // Sub-fase D — oficio: setup/cleanup declarativos; el acomodado
  // (censo E.0 filas 4-19: algoritmo, demasía, pliego, panelizado,
  // márgenes, costeo del sustrato) es UNA card cohesiva del detallado
  // extraída. La fila 3 (tiempo fijo override) ya vive como
  // tiempo.tiempo_fijo. La sección "ajustes" se eliminó: los escapes
  // viven dentro del acomodado.
  // El talonario se movió de Tiempo a oficio (feedback del usuario:
  // es una decisión sobre cómo se arma el pliego).
  oficio: [
    // T4-H15: los parámetros propios de la familia (refuerzos del bastidor,
    // densidad del sembrado, lados de la demasía) entran al guiado — antes
    // sólo existían en el detallado (ParamsFamiliaFields).
    "oficio.params_familia",
    // [Efectos] lo que el paso le exige al trabajo (demasía de medida).
    "oficio.efectos",
    // El talonario dejó de ser opción propia: se fusionó con la imposición
    // de cuadernillo en UN control "Imposición del pliego" (mismo eje —
    // un pliego se impone de una sola forma). Vive en el Acomodado, no acá.
    "oficio.setup",
    "oficio.cleanup",
    "oficio.acomodado",
  ],
};

// Con la D no quedan secciones pendientes: el CENSO está cubierto entero.
const SECCIONES_PENDIENTES: string[] = [];

function ctxBase(extra?: {
  cfg?: Partial<UpsertConfigPasoPayload>;
  familia?: Partial<FamiliaListItem>;
  otros?: Array<{ id: string; nombre: string; modoActivacion?: string | null }>;
  lookups?: Partial<LookupsConfigPaso>;
  slot?: SlotEnContexto;
}): ContextoOpcion {
  const cfg = {
    rutaPasoId: "rp-1",
    modoActivacion: "OPCIONAL",
    ...extra?.cfg,
  } as UpsertConfigPasoPayload;
  return {
    cfg,
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
      modosTiempoSoportados: ["T-1", "T-2"],
      mecanismosCantidadSoportados: [
        "DIRECT_FROM_JOBCONTEXT",
        "HEREDAR_DEL_OUTPUT_CANONICO",
      ],
      relacionMaquinaSoportada: ["M-0"],
      slotsRequeridos: [],
      ...extra?.familia,
    } as unknown as FamiliaListItem,
    paramsPaso: (cfg.paramsPasoJson ?? {}) as Record<string, unknown>,
    otrosPasos: extra?.otros ?? [],
    lookups: {
      maquinas: [],
      centrosCosto: [],
      materiasPrimas: [],
      ...extra?.lookups,
    } as LookupsConfigPaso,
    slot: extra?.slot,
  };
}

function slotCtx(
  payload: Partial<UpsertSlotMaterialPayload>,
  opts?: { esAdicional?: boolean; declTipo?: string },
): SlotEnContexto {
  return {
    payload: {
      slotCodigo: payload.slotCodigo ?? "sustrato_principal",
      modoSeleccion: payload.modoSeleccion ?? "HARDCODED",
      ...payload,
    } as UpsertSlotMaterialPayload,
    decl: opts?.esAdicional
      ? null
      : {
          codigo: payload.slotCodigo ?? "sustrato_principal",
          nombre: "Sustrato principal",
          requerido: true,
          tipo: opts?.declTipo,
        },
    esAdicional: opts?.esAdicional ?? false,
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
    expect(cuando.resumen(ctx)).toBe("Obligatorio — fijado por el paso");
    // El control es propio (segmented + la consecuencia del modo elegido);
    // lo que sigue siendo del esquema es QUÉ modos se ofrecen.
    expect(cuando.control.tipo).toBe("componente");
    expect(modosActivacionOfrecidos(ctx)).toEqual([
      "OBLIGATORIO",
      "NO_EJECUTAR",
    ]);
  });

  it("cada modo dice qué implica: elegir entre etiquetas sueltas es adivinar", () => {
    for (const modo of [
      "OBLIGATORIO",
      "OPCIONAL",
      "CONDICIONAL",
      "NO_EJECUTAR",
    ]) {
      expect(MODO_ACTIVACION_CONSECUENCIA[modo]).toBeTruthy();
    }
  });

  it("el arrastre sólo se ofrece con activación condicional; obligatorio con selecciones legacy sigue visible para limpiar", () => {
    // Decisión del usuario (2026-08-11, revierte H-7): en un paso que corre
    // SIEMPRE, arrastrar equivale a configurar los destinos como "Siempre" —
    // la sección era ruido. El motor sí arrastra desde obligatorios, así que
    // las selecciones guardadas se muestran para poder destildarlas.
    const co = ESQUEMA_PASO.find(
      (op) => op.clave === "activacion.coejecucion",
    )!;
    const conVecinos = { otros: [{ id: "otro", nombre: "Tensado de lona" }] };
    expect(
      co.visible(
        ctxBase({ ...conVecinos, cfg: { modoActivacion: "OBLIGATORIO" } }),
      ),
    ).toBe(false);
    expect(
      co.visible(
        ctxBase({ ...conVecinos, cfg: { modoActivacion: "OPCIONAL" } }),
      ),
    ).toBe(true);
    expect(
      co.visible(
        ctxBase({ ...conVecinos, cfg: { modoActivacion: "CONDICIONAL" } }),
      ),
    ).toBe(true);
    // Legacy: obligatorio con selecciones guardadas → visible para limpiar.
    expect(
      co.visible(
        ctxBase({
          ...conVecinos,
          cfg: {
            modoActivacion: "OBLIGATORIO",
            requiereRutaPasoIds: ["otro"],
          },
        }),
      ),
    ).toBe(true);
    // Apagado: si el paso no corre, no arrastra a nadie.
    expect(
      co.visible(
        ctxBase({ ...conVecinos, cfg: { modoActivacion: "NO_EJECUTAR" } }),
      ),
    ).toBe(false);
    // Destinos: un vecino OBLIGATORIO no es arrastrable — sin candidatos,
    // la sección se oculta aunque este paso sea opcional.
    expect(
      co.visible(
        ctxBase({
          otros: [
            {
              id: "otro",
              nombre: "Impresión",
              modoActivacion: "OBLIGATORIO",
            },
          ],
          cfg: { modoActivacion: "OPCIONAL" },
        }),
      ),
    ).toBe(false);
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

describe("sección Tiempo y costo", () => {
  it("capa comercial: 'Puede' deja visible el base; sólo 'Debe' suprime las preguntas de ritmo", () => {
    // "Puede" (habilitado sin obligatorio): el tiempo base sigue visible —
    // es la sugerencia/fallback (el bug de los dos defaults era esconderlo).
    const ctxPuede = ctxBase({
      cfg: {
        modoTiempo: "T-2",
        paramsPasoJson: { tiempoManual: { habilitado: true, defaultMin: 30 } },
      },
    });
    const clavesPuede = opcionesDeSeccion("tiempo", ctxPuede).map(
      (op) => op.clave,
    );
    expect(clavesPuede).toContain("tiempo.forma");
    expect(clavesPuede).toContain("tiempo.productividad");

    // "Debe" (obligatorio): el comercial SIEMPRE pisa el base → se suprime.
    const ctxDebe = ctxBase({
      cfg: {
        modoTiempo: "T-2",
        paramsPasoJson: {
          tiempoManual: { habilitado: true, obligatorio: true },
        },
      },
    });
    const suprimidas = opcionesDeSeccion("tiempo", ctxDebe).map(
      (op) => op.clave,
    );
    for (const clave of [
      "tiempo.origen",
      "tiempo.forma",
      "tiempo.ritmo_modo",
      "tiempo.productividad",
      "tiempo.batch",
      "tiempo.calcular_segun",
      "tiempo.fijo_valor",
    ]) {
      expect(suprimidas).not.toContain(clave);
    }
    const comercial = ESQUEMA_PASO.find(
      (op) => op.clave === "tiempo.comercial",
    )!;
    expect(comercial.resumen(ctxDebe)).toBe(
      "Debe cargarlo — sin su tiempo no cotiza",
    );
    // Legacy T-4 (etiqueta sin rama en el motor) se lee como "Debe".
    const ctxT4 = ctxBase({ cfg: { modoTiempo: "T-4" } });
    expect(comercial.resumen(ctxT4)).toBe(
      "Debe cargarlo — sin su tiempo no cotiza",
    );
  });

  it("el centro productivo resume el default del paso y su pendiente es 'centro'", () => {
    const centro = ESQUEMA_PASO.find((op) => op.clave === "tiempo.centro")!;
    expect(centro.pregunta).toBe(
      "¿En qué centro productivo se realiza este paso?",
    );
    expect(centro.pendiente).toBe("centro");
    const ctx = ctxBase({
      familia: {
        defaults: { centroCostoId: "cc-1" },
      } as Partial<FamiliaListItem>,
      lookups: {
        centrosCosto: [
          {
            id: "cc-1",
            codigo: "TAL",
            nombre: "Taller general",
            unidadBaseFutura: "hora",
          },
        ],
      },
    });
    expect(centro.resumen(ctx)).toBe("Usando el del paso: Taller general");
    expect(centro.origenValor(ctx)).toBe("default-paso");
    // Con máquina el centro lo pone ella: la sección sigue visible pero muestra
    // —read-only— el centro de la máquina, en vez de esconderse.
    const ctxMaq = ctxBase({
      cfg: { maquinaM1Id: "mq-1" },
      lookups: {
        maquinas: [
          {
            id: "mq-1",
            centroCostoPrincipal: {
              id: "cc-9",
              codigo: "IMP",
              nombre: "Impresión",
            },
          },
        ],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(centro.visible(ctxMaq)).toBe(true);
    expect(centro.resumen(ctxMaq)).toBe("Impresión · lo pone la máquina");
    expect(centro.origenValor(ctxMaq)).toBe("default-maquina");
  });

  it("la regla del tiempo variable es UNA pregunta para productividad y tanda", () => {
    // Feedback del usuario: "Tipo de ritmo" sobra — la oración
    // "[N] [magnitud] cada [T] [min|h]" expresa ambos; la diferencia real
    // (la tanda redondea) es el interruptor "tandas enteras" del control.
    const ctxProd = ctxBase({ cfg: { modoTiempo: "T-2" } });
    const clavesProd = opcionesDeSeccion("tiempo", ctxProd).map(
      (op) => op.clave,
    );
    expect(clavesProd).toContain("tiempo.productividad");
    expect(clavesProd).not.toContain("tiempo.batch");
    expect(clavesProd).not.toContain("tiempo.ritmo_modo");

    const ctxBatch = ctxBase({
      cfg: {
        modoTiempo: "T-2",
        paramsPasoJson: {
          timeCalculationMode: "batch_time",
          batchSize: 3,
          batchTimeMin: 1,
        },
      },
    });
    const clavesBatch = opcionesDeSeccion("tiempo", ctxBatch).map(
      (op) => op.clave,
    );
    expect(clavesBatch).toContain("tiempo.productividad");
    expect(clavesBatch).not.toContain("tiempo.batch");
    expect(clavesBatch).not.toContain("tiempo.ritmo_modo");

    // El resumen de la regla dice la tanda (y el redondeo) cuando aplica.
    const prod = ESQUEMA_PASO.find(
      (op) => op.clave === "tiempo.productividad",
    )!;
    expect(prod.resumen(ctxBatch)).toContain("cada 1 min");

    // El ritmo declarado por el paso se usa como default vivo.
    const ctxDefault = ctxBase({
      cfg: { modoTiempo: "T-2" },
      familia: {
        defaults: { productividadHora: 45 },
      } as Partial<FamiliaListItem>,
    });
    expect(prod.resumen(ctxDefault)).toBe("Usando el del paso: 45/h");
    expect(prod.origenValor(ctxDefault)).toBe("default-paso");
  });

  it("el valor del fijo aparece con forma=fijo y unifica los dos storages (T-1 min / T-2 horas)", () => {
    const fijo = ESQUEMA_PASO.find((op) => op.clave === "tiempo.fijo_valor")!;
    const ctxT1 = ctxBase({
      cfg: { modoTiempo: "T-1" },
      familia: { defaults: { tiempoFijoMin: 15 } } as Partial<FamiliaListItem>,
    });
    expect(fijo.visible(ctxT1)).toBe(true);
    expect(fijo.resumen(ctxT1)).toBe("Usando el del paso: 15 min");
    // T-2 puro (ritmo) no muestra el fijo…
    expect(fijo.visible(ctxBase({ cfg: { modoTiempo: "T-2" } }))).toBe(false);
    // …pero T-2 con horas cargadas ES fijo (el storage histórico de horas):
    // se muestra y resume en horas.
    const ctxT2Horas = ctxBase({
      cfg: { modoTiempo: "T-2", paramsPasoJson: { horasEstimadas: 2 } },
    });
    expect(fijo.visible(ctxT2Horas)).toBe(true);
    expect(fijo.resumen(ctxT2Horas)).toBe("2 h");
    // ① = máquina no ofrece fijo: el reloj lo define el perfil.
    expect(fijo.visible(ctxBase({ cfg: { modoTiempo: "T-3" } }))).toBe(false);
  });

  it("la bifurcación ①: origen máquina muestra el panel y esconde las perillas del taller", () => {
    const claves = opcionesDeSeccion(
      "tiempo",
      ctxBase({
        cfg: { modoTiempo: "T-3" },
        familia: {
          modosTiempoSoportados: ["T-2", "T-3"],
        } as Partial<FamiliaListItem>,
      }),
    ).map((op) => op.clave);
    expect(claves).toContain("tiempo.origen");
    expect(claves).toContain("tiempo.maquina_panel");
    expect(claves).not.toContain("tiempo.forma");
    expect(claves).not.toContain("tiempo.ritmo_modo");
    expect(claves).not.toContain("tiempo.productividad");
    // Y al revés: taller con T-2 ofrece la forma, no el panel.
    const clavesTaller = opcionesDeSeccion(
      "tiempo",
      ctxBase({
        cfg: { modoTiempo: "T-2" },
        familia: {
          modosTiempoSoportados: ["T-2", "T-3"],
        } as Partial<FamiliaListItem>,
      }),
    ).map((op) => op.clave);
    expect(clavesTaller).toContain("tiempo.forma");
    expect(clavesTaller).not.toContain("tiempo.maquina_panel");
  });

  it("talonario ya no es opción propia: se fusionó con la imposición del pliego (ni en oficio ni aun declarando el param); piezas a montar sólo en montaje", () => {
    const claves = opcionesDeSeccion("tiempo", ctxBase()).map((o) => o.clave);
    expect(claves).not.toContain("tiempo.piezas_montar");
    // Antes talonario aparecía como opción de oficio cuando la ficha declaraba
    // modoTalonarioIncompleto. Ahora es un MODO del control "Imposición del
    // pliego" (dentro del Acomodado), no una opción del esquema — así que no
    // aparece por opcionesDeSeccion ni siquiera declarando el param.
    const clavesPrensa = opcionesDeSeccion(
      "oficio",
      ctxBase({
        familia: {
          codigo: "impresion_por_hoja",
          paramsPasoSchema: [
            { campo: "modoTalonarioIncompleto", etiqueta: "Agrupado", tipo: "enum" },
          ],
        },
      }),
    ).map((o) => o.clave);
    expect(clavesPrensa).not.toContain("oficio.talonario");
  });

  it("con HEREDAR, el control único de cantidad nombra la magnitud", () => {
    const cantidad = ESQUEMA_PASO.find(
      (op) => op.clave === "tiempo.cantidad_operativa",
    )!;
    const ctx = ctxBase({
      cfg: {
        mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO",
        mecanismoCantidadConfigJson: {
          origen: { rutaPasoId: "rp-2", capacidad: "pliegos" },
        },
      },
      otros: [{ id: "rp-2", nombre: "Pre-prensa" }],
    });
    // Opción A: un solo control fusiona método + magnitud; con HEREDAR el
    // resumen es la magnitud, no "Hereda del paso anterior".
    expect(cantidad.visible(ctx)).toBe(true);
    expect(cantidad.resumen(ctx)).toBe("Pliegos");
  });

  it("la opción separada 'Hereda de' quedó fusionada (oculta) pero su resumen sigue vivo", () => {
    const herencia = ESQUEMA_PASO.find((op) => op.clave === "tiempo.herencia")!;
    expect(herencia.pendiente).toBe("herencia_origen");
    const ctx = ctxBase({
      cfg: {
        mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO",
        mecanismoCantidadConfigJson: {
          origen: { rutaPasoId: "rp-2", capacidad: "pliegos" },
        },
      },
      otros: [{ id: "rp-2", nombre: "Pre-prensa" }],
    });
    // El editor guiado ya no la renderiza aparte…
    expect(herencia.visible(ctx)).toBe(false);
    // …pero el detallado y el resumen siguen leyendo su lógica.
    expect(herencia.resumen(ctx)).toBe("Hereda de Pre-prensa (pliegos)");
    expect(herencia.origenValor(ctx)).toBe("config");
  });
});

describe("sección Máquina y perfil", () => {
  it("máquina requerida vs. paso manual cambian resumen y origen", () => {
    const maquina = ESQUEMA_PASO.find((op) => op.clave === "maquina.maquina")!;
    // Familia M-1 pura (sin M-0): la máquina es obligatoria.
    const ctxRequerida = ctxBase({
      familia: { relacionMaquinaSoportada: ["M-1"] },
    });
    expect(maquina.visible(ctxRequerida)).toBe(true);
    expect(maquina.resumen(ctxRequerida)).toBe("Sin máquina elegida");
    expect(maquina.origenValor(ctxRequerida)).toBe("sin-definir");
    // Familia M-0/M-1: sin máquina es un paso manual válido.
    const ctxManual = ctxBase({
      familia: { relacionMaquinaSoportada: ["M-0", "M-1"] },
    });
    expect(maquina.resumen(ctxManual)).toBe("Sin máquina (paso manual)");
    expect(maquina.origenValor(ctxManual)).toBe("default-paso");
  });

  it("con candidatas elegidas, máquina y perfil M-1 no se repiten (viven por candidata)", () => {
    const maquina = ESQUEMA_PASO.find((op) => op.clave === "maquina.maquina")!;
    const perfil = ESQUEMA_PASO.find((op) => op.clave === "maquina.perfil")!;
    const conCandidatas = ctxBase({
      familia: { relacionMaquinaSoportada: ["M-1", "M-2"] },
      cfg: {
        maquinaM1Id: "mq-1",
        maquinasCandidatas: [{ maquinaId: "mq-1" }],
      },
    });
    expect(maquina.visible(conCandidatas)).toBe(false);
    expect(perfil.visible(conCandidatas)).toBe(false);
    // Sin candidatas todavía, M-2 mantiene una única UI: la lista de
    // candidatas. Mostrar además los selectores M-1 duplicaría el concepto.
    const sinCandidatas = ctxBase({
      familia: { relacionMaquinaSoportada: ["M-1", "M-2"] },
      cfg: { maquinaM1Id: "mq-1" },
    });
    expect(maquina.visible(sinCandidatas)).toBe(false);
    expect(perfil.visible(sinCandidatas)).toBe(false);
  });

  it("candidatas: visible sólo en M-2, resume por nombre y su pendiente es 'candidatas'", () => {
    const candidatas = ESQUEMA_PASO.find(
      (op) => op.clave === "maquina.candidatas",
    )!;
    expect(candidatas.pendiente).toBe("candidatas");
    expect(candidatas.visible(ctxBase())).toBe(false);
    const ctx = ctxBase({
      familia: { relacionMaquinaSoportada: ["M-2"] },
      cfg: {
        maquinasCandidatas: [{ maquinaId: "mq-1", esPreferida: true }],
      },
      lookups: {
        maquinas: [
          {
            id: "mq-1",
            codigo: "RICOH",
            nombre: "Ricoh Pro",
            plantilla: "IMPRESORA_LASER",
            perfilesOperativos: [],
          },
        ],
      },
    });
    expect(candidatas.visible(ctx)).toBe(true);
    expect(candidatas.resumen(ctx)).toBe("1 candidata: Ricoh Pro");
    // El control es LA UI del detallado extraída (corrección del usuario).
    expect(candidatas.control).toEqual({
      tipo: "componente",
      id: "candidatas-detallado",
    });
  });

  it("modo de color: sólo en familias de impresión con máquina, y con candidatas vive adentro de candidatas", () => {
    const modoColor = ESQUEMA_PASO.find(
      (op) => op.clave === "maquina.modo_color",
    )!;
    expect(modoColor.visible(ctxBase())).toBe(false);
    const ctxImpresion = ctxBase({
      // [Etapa F3] La familia declara ser de impresión, como el catálogo.
      familia: {
        codigo: "impresion_por_hoja",
        esImpresion: true,
        relacionMaquinaSoportada: ["M-1"],
      },
      cfg: { maquinaM1Id: "mq-1" },
    });
    expect(modoColor.visible(ctxImpresion)).toBe(true);
    expect(modoColor.resumen(ctxImpresion)).toBe(
      "Todos los modos de la máquina y el perfil",
    );
    // M-2 con candidatas elegidas: el modo de color se define por candidata.
    const ctxCandidatas = ctxBase({
      familia: {
        codigo: "impresion_por_hoja",
        relacionMaquinaSoportada: ["M-2"],
      },
      cfg: {
        maquinaM1Id: "mq-1",
        maquinasCandidatas: [{ maquinaId: "mq-2" }],
      },
    });
    expect(modoColor.visible(ctxCandidatas)).toBe(false);
  });
});

describe("sección Materiales", () => {
  const familiaConSlot = {
    slotsRequeridos: [
      {
        codigo: "sustrato_principal",
        nombre: "Sustrato principal",
        requerido: true,
      },
    ],
    permiteSlotsAdicionales: true,
  } as Partial<FamiliaListItem>;

  it("agregar: sin el slot requerido configurado queda sin-definir", () => {
    const agregar = ESQUEMA_PASO.find(
      (op) => op.clave === "materiales.agregar",
    )!;
    const ctx = ctxBase({ familia: familiaConSlot });
    expect(agregar.visible(ctx)).toBe(true);
    expect(agregar.origenValor(ctx)).toBe("sin-definir");
    const ctxConSlot = ctxBase({
      familia: familiaConSlot,
      cfg: {
        slotsMateriales: [
          { slotCodigo: "sustrato_principal", modoSeleccion: "HARDCODED" },
        ],
      },
    });
    expect(agregar.origenValor(ctxConSlot)).toBe("config");
    expect(agregar.resumen(ctxConSlot)).toBe("1 material configurado");
    // Con un slot en contexto (iteración por slot) no se repite.
    expect(
      agregar.visible(ctxBase({ familia: familiaConSlot, slot: slotCtx({}) })),
    ).toBe(false);
  });

  it("las claves por slot sólo aparecen con slot en contexto", () => {
    const sinSlot = opcionesDeSeccion("materiales", ctxBase()).map(
      (o) => o.clave,
    );
    expect(sinSlot).not.toContain("materiales.quien");
    // H9: la familia base no multiplica por caras → la pregunta de doble
    // faz no aparece (era ruido en herrería/LED).
    const conSlot = opcionesDeSeccion(
      "materiales",
      ctxBase({ slot: slotCtx({}) }),
    ).map((o) => o.clave);
    expect(conSlot).toEqual([
      "materiales.quien",
      "materiales.material",
      "materiales.consumo",
    ]);
  });

  it("la doble faz aparece si la familia multiplica por caras, o si ya está activa (H9)", () => {
    const familiaConCaras = {
      ...ctxBase().familia!,
      multiplicadoresSoportados: ["caras"],
    };
    const conCaras = opcionesDeSeccion(
      "materiales",
      ctxBase({ familia: familiaConCaras, slot: slotCtx({}) }),
    ).map((o) => o.clave);
    expect(conCaras).toContain("materiales.caras");
    // Config existente encendida: no se esconde aunque la familia no la
    // soporte (el modelador tiene que poder verla y apagarla).
    const conActiva = opcionesDeSeccion(
      "materiales",
      ctxBase({ slot: slotCtx({ aplicaMultiCaras: true }) }),
    ).map((o) => o.clave);
    expect(conActiva).toContain("materiales.caras");
  });

  it("material fijo vs candidatos vs criterio siguen al modo de selección", () => {
    const material = ESQUEMA_PASO.find(
      (op) => op.clave === "materiales.material",
    )!;
    const candidatos = ESQUEMA_PASO.find(
      (op) => op.clave === "materiales.candidatos",
    )!;
    const criterio = ESQUEMA_PASO.find(
      (op) => op.clave === "materiales.criterio",
    )!;
    const fijo = ctxBase({ slot: slotCtx({ modoSeleccion: "HARDCODED" }) });
    expect(material.visible(fijo)).toBe(true);
    expect(candidatos.visible(fijo)).toBe(false);
    expect(material.pendiente).toBe("material_slot");
    expect(material.origenValor(fijo)).toBe("sin-definir");

    const motor = ctxBase({
      slot: slotCtx({
        modoSeleccion: "MOTOR_ELIGE_AUTO",
        candidatos: [
          {
            materiaPrimaId: "mp-1",
            varianteIds: ["v1", "v2"],
          },
        ],
      }),
    });
    expect(material.visible(motor)).toBe(false);
    expect(candidatos.visible(motor)).toBe(true);
    expect(candidatos.resumen(motor)).toBe("1 material · 2 variantes");
    expect(criterio.visible(motor)).toBe(true);
    expect(criterio.origenValor(motor)).toBe("sin-definir");
  });

  it("el material fijo resume la variante por nombre desde los lookups", () => {
    const material = ESQUEMA_PASO.find(
      (op) => op.clave === "materiales.material",
    )!;
    const ctx = ctxBase({
      slot: slotCtx({ materialVarianteId: "v-9" }),
      lookups: {
        materiasPrimas: [
          {
            id: "mp-1",
            codigo: "VIN",
            nombre: "Vinilo blanco",
            familia: "VINILOS",
            subfamilia: "",
            templateId: "t",
            variantes: [
              {
                id: "v-9",
                sku: "VIN-9",
                nombreVariante: "80 µm mate",
                precioReferencia: null,
              },
            ],
          },
        ],
      },
    });
    expect(material.resumen(ctx)).toBe("Vinilo blanco — 80 µm mate");
    expect(material.origenValor(ctx)).toBe("config");
  });

  it("base de consumo: plegada dentro de consumo (ya no es control separado), pero resume base × factor", () => {
    const base = ESQUEMA_PASO.find((op) => op.clave === "materiales.base")!;
    // "Regla propia" (base × factor) vive ahora dentro de materiales.consumo
    // (las 3 formas): la clave materiales.base ya no se muestra sola. Se
    // conserva su resumen para tests/textos.
    expect(base.visible(ctxBase({ slot: slotCtx({}) }))).toBe(false);
    const adicional = ctxBase({
      slot: slotCtx(
        { cantidadBase: "cantidad_pedida", cantidadFactor: 2 },
        { esAdicional: true },
      ),
    });
    expect(base.visible(adicional)).toBe(false);
    expect(base.resumen(adicional)).toBe("2 por cantidad pedida");
    const insumo = ctxBase({
      slot: slotCtx({}, { declTipo: "INSUMO_PASO" }),
    });
    expect(base.visible(insumo)).toBe(false);
    expect(base.resumen(insumo)).toBe("Según fórmula del consumo");
  });

  // [Costeo del sustrato → nesting] Los tests de `materiales.costeo` se
  // eliminaron con la pregunta: el costeo del sustrato lo posee el nesting
  // (Acomodo), fuente única `nestingConfig.costing`. Ver schema §materiales.

  it("el nombre sólo aplica a slots adicionales", () => {
    const nombre = ESQUEMA_PASO.find((op) => op.clave === "materiales.nombre")!;
    expect(nombre.visible(ctxBase({ slot: slotCtx({}) }))).toBe(false);
    const adicional = ctxBase({
      slot: slotCtx({ slotNombre: "Ojales" }, { esAdicional: true }),
    });
    expect(nombre.visible(adicional)).toBe(true);
    expect(nombre.resumen(adicional)).toBe('"Ojales"');
  });
});

describe("sección Quién lo hace (tercerización)", () => {
  it("es la PRIMERA pregunta del esquema", () => {
    expect(ESQUEMA_PASO[0].clave).toBe("quien.tercerizado");
  });

  it("declarado por la familia: no se re-pregunta (colapsado con origen del paso)", () => {
    const quien = ESQUEMA_PASO.find((op) => op.clave === "quien.tercerizado")!;
    const ctx = ctxBase({
      cfg: { tercerizado: true },
      familia: { defaults: { tercerizado: true } } as Partial<FamiliaListItem>,
    });
    expect(quien.resumen(ctx)).toBe(
      "Sí — declarado en el paso",
    );
    expect(quien.origenValor(ctx)).toBe("default-paso");
    // Internalizarlo pese a la declaración es una decisión propia.
    const internalizado = ctxBase({
      cfg: { tercerizado: false },
      familia: { defaults: { tercerizado: true } } as Partial<FamiliaListItem>,
    });
    expect(internalizado.cfg.tercerizado).toBe(false);
    expect(quien.origenValor(internalizado)).toBe("config");
  });

  it("el proveedor sólo aparece tercerizado y exige proveedor + precios", () => {
    const proveedor = ESQUEMA_PASO.find(
      (op) => op.clave === "quien.proveedor",
    )!;
    expect(proveedor.visible(ctxBase())).toBe(false);
    expect(proveedor.pendiente).toBe("proveedor");
    const sinProveedor = ctxBase({ cfg: { tercerizado: true } });
    expect(proveedor.visible(sinProveedor)).toBe(true);
    expect(proveedor.origenValor(sinProveedor)).toBe("sin-definir");
    // Con proveedor pero la matriz vacía sigue sin definir (cotiza $0).
    const sinGrilla = ctxBase({
      cfg: { tercerizado: true, proveedorId: "prov-1" },
    });
    expect(proveedor.origenValor(sinGrilla)).toBe("sin-definir");
    expect(proveedor.resumen(sinGrilla)).toBe(
      "Proveedor elegido — con matriz de precios · faltan los precios",
    );
    const completo = ctxBase({
      cfg: {
        tercerizado: true,
        proveedorId: "prov-1",
        fuenteCostoTercerizado: "fijo",
        tercerizadoConfigJson: { costoFijo: 1500 },
        plazoProveedorDias: 5,
      },
    });
    expect(proveedor.origenValor(completo)).toBe("config");
    expect(proveedor.resumen(completo)).toBe(
      "Proveedor elegido — a precio fijo por trabajo · entrega en 5 días",
    );
  });
});

describe("sección Ajustes del trabajo (oficio)", () => {
  it("setup y cleanup sólo con máquina, heredando del perfil", () => {
    const setup = ESQUEMA_PASO.find((op) => op.clave === "oficio.setup")!;
    expect(setup.visible(ctxBase())).toBe(false);
    const conMaquina = ctxBase({ cfg: { maquinaM1Id: "mq-1" } });
    expect(setup.visible(conMaquina)).toBe(true);
    expect(setup.resumen(conMaquina)).toBe("El del perfil de la máquina");
    expect(setup.origenValor(conMaquina)).toBe("default-maquina");
    const conOverride = ctxBase({
      cfg: { maquinaM1Id: "mq-1", setupOverrideMin: 12 },
    });
    expect(setup.resumen(conOverride)).toBe("12 min");
    expect(setup.origenValor(conOverride)).toBe("config");
  });

  it("el acomodado aparece según la regla de nesting y resume la política de costeo", () => {
    const acomodado = ESQUEMA_PASO.find(
      (op) => op.clave === "oficio.acomodado",
    )!;
    // trabajo_manual sin CALCULADO_POR_PASO: no acomoda.
    expect(acomodado.visible(ctxBase())).toBe(false);
    // pre_prensa nunca (delega el acomodo a impresión).
    expect(
      acomodado.visible(ctxBase({ familia: { codigo: "pre_prensa" } })),
    ).toBe(false);
    const granFormato = ctxBase({
      // [Etapa F2] La familia declara su acomodado, como el catálogo real.
      familia: {
        codigo: "impresion_por_area",
        nestingConfig: { superficie: "segun_material" },
      },
      cfg: {
        paramsPasoJson: {
          nestingConfig: {
            costing: { strategy: "consumed-length" },
            paneling: { enabled: true },
          },
        },
      },
    });
    expect(acomodado.visible(granFormato)).toBe(true);
    expect(acomodado.resumen(granFormato)).toBe(
      "Costeo: largo utilizado de la materia prima · Panelizado",
    );
    expect(acomodado.origenValor(granFormato)).toBe("config");
  });

  it("con el costeo en su default no lo nombra", () => {
    const acomodado = ESQUEMA_PASO.find(
      (op) => op.clave === "oficio.acomodado",
    )!;
    const ctx = ctxBase({
      familia: { codigo: "impresion_por_area" },
      cfg: {
        paramsPasoJson: {
          nestingConfig: { costing: { strategy: "simple" } },
        },
      },
    });
    expect(acomodado.resumen(ctx)).toBe("Acomodo estándar");
  });

  it("en ROLLO no nombra el costeo aunque haya una estrategia guardada (dato muerto)", () => {
    const acomodado = ESQUEMA_PASO.find(
      (op) => op.clave === "oficio.acomodado",
    )!;
    // Vinilo en rollo con plate-segments heredado de una config previa:
    // la card no lo ofrece y el motor lo ignora, así que no se nombra.
    const rollo = ctxBase({
      familia: { codigo: "impresion_por_area" },
      cfg: {
        slotsMateriales: [
          {
            slotCodigo: "sustrato_principal",
            modoSeleccion: "HARDCODED",
            materialVarianteId: "v-rollo",
          },
        ],
        paramsPasoJson: {
          nestingConfig: {
            costing: { strategy: "plate-segments" },
            paneling: { enabled: true },
          },
        },
      },
      lookups: {
        materiasPrimas: [
          {
            id: "mp-vinilo",
            codigo: "VIN",
            nombre: "Vinilo blanco",
            familia: "VINILOS",
            subfamilia: "",
            templateId: "t",
            variantes: [
              {
                id: "v-rollo",
                sku: "VIN-50",
                nombreVariante: "1,50 × 50 m",
                precioReferencia: null,
                atributosVarianteJson: { anchoMm: 1500, largoRolloMm: 50000 },
              },
            ],
          },
        ],
      },
    });
    expect(acomodado.resumen(rollo)).toBe("Panelizado");
  });
});
