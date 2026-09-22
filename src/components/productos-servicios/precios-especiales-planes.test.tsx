// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PreciosEspecialesClientesCard, TabPrecioCompleto } from "./tab-precio-completo";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ProductoVisualProvider } from "./producto-ui";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), clientes: vi.fn(), actualizar: vi.fn() }));
vi.mock("@/lib/productos-servicios-api", async original => ({
  ...await original<typeof import("@/lib/productos-servicios-api")>(),
  getPreciosEspecialesProducto: mocks.listar,
  actualizarPrecioEspecialCliente: mocks.actualizar,
  getImpuestosCatalogo: async () => [], getCategoriaFiscal: async () => ({ categoriaFiscal: "general" }),
  getComisionesCatalogo: async () => [], getComisionesAplicadas: async () => [],
}));
vi.mock("@/lib/clientes-api", () => ({ getClientes: mocks.clientes }));
let container: HTMLDivElement, root: Root;
const regla = { id: "regla", productoId: "producto", clienteId: "cliente", activo: true,
  cliente: { id: "cliente", nombre: "Cliente habitual", razonSocial: null }, configJson: { metodoCalculo: "precio_fijo", detalle: { price: 200, precioIncluyeIva: false } } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  mocks.listar.mockResolvedValue([regla]); mocks.clientes.mockResolvedValue([{ id: "otro", nombre: "Otro cliente" }]);
  mocks.actualizar.mockResolvedValue({ ...regla, activo: false });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render({ incluida = false, permisos = ["costos.ver", "costos.gestionar"], completo = false } = {}) {
  await act(async () => root.render(<DesignSystemProvider theme="brand" appearance="light"><ProductoVisualProvider>
    <PermisosProvider permisos={permisos}><CapacidadesProvider capacidades={{ funciones: { precios_especiales: incluida, reglas_precio: false } }}>
      {completo ? <TabPrecioCompleto productoId="producto" precioConfig={{ metodoCalculo: "precio_fijo", detalle: { price: 1000 } }} onChangePrecioConfig={() => {}} /> : <PreciosEspecialesClientesCard productoId="producto" />}
    </CapacidadesProvider></PermisosProvider>
  </ProductoVisualProvider></DesignSystemProvider>));
}
it("sin T08 conserva la regla completa y no carga la lista de clientes ni ofrece modificarla", async () => {
  await render();
  expect(container.textContent).toContain("Cliente habitual");
  expect(container.textContent).toContain("Sin aplicar por plan");
  expect(container.textContent).toContain("Precio: 200");
  expect(container.textContent).toContain("IVA: No incluido");
  expect(mocks.clientes).not.toHaveBeenCalled();
  expect(container.querySelector('[role="switch"]')).toBeNull();
  expect(container.querySelector('[aria-label^="Editar precio"]')).toBeNull();
  expect(container.querySelector('[aria-label^="Eliminar precio"]')).toBeNull();
});
it("T08 puede operarse aunque el editor del precio general T07 esté deshabilitado", async () => {
  await render({ incluida: true, completo: true });
  const editar = container.querySelector<HTMLButtonElement>('[aria-label="Editar precio especial de Cliente habitual"]');
  expect(editar).not.toBeNull();
  expect(editar!.matches(":disabled")).toBe(false);
  expect(editar!.closest("fieldset[disabled]")).toBeNull();
  expect(container.querySelector('fieldset[disabled]')).not.toBeNull();
  const activar = container.querySelector<HTMLElement>('[role="switch"][aria-label^="Desactivar precio"]');
  expect(activar).not.toBeNull();
  await act(async () => activar!.click());
  expect(mocks.actualizar).toHaveBeenCalledWith("regla", { activo: false });
});
it("permiso de lectura conserva reglas sin edición y sin permiso de costos no consulta la API", async () => {
  await render({ incluida: true, permisos: ["costos.ver"] });
  expect(container.textContent).toContain("Cliente habitual");
  expect(container.querySelector('[aria-label^="Editar precio"]')).toBeNull();
  mocks.listar.mockClear();
  await render({ incluida: true, permisos: [] });
  expect(container.textContent).not.toContain("Cliente habitual");
  expect(mocks.listar).not.toHaveBeenCalled();
});
it("un fallo de consulta permite reintentar y no informa que se perdieron las reglas", async () => {
  mocks.listar.mockRejectedValueOnce(new Error("Sin conexión"));
  await render();
  expect(container.textContent).toContain("Sin conexión");
  expect(container.textContent).not.toContain("Sin precios especiales configurados");
  const reintentar = [...container.querySelectorAll('button')].find(b => b.textContent?.includes("Reintentar"));
  await act(async () => reintentar!.click());
  expect(container.textContent).toContain("Cliente habitual");
  expect(container.textContent).not.toContain("Sin conexión");
});
