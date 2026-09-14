import { resolverEstacionDePaso as resolverBackend } from "../../apps/api/src/eta/motor/tablero-tipos";
import { describe, expect, it } from "vitest";

import {
  bucketKanbanProduccion,
  codigoVisibleItem,
  debeRefrescarTablero,
  esItemEnCursoOperativo,
  etiquetaPasoKanban,
  itemBloqueado,
  itemEsperandoDependencias,
  itemIniciado,
  lineaEstado,
  resolverEstacionDePaso,
  textoEntregaRelativa,
  type TableroItemData,
} from "@/lib/tablero-produccion";

describe("clasificación operativa del tablero", () => {
  it("distingue el paso que está corriendo del próximo paso pendiente", () => {
    expect(etiquetaPasoKanban("en_curso")).toBe("Paso en curso:");
    expect(etiquetaPasoKanban("pausado")).toBe("Paso pausado:");
    expect(etiquetaPasoKanban("pendiente")).toBe("Próximo paso:");
    expect(etiquetaPasoKanban("bloqueado")).toBe("Próximo paso:");
  });

  it("identifica cada item con un único código compacto de OT", () => {
    expect(codigoVisibleItem("OT-2026-0041", 0)).toBe("OT-0041-A");
    expect(codigoVisibleItem("OT-2026-0041", 1)).toBe("OT-0041-B");
  });

  it("un pendiente futuro no cuenta como trabajo en curso", () => {
    expect(
      esItemEnCursoOperativo({
        iniciado: false,
        terminado: false,
        bloqueado: false,
        atrasado: false,
      }),
    ).toBe(false);
  });

  it("sólo considera en curso un item iniciado, vivo y sin alertas", () => {
    expect(
      esItemEnCursoOperativo({
        iniciado: true,
        terminado: false,
        bloqueado: false,
        atrasado: false,
      }),
    ).toBe(true);
  });

  it("Kanban prioriza el atraso aunque el trabajo no haya iniciado", () => {
    expect(
      bucketKanbanProduccion({
        iniciado: false,
        atrasado: true,
        diasEntrega: -3,
      }),
    ).toBe("delayed");
  });

  it("el Kanban omite los items cuyo trabajo ya terminó", () => {
    expect(
      bucketKanbanProduccion({
        iniciado: true,
        terminado: true,
        atrasado: false,
        diasEntrega: 2,
      }),
    ).toBeNull();
  });

  it("considera iniciado un tercerizado desde que fue pedido al proveedor", () => {
    const base = {
      sinRuta: false,
      pasos: [
        {
          id: "bastidor",
          indice: 0,
          estado: "pendiente",
          tipoEjecucion: "tercerizado",
        },
      ],
    } as TableroItemData;

    expect(
      itemIniciado({
        ...base,
        pasos: [{ ...base.pasos[0], estadoCompra: "pendiente" }],
      }),
    ).toBe(false);
    expect(
      itemIniciado({
        ...base,
        pasos: [{ ...base.pasos[0], estadoCompra: "pedido" }],
      }),
    ).toBe(true);
  });

  it("expresa las entregas vencidas como atraso y no como tiempo restante", () => {
    expect(textoEntregaRelativa(-15, "Vencida 15d")).toBe("15 días de atraso");
    expect(textoEntregaRelativa(0, "Hoy")).toBe("vence hoy");
  });

  it("pausa el refresco con pestaña oculta, mutaciones o drag activo", () => {
    expect(
      debeRefrescarTablero({
        pestanaOculta: false,
        mutacionesEnCurso: 0,
        arrastreActivo: false,
      }),
    ).toBe(true);
    expect(
      debeRefrescarTablero({
        pestanaOculta: true,
        mutacionesEnCurso: 0,
        arrastreActivo: false,
      }),
    ).toBe(false);
    expect(
      debeRefrescarTablero({
        pestanaOculta: false,
        mutacionesEnCurso: 1,
        arrastreActivo: false,
      }),
    ).toBe(false);
    expect(
      debeRefrescarTablero({
        pestanaOculta: false,
        mutacionesEnCurso: 0,
        arrastreActivo: true,
      }),
    ).toBe(false);
  });

  it("no confunde un DAG bloqueado por componentes con un item completado", () => {
    const item = {
      sinRuta: false,
      pasos: [
        {
          id: "ensamble",
          indice: 0,
          nodoClave: "etapa:ensamble",
          estado: "pendiente",
          predecesoresSatisfechos: false,
          predecesorPasoIds: ["paso-componente"],
        },
      ],
    } as TableroItemData;

    expect(lineaEstado(item)).toBe(
      "Esperando componentes o pasos anteriores",
    );
    expect(itemBloqueado(item)).toBe(false);
    expect(itemEsperandoDependencias(item)).toBe(true);
  });

  it("presenta un nodo tercerizado como compra y no como trabajo por iniciar", () => {
    const item = {
      sinRuta: false,
      pasos: [
        {
          id: "bastidor",
          indice: 0,
          nodoClave: "paso:bastidor",
          estado: "pendiente",
          predecesoresSatisfechos: true,
          tipoEjecucion: "tercerizado",
          estadoCompra: "pedido",
        },
      ],
    } as TableroItemData;

    expect(lineaEstado(item)).toBe("Pedido al proveedor");
  });
});

