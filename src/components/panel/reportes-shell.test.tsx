import { describe, expect, it } from "vitest";
import { reportesVisibles } from "./reportes-shell";
import type { PermisoClave } from "@/lib/permisos";
const labels = (permisos: string[]) => reportesVisibles((p: PermisoClave) => permisos.includes(p)).map(r => r.label);
describe("acceso granular al Centro de análisis", () => {
  it("sólo muestra las vistas autorizadas", () => {
    expect(labels(["reportes.comercial.ver", "reportes.embudo.ver"])).toEqual(["Comercial", "Embudo"]);
  });
  it("una vista no habilita resumen ni finanzas", () => {
    expect(labels(["reportes.comercial.ver"])).toEqual(["Comercial"]);
    expect(labels(["reportes.resumen.ver"])).toEqual(["Resumen ejecutivo"]);
  });
  it("Finanzas exige su vista y el permiso de márgenes", () => {
    expect(labels(["reportes.finanzas.ver"])).toEqual([]);
    expect(labels(["finanzas.ver_margenes"])).toEqual([]);
    expect(labels(["reportes.finanzas.ver", "finanzas.ver_margenes"])).toEqual(["Finanzas"]);
  });
  it("las llaves antiguas solas no abren vistas ya calculadas", () => {
    expect(labels(["reportes.ver", "reportes.ver_resumen"])).toEqual([]);
  });
});
