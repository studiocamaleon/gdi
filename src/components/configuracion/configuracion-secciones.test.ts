import { describe, expect, it } from "vitest";
import { SECCIONES_CONFIG, seccionesConfigVisibles } from "./configuracion-secciones";
import type { PermisoClave } from "@/lib/permisos";
const labels = (permisos: string[], pais = "AR", impresoras = false) =>
  seccionesConfigVisibles((p: PermisoClave) => permisos.includes(p), pais, impresoras).map(s => s.label);
describe("acceso granular a Configuración", () => {
  it("cada vista se habilita de forma independiente", () => {
    for (const s of SECCIONES_CONFIG) expect(labels([s.permiso], "AR", true)).toEqual([s.label]);
  });
  it("el permiso para modificar datos fiscales no abre usuarios ni otras vistas", () => {
    expect(labels(["configuracion.fiscal.ver", "administracion.configurar"])).toEqual(["Datos fiscales"]);
  });
  it("los permisos de módulo antiguos solos no amplían las vistas ya calculadas", () => {
    expect(labels(["configuracion.ver", "administracion.configurar"])).toEqual([]);
  });
  it("lo fiscal argentino y las impresoras conservan sus condiciones", () => {
    expect(labels(SECCIONES_CONFIG.map(s => s.permiso), "CL")).not.toContain("Datos fiscales");
    expect(labels(["configuracion.impresoras.ver"])).toEqual([]);
    expect(labels(["configuracion.metodos.ver"], "CL")).toEqual(["Métodos de pago"]);
  });
});
