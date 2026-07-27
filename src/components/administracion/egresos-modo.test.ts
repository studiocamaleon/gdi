import { describe, expect, it } from "vitest";

import { TABS_POR_MODO } from "./egresos-view";

/**
 * Qué muestra cada mitad del módulo.
 *
 * El corte responde a una confusión concreta: "Egresos" se leía como sinónimo
 * de "cuentas por pagar", y no lo es — un gasto de contado nunca fue deuda.
 * Si un tab se filtra mal, la mitad izquierda vuelve a mostrar cosas que no
 * son deuda y el malentendido vuelve con él.
 */
describe("las dos caras del módulo", () => {
  it("Cuentas por pagar sólo muestra deuda: por factura y por proveedor", () => {
    expect(TABS_POR_MODO["cuentas-por-pagar"]).toEqual([
      "por-pagar",
      "proveedores",
    ]);
  });

  /** "Todos" incluye los de contado: no puede estar del lado de la deuda. */
  it("Cuentas por pagar NO muestra el registro completo ni las plantillas", () => {
    const tabs = TABS_POR_MODO["cuentas-por-pagar"];
    expect(tabs).not.toContain("todos");
    expect(tabs).not.toContain("recurrentes");
    expect(tabs).not.toContain("analisis");
  });

  it("Egresos muestra el registro completo, el análisis y las plantillas", () => {
    expect(TABS_POR_MODO.egresos).toEqual([
      "todos",
      "analisis",
      "recurrentes",
    ]);
  });

  /** Cada entrada abre en su primer tab: es el que define la pregunta. */
  it("cada modo abre en un tab propio", () => {
    expect(TABS_POR_MODO["cuentas-por-pagar"][0]).toBe("por-pagar");
    expect(TABS_POR_MODO.egresos[0]).toBe("todos");
  });

  /** Ningún tab puede quedar huérfano: quedaría código muerto sin puerta. */
  it("entre los dos modos se ofrecen todos los tabs, sin repetir", () => {
    const todos = [
      ...TABS_POR_MODO["cuentas-por-pagar"],
      ...TABS_POR_MODO.egresos,
    ];
    expect(new Set(todos).size).toBe(todos.length);
    expect([...todos].sort()).toEqual(
      ["analisis", "por-pagar", "proveedores", "recurrentes", "todos"].sort(),
    );
  });
});
