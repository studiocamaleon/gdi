import { describe, expect, it } from "vitest";

import { navPara } from "@/components/navigation/nav-items";

/**
 * Qué ve cada uno en el sidebar.
 *
 * La regla que fijan estos tests: **el permiso de un hijo REEMPLAZA al del
 * grupo, no se suma**. Eso corta para los dos lados y los dos importan:
 *
 *  - abre: el Administrativo llega a Datos fiscales sin que le demos
 *    Configuración entera, que le abriría Usuarios —o sea crear cuentas y
 *    repartir roles—;
 *  - cierra: tener Reportes NO alcanza para el Resumen ejecutivo.
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
    it("el Administrativo ve Configuración con SÓLO sus dos pantallas", () => {
      const permisos = [
        "panel.ver",
        "reportes.ver",
        "comercial.ver",
        "registros.ver",
        "administracion.gestionar",
        "administracion.ver",
        "administracion.configurar",
        "finanzas.ver_margenes",
      ];

      expect(etiquetas(permisos)).toContain("Configuración");
      expect(hijos(permisos, "Configuración")).toEqual([
        "Datos fiscales",
        "Métodos de pago",
      ]);
    });

    /** Lo que hace que la llave suelta valga la pena: NO le abre Usuarios. */
    it("y no ve Usuarios", () => {
      expect(hijos(["administracion.configurar"], "Configuración")).not.toContain(
        "Usuarios",
      );
    });

    it("sin ninguna llave de Configuración, el grupo no aparece", () => {
      expect(etiquetas(["comercial.ver"])).not.toContain("Configuración");
    });
  });

  describe("el hijo con permiso propio también se restringe solo", () => {
    /** El agujero que no puede abrirse: Reportes NO da el Resumen ejecutivo. */
    it("tener Reportes no alcanza para el Resumen ejecutivo", () => {
      const soloReportes = hijos(["reportes.ver"], "Reportes");
      expect(soloReportes).toContain("Comercial");
      expect(soloReportes).not.toContain("Resumen ejecutivo");
      expect(soloReportes).not.toContain("Finanzas");
      expect(soloReportes).not.toContain("Costo laboral");
    });

    it("con la llave del resumen, aparece", () => {
      expect(hijos(["reportes.ver", "reportes.ver_resumen"], "Reportes")).toContain(
        "Resumen ejecutivo",
      );
    });

    /** Los sueldos no se abren por poder leer los reportes del negocio. */
    it("Costo laboral pide la llave de remuneraciones", () => {
      expect(
        hijos(["reportes.ver", "registros.ver_remuneraciones"], "Reportes"),
      ).toContain("Costo laboral");
    });
  });

  describe("lo de siempre no se rompió", () => {
    it("el Administrador ve todo", () => {
      const todo = [
        "panel.ver",
        "comercial.ver",
        "registros.ver",
        "costos.ver",
        "produccion.ver",
        "administracion.ver",
        "administracion.configurar",
        "reportes.ver",
        "reportes.ver_resumen",
        "registros.ver_remuneraciones",
        "finanzas.ver_margenes",
        "inventario.ver",
        "configuracion.ver",
      ];
      expect(hijos(todo, "Configuración")).toEqual([
        "Usuarios",
        "Datos fiscales",
        "Métodos de pago",
        "Almacenamiento",
        "Integraciones",
      ]);
    });

    /** Sesión vieja sin lista de permisos: se ofrece todo y el API frena. */
    it("sin lista de permisos se devuelve el árbol completo", () => {
      expect(navPara(null).map((m) => m.label)).toContain("Configuración");
    });

    it("el Operario sólo ve Panel general y Producción", () => {
      expect(etiquetas(["panel.ver", "produccion.gestionar", "produccion.ver"]))
        .toEqual(["Panel general", "Producción"]);
    });
  });
});
