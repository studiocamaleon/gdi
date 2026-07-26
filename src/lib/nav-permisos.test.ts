import { describe, expect, it } from "vitest";

import { navPara } from "@/components/navigation/nav-items";

/**
 * Qué ve cada uno en el sidebar.
 *
 * La regla que fijan estos tests: **el permiso de un hijo REEMPLAZA al del
 * grupo, no se suma**. Corta para los dos lados —abre Datos fiscales al
 * Administrativo sin darle Configuración entera, y cierra el Resumen ejecutivo
 * a quien sólo tiene Reportes—, pero desde que Reportes y Configuración son
 * módulos de una sola línea, esa regla se prueba donde ahora vive cada lista:
 * reportes-shell.test.tsx y configuracion-secciones.test.ts.
 *
 * Un error acá no se ve en pantalla: se ve como alguien mirando algo que no le
 * corresponde.
 */

const etiquetas = (permisos: string[]) =>
  navPara(new Set(permisos)).map((m) => m.label);

const hijos = (permisos: string[], grupo: string) => {
  const modulo = navPara(new Set(permisos)).find((m) => m.label === grupo);
  return modulo && "children" in modulo && modulo.children
    ? modulo.children.map((c) => c.label)
    : [];
};

describe("qué muestra el sidebar", () => {
  describe("el hijo con permiso propio se sostiene solo", () => {
    /** El circuito fiscal es del que factura, no del dueño del taller. */
    it("Comprobantes y Facturación siguen a administracion.ver", () => {
      const admin = hijos(["administracion.ver"], "Administración");
      expect(admin).toContain("Comprobantes");
      expect(admin).toContain("Deudores");
    });

    it("sin la llave del módulo, el grupo no aparece", () => {
      expect(etiquetas(["comercial.ver"])).not.toContain("Administración");
    });
  });

  /**
   * Reportes y Configuración ocupan UNA línea cada uno: adentro, la tira de
   * reportes y la columna de ajustes son la navegación. Acá sólo se prueba que
   * no reaparezcan como grupos con hijos.
   */
  describe("los módulos de una sola línea", () => {
    it("Reportes es una sola entrada a /reportes", () => {
      const reportes = navPara(new Set(["reportes.ver"])).find(
        (m) => m.label === "Reportes",
      );
      expect(reportes?.href).toBe("/reportes");
      expect(hijos(["reportes.ver"], "Reportes")).toEqual([]);
    });

    /** Sin la llave del módulo no hay Reportes, aunque tenga la de un reporte. */
    it("sin reportes.ver no aparece Reportes", () => {
      expect(etiquetas(["reportes.ver_resumen"])).not.toContain("Reportes");
    });

    /** Configuración salió de la lista: es el ancla del pie, no un grupo. */
    it("Configuración no está en el árbol del menú", () => {
      expect(navPara(null).map((m) => m.label)).not.toContain("Configuración");
    });
  });

  describe("lo de siempre no se rompió", () => {
    /** Sesión vieja sin lista de permisos: se ofrece todo y el API frena. */
    it("sin lista de permisos se devuelve el árbol completo", () => {
      const todo = navPara(null).map((m) => m.label);
      expect(todo).toContain("Comercial");
      expect(todo).toContain("Producción");
      expect(todo).toContain("Inventario");
    });

    it("el Operario sólo ve Panel general y Producción", () => {
      expect(etiquetas(["panel.ver", "produccion.gestionar", "produccion.ver"]))
        .toEqual(["Panel general", "Producción"]);
    });
  });
});
