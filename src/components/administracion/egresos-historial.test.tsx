import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { EgresosView } from "./egresos-view";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import type { Egreso } from "@/lib/egresos";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const egreso: Egreso = {
  id: "egreso", numero: "EGR-2026-001", descripcion: "Factura conservada", beneficiarioNombre: "Proveedor histórico",
  proveedorId: null, proveedorNombre: null, categoriaEgresoId: "categoria", categoriaNombre: "Material", naturaleza: "COSTO_PRODUCCION",
  fechaCompetencia: "2026-09-01", fechaVencimiento: "2026-09-30", moneda: "ARS", neto: 100, iva: 0, otrosImpuestos: 0,
  total: 100, pagadoTotal: 0, saldo: 100, tipoComprobante: null, puntoVenta: null, numeroComprobante: null,
  estado: "pendiente", origen: "manual", anuladoEl: null, motivoAnulacion: null, registradoPorNombre: "Administrador", notas: null,
};
it.each(["egresos", "cuentas-por-pagar"] as const)("%s conserva registros y no abre un alta ni propone endoso desde parámetros anteriores", modo => {
  const html = renderToStaticMarkup(
    <DesignSystemProvider theme="brand" appearance="light">
      <PermisosProvider permisos={["administracion.ver", "administracion.gestionar", "administracion.anular"]}>
        <CapacidadesProvider capacidades={{ funciones: {} }}>
          <EgresosView modo={modo} initialEgresos={[egreso]} initialResumen={null} categorias={[]} proveedores={[]} metodosPago={[]} cuentas={[]} altaInicial valorEndosoInicialId="valor-anterior" />
        </CapacidadesProvider>
      </PermisosProvider>
    </DesignSystemProvider>,
  );
  expect(html).toContain("Factura conservada");
  expect(html).toContain("Historial de egresos");
  expect(html).not.toContain('role="dialog"');
  expect(html).not.toContain("Endosar cheque desde cartera");
  const botones = (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []).join("\n");
  expect(botones).not.toMatch(/Registrar egreso|Registrar factura|Pagar selección|Anular/);
  if (modo === "egresos") expect(html).toContain('href="/administracion/programaciones"');
});
