// @vitest-environment jsdom
import { act, createContext, useContext, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmpleadoUsuario } from "./empleado-usuario";
import { UsuariosView } from "./usuarios-view";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import type { UsuarioDelTenant } from "@/lib/usuarios-api";

// jsdom no calcula el layout del popup. Se prueba el formulario con un selector
// nativo; la composición visual del selector se comprueba en el navegador.
vi.mock("@/components/ui/select", () => {
  const Ctx = createContext<{
    value: string;
    onValueChange: (s: string) => void;
    disabled: boolean;
  } | null>(null);
  return {
    Select: ({
      children,
      ...props
    }: {
      children: ReactNode;
      value: string;
      onValueChange: (s: string) => void;
      disabled: boolean;
    }) => <Ctx.Provider value={props}>{children}</Ctx.Provider>,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => {
      const ctx = useContext(Ctx)!;
      return (
        <select
          role="combobox"
          value={ctx.value}
          disabled={ctx.disabled}
          onChange={(e) => ctx.onValueChange(e.target.value)}
        >
          {children}
        </select>
      );
    },
    SelectGroup: ({ children }: { children: ReactNode }) => (
      <optgroup label="Empleados">{children}</optgroup>
    ),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => (
      <option role="option" value={value}>
        {children}
      </option>
    ),
  };
});

const api = vi.hoisted(() => ({
  editar: vi.fn(),
  empleados: vi.fn(),
  usuarios: vi.fn(),
}));
vi.mock("@/lib/empleados-api", () => ({ getEmpleados: api.empleados }));
vi.mock("@/lib/usuarios-api", async (original) => ({
  ...(await original<typeof import("@/lib/usuarios-api")>()),
  editarUsuario: api.editar,
  getUsuarios: api.usuarios,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/configuracion/usuarios",
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useFecha: () => ({ fechaHoraCorta: (s: string) => s }),
}));

const usuario: UsuarioDelTenant = {
  id: "admin-demo",
  membershipId: "miembro-demo",
  email: "admin@example.invalid",
  nombreCompleto: "Ana Demo",
  rolId: "rol-admin",
  rolNombre: "Administrador",
  ipsPermitidas: [],
  activa: true,
  empleado: null,
  estado: "activo",
  esYo: true,
};
let el: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  api.editar.mockReset().mockResolvedValue({ ok: true });
  api.empleados.mockReset().mockResolvedValue([
    { id: "legajo-demo", nombreCompleto: "Ana Demo" },
    { id: "ocupado", nombreCompleto: "Otro empleado" },
  ]);
  api.usuarios
    .mockReset()
    .mockResolvedValue({
      usuarios: [
        usuario,
        {
          ...usuario,
          id: "otro",
          esYo: false,
          empleado: { id: "ocupado", nombreCompleto: "Otro empleado" },
        },
      ],
    });
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const boton = (s: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (e) => e.textContent?.trim() === s,
  )!;
const click = async (s: string) => act(async () => boton(s).click());
async function seleccionar(s: string) {
  const select =
    document.querySelector<HTMLSelectElement>('[role="combobox"]')!;
  await act(async () => {
    select.value = [...select.options].find((o) => o.text === s)!.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("permite abrir el vínculo propio conservando deshabilitados el rol y Quitar acceso", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={["configuracion.usuarios.gestionar"]}>
        <UsuariosView
          inicial={{ usuarios: [usuario], limite: null, enUso: 1 }}
          roles={[]}
          catalogo={null}
          empleados={[]}
          historial={[]}
        />
      </PermisosProvider>,
    ),
  );
  expect(el.querySelector<HTMLSelectElement>(".usr-rol")!.disabled).toBe(true);
  expect(boton("Quitar acceso").disabled).toBe(true);
  expect(boton("Vincular empleado").disabled).toBe(false);
  await click("Vincular empleado");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Rol: Administrador",
  );
});

it("sin gestión de usuarios no ofrece vincular empleados", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={["configuracion.usuarios.ver"]}>
        <UsuariosView
          inicial={{ usuarios: [usuario], limite: null, enUso: 1 }}
          roles={[]}
          catalogo={null}
          empleados={[]}
          historial={[]}
        />
      </PermisosProvider>,
    ),
  );
  expect(boton("Vincular empleado")).toBeUndefined();
});

it("elige un legajo libre y guarda únicamente el vínculo del administrador", async () => {
  const cerrar = vi.fn(),
    guardado = vi.fn();
  await act(async () =>
    root.render(
      <EmpleadoUsuario
        usuario={usuario}
        onCerrar={cerrar}
        onGuardado={guardado}
      />,
    ),
  );
  expect(boton("Guardar vínculo").disabled).toBe(true);
  expect(
    [...document.querySelectorAll('[role="option"]')].map((e) => e.textContent),
  ).not.toContain("Otro empleado");
  await seleccionar("Ana Demo");
  await click("Guardar vínculo");
  expect(api.editar).toHaveBeenCalledExactlyOnceWith(usuario.id, {
    empleadoId: "legajo-demo",
  });
  expect(guardado).toHaveBeenCalledOnce();
  expect(cerrar).toHaveBeenCalledOnce();
});

it("permite desvincular con null", async () => {
  const cerrar = vi.fn();
  await act(async () =>
    root.render(
      <EmpleadoUsuario
        usuario={{
          ...usuario,
          empleado: { id: "legajo-demo", nombreCompleto: "Ana Demo" },
        }}
        onCerrar={cerrar}
        onGuardado={vi.fn()}
      />,
    ),
  );
  await seleccionar("Sin vincular");
  await click("Guardar vínculo");
  expect(api.editar).toHaveBeenCalledExactlyOnceWith(usuario.id, {
    empleadoId: null,
  });
});

it("informa errores de carga, permite reintentar y no confunde error con lista vacía", async () => {
  api.empleados.mockRejectedValueOnce(new Error("sin conexión"));
  await act(async () =>
    root.render(
      <EmpleadoUsuario
        usuario={usuario}
        onCerrar={vi.fn()}
        onGuardado={vi.fn()}
      />,
    ),
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "No se pudieron consultar",
  );
  expect(boton("Guardar vínculo").disabled).toBe(true);
  await click("Reintentar");
  expect(document.querySelector('[role="combobox"]')).not.toBeNull();
});

it("un rechazo al guardar conserva abierto el formulario y cancelar no escribe", async () => {
  api.editar.mockRejectedValue(new Error("Empleado ocupado"));
  const cerrar = vi.fn(),
    guardado = vi.fn();
  await act(async () =>
    root.render(
      <EmpleadoUsuario
        usuario={usuario}
        onCerrar={cerrar}
        onGuardado={guardado}
      />,
    ),
  );
  await seleccionar("Ana Demo");
  await click("Guardar vínculo");
  expect(cerrar).not.toHaveBeenCalled();
  expect(guardado).not.toHaveBeenCalled();
  await click("Cancelar");
  expect(cerrar).toHaveBeenCalledOnce();
  expect(api.editar).toHaveBeenCalledOnce();
});
