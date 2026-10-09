import { beforeEach, expect, it, vi } from "vitest";
import NuevoEmpleadoPage from "./nuevo/page";
import EmpleadosPage from "./page";
const m = vi.hoisted(() => ({ permisos: [] as string[] }));
vi.mock("@/lib/auth-server", () => ({
  getCurrentUserCached: async () => ({
    currentUser: { tenantActual: { permisos: m.permisos } },
  }),
}));
vi.mock("@/lib/capacidades", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/capacidades")>()),
  consultarCapacidades: async () => ({ funciones: { empleados: true } }),
}));
vi.mock("@/lib/empleados-api", () => ({
  listEmpleados: async () => ({ data: [], meta: { total: 0 } }),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
beforeEach(() => {
  m.permisos = ["acceso.por_vista", "registros.empleados.gestionar"];
});
it.each([false, true])(
  "gestionar legajos habilita la ficha y mantiene separado el permiso de comisiones: %s",
  async (comisiones) => {
    if (comisiones) m.permisos.push("registros.ver_comisiones");
    const pagina = await NuevoEmpleadoPage();
    expect(pagina.props.canManage).toBe(true);
    expect(pagina.props.canViewCommissions).toBe(comisiones);
    const contenido = EmpleadosPage().props.children;
    const listado = await contenido.type(contenido.props);
    expect(listado.props.canManage).toBe(true);
  },
);
it("ver comisiones no permite crear ni editar el legajo si la vista es de lectura", async () => {
  m.permisos = [
    "acceso.por_vista",
    "registros.empleados.ver",
    "registros.ver_comisiones",
  ];
  expect((await NuevoEmpleadoPage()).props.modulo).toBe("Empleados");
  const contenido = EmpleadosPage().props.children;
  expect((await contenido.type(contenido.props)).props.canManage).toBe(false);
});
