/**
 * Tests del motor de flujo (src/lib/flujo-produccion.ts).
 *
 * Este motor calcula TODAS las fechas estimadas del sistema: la ETA por
 * item del tablero y la demora sugerida del cotizador. Es puro y acepta
 * `ahora` como parámetro, así que los tests son 100% deterministas.
 *
 * La red existe por un caso real: la regla "un paso tercerizado suma
 * plazoProveedorDias a la ETA" (D14) estaba escrita en el diseño pero
 * nunca implementada, y el cotizador prometía fechas imposibles sin
 * avisar. Los tests de tercerización de acá abajo son esa regla.
 * Ver docs/simulacion-flujo-diseno.md
 */

import { describe, expect, it } from "vitest";

import type { CalendarioEstacion, Estacion } from "@/lib/estaciones";
import { SIN_ESTACION_KEY } from "@/lib/tablero-produccion";
import type { TableroItemData, TableroPasoData } from "@/lib/tablero-produccion";
import {
  avanzarAVentana,
  estimarDemoraNuevos,
  PROVEEDOR_KEY,
  restarMinutosLaborales,
  simularFlujo,
  sumarDiasHabiles,
  sumarMinutosLaborales,
} from "@/lib/flujo-produccion";

// ── Fixtures ─────────────────────────────────────────────────────────────

/** L–V 08:00–17:00 (9 h por día), sábado y domingo cerrados. */
const CALENDARIO: CalendarioEstacion = {
  dias: {
    lun: { desde: "08:00", hasta: "17:00" },
    mar: { desde: "08:00", hasta: "17:00" },
    mie: { desde: "08:00", hasta: "17:00" },
    jue: { desde: "08:00", hasta: "17:00" },
    vie: { desde: "08:00", hasta: "17:00" },
    sab: null,
    dom: null,
  },
};

/** Lunes 20 de julio de 2026, 08:00 — justo al abrir el taller. */
const AHORA = new Date(2026, 6, 20, 8, 0);

/** Atajo para fechas de julio 2026 en hora local. */
const jul = (dia: number, hora = 0, minuto = 0) => new Date(2026, 6, dia, hora, minuto);

