import { beforeEach, expect, it, vi } from "vitest";
import { puedeConfigurar } from "./capacidades-server";
import { capacidadDeRuta } from "./capacidades";
const mocks = vi.hoisted(() => ({ capacidades: vi.fn(), permiso: vi.fn() }));
vi.mock("./capacidades", async (original) => ({
  ...(await original<typeof import("./capacidades")>()),
  consultarCapacidades: mocks.capacidades,
}));
vi.mock("./permisos-server", () => ({ tienePermiso: mocks.permiso }));
beforeEach(() => vi.clearAllMocks());
it.each([
  [false, false, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
])(
  "combina plan %s y permiso %s para configurar",
  async (plan, permiso, esperado) => {
    mocks.capacidades.mockResolvedValue({ funciones: { productos: plan } });
    mocks.permiso.mockResolvedValue(permiso);
    expect(await puedeConfigurar("productos", "costos.gestionar")).toBe(
      esperado,
    );
  },
);
it("la configuración de una ruta de producto exige ambas funciones", async () => {
  mocks.capacidades.mockResolvedValue({
    funciones: { productos: true, procesos: false },
  });
  mocks.permiso.mockResolvedValue(true);
  expect(
    await puedeConfigurar(["productos", "procesos"], "costos.gestionar"),
  ).toBe(false);
});
it.each([
  ["/crm/clientes/nuevo", "clientes", "/crm/clientes/cliente"],
  ["/empleados/nuevo", "empleados", "/empleados/empleado"],
  ["/productos-servicios/nuevo", "productos", "/productos-servicios/producto"],
  ["/costos/maquinaria/nueva", "maquinaria", "/costos/maquinaria/maquina"],
  [
    "/inventario/materias-primas/costos",
    "materiales",
    "/inventario/materias-primas/material",
  ],
  [
    "/productos-servicios/rutas/nueva",
    "procesos",
    "/productos-servicios/rutas/ruta",
  ],
  ["/configuracion/impuestos", "reglas_precio", "/comercial/propuestas"],
])(
  "limita %s y conserva la consulta del registro",
  (alta, capacidad, consulta) => {
    expect(capacidadDeRuta(alta)).toBe(capacidad);
    expect(capacidadDeRuta(consulta)).toBeNull();
  },
);
