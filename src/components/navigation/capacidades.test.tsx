import { reportesVisibles } from "@/lib/reportes-config";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { navPara, hasChildren } from "./nav-items";
import { CapacidadesProvider, useCapacidad } from "./capacidades-provider";
import { AccesoPorPlan } from "./acceso-por-plan";
import { PROPUESTA_PLANES } from "../../../apps/api/src/plataforma/planes/catalogo-planes";
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ ruta: "/produccion/colas" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.ruta }));
const esencial = PROPUESTA_PLANES[0].contenido.funciones;
const pro = PROPUESTA_PLANES[1].contenido.funciones;
const rutas = (
  funciones: Record<string, boolean>,
  permisos: Set<string> | null = null,
) =>
  navPara(permisos, "AR", funciones).flatMap((i) =>
    hasChildren(i) ? i.children.map((c) => c.href) : [i.href],
  );

it("Esencial conserva trabajo diario e historiales sin ofrecer funciones de gestión excluidas", () => {
  const visibles = rutas(esencial);
  expect(visibles).toContain("/produccion/tablero");
  expect(visibles).toContain("/inventario/compras");
  expect(
    navPara(null, "AR", esencial)
      .flatMap((i) => (hasChildren(i) ? i.children : []))
      .find((c) => c.href === "/inventario/compras")?.label,
  ).toBe("Historial de compras");
  expect(visibles).toContain("/administracion/deudores");
  expect(visibles).toContain("/comercial/campanas");
  for (const ruta of ["/administracion/tesoreria", "/administracion/egresos", "/administracion/cuentas-por-pagar"])
    expect(visibles).toContain(ruta);
  expect(rutas(esencial, new Set(["comercial.ver"])) ).not.toContain("/administracion/tesoreria");
  for (const ruta of [
    "/produccion/planificacion",
    "/produccion/colas",
  ])
    expect(visibles).not.toContain(ruta);
  expect(visibles).toContain("/crm/fidelizacion");
  expect(visibles).toContain("/crm/cupones");
  expect(
    navPara(null, "AR", esencial).flatMap(i => hasChildren(i) ? i.children : [])
      .find(c => c.href === "/crm/cupones")?.label,
  ).toBe("Historial de cupones");
});

it("Pro habilita sus funciones sin habilitar la planificación de Avanzado ni reemplazar los permisos", () => {
  expect(rutas(pro)).toContain("/crm/fidelizacion");
  expect(rutas(pro)).not.toContain("/produccion/planificacion");
  expect(rutas(pro, new Set(["produccion.ver"]))).not.toContain(
    "/crm/fidelizacion",
  );
});

it("una URL directa excluida no monta el contenido ni sus consultas", async () => {
  const consulta = vi.fn();
  function Contenido() {
    consulta();
    return <p>Contenido restringido</p>;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <CapacidadesProvider capacidades={{ funciones: esencial }}>
          <AccesoPorPlan>
            <Contenido />
          </AccesoPorPlan>
        </CapacidadesProvider>,
      ),
    );
    expect(container.textContent).toContain("Función no incluida en tu plan");
    expect(consulta).not.toHaveBeenCalled();
    await act(async () =>
      root.render(
        <CapacidadesProvider capacidades={{ funciones: PROPUESTA_PLANES[2].contenido.funciones }}>
          <AccesoPorPlan>
            <Contenido />
          </AccesoPorPlan>
        </CapacidadesProvider>,
      ),
    );
    expect(container.textContent).toContain("Contenido restringido");
  } finally {
    await act(async () => root.unmount());
  }
});

it("permite previsión de materiales sin habilitar ETA en el cotizador", async () => {
  function Cotizador() {
    const prevision = useCapacidad("prevision_materiales");
    const eta = useCapacidad("eta_capacidad");
    return (
      <p>
        {prevision ? "Consultar faltantes" : "Sin previsión"} ·{" "}
        {eta ? "Calcular fecha" : "Fecha manual"}
      </p>
    );
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <CapacidadesProvider capacidades={{ funciones: pro }}>
          <Cotizador />
        </CapacidadesProvider>,
      ),
    );
    expect(container.textContent).toBe("Consultar faltantes · Fecha manual");
  } finally {
    await act(async () => root.unmount());
  }
});

it("el catálogo y selector de reportes filtran por plan y permisos juntos", () => {
  const basicos = reportesVisibles(() => true, esencial).map((r) => r.href);
  expect(basicos).toEqual([
    "/reportes/resumen",
    "/reportes/comercial",
    "/reportes/embudo",
  ]);
  expect(reportesVisibles(() => true, pro).map((r) => r.href)).toContain(
    "/reportes/finanzas",
  );
  expect(reportesVisibles(() => false, pro).map((r) => r.href)).not.toContain(
    "/reportes/finanzas",
  );
});
