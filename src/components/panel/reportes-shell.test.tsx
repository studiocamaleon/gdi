import { describe, expect, it } from "vitest";

import { reportesVisibles } from "./reportes-shell";
import type { PermisoClave } from "@/lib/permisos";

/**
 * Qué reportes se le ofrecen a cada uno.
 *
 * Esto lo cubría el sidebar mientras Reportes tenía un hijo por reporte. Ahora
 * el módulo es una sola línea del menú y la tira de esta shell es la única
 * lista: si acá se cuela un reporte de más, alguien mira lo que no le
 * corresponde —sueldos del equipo, márgenes del negocio— hasta que el gate de
 * la página lo frena.
 */
const puedeCon = (permisos: string[]) => (p: PermisoClave) => permisos.includes(p);

const labels = (permisos: string[]) =>
  reportesVisibles(puedeCon(permisos)).map((r) => r.label);

describe("los reportes que se ofrecen", () => {
  it("con sólo el módulo se ven los reportes abiertos", () => {
    const soloReportes = labels(["reportes.ver"]);
    expect(soloReportes).toContain("Comercial");
    expect(soloReportes).toContain("Embudo");
  });

  /** El permiso del reporte reemplaza al del módulo, no se suma. */
  it("tener Reportes no alcanza para el Resumen ejecutivo", () => {
    const soloReportes = labels(["reportes.ver"]);
    expect(soloReportes).not.toContain("Resumen ejecutivo");
    expect(soloReportes).not.toContain("Finanzas");
    expect(soloReportes).not.toContain("Costo laboral");
  });

  it("con la llave del resumen, aparece", () => {
    expect(labels(["reportes.ver", "reportes.ver_resumen"])).toContain(
      "Resumen ejecutivo",
    );
  });

  /** Los sueldos no se abren por poder leer los reportes del negocio. */
  it("Costo laboral pide la llave de remuneraciones", () => {
    expect(labels(["reportes.ver", "registros.ver_remuneraciones"])).toContain(
      "Costo laboral",
    );
  });

  it("Finanzas pide la llave de márgenes", () => {
    expect(labels(["reportes.ver", "finanzas.ver_margenes"])).toContain("Finanzas");
  });
});
