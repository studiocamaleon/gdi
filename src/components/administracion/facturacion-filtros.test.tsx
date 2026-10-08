// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { FacturacionView } from "./facturacion-view";
import FacturacionPage from "@/app/(dashboard)/administracion/facturacion/page";
import type { OrdenFacturable } from "@/lib/administracion";
import type { FiltrosFacturacion } from "@/lib/facturacion-filtros";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  get: vi.fn(),
  facturar: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));
vi.mock("@/lib/administracion-api", () => ({
  getFacturacionPendientes: mocks.get,
  facturarLote: mocks.facturar,
}));
const orden: OrdenFacturable = {
  ordenId: "ficticia",
  numero: "OT-TEST",
  estado: "finalizada",
  clienteId: null,
  clienteNombre: "Cliente ficticio",
  clienteCondicionFiscal: null,
  fechaEmision: "2026-10-08T01:00:00Z",
  fechaFinalizada: "2026-10-08",
  total: 100,
  facturado: 0,
  cobrado: 100,
  saldoSinFacturar: 100,
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(
  filtros: FiltrosFacturacion = {},
  permiso = "administracion.gestionar",
  ordenes = [orden],
) {
  await act(async () =>
    root.render(
      <DesignSystemProvider theme="brand" appearance="light">
        <PermisosProvider permisos={[permiso]}>
          <FacturacionView initialOrdenes={ordenes} initialFiltros={filtros} />
        </PermisosProvider>
      </DesignSystemProvider>,
    ),
  );
}
function boton(texto: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === texto,
  );
  expect(button, `Botón ${texto}`).toBeDefined();
  return button!;
}
async function fecha(indice: number, valor: string) {
  const input =
    container.querySelectorAll<HTMLInputElement>('input[type="date"]')[indice];
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("abre sin filtrar; aplica cobro y fechas sólo al confirmar, y limpia la selección", async () => {
  await render();
  expect(
    container.querySelector('form[aria-label="Filtros de facturación"]'),
  ).toBeNull();
  expect(mocks.replace).not.toHaveBeenCalled();
  // La emisión se muestra en el día del taller, no en UTC.
  expect(container.textContent).toContain("07/10/2026");
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('[aria-label="Seleccionar OT-TEST"]')!
      .click(),
  );
  expect(container.textContent).toContain("1 orden seleccionada");
  await act(async () => boton("Filtros").click());
  await act(async () => boton("Sin facturar · cobradas al 100%").click());
  await fecha(0, "2026-10-01");
  await fecha(1, "2026-10-08");
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => boton("Aplicar filtros").click());
  expect(mocks.replace).toHaveBeenCalledWith(
    "/administracion/facturacion?cobro=cobradas_sin_facturar&emisionDesde=2026-10-01&emisionHasta=2026-10-08",
    { scroll: false },
  );
  expect(container.textContent).not.toContain("1 orden seleccionada");
  expect(mocks.facturar).not.toHaveBeenCalled();
});

it("permite limpiar filtros activos sin desplegar el panel y no conserva el filtro por defecto", async () => {
  await render({ cobro: "cobradas_sin_facturar", emisionHasta: "2026-10-08" });
  expect(container.querySelector("form")).toBeNull();
  expect(container.textContent).toContain("Emisión hasta 08/10/2026");
  await act(async () => boton("Limpiar filtros").click());
  expect(mocks.replace).toHaveBeenCalledWith("/administracion/facturacion", {
    scroll: false,
  });
});

it("rechaza el rango invertido antes de navegar", async () => {
  await render();
  await act(async () => boton("Filtros").click());
  await fecha(0, "2026-10-09");
  await fecha(1, "2026-10-08");
  expect(boton("Aplicar filtros").disabled).toBe(true);
  expect(container.textContent).toContain(
    "La fecha desde no puede ser posterior",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("lectura puede filtrar, sin habilitar emisión; el vacío filtrado no dice que esté al día", async () => {
  await render({ cobro: "cobradas_sin_facturar" }, "administracion.ver", []);
  expect(container.textContent).toContain(
    "No encontramos órdenes con esos filtros",
  );
  expect(container.textContent).not.toContain("La facturación está al día");
  expect(container.textContent).not.toContain("Preparar facturación");
  await act(async () => boton("Filtros activos").click());
  expect(boton("Aplicar filtros").disabled).toBe(false);
});

it("la página lleva los filtros a la API y cambia la clave del listado para descartar selecciones antiguas", async () => {
  mocks.get.mockResolvedValue([orden]);
  const base = await FacturacionPage({ searchParams: Promise.resolve({}) });
  expect(mocks.get).toHaveBeenLastCalledWith({
    cobro: undefined,
    emisionDesde: undefined,
    emisionHasta: undefined,
  });
  const filtrada = await FacturacionPage({
    searchParams: Promise.resolve({
      cobro: "cobradas_sin_facturar",
      emisionDesde: "2026-10-01",
    }),
  });
  expect(mocks.get).toHaveBeenLastCalledWith({
    cobro: "cobradas_sin_facturar",
    emisionDesde: "2026-10-01",
    emisionHasta: undefined,
  });
  expect(filtrada.key).not.toBe(base.key);
});
