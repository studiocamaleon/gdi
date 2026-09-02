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
      expect(admin).toContain("Cuentas por cobrar");
    });

    /**
     * Las dos caras del mismo mostrador van juntas y en ese orden: primero lo
     * que te deben, después lo que debés. Que "Egresos" venga al final no es
     * cosmético — es lo que evita que se lea como sinónimo de cuentas por
     * pagar, que fue el malentendido que motivó el corte.
     */
    it("Cuentas por cobrar y por pagar quedan una al lado de la otra", () => {
      const admin = hijos(["administracion.ver"], "Administración");
      const cobrar = admin.indexOf("Cuentas por cobrar");
      const pagar = admin.indexOf("Cuentas por pagar");
      expect(cobrar).toBeGreaterThanOrEqual(0);
      expect(pagar).toBe(cobrar + 1);
      expect(admin.indexOf("Egresos")).toBe(pagar + 1);
    });

    it("sin la llave del módulo, el grupo no aparece", () => {
      expect(etiquetas(["comercial.ver"])).not.toContain("Administración");
    });
  });

    /**
     * Gastos fijos se mudó de Costos a Administración con permiso PROPIO.
     *
     * Adentro está la masa salarial del taller, así que quién lo ve no puede
     * quedar librado al permiso del grupo. El cambio corta para los dos lados
     * y así tiene que ser: el Jefe de producción —que antes lo veía por
     * `costos.ver`— lo pierde, y el Administrativo —que carga esos números y
     * NO tenía `costos.ver`— lo gana.
     */
    describe("Gastos fijos y la masa salarial", () => {
      it("no aparece en Costos", () => {
        expect(hijos(["costos.ver"], "Costos")).not.toContain("Gastos fijos");
      });

      it("el Jefe de producción ya no lo ve", () => {
        const jefe = ["panel.ver", "costos.ver", "produccion.gestionar"];
        expect(hijos(jefe, "Administración")).not.toContain("Gastos fijos");
        expect(hijos(jefe, "Costos")).not.toContain("Gastos fijos");
      });

      /** Entrar a Administración no alcanza: pide su propio permiso. */
      it("no se abre sólo por tener Administración", () => {
        const admin = hijos(["administracion.ver"], "Administración");
        expect(admin).toContain("Cuentas por pagar");
        expect(admin).not.toContain("Gastos fijos");
      });

      it("el Administrativo sí lo ve", () => {
        expect(
          hijos(["administracion.configurar"], "Administración"),
        ).toContain("Gastos fijos");
      });
    });

  /**
   * Reportes y Configuración ocupan UNA línea cada uno: adentro, la tira de
   * reportes y la columna de ajustes son la navegación. Acá sólo se prueba que
   * no reaparezcan como grupos con hijos.
   */
  describe("los módulos de una sola línea", () => {
    it("Centro de análisis es una sola entrada a /reportes", () => {
      const reportes = navPara(new Set(["reportes.ver"])).find(
        (m) => m.label === "Centro de análisis",
      );
      expect(reportes?.href).toBe("/reportes");
      expect(hijos(["reportes.ver"], "Centro de análisis")).toEqual([]);
    });

    /** Sin la llave del módulo no hay Reportes, aunque tenga la de un reporte. */
    it("sin reportes.ver no aparece Centro de análisis", () => {
      expect(etiquetas(["reportes.ver_resumen"])).not.toContain("Centro de análisis");
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
