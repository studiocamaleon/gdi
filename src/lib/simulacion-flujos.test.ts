import { describe, expect, it } from "vitest";
import { contextoFlujoSimulacion, focoFlujosSimulacion } from "./simulacion-flujos";

function item(loteId: string | null, esProductoDelLote = true, ordenId = "ot-54") {
  return {
    ordenId, ordenNumero: "OT-2026-0054", loteEntregaId: loteId,
    loteEntrega: loteId ? {
      id: loteId, nombre: `Lote ${loteId}`, cantidad: 50, unidad: "u",
      productoNombre: "Exhibidor", esProductoDelLote,
    } : null,
  };
}
function paso(id: string, lote: string | null, componente = false) {
  return { id, ...contextoFlujoSimulacion(item(lote, !componente)) };
}
const bloques = [
  paso("revision-B", "B"), paso("impresion-B", "B", true), paso("ensamble-B", "B"),
  paso("revision-C", "C"), paso("impresion-C", "C", true),
  paso("sin-lote", null),
];
const idsEnFoco = (foco: Set<string> | null) =>
  bloques.filter((b) => !foco || foco.has(b.flujoClave)).map((b) => b.id);

describe("flujo de un lote en la simulación", () => {
  it("incluye el producto y sus componentes al pasar sobre un paso, sin mezclar otros lotes de la OT", () => {
    expect(idsEnFoco(focoFlujosSimulacion(bloques, bloques[1].flujoClave, null)))
      .toEqual(["revision-B", "impresion-B", "ensamble-B"]);
  });

  it("mantiene el lote seleccionado aunque la búsqueda sea de toda la OT", () => {
    expect(idsEnFoco(focoFlujosSimulacion(bloques, null, bloques[0], () => true)))
      .toEqual(["revision-B", "impresion-B", "ensamble-B"]);
    expect(idsEnFoco(focoFlujosSimulacion(bloques, bloques[3].flujoClave, bloques[0], () => true)))
      .toEqual(["revision-C", "impresion-C"]);
  });

  it("permite buscar un lote o consultar toda la orden cuando no hay selección", () => {
    expect(idsEnFoco(focoFlujosSimulacion(bloques, null, null, b => b.loteNombre === "Lote C")))
      .toEqual(["revision-C", "impresion-C"]);
    expect(idsEnFoco(focoFlujosSimulacion(bloques, null, null, () => true))).toHaveLength(6);
    expect(focoFlujosSimulacion(bloques, null, null)).toBeNull();
  });

  it("conserva el flujo de una OT sin lotes y lo separa de sus lotes", () => {
    const original = contextoFlujoSimulacion(item(null));
    expect(original.flujoNombre).toBe("OT-2026-0054");
    expect(original.loteNombre).toBeNull();
    expect(idsEnFoco(focoFlujosSimulacion(bloques, original.flujoClave, null)))
      .toEqual(["sin-lote"]);
  });

  it("usa identidades estables: renombrar un lote no lo mezcla con otro de igual nombre", () => {
    const a = item("A");
    const b = item("B");
    b.loteEntrega!.nombre = "Lote A";
    expect(contextoFlujoSimulacion(a).flujoClave).not.toBe(contextoFlujoSimulacion(b).flujoClave);
    a.loteEntrega!.nombre = "Primera entrega";
    expect(contextoFlujoSimulacion(a).flujoClave).toBe(contextoFlujoSimulacion(item("A")).flujoClave);
    expect(contextoFlujoSimulacion(a).flujoClave).not.toBe(contextoFlujoSimulacion(item("A", true, "otra-ot")).flujoClave);
  });

  it("reconoce el lote aun si sólo llega su ID o sólo la relación", () => {
    const a = item("A");
    expect(contextoFlujoSimulacion({ ...a, loteEntrega: null }).flujoClave)
      .toBe(contextoFlujoSimulacion({ ...a, loteEntregaId: null }).flujoClave);
  });
});
