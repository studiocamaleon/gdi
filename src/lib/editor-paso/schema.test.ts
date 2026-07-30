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
  // Sub-fase B — Tiempo y costo: el tiempo del comercial va PRIMERO y
  // suprime ritmo/tanda/tiempo fijo/calcular-según (corrección usuario).
  tiempo: [
    "tiempo.comercial",
    "tiempo.modo",
    "tiempo.centro",
    "tiempo.dotacion",
    "tiempo.ritmo_modo",
    "tiempo.productividad",
    "tiempo.batch",
    "tiempo.cantidad_operativa",
    "tiempo.herencia",
    "tiempo.calcular_segun",
    "tiempo.piezas_montar",
    "tiempo.talonario",
    "tiempo.tiempo_fijo",
  ],
  // Sub-fase B — Máquina y perfil: candidatas y modo de color usan LA UI
  // del detallado extraída como componentes. "Modo de color del producto"
  // y "modos permitidos" son UN control en la implementación (el bloque
  // del detallado); por candidata viven dentro de candidatas.
  maquina: [
    "maquina.maquina",
    "maquina.perfil",
    "maquina.candidatas",
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
    "materiales.costeo",
    "materiales.base",
    "materiales.caras",
  ],
  // Sub-fase D — oficio: setup/cleanup declarativos; el acomodado
  // (censo E.0 filas 4-19: algoritmo, demasía, pliego, panelizado,
  // márgenes, costeo del sustrato) es UNA card cohesiva del detallado
  // extraída. La fila 3 (tiempo fijo override) ya vive como
  // tiempo.tiempo_fijo. La sección "ajustes" se eliminó: los escapes
  // viven dentro del acomodado.
  oficio: ["oficio.setup", "oficio.cleanup", "oficio.acomodado"],
};

// Con la D no quedan secciones pendientes: el CENSO está cubierto entero.
const SECCIONES_PENDIENTES: string[] = [];

