import { describe, expect, it } from "vitest";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import { DEFAULT_MOTOR_CONFIG, hayMaterialVisualPendiente, buildJobContext } from "./agregar-producto-sheet";

function producto(): ProductoDetalle {
  return {
    modoMedidas: "LIBRE", unidadComercial: "unidad", atributosComercialesJson: {}, medidasPredefinidasJson: [],
    rutasAlternativas: [{ id: "ruta", esPreferida: true, ruta: { pasos: [] }, configPasos: ["tapa", "interior"].map((id) => ({
      id, rutaPasoId: `paso-${id}`, rutaPaso: { familiaCodigo: "impresion_laser" }, modoActivacion: "OBLIGATORIO", paramsPasoJson: {}, maquinaM1: null, perfilM1: null,
      slotsMateriales: [{ slotCodigo: "sustrato_principal", modoSeleccion: "COMERCIAL_ELIGE", formula: "por_hoja", candidatos: [{
        materiaPrimaId: "ilustracion", materiaPrima: { nombre: "Papel", templateId: "sustrato_hoja_v1" }, defaultVarianteId: "150", variantes: [150, 250].map((gramaje) => ({ variante: { id: String(gramaje), sku: `P-${gramaje}`, precioReferencia: 10, atributosVarianteJson: { gramaje, ancho: 32.5, alto: 47.5 } } })),
      }] }],
    })) }],
  } as unknown as ProductoDetalle;
}
const config = (seleccionMaterial: Record<string, string> = {}) => ({ ...DEFAULT_MOTOR_CONFIG, seleccionMaterial });

describe("bloqueo de cotización y guardado durante la elección de papel", () => {
  it("un papel pendiente bloquea aunque el otro componente tenga variante; resolverlo habilita", () => {
    const p = producto();
    expect(hayMaterialVisualPendiente(p, config(), 100)).toBe(false);
    expect(hayMaterialVisualPendiente(p, config({ tapa_sustrato_principal: "", interior_sustrato_principal: "250" }), 100)).toBe(true);
    expect(hayMaterialVisualPendiente(p, config({ tapa_sustrato_principal: "150", interior_sustrato_principal: "250" }), 100)).toBe(false);
    expect(hayMaterialVisualPendiente(p, config({ tapa_sustrato_principal: "borrada" }), 100)).toBe(true);
  });

  it("sólo exige papel en opcionales activos, pasos ejecutables y condiciones cumplidas", () => {
    const p = producto(); const paso = p.rutasAlternativas[0].configPasos[0];
    const c = config({ tapa_sustrato_principal: "" });
    paso.modoActivacion = "OPCIONAL";
    expect(hayMaterialVisualPendiente(p, c, 100)).toBe(false);
    expect(hayMaterialVisualPendiente(p, { ...c, opcionalesActivados: { tapa: true } }, 100)).toBe(true);
    paso.modoActivacion = "NO_EJECUTAR";
    expect(hayMaterialVisualPendiente(p, c, 100)).toBe(false);
    paso.modoActivacion = "CONDICIONAL";
    paso.condicionActivacionJson = { ">": [{ var: "cantidad" }, 500] };
    expect(hayMaterialVisualPendiente(p, c, 100)).toBe(false);
    expect(hayMaterialVisualPendiente(p, c, 1000)).toBe(true);
  });

  it("no bloquea papeles automáticos, fijos ni selecciones de otras rutas", () => {
    const p = producto(); const slot = p.rutasAlternativas[0].configPasos[0].slotsMateriales[0];
    const c = config({ tapa_sustrato_principal: "", otraRuta_sustrato_principal: "" });
    slot.modoSeleccion = "MOTOR_ELIGE_AUTO";
    expect(hayMaterialVisualPendiente(p, c, 100)).toBe(false);
    slot.modoSeleccion = "HARDCODED";
    expect(hayMaterialVisualPendiente(p, c, 100)).toBe(false);
    expect(hayMaterialVisualPendiente(null, c, 100)).toBe(false);
  });

  it("no inventa un default cuando hay varias variantes; usa el catálogo activo con todasLasVariantes", () => {
    const p = producto(); const candidato = p.rutasAlternativas[0].configPasos[0].slotsMateriales[0].candidatos[0];
    candidato.defaultVarianteId = null;
    candidato.todasLasVariantes = true;
    candidato.materiaPrima.variantes = candidato.variantes.map((v) => v.variante);
    candidato.variantes = [];
    expect(hayMaterialVisualPendiente(p, config(), 100)).toBe(true);
    expect(hayMaterialVisualPendiente(p, config({ tapa_sustrato_principal: "250" }), 100)).toBe(false);
  });

  it("un color pendiente bloquea cotización y guardado también en rígidos y vinilo por metro lineal", () => {
    for (const template of ["sustrato_rigido_v1", "vinilo_de_corte_rollo_v1"]) {
      const p = producto();
      const paso = p.rutasAlternativas[0].configPasos[0];
      const slot = paso.slotsMateriales[0];
      slot.candidatos[0].materiaPrima.templateId = template;
      if (template === "vinilo_de_corte_rollo_v1") {
        p.unidadComercial = "metro_lineal";
        slot.formula = "por_metro_lineal";
      }
      const c = { ...config({ tapa_sustrato_principal: "" }), modoCotizacionLineal: "directo" as const };
      expect(hayMaterialVisualPendiente(p, c, 1)).toBe(true);
      expect(hayMaterialVisualPendiente(p, { ...c, seleccionMaterial: { tapa_sustrato_principal: "250" } }, 1)).toBe(false);
      slot.modoSeleccion = "MOTOR_ELIGE_AUTO";
      expect(hayMaterialVisualPendiente(p, c, 1)).toBe(false);
    }
  });
});


describe("elección manual cuando el material automático depende del stock", () => {
  it("no fija un candidato predeterminado y permite volver al modo automático", () => {
    const p = producto();
    const paso = p.rutasAlternativas[0].configPasos[0];
    paso.slotsMateriales[0].modoSeleccion = "MOTOR_ELIGE_AUTO";
    paso.slotsMateriales[0].politicaStock = "SOLO_DISPONIBLES";
    expect(buildJobContext(p, config(), 10, []).slotMateriales).toBeUndefined();
    expect(buildJobContext(p, config({ tapa_sustrato_principal: "250" }), 10, []).slotMateriales).toEqual({ tapa_sustrato_principal: "250" });
    expect(buildJobContext(p, config({ tapa_sustrato_principal: "" }), 10, []).slotMateriales).toBeUndefined();
  });
});
