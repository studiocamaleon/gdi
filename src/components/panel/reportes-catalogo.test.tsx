import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { navPara } from "@/components/navigation/nav-items";
import { PROPUESTA_PLANES } from "../../../apps/api/src/plataforma/planes/catalogo-planes";
import { ReportesCatalogo } from "./reportes-catalogo";

const render = (funciones: Record<string, boolean>, permisos: string[]) => renderToStaticMarkup(
  <PermisosProvider permisos={permisos}>
    <CapacidadesProvider capacidades={{ funciones }}><ReportesCatalogo /></CapacidadesProvider>
  </PermisosProvider>,
);

describe("catálogo de reportes por plan y permisos", () => {
  it.each([0, 1, 2])("ofrece sólo los informes incluidos en el plan %s", indice => {
    const html = render(PROPUESTA_PLANES[indice].contenido.funciones, ["reportes.ver", "reportes.ver_resumen", "finanzas.ver_margenes"]);
    expect(html).toContain('href="/reportes/resumen"');
    expect(html.includes('href="/reportes/finanzas"')).toBe(indice > 0);
    expect(html.includes('href="/reportes/producto"')).toBe(indice > 0);
    expect(html.includes('href="/reportes/equipo"')).toBe(indice === 2);
  });
  it("sin reportes contratados muestra un estado claro y retira el enlace del sidebar", () => {
    const funciones = { ...PROPUESTA_PLANES[0].contenido.funciones, reportes_resumen: false };
    expect(render(funciones, ["reportes.ver"])).toContain("Función no incluida en tu plan");
    expect(navPara(new Set(["reportes.ver"]), "AR", funciones).some(n => n.key === "reportes")).toBe(false);
  });
  it("distingue la falta de permiso de una función no contratada", () => {
    const funciones = { reportes_finanzas: true };
    expect(render(funciones, ["reportes.ver"])).toContain("No tenés acceso");
    expect(navPara(new Set(["reportes.ver"]), "AR", funciones).some(n => n.key === "reportes")).toBe(false);
    expect(navPara(new Set(["reportes.ver", "finanzas.ver_margenes"]), "AR", funciones).some(n => n.key === "reportes")).toBe(true);
  });
});