function ctxBase(extra?: {
  cfg?: Partial<UpsertConfigPasoPayload>;
  familia?: Partial<FamiliaListItem>;
  otros?: Array<{ id: string; nombre: string }>;
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

describe("sección Tiempo y costo", () => {
  it("el tiempo del comercial va PRIMERO y suprime las preguntas de ritmo", () => {
    const claves = opcionesDeSeccion("tiempo", ctxBase()).map(
      (op) => op.clave,
    );
    expect(claves[0]).toBe("tiempo.comercial");

    // Con el comercial estimando, las preguntas de cálculo desaparecen.
    const ctxComercial = ctxBase({
      cfg: {
        modoTiempo: "T-2",
        paramsPasoJson: { tiempoManual: { habilitado: true, defaultMin: 30 } },
      },
    });
    const suprimidas = opcionesDeSeccion("tiempo", ctxComercial).map(
      (op) => op.clave,
    );
    for (const clave of [
      "tiempo.modo",
      "tiempo.ritmo_modo",
      "tiempo.productividad",
      "tiempo.batch",
      "tiempo.calcular_segun",
      "tiempo.tiempo_fijo",
    ]) {
      expect(suprimidas).not.toContain(clave);
    }
    const comercial = ESQUEMA_PASO.find(
      (op) => op.clave === "tiempo.comercial",
    )!;
    expect(comercial.resumen(ctxComercial)).toBe(
      "Sí — lo carga al cotizar (sugerido 30 min)",
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
    // Con máquina, el centro lo pone la máquina: la pregunta no aparece.
    expect(centro.visible(ctxBase({ cfg: { maquinaM1Id: "mq-1" } }))).toBe(
      false,
    );
  });

  it("ritmo: productividad y tanda se excluyen según cómo se mide", () => {
    const ctxProd = ctxBase({ cfg: { modoTiempo: "T-2" } });
    const clavesProd = opcionesDeSeccion("tiempo", ctxProd).map(
      (op) => op.clave,
    );
    expect(clavesProd).toContain("tiempo.productividad");
    expect(clavesProd).not.toContain("tiempo.batch");

    const ctxBatch = ctxBase({
      cfg: {
        modoTiempo: "T-2",
        paramsPasoJson: { timeCalculationMode: "batch_time" },
      },
    });
    const clavesBatch = opcionesDeSeccion("tiempo", ctxBatch).map(
      (op) => op.clave,
    );
    expect(clavesBatch).toContain("tiempo.batch");
    expect(clavesBatch).not.toContain("tiempo.productividad");

    // El ritmo declarado por el paso se usa como default vivo.
    const prod = ESQUEMA_PASO.find(
      (op) => op.clave === "tiempo.productividad",
    )!;
    const ctxDefault = ctxBase({
      cfg: { modoTiempo: "T-2" },
      familia: {
        defaults: { productividadHora: 45 },
      } as Partial<FamiliaListItem>,
    });
    expect(prod.resumen(ctxDefault)).toBe("Usando el del paso: 45/h");
    expect(prod.origenValor(ctxDefault)).toBe("default-paso");
  });

  it("el tiempo fijo sólo aparece en T-1 sin máquina y resume el default", () => {
    const fijo = ESQUEMA_PASO.find((op) => op.clave === "tiempo.tiempo_fijo")!;
    const ctxT1 = ctxBase({
      cfg: { modoTiempo: "T-1" },
      familia: { defaults: { tiempoFijoMin: 15 } } as Partial<FamiliaListItem>,
    });
    expect(fijo.visible(ctxT1)).toBe(true);
    expect(fijo.resumen(ctxT1)).toBe("Usando el del paso: 15 min");
    expect(fijo.visible(ctxBase({ cfg: { modoTiempo: "T-2" } }))).toBe(false);
    expect(
      fijo.visible(ctxBase({ cfg: { modoTiempo: "T-1", maquinaM1Id: "mq" } })),
    ).toBe(false);
  });

  it("talonario sólo en pre-prensa; piezas a montar sólo en montaje", () => {
    const claves = opcionesDeSeccion("tiempo", ctxBase()).map((o) => o.clave);
    expect(claves).not.toContain("tiempo.talonario");
    expect(claves).not.toContain("tiempo.piezas_montar");
    const clavesPrensa = opcionesDeSeccion(
      "tiempo",
      ctxBase({ familia: { codigo: "pre_prensa" } }),
    ).map((o) => o.clave);
    expect(clavesPrensa).toContain("tiempo.talonario");
  });

  it("la herencia aparece con mecanismo HEREDAR y nombra el paso origen", () => {
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
    expect(herencia.visible(ctx)).toBe(true);
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
      familia: {
        codigo: "impresion_por_hoja",
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
    const conSlot = opcionesDeSeccion(
      "materiales",
      ctxBase({ slot: slotCtx({}) }),
    ).map((o) => o.clave);
    expect(conSlot).toEqual([
      "materiales.quien",
      "materiales.material",
      "materiales.consumo",
      "materiales.costeo",
      "materiales.caras",
    ]);
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

  it("base de consumo: sólo adicional o insumo declarado, y resume base × factor", () => {
    const base = ESQUEMA_PASO.find((op) => op.clave === "materiales.base")!;
    expect(base.visible(ctxBase({ slot: slotCtx({}) }))).toBe(false);
    const adicional = ctxBase({
      slot: slotCtx(
        { cantidadBase: "cantidad_pedida", cantidadFactor: 2 },
        { esAdicional: true },
      ),
    });
    expect(base.visible(adicional)).toBe(true);
    expect(base.resumen(adicional)).toBe("2 por cantidad pedida");
    const insumo = ctxBase({
      slot: slotCtx({}, { declTipo: "INSUMO_PASO" }),
    });
    expect(base.visible(insumo)).toBe(true);
    expect(base.resumen(insumo)).toBe("Según fórmula del consumo");
  });

  it("el costeo se oculta cuando Acomodado/nesting lo define", () => {
    const costeo = ESQUEMA_PASO.find((op) => op.clave === "materiales.costeo")!;
    expect(costeo.visible(ctxBase({ slot: slotCtx({}) }))).toBe(true);
    const conNesting = ctxBase({
      cfg: {
        paramsPasoJson: {
          nestingConfig: { costing: { strategy: "consumed-length" } },
        },
      },
      slot: slotCtx({}),
    });
    expect(costeo.visible(conNesting)).toBe(false);
  });

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
      "Lo hace un proveedor — declarado en el paso",
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
      familia: { codigo: "impresion_por_area" },
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
      "Costeo: largo consumido · panelizado",
    );
    expect(acomodado.origenValor(granFormato)).toBe("config");
  });
});
