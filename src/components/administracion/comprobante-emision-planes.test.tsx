// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ComprobanteDetalleView } from "./comprobante-detalle-view";
import { CapacidadesProvider } from "../navigation/capacidades-provider";
import { PermisosProvider } from "../navigation/permisos-provider";
import type { ComprobanteDetalle } from "@/lib/administracion";
import {
  consultarEmisionComprobante,
  emitirComprobante,
} from "@/lib/administracion-api";
import NuevoComprobantePage from "@/app/(dashboard)/administracion/comprobantes/nuevo/page";
import { tieneCapacidad } from "@/lib/capacidades-server";
import { getConfiguracionFiscal } from "@/lib/administracion-api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/administracion-api", () => ({
  consultarEmisionComprobante: vi.fn(),
  emitirComprobante: vi.fn(),
  cargarCae: vi.fn(),
  getComprobante: vi.fn(),
  getConfiguracionFiscal: vi.fn(),
}));
vi.mock("@/lib/capacidades-server", () => ({ tieneCapacidad: vi.fn() }));
vi.mock("@/lib/permisos-server", () => ({
  tienePermiso: vi.fn().mockResolvedValue(true),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
const c: ComprobanteDetalle = {
  id: "ensayo",
  tipo: "factura",
  letra: "B",
  puntoVentaNumero: "0001",
  numero: 1,
  numeroCompleto: "B 0001-00000001",
  fecha: "2026-09-22",
  clienteNombre: "Cliente",
  clienteCuit: null,
  ordenId: null,
  ordenNumero: null,
  ordenes: [],
  items: [],
  netoGravado: 100,
  ivaPorAlicuota: [],
  ivaTotal: 21,
  total: 121,
  moneda: "ARS",
  cotizacion: null,
  estado: "por_verificar",
  cae: null,
  caeVencimiento: null,
  condicionVenta: "contado",
  vencimiento: null,
  leyenda: null,
  rechazo: null,
  saldoPendiente: 121,
  comprobanteOrigenId: null,
  cobrosImputados: [],
  emision: {
    id: "intento",
    estado: "verificar",
    proveedor: "afipsdk",
    ambiente: "dev",
    detalle: "Consultá el resultado del envío.",
    creadaEl: "2026-09-22",
    enviadaEl: "2026-09-22",
  },
};
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function mostrar(
  datos = c,
  fiscal = false,
  permisos = ["administracion.gestionar"],
) {
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{ funciones: { fiscal_argentina: fiscal } }}
      >
        <PermisosProvider permisos={permisos}>
          <ComprobanteDetalleView comprobante={datos} />
        </PermisosProvider>
      </CapacidadesProvider>,
    ),
  );
}
const boton = (texto: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(texto),
  );
it("retirar ARCA conserva consultar resultado sin ofrecer volver a emitir", async () => {
  await mostrar();
  expect(container.textContent).toContain("Resultado por verificar");
  expect(boton("Emitir comprobante")).toBeUndefined();
  vi.mocked(consultarEmisionComprobante).mockResolvedValue({
    aplicada: true,
    detalle: "Recuperado",
    comprobante: { ...c, estado: "emitido" },
  });
  await act(async () => boton("Consultar resultado")!.click());
  expect(consultarEmisionComprobante).toHaveBeenCalledWith(c.id);
  expect(emitirComprobante).not.toHaveBeenCalled();
});
it("un borrador no muestra emitir sin la función, aunque el usuario gestione administración", async () => {
  await mostrar({ ...c, estado: "borrador", numero: null });
  expect(boton("Emitir comprobante")).toBeUndefined();
  expect(container.textContent).toContain("Historial de comprobantes");
});
it("con la función muestra emitir para un borrador", async () => {
  await mostrar({ ...c, estado: "borrador", numero: null }, true);
  expect(boton("Emitir comprobante")).toBeDefined();
  expect(boton("Consultar resultado")).toBeUndefined();
});
it("un lector conserva el estado sin poder consultar ni iniciar emisión", async () => {
  await mostrar(c, true, ["administracion.ver"]);
  expect(container.textContent).toContain("Resultado por verificar");
  expect(boton("Consultar resultado")).toBeUndefined();
});
it("las notas requieren permiso de anulación y función incluida", async () => {
  await mostrar({ ...c, estado: "emitido", cae: "12345678901234" }, true, [
    "administracion.gestionar",
  ]);
  expect(container.querySelector('a[href*="nuevo?origen"]')).toBeNull();
  await mostrar({ ...c, estado: "emitido", cae: "12345678901234" }, true, [
    "administracion.anular",
  ]);
  expect(container.querySelector('a[href*="nuevo?origen"]')).not.toBeNull();
});
it("la ruta de nueva emisión no consulta datos editables cuando falta ARCA", async () => {
  vi.mocked(tieneCapacidad).mockResolvedValue(false);
  const pagina = await NuevoComprobantePage({
    searchParams: Promise.resolve({}),
  });
  await act(async () => root.render(pagina));
  expect(container.textContent).toContain("Función no incluida");
  expect(getConfiguracionFiscal).not.toHaveBeenCalled();
});