function estacion(overrides: Partial<Estacion> & Pick<Estacion, "id">): Estacion {
  return {
    nombre: overrides.id,
    descripcion: "",
    activo: true,
    etapa: "impresion",
    icono: null,
    capacidadConcurrente: 1,
    tiempoPreparacionMin: null,
    calendario: CALENDARIO,
    familias: [],
    empleados: [],
    maquinas: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function paso(
  indice: number,
  familiaCodigo: string,
  overrides: Partial<TableroPasoData> = {},
): TableroPasoData {
  return {
    id: `paso-${indice}-${familiaCodigo}`,
    indice,
    nombre: familiaCodigo,
    familiaCodigo,
    categoriaFamilia: "",
    centroCostoId: null,
    centroCostoNombre: null,
    duracionEstimadaMin: null,
    estado: "pendiente",
    motivoBloqueo: null,
    iniciadoEl: null,
    completadoEl: null,
    modoRegistro: "cronometro",
    tiempoRealMin: null,
    tiempoFuente: null,
    iniciadoPorNombre: null,
    completadoPorNombre: null,
    tramoAbierto: null,
    motivoPausa: null,
    tiempoAcumuladoMin: 0,
    mesaEsMia: false,
    mesaUsuarioNombre: null,
    tipoEjecucion: "interno",
    proveedorNombre: null,
    plazoProveedorDias: null,
    estadoCompra: null,
    ...overrides,
  };
}

/** Paso interno con duración propia en minutos. */
const interno = (indice: number, familia: string, minutos: number) =>
  paso(indice, familia, { duracionEstimadaMin: minutos });

/**
 * Paso tercerizado con su lead time de proveedor en días (null = sin cargar).
 * `minutos` carga una duración interna que el motor debe IGNORAR: sirve para
 * que los tests distingan "se programó como tercerizado" de "se programó
 * como paso interno y dio lo mismo de casualidad".
 */
const tercerizado = (indice: number, familia: string, dias: number | null, minutos: number | null = null) =>
  paso(indice, familia, {
    tipoEjecucion: "tercerizado",
    plazoProveedorDias: dias,
    duracionEstimadaMin: minutos,
  });

function item(
  id: string,
  pasos: TableroPasoData[],
  overrides: Partial<TableroItemData> = {},
): TableroItemData {
  return {
    id,
    ordenId: `orden-${id}`,
    ordenNumero: `OT-${id}`,
    ordenEstado: "produccion",
    itemIndice: 1,
    codigo: id,
    nombre: id,
    clienteNombre: "",
    vendedorNombre: "",
    cantidad: 1,
    cantidadUnidad: "u",
    specs: [],
    fechaEntrega: null,
    sinRuta: false,
    pasos,
    ...overrides,
  };
}

/** Un taller de una sola estación de impresión con un puesto. */
const TALLER = [estacion({ id: "e1", familias: ["impresion"] })];

function correr(
  items: TableroItemData[],
  opciones: {
    estaciones?: Estacion[];
    medianas?: Map<string, number>;
    noLaborables?: Set<string>;
    tiempoEntrePasosMin?: number;
  } = {},
) {
  return simularFlujo({
    items,
    estaciones: opciones.estaciones ?? TALLER,
    medianas: opciones.medianas ?? new Map(),
    ahora: AHORA,
    noLaborables: opciones.noLaborables ?? new Set(),
    tiempoEntrePasosMin: opciones.tiempoEntrePasosMin ?? 0,
  });
}

/** Máquina de la estación, identificada por su centro de costo. */
const maquina = (centroCostoId: string, i = 0) => ({
  id: `maq-${centroCostoId}-${i}`,
  codigo: `M${i}`,
  nombre: `maquina-${centroCostoId}-${i}`,
  centroCostoId,
});

/** Paso interno que corre en la máquina de ese centro de costo. */
const enMaquina = (indice: number, familia: string, minutos: number, cc: string) =>
  paso(indice, familia, { duracionEstimadaMin: minutos, centroCostoId: cc });

// ── Aritmética de calendario ─────────────────────────────────────────────

describe("avanzarAVentana", () => {
  it("devuelve el mismo instante si ya cae dentro de la franja", () => {
    expect(avanzarAVentana(CALENDARIO, jul(20, 10, 30))).toEqual(jul(20, 10, 30));
  });

  it("empuja al inicio de la franja si es antes de abrir", () => {
    expect(avanzarAVentana(CALENDARIO, jul(20, 6, 0))).toEqual(jul(20, 8, 0));
  });

  it("salta el fin de semana: sábado a la tarde cae en lunes al abrir", () => {
    expect(avanzarAVentana(CALENDARIO, jul(25, 15, 0))).toEqual(jul(27, 8, 0));
  });

  it("salta los feriados del taller", () => {
    const feriado = new Set(["2026-07-20"]);
    expect(avanzarAVentana(CALENDARIO, jul(20, 9, 0), feriado)).toEqual(jul(21, 8, 0));
  });

  it("devuelve null si no hay ninguna ventana en el horizonte (D8)", () => {
    // Franja degenerada: el día existe pero no tiene minutos utilizables.
    const imposible: CalendarioEstacion = {
      dias: { ...CALENDARIO.dias, lun: { desde: "08:00", hasta: "08:00" } },
    };
    const soloLunes: CalendarioEstacion = {
      dias: { ...imposible.dias, mar: null, mie: null, jue: null, vie: null },
    };
    expect(avanzarAVentana(soloLunes, jul(20, 8, 0))).toBeNull();
  });
});

describe("sumarMinutosLaborales", () => {
  it("suma dentro de la misma jornada", () => {
    expect(sumarMinutosLaborales(CALENDARIO, jul(20, 8, 0), 60)).toEqual(jul(20, 9, 0));
  });

  it("parte el trabajo que no entra en el día y sigue al siguiente", () => {
    // 16:00 lunes + 120 min: 60 min quedan el lunes, 60 pasan al martes.
    expect(sumarMinutosLaborales(CALENDARIO, jul(20, 16, 0), 120)).toEqual(jul(21, 9, 0));
  });

  it("cruza el fin de semana sin contar sábado ni domingo", () => {
    // Viernes 16:00 + 120 min: 60 el viernes, 60 el lunes.
    expect(sumarMinutosLaborales(CALENDARIO, jul(24, 16, 0), 120)).toEqual(jul(27, 9, 0));
  });

  it("avanza a la ventana antes de empezar a contar", () => {
    expect(sumarMinutosLaborales(CALENDARIO, jul(20, 5, 0), 30)).toEqual(jul(20, 8, 30));
  });
});

describe("sumarDiasHabiles", () => {
  it("preserva la hora del día", () => {
    expect(sumarDiasHabiles(jul(20, 14, 30), 1)).toEqual(jul(21, 14, 30));
  });

  it("con 0 días devuelve la fecha tal cual", () => {
    expect(sumarDiasHabiles(jul(20, 8, 0), 0)).toEqual(jul(20, 8, 0));
  });

  it("no cuenta sábado ni domingo", () => {
    // Viernes + 1 hábil = lunes.
    expect(sumarDiasHabiles(jul(24, 8, 0), 1)).toEqual(jul(27, 8, 0));
  });

  it("saltea feriados además del fin de semana", () => {
    // Lunes + 2 hábiles, con el miércoles feriado: martes y jueves.
    expect(sumarDiasHabiles(jul(20, 8, 0), 2, new Set(["2026-07-22"]))).toEqual(jul(23, 8, 0));
  });
});

// ── Scheduling de pasos internos ─────────────────────────────────────────

describe("simularFlujo · pasos internos", () => {
  it("programa un paso simple contra el calendario de su estación", () => {
    const { porItem } = correr([item("A", [interno(0, "impresion", 60)])]);

    expect(porItem.get("A")).toEqual({
      finEstimado: jul(20, 9, 0),
      sinEstimar: false,
      parcial: false,
      asumeDesbloqueo: false,
    });
  });

  it("usa la mediana de la familia cuando el paso no trae duración propia", () => {
    const { porItem } = correr([item("A", [paso(0, "impresion")])], {
      medianas: new Map([["impresion", 90]]),
    });

    expect(porItem.get("A")?.finEstimado).toEqual(jul(20, 9, 30));
  });

  it("marca sinEstimar cuando no hay duración ni mediana (D6)", () => {
    const { porItem } = correr([item("A", [paso(0, "impresion")])]);

    expect(porItem.get("A")?.sinEstimar).toBe(true);
    expect(porItem.get("A")?.finEstimado).toBeNull();
  });

  it("trata la duración 0 como duración conocida, no como sin estimar", () => {
    // Caso real (OT-2026-0025 · A): el motor materializa "Material sin
    // impresión" con tiempoCero, y ese 0 se leía como "no sé cuánto tarda".
    // Sin mediana para su familia, un solo paso de 0 min dejaba sin ETA a
    // toda la orden aunque el resto de la ruta estuviera perfectamente
    // estimada.
    const { porItem } = correr([
      item("A", [interno(0, "impresion", 0), interno(1, "impresion", 60)]),
    ]);

    const eta = porItem.get("A");
    expect(eta?.sinEstimar).toBe(false);
    expect(eta?.finEstimado).toEqual(jul(20, 9, 0));
  });

  it("un paso de 0 min no toma la mediana de su familia", () => {
    // Peor que quedarse sin ETA: inventarle a un paso que NO imprime el
    // tiempo mediano de los que sí imprimen.
    const { porItem } = correr([item("A", [interno(0, "impresion", 0)])], {
      medianas: new Map([["impresion", 240]]),
    });

    expect(porItem.get("A")?.finEstimado).toEqual(jul(20, 8, 0));
  });

  it("no le inventa ETA a un item sin ventana en el horizonte (D8)", () => {
    const soloLunes: CalendarioEstacion = {
      dias: {
        lun: { desde: "08:00", hasta: "08:00" },
        mar: null,
        mie: null,
        jue: null,
        vie: null,
        sab: null,
        dom: null,
      },
    };
    const { porItem } = correr([item("A", [interno(0, "impresion", 60)])], {
      estaciones: [estacion({ id: "e1", familias: ["impresion"], calendario: soloLunes })],
    });

    const eta = porItem.get("A");
    expect(eta?.finEstimado).toBeNull();
    // Horizonte agotado NO es lo mismo que "no se puede estimar": el dato
    // está, lo que falla es el calendario.
    expect(eta?.sinEstimar).toBe(false);
  });
});

describe("simularFlujo · capacidad finita", () => {
  it("hace esperar al segundo item cuando la estación tiene un solo puesto", () => {
    const { porItem } = correr([
      item("1", [interno(0, "impresion", 120)]),
      item("2", [interno(0, "impresion", 120)]),
    ]);

    // OT-1 gana el desempate (mismo start, sin urgencia ni entrega) y OT-2
    // arranca recién cuando se libera el puesto.
    expect(porItem.get("1")?.finEstimado).toEqual(jul(20, 10, 0));
    expect(porItem.get("2")?.finEstimado).toEqual(jul(20, 12, 0));
  });

  it("con dos puestos los dos items corren en paralelo", () => {
    const { porItem } = correr(
      [item("1", [interno(0, "impresion", 120)]), item("2", [interno(0, "impresion", 120)])],
      { estaciones: [estacion({ id: "e1", familias: ["impresion"], capacidadConcurrente: 2 })] },
    );

    expect(porItem.get("1")?.finEstimado).toEqual(jul(20, 10, 0));
    expect(porItem.get("2")?.finEstimado).toEqual(jul(20, 10, 0));
  });
});

// ── Pasos tercerizados (D14) ─────────────────────────────────────────────

describe("simularFlujo · pasos tercerizados", () => {
  it("suma el plazo del proveedor después de un paso interno", () => {
    const { porItem } = correr([
      item("A", [interno(0, "impresion", 60), tercerizado(1, "offset", 3)]),
    ]);

    // Interno termina lunes 09:00; +3 días hábiles → jueves 09:00.
    expect(porItem.get("A")?.finEstimado).toEqual(jul(23, 9, 0));
    expect(porItem.get("A")?.sinEstimar).toBe(false);
  });

  it("empuja el paso interno que viene DESPUÉS del proveedor", () => {
    const { porItem, llegadasPorEstacion } = correr([
      item("A", [tercerizado(0, "offset", 3), interno(1, "impresion", 60)]),
    ]);

    // El proveedor tarda 3 hábiles (jueves 08:00) y recién ahí entra al taller.
    expect(porItem.get("A")?.finEstimado).toEqual(jul(23, 9, 0));

    // El paso interno llega a la estación el jueves, no hoy: esa es la
    // "carga en camino" con timing real.
    const llegadas = llegadasPorEstacion.get("e1") ?? [];
    expect(llegadas).toHaveLength(1);
    expect(llegadas[0].llegada).toEqual(jul(23, 8, 0));
  });

  it("drena dos tercerizados seguidos en cadena", () => {
    const { porItem } = correr([
      item("A", [tercerizado(0, "offset", 2), tercerizado(1, "laminado", 1)]),
    ]);

    // Lunes + 2 hábiles = miércoles; + 1 hábil = jueves.
    expect(porItem.get("A")?.finEstimado).toEqual(jul(23, 8, 0));
  });

  it("marca sinEstimar si el tercerizado no tiene plazo cargado", () => {
    // El paso trae duración interna y hasta mediana: si el motor lo tratara
    // como interno saldría una ETA prolija — y sería una fecha inventada,
    // porque nadie sabe cuánto tarda el proveedor.
    const { porItem } = correr(
      [item("A", [interno(0, "impresion", 60), tercerizado(1, "offset", null, 30)])],
      { medianas: new Map([["offset", 30]]) },
    );

    const eta = porItem.get("A");
    expect(eta?.sinEstimar).toBe(true);
    expect(eta?.finEstimado).toBeNull();
  });

  it("cuenta el plazo en días hábiles: cruza fin de semana y feriados", () => {
    const { porItem } = correr([item("A", [tercerizado(0, "offset", 5)])]);
    // Lunes + 5 hábiles saltando sáb/dom → lunes siguiente.
    expect(porItem.get("A")?.finEstimado).toEqual(jul(27, 8, 0));

    const conFeriado = correr([item("A", [tercerizado(0, "offset", 5)])], {
      noLaborables: new Set(["2026-07-22"]),
    });
    // El miércoles feriado corre todo un día más.
    expect(conFeriado.porItem.get("A")?.finEstimado).toEqual(jul(28, 8, 0));
  });

  it("NO toma la mediana de su familia aunque exista", () => {
    // La mediana de 'offset' se midió sobre pasos INTERNOS: no dice nada
    // del proveedor. Con plazo 0 el item sale ya; si tomara la mediana
    // terminaría 480 minutos después.
    const { porItem } = correr([item("A", [tercerizado(0, "offset", 0)])], {
      medianas: new Map([["offset", 480]]),
    });

    expect(porItem.get("A")?.finEstimado).toEqual(AHORA);
  });

  it("NO ocupa un puesto del taller: el proveedor trabaja en paralelo", () => {
    const { porItem, llegadasPorEstacion } = correr([
      // El tercerizado es de la familia 'impresion', o sea que rutea a e1.
      item("1", [tercerizado(0, "impresion", 3)]),
      item("2", [interno(0, "impresion", 120)]),
    ]);

    // El item interno arranca a las 08:00 igual: el tercerizado nunca tomó
    // el único puesto de la estación.
    expect(porItem.get("2")?.finEstimado).toEqual(jul(20, 10, 0));
    expect(porItem.get("1")?.finEstimado).toEqual(jul(23, 8, 0));

    // Y no aparece como carga que llega a la estación.
    const llegadas = llegadasPorEstacion.get("e1") ?? [];
    expect(llegadas.map((l) => l.itemId)).not.toContain("1");
  });

  it("no marca parcial: el plazo del proveedor es un dato, no un supuesto", () => {
    // 'offset' no es familia de ninguna estación, así que un paso interno
    // caería al bucket sin estación y marcaría parcial. El tercerizado no
    // pasa por ahí: nunca busca estación.
    const { porItem } = correr([item("A", [tercerizado(0, "offset", 3, 60)])]);

    expect(porItem.get("A")?.parcial).toBe(false);
    expect(porItem.get("A")?.finEstimado).toEqual(jul(23, 8, 0));
  });
});

// ── Demora sugerida del cotizador ────────────────────────────────────────

describe("estimarDemoraNuevos", () => {
  it("estima un trabajo nuevo contra un taller vacío", () => {
    const demoras = estimarDemoraNuevos({
      nuevos: [{ id: "nuevo", pasos: [{ familiaCodigo: "impresion", centroCostoId: null, duracionMin: 60 }] }],
      enCola: [],
      estaciones: TALLER,
      medianas: new Map(),
      ahora: AHORA,
    });

    expect(demoras.get("nuevo")?.finEstimado).toEqual(jul(20, 9, 0));
  });

  it("hace esperar al trabajo nuevo detrás de la cola real (D9)", () => {
    const demoras = estimarDemoraNuevos({
      nuevos: [{ id: "nuevo", pasos: [{ familiaCodigo: "impresion", centroCostoId: null, duracionMin: 60 }] }],
      enCola: [item("1", [interno(0, "impresion", 120)])],
      estaciones: TALLER,
      medianas: new Map(),
      ahora: AHORA,
    });

    // El comprometido ocupa 08:00–10:00; lo nuevo pierde el empate y sale 11:00.
    expect(demoras.get("nuevo")?.finEstimado).toEqual(jul(20, 11, 0));
  });

  it("suma el plazo del proveedor a la fecha que se promete", () => {
    const demoras = estimarDemoraNuevos({
      nuevos: [
        {
          id: "nuevo",
          pasos: [
            { familiaCodigo: "impresion", centroCostoId: null, duracionMin: 60 },
            { familiaCodigo: "offset", centroCostoId: null, duracionMin: null, tercerizado: true, plazoProveedorDias: 3 },
          ],
        },
      ],
      enCola: [],
      estaciones: TALLER,
      medianas: new Map(),
      ahora: AHORA,
    });

    expect(demoras.get("nuevo")?.finEstimado).toEqual(jul(23, 9, 0));
  });

  it("avisa (sinEstimar) en vez de prometer una fecha inventada si falta el plazo", () => {
    const demoras = estimarDemoraNuevos({
      nuevos: [
        {
          id: "nuevo",
          pasos: [
            { familiaCodigo: "impresion", centroCostoId: null, duracionMin: 60 },
            // Con duración interna cargada: tratado como paso propio daría
            // una fecha prolija e igualmente falsa.
            { familiaCodigo: "offset", centroCostoId: null, duracionMin: 30, tercerizado: true },
          ],
        },
      ],
      enCola: [],
      estaciones: TALLER,
      medianas: new Map([["offset", 30]]),
      ahora: AHORA,
    });

    const eta = demoras.get("nuevo");
    expect(eta?.sinEstimar).toBe(true);
    expect(eta?.finEstimado).toBeNull();
  });
});

// ── La traza: el plan, no sólo su resultado ──────────────────────────────

describe("simularFlujo · traza", () => {
  it("anota un bloque por cada paso colocado, en orden de decisión", () => {
    const { traza } = correr([
      item("A", [interno(0, "impresion", 60), interno(1, "impresion", 30)]),
      item("B", [interno(0, "impresion", 45)]),
    ]);

    expect(traza).toHaveLength(3);
    expect(traza.map((p) => p.orden)).toEqual([0, 1, 2]);
    // Un solo puesto: el orden de decisión es el de ocupación del puesto.
    expect(traza.map((p) => p.itemId)).toEqual(["A", "B", "A"]);
  });

  it("los bloques encadenan: el fin de uno es el inicio del siguiente", () => {
    const { traza } = correr([
      item("A", [interno(0, "impresion", 60), interno(1, "impresion", 30)]),
    ]);

    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[0].fin).toEqual(jul(20, 9, 0));
    expect(traza[1].inicio).toEqual(jul(20, 9, 0));
    expect(traza[1].fin).toEqual(jul(20, 9, 30));
  });

  it("mide la espera por un puesto ocupado", () => {
    const { traza } = correr([
      item("A", [interno(0, "impresion", 120)]),
      item("B", [interno(0, "impresion", 60)]),
    ]);

    const b = traza.find((p) => p.itemId === "B")!;
    // B estaba listo a las 08:00 pero el único puesto se libera a las 10:00.
    expect(b.esperaMin).toBe(120);
    expect(traza.find((p) => p.itemId === "A")!.esperaMin).toBe(0);
  });

  it("registra el tercerizado en su propio carril, con el plazo", () => {
    const { traza } = correr([item("A", [tercerizado(0, "impresion", 3)])]);

    expect(traza).toHaveLength(1);
    expect(traza[0].tercerizado).toBe(true);
    expect(traza[0].estacionKey).toBe(PROVEEDOR_KEY);
    expect(traza[0].plazoDias).toBe(3);
    // No consume minutos de taller: su costo es el lead time.
    expect(traza[0].duracionMin).toBeNull();
  });

  it("marca parcial el paso que cae en el carril sin estación", () => {
    const { traza } = correr([item("A", [interno(0, "familia-huerfana", 30)])]);

    expect(traza[0].estacionKey).toBe(SIN_ESTACION_KEY);
    expect(traza[0].parcial).toBe(true);
  });

  it("no anota los pasos que no se pueden estimar", () => {
    const { traza, porItem } = correr([
      item("A", [interno(0, "impresion", 30), paso(1, "impresion")]),
    ]);

    // El primero sí entra al plan; el segundo corta la ruta.
    expect(traza).toHaveLength(1);
    expect(porItem.get("A")?.sinEstimar).toBe(true);
  });

  it("cuenta los candidatos que competían por el puesto", () => {
    const { traza } = correr([
      item("A", [interno(0, "impresion", 60)]),
      item("B", [interno(0, "impresion", 60)]),
      item("C", [interno(0, "impresion", 60)]),
    ]);

    expect(traza[0].candidatos).toBe(3);
    expect(traza[1].candidatos).toBe(2);
    expect(traza[2].candidatos).toBe(1);
  });

  it("el fin del último bloque de un item coincide con su ETA", () => {
    const { traza, porItem } = correr([
      item("A", [interno(0, "impresion", 60), interno(1, "impresion", 30)]),
    ]);

    const ultimo = traza.filter((p) => p.itemId === "A").at(-1)!;
    expect(ultimo.fin).toEqual(porItem.get("A")!.finEstimado);
  });
});

// ── Puestos vs máquinas ──────────────────────────────────────────────────

describe("simularFlujo · la máquina es un recurso aparte del puesto", () => {
  /** 2 operarios, pero una sola guillotina y una sola laminadora. */
  const CORTE = [
    estacion({
      id: "corte",
      familias: ["guillotina", "laminado"],
      capacidadConcurrente: 2,
      maquinas: [maquina("cc-guillotina"), maquina("cc-laminadora")],
    }),
  ];

  it("dos pasos de la misma máquina se serializan aunque sobren puestos", () => {
    const { traza } = correr(
      [
        item("A", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
        item("B", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
      ],
      { estaciones: CORTE },
    );

    // Hay 2 puestos libres, pero una sola guillotina: van en fila.
    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[1].inicio).toEqual(jul(20, 9, 0));
  });

  it("pasos de máquinas distintas sí usan los dos puestos en paralelo", () => {
    const { traza } = correr(
      [
        item("A", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
        item("B", [enMaquina(0, "laminado", 60, "cc-laminadora")]),
      ],
      { estaciones: CORTE },
    );

    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[1].inicio).toEqual(jul(20, 8, 0));
  });

  it("con dos guillotinas los dos pasos arrancan juntos", () => {
    const dos = [
      estacion({
        id: "corte",
        familias: ["guillotina"],
        capacidadConcurrente: 2,
        maquinas: [maquina("cc-guillotina", 0), maquina("cc-guillotina", 1)],
      }),
    ];
    const { traza } = correr(
      [
        item("A", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
        item("B", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
      ],
      { estaciones: dos },
    );

    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[1].inicio).toEqual(jul(20, 8, 0));
  });

  it("el puesto sigue mandando: 3 máquinas pero 1 puesto no paralelizan", () => {
    const cuelloDePuesto = [
      estacion({
        id: "corte",
        familias: ["guillotina"],
        capacidadConcurrente: 1,
        maquinas: [
          maquina("cc-guillotina", 0),
          maquina("cc-guillotina", 1),
          maquina("cc-guillotina", 2),
        ],
      }),
    ];
    const { traza } = correr(
      [
        item("A", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
        item("B", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
      ],
      { estaciones: cuelloDePuesto },
    );

    expect(traza[1].inicio).toEqual(jul(20, 9, 0));
  });

  it("un paso sin centro de costo no toma máquina: sólo compite por puesto", () => {
    const { traza } = correr(
      [
        item("A", [interno(0, "guillotina", 60)]),
        item("B", [interno(0, "guillotina", 60)]),
      ],
      { estaciones: CORTE },
    );

    // Trabajo manual en la estación: los 2 puestos van en paralelo.
    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[1].inicio).toEqual(jul(20, 8, 0));
  });
});

// ── Tiempo de preparación entre pasos ────────────────────────────────────

describe("simularFlujo · tiempo de preparación", () => {
  it("corre el arranque del trabajo, no sólo el fin", () => {
    const { traza, porItem } = correr([item("A", [interno(0, "impresion", 60)])], {
      tiempoEntrePasosMin: 15,
    });

    // El puesto se toma a las 08:00 (el operario sale a buscar el material),
    // pero el trabajo en sí termina 15 min más tarde que sin preparación.
    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[0].preparacionMin).toBe(15);
    expect(porItem.get("A")?.finEstimado).toEqual(jul(20, 9, 15));
  });

  it("ocupa el puesto: el trabajo siguiente espera la preparación del anterior", () => {
    const { traza } = correr(
      [
        item("A", [interno(0, "impresion", 60)]),
        item("B", [interno(0, "impresion", 60)]),
      ],
      { tiempoEntrePasosMin: 15 },
    );

    // Un solo puesto ocupado 15 + 60: B no arranca hasta las 09:15.
    expect(traza[1].inicio).toEqual(jul(20, 9, 15));
  });

  it("la estación puede pisar el default del tenant", () => {
    const lenta = [
      estacion({ id: "e1", familias: ["impresion"], tiempoPreparacionMin: 45 }),
    ];
    const { traza } = correr([item("A", [interno(0, "impresion", 60)])], {
      estaciones: lenta,
      tiempoEntrePasosMin: 5,
    });

    expect(traza[0].preparacionMin).toBe(45);
  });

  it("una estación puede declarar cero y anular el default", () => {
    const inmediata = [
      estacion({ id: "e1", familias: ["impresion"], tiempoPreparacionMin: 0 }),
    ];
    const { traza } = correr([item("A", [interno(0, "impresion", 60)])], {
      estaciones: inmediata,
      tiempoEntrePasosMin: 30,
    });

    expect(traza[0].preparacionMin).toBe(0);
  });

  it("no se le cobra preparación al proveedor ni a lo que ya está en curso", () => {
    const { traza } = correr(
      [item("A", [tercerizado(0, "impresion", 2)])],
      { tiempoEntrePasosMin: 20 },
    );

    expect(traza[0].preparacionMin).toBe(0);
  });

  it("la máquina no se ocupa durante la preparación", () => {
    const CORTE = [
      estacion({
        id: "corte",
        familias: ["guillotina"],
        capacidadConcurrente: 2,
        maquinas: [maquina("cc-guillotina")],
      }),
    ];
    const { traza } = correr(
      [
        item("A", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
        item("B", [enMaquina(0, "guillotina", 60, "cc-guillotina")]),
      ],
      { estaciones: CORTE, tiempoEntrePasosMin: 30 },
    );

    // A: puesto 08:00, máquina 08:30–09:30. B tiene el otro puesto libre, así
    // que su preparación (30 min) corre EN PARALELO con el trabajo de A, y
    // sólo espera la máquina: arranca 09:00 y lamina de 09:30 a 10:30.
    expect(traza[1].inicio).toEqual(jul(20, 9, 0));
    expect(traza[1].fin).toEqual(jul(20, 10, 30));
  });
});

describe("restarMinutosLaborales", () => {
  it("resta dentro de la misma jornada", () => {
    expect(restarMinutosLaborales(CALENDARIO, jul(20, 10, 0), 60)).toEqual(jul(20, 9, 0));
  });

  it("es la inversa exacta de sumar", () => {
    const fin = sumarMinutosLaborales(CALENDARIO, jul(20, 16, 0), 120)!;
    expect(restarMinutosLaborales(CALENDARIO, fin, 120)).toEqual(jul(20, 16, 0));
  });

  it("cruza hacia atrás el cierre del día", () => {
    // Martes 08:30 − 60 min: 30 min del martes, 30 del cierre del lunes.
    expect(restarMinutosLaborales(CALENDARIO, jul(21, 8, 30), 60)).toEqual(jul(20, 16, 30));
  });

  it("salta el fin de semana hacia atrás", () => {
    // Lunes 08:30 − 60 min cae en el viernes anterior, no en el domingo.
    expect(restarMinutosLaborales(CALENDARIO, jul(27, 8, 30), 60)).toEqual(jul(24, 16, 30));
  });

  it("con 0 minutos devuelve el mismo instante", () => {
    expect(restarMinutosLaborales(CALENDARIO, jul(20, 10, 0), 0)).toEqual(jul(20, 10, 0));
  });
});

describe("simularFlujo · inicioTrabajo", () => {
  it("es el inicio más el traslado, en minutos laborales", () => {
    const { traza } = correr([item("A", [interno(0, "impresion", 60)])], {
      tiempoEntrePasosMin: 30,
    });

    expect(traza[0].inicio).toEqual(jul(20, 8, 0));
    expect(traza[0].inicioTrabajo).toEqual(jul(20, 8, 30));
  });

  it("si el traslado cruza el cierre, el trabajo sigue al día siguiente", () => {
    // El desempate del scheduler es por número de OT, así que el relleno se
    // llama "A" para que tome el puesto primero. A también paga traslado:
    // 08:00 sale, 08:30 empieza, 500 min → libera el puesto 16:50.
    // "B" arranca 16:50 con 30 min de traslado: 10 min hoy (cierra 17:00) y
    // 20 mañana. Sumar minutos de RELOJ daría 17:20, que no existe.
    const { traza } = correr(
      [
        item("A", [interno(0, "impresion", 500)]),
        item("B", [interno(0, "impresion", 30)]),
      ],
      { tiempoEntrePasosMin: 30 },
    );

    const b = traza.find((t) => t.itemId === "B")!;
    expect(b.inicio).toEqual(jul(20, 16, 50));
    expect(b.inicioTrabajo).toEqual(jul(21, 8, 20));
    expect(b.fin).toEqual(jul(21, 8, 50));
  });
});