type Est = {
  id: string; activo: boolean; familias: string[];
  maquinas: Array<{ id?: string | null; activo?: boolean; centroCostoId: string | null }>;
  reglas?: Array<{ tipo: string; valor: string }>;
};
function est(id: string, over: Partial<Est> = {}): Est {
  return { id, activo: true, familias: [], maquinas: [], ...over };
}
type Paso = { familiaCodigo: string; plantillaCodigo?: string | null; centroCostoId: string | null; maquinaId?: string | null; tecnologia?: string | null; requiereMaquina?: boolean; tipoEjecucion?: string };
const paso = (over: Partial<Paso> = {}): Paso => ({ familiaCodigo: "impresion", centroCostoId: null, ...over });
const maquina = (id: string, activo = true) => ({ id, activo, centroCostoId: "cc-compartido" });

// El mismo contrato protege tablero, ETA y permisos de ejecución backend.
for (const [nombre, resolver] of [["tablero", resolverEstacionDePaso], ["ETA backend", resolverBackend]] as const) {
  describe(`asignación de estaciones — ${nombre}`, () => {
    it("distingue dos máquinas de la misma tecnología y centro de costo", () => {
      const estaciones = [est("Digital A", { maquinas: [maquina("A")] }), est("Digital B", { maquinas: [maquina("B")] })];
      expect(resolver(estaciones, paso({ maquinaId: "B", tecnologia: "laser" }))?.id).toBe("Digital B");
    });
    it("una máquina sin estación no cae en reglas de tecnología, paso ni familia", () => {
      const estaciones = [est("Manual", { familias: ["impresion"], reglas: [{ tipo: "paso", valor: "impresion" }, { tipo: "tecnologia", valor: "uv" }] })];
      expect(resolver(estaciones, paso({ maquinaId: "sin-asignar", tecnologia: "uv" }))).toBeNull();
    });
    it("una estación inactiva o máquina deshabilitada no reciben tareas", () => {
      const manual = est("Manual", { familias: ["impresion"] });
      expect(resolver([manual, est("Inactiva", { activo: false, maquinas: [maquina("A")] })], paso({ maquinaId: "A" }))).toBeNull();
      expect(resolver([manual, est("Inactiva", { maquinas: [maquina("A", false)] })], paso({ maquinaId: "A" }))).toBeNull();
    });
    it("un paso histórico que exige máquina no se confunde con uno manual", () => {
      const estaciones = [est("Manual", { familias: ["impresion"] })];
      expect(resolver(estaciones, paso({ requiereMaquina: true }))).toBeNull();
      expect(resolver(estaciones, paso({ tecnologia: "uv" }))).toBeNull();
    });
    it("una estación con máquinas también puede recibir pasos manuales", () => {
      const taller = est("Taller", { maquinas: [maquina("A")], familias: ["embalaje"] });
      expect(resolver([taller], paso({ familiaCodigo: "embalaje" }))?.id).toBe("Taller");
    });
    it("el paso propio prevalece sobre su plantilla, independientemente del orden", () => {
      const plantilla = est("General", { reglas: [{ tipo: "paso", valor: "diseno_grafico" }] });
      const propia = est("Diseño especial", { familias: ["uuid-propio"] });
      for (const estaciones of [[plantilla, propia], [propia, plantilla]]) {
        expect(resolver(estaciones, paso({ familiaCodigo: "uuid-propio", plantillaCodigo: "diseno_grafico" }))?.id).toBe("Diseño especial");
      }
      expect(resolver([plantilla], paso({ familiaCodigo: "otro-uuid", plantillaCodigo: "diseno_grafico" }))?.id).toBe("General");
    });
    it("dos asignaciones manuales ambiguas quedan sin estación", () => {
      const a = est("A", { familias: ["embalaje"], maquinas: [maquina("A")] });
      const b = est("B", { familias: ["embalaje"] });
      expect(resolver([a, b], paso({ familiaCodigo: "embalaje" }))).toBeNull();
      expect(resolver([b, a], paso({ familiaCodigo: "embalaje" }))).toBeNull();
    });
    it("respeta las antiguas asignaciones explícitas de pasos manuales", () => {
      const a = est("A", { familias: ["embalaje"] });
      const b = est("B", { reglas: [{ tipo: "paso", valor: "embalaje" }] });
      expect(resolver([a, b], paso({ familiaCodigo: "embalaje" }))?.id).toBe("B");
    });
    it("los tercerizados permanecen en el flujo de proveedores", () => {
      expect(resolver([est("Manual", { familias: ["impresion"] })], paso({ tipoEjecucion: "tercerizado" }))).toBeNull();
    });
  });
}
