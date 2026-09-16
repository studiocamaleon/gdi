import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type { OrdenFacturable } from "@/lib/administracion";
import { FacturacionView } from "./facturacion-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const orden: OrdenFacturable = {
  ordenId: "ot",
  numero: "OT-47",
  estado: "finalizada",
  clienteId: "c",
  clienteNombre: "Cliente",
  clienteCondicionFiscal: null,
  fechaFinalizada: "2026-09-01",
  total: 1234.56,
  facturado: 234.1,
  cobrado: 1234.56,
  saldoSinFacturar: 1000.46,
};
function render(permisos: string[], ordenes = [orden]) {
  return renderToStaticMarkup(
    <DesignSystemProvider theme="brand" appearance="light">
      <PermisosProvider permisos={permisos}>
        <FacturacionView initialOrdenes={ordenes} />
      </PermisosProvider>
    </DesignSystemProvider>,
  );
}
describe("Facturación — presentación y acceso", () => {
  it("conserva la consulta sin controles de gestión para lectura", () => {
    const html = render(["administracion.ver"]);
    expect(html).toContain("OT-47");
    expect(html).toContain("/produccion/ordenes/ot");
    expect(html).not.toContain("Seleccionar OT-47");
    expect(html).not.toContain("Preparar facturación");
  });
  it("ofrece selección con permiso de gestión", () => {
    const html = render(["administracion.gestionar"]);
    expect(html).toContain("Seleccionar OT-47");
    expect(html).toContain("Seleccionar todas las órdenes visibles");
  });
  it("muestra saldo fiscal con centavos aunque la orden esté completamente cobrada", () => {
    const html = render(["administracion.ver"]);
    expect(html).toContain("1.000,46");
    expect(html).toContain("1.234,56");
    expect(html).toContain("234,10");
    expect(html).toContain("01/09/2026");
  });
  it("presenta el vacío real sin inventar documentos", () => {
    const html = render(["administracion.gestionar"], []);
    expect(html).toContain("La facturación está al día");
    expect(html).not.toContain("Seleccionar todas las órdenes visibles");
  });
});
