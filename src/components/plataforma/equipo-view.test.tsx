// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { EditorEquipo, EquipoView } from "./equipo-view";
import type {
  EquipoPlataforma,
  OperadorPlataforma,
} from "@/lib/plataforma-equipo-api";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  agregar: vi.fn(),
  actualizar: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  limpiar: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-equipo-api", () => ({
  agregarOperador: mocks.agregar,
  actualizarOperador: mocks.actualizar,
}));
vi.mock("@/lib/session", () => ({ clearSessionToken: mocks.limpiar }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    options,
    value,
    onChange,
    ...props
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select {...props} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    title,
    children,
    isDismissable,
    onOpenChange,
  }: {
    title: ReactNode;
    children: ReactNode;
    isDismissable: boolean;
    onOpenChange: (v: boolean) => void;
  }) => (
    <section>
      <h2>{title}</h2>
      <button
        aria-label="Cerrar modal"
        disabled={!isDismissable}
        onClick={() => onOpenChange(false)}
      >
        Cerrar
      </button>
      {children}
    </section>
  ),
}));
vi.mock("@/components/perfil-mfa", () => ({
  PerfilMfa: ({
    onBloqueoChange,
  }: {
    onBloqueoChange: (v: boolean) => void;
  }) => (
    <div>
      <button onClick={() => onBloqueoChange(true)}>Mostrar códigos</button>
      <button onClick={() => onBloqueoChange(false)}>Códigos guardados</button>
    </div>
  ),
}));

const operador: OperadorPlataforma = {
  id: "operador",
  nombre: "Ana",
  email: "ana@test.local",
  rol: "SOPORTE",
  activo: true,
  esPropio: false,
  mfaActivo: true,
  recuperacionConfirmada: true,
  sesionesActivas: 1,
  ultimaSesionActivaEl: null,
};
const datos: EquipoPlataforma = {
  total: 1,
  pagina: 1,
  limite: 25,
  roles: [],
  usuarios: [operador],
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.api.mockResolvedValue(datos);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function boton(texto: string) {
  const b = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  );
  if (!b) throw new Error(`Falta botón ${texto}`);
  return b;
}
async function input(selector: string, valor: string) {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

it("soporte consulta equipo y su propia seguridad sin controles administrativos", async () => {
  await act(async () =>
    root.render(<EquipoView esAdmin={false} esSesionPlataforma />),
  );
  expect(container.textContent).toContain("Ana");
  expect(container.textContent).toContain("MFA activada");
  expect(container.textContent).not.toContain("Invitar integrante");
  expect(container.textContent).not.toContain("Gestionar");
  expect(boton("Mi seguridad")).toBeDefined();
});
it("no ofrece gestión desde una sesión de empresa aunque el usuario sea admin de Plataforma", async () => {
  await act(async () =>
    root.render(<EquipoView esAdmin esSesionPlataforma={false} />),
  );
  expect(container.textContent).toContain(
    "ingresá con tu cuenta en /backoffice",
  );
  expect(container.textContent).not.toContain("Invitar integrante");
});
it("el alta parte de Soporte, requiere motivo, evita duplicados y permite reintentar errores", async () => {
  const guardado = vi.fn();
  let rechazar!: (error: Error) => void;
  mocks.agregar
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rechazar = reject;
        }),
    )
    .mockResolvedValueOnce({ ok: true });
  await act(async () =>
    root.render(
      <EditorEquipo usuario={null} onCerrar={vi.fn()} onGuardado={guardado} />,
    ),
  );
  expect(boton("Agregar al equipo").disabled).toBe(true);
  await input("#equipo-email", "ana@test.local");
  await input("#equipo-motivo", "Nuevo equipo");
  await submit();
  await submit();
  expect(mocks.agregar).toHaveBeenCalledTimes(1);
  expect(mocks.agregar).toHaveBeenCalledWith(
    "ana@test.local",
    "SOPORTE",
    "Nuevo equipo",
  );
  expect(boton("Cerrar").disabled).toBe(true);
  await act(async () => rechazar(new Error("La cuenta no existe")));
  expect(container.textContent).toContain("La cuenta no existe");
  expect(guardado).not.toHaveBeenCalled();
  await submit();
  expect(guardado).toHaveBeenCalledTimes(1);
});
it("si el cambio cierra la sesión propia, limpia el token y vuelve al backoffice", async () => {
  mocks.actualizar.mockResolvedValue({ ok: true, sesionActualCerrada: true });
  await act(async () =>
    root.render(
      <EditorEquipo
        usuario={{ ...operador, rol: "ADMIN", esPropio: true }}
        onCerrar={vi.fn()}
        onGuardado={vi.fn()}
      />,
    ),
  );
  expect(container.textContent).toContain(
    "Este cambio cerrará tu sesión actual",
  );
  await input("#equipo-motivo", "Cambio de funciones");
  await submit();
  expect(mocks.actualizar).toHaveBeenCalledWith(
    expect.objectContaining({ rol: "ADMIN" }),
    "rol",
    "SOPORTE",
    "Cambio de funciones",
  );
  expect(mocks.limpiar).toHaveBeenCalledOnce();
  expect(mocks.replace).toHaveBeenCalledWith("/backoffice");
});
it("no permite cerrar el modal de MFA hasta guardar los códigos de recuperación", async () => {
  await act(async () => root.render(<EquipoView esAdmin esSesionPlataforma />));
  await act(async () => boton("Mi seguridad").click());
  await act(async () => boton("Mostrar códigos").click());
  expect(boton("Cerrar").disabled).toBe(true);
  await act(async () => boton("Códigos guardados").click());
  expect(boton("Cerrar").disabled).toBe(false);
  await act(async () => boton("Cerrar").click());
  expect(container.textContent).not.toContain("Mostrar códigos");
});
