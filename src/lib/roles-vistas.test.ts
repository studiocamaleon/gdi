import { describe, it, expect } from "vitest";
import { VISTAS, expandirVistas } from "./permisos-vistas";
import { nivelesDesde, permisosDesdeNiveles } from "./roles-vistas";
import { navPara } from "@/components/navigation/nav-items";
import { reportesVisibles } from "./reportes-config";
import type { CatalogoPermisos } from "./usuarios-api";
const catalogo: CatalogoPermisos = {
  modulos: [
    {
      clave: "comercial",
      label: "Comercial",
      descripcion: "",
      enElPlan: true,
      vistas: VISTAS.filter((v) => v.modulo === "comercial").map((v) => ({
        ...v,
        permiteGestion: true,
      })),
    },
  ],
  transversales: [],
  features: { afip: false, whatsapp: false },
};
describe("Edición granular de un rol anterior", () => {
  it("carga todos sus accesos y permite cerrar campañas sin conservar el comodín", () => {
    const niveles = nivelesDesde(["comercial.gestionar"], catalogo);
    expect(niveles["comercial.campanas"]).toBe("gestionar");
    niveles["comercial.campanas"] = "ninguno";
    const permisos = permisosDesdeNiveles(niveles, []);
    expect(permisos).not.toContain("comercial.gestionar");
    const efectivos = expandirVistas(permisos);
    expect(efectivos.has("comercial.campanas.ver")).toBe(false);
    expect(efectivos.has("comercial.presupuestos.ver")).toBe(true);
  });
  it("ofrece sólo presupuestos, también sin los demás hijos de Comercial", () => {
    const nav = navPara(
      new Set(["acceso.por_vista", "comercial.presupuestos.ver"]),
    );
    expect(nav).toHaveLength(1);
    expect(nav[0].children?.map((c) => c.key)).toEqual(["presupuestos"]);
  });
  it("un reporte específico abre el Centro de análisis y sólo ese informe", () => {
    const permisos = new Set(["acceso.por_vista", "reportes.comercial.ver"]);
    expect(navPara(permisos).map((n) => n.key)).toEqual(["reportes"]);
    expect(reportesVisibles((p) => permisos.has(p)).map((r) => r.href)).toEqual(
      ["/reportes/comercial"],
    );
  });
  it("crear y consultar órdenes forman un único permiso, sin abrir presupuestos", () => {
    const permisos = expandirVistas([
      "acceso.por_vista",
      "comercial.ordenes.gestionar",
    ]);
    expect(permisos.has("comercial.ordenes.ver")).toBe(true);
    expect(permisos.has("comercial.presupuestos.ver")).toBe(false);
    const comercial = navPara(permisos).find((n) => n.key === "comercial");
    expect(comercial?.children?.map((c) => c.href)).toEqual(
      expect.arrayContaining([
        "/comercial/crear-propuesta",
        "/produccion/ordenes",
      ]),
    );
    expect(VISTAS.some((v) => (v.clave as string) === "comercial.crear")).toBe(
      false,
    );
  });
  it("preserva acciones implícitas de producción al editar un rol histórico", () => {
    const p = expandirVistas(["produccion.gestionar"]);
    expect(p.has("produccion.ejecutar")).toBe(true);
    expect(p.has("produccion.supervisar")).toBe(true);
  });
  it("los catálogos del navegador y API son idénticos", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/lib/permisos-vistas.ts", "utf8")).toBe(
      readFileSync("apps/api/src/auth/vistas.ts", "utf8"),
    );
  });
});
