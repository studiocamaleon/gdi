// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  InvitacionEquipoDialog,
  InvitacionesEquipoView,
} from "./invitaciones-equipo";
import { InvitacionBackoffice } from "./invitacion-backoffice";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  invitar: vi.fn(),
  gestionar: vi.fn(),
  consultar: vi.fn(),
  aceptar: vi.fn(),
  token: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-equipo-api", () => ({
  invitarEquipo: mocks.invitar,
  gestionarInvitacionEquipo: mocks.gestionar,
  consultarInvitacionEquipo: mocks.consultar,
  aceptarInvitacionEquipo: mocks.aceptar,
}));
vi.mock("@/lib/session", () => ({ setSessionToken: mocks.token }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/components/design-system/appearance", () => ({
  DesignSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
    type,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: "button" | "submit";
  }) => (
    <button type={type ?? "button"} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/auth/mfa-login-form", () => ({
  MfaLoginForm: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <div>
      <h2>Verificá tu segundo factor</h2>
      <button onClick={() => onSuccess("sesion-verificada")}>
        Código correcto
      </button>
    </div>
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
      <button onClick={() => onOpenChange(false)} disabled={!isDismissable}>
        Cerrar modal
      </button>
      {children}
    </section>
  ),
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
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  window.history.replaceState(
    null,
    "",
    "/backoffice/invitacion#token=" + "a".repeat(64),
  );
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
  if (!b) throw new Error(`Falta ${texto}`);
  return b;
}
async function escribir(id: string, valor: string) {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>(id)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function enviar() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

it("invita con rol mínimo y motivo, evita duplicados y muestra el enlace sólo después de la respuesta", async () => {
  let completar!: (r: unknown) => void;
  mocks.invitar.mockImplementation(
    () =>
      new Promise((resolve) => {
        completar = resolve;
      }),
  );
  await act(async () =>
    root.render(
      <InvitacionEquipoDialog onCerrar={vi.fn()} onCambio={vi.fn()} />,
    ),
  );
  expect(boton("Generar enlace").disabled).toBe(true);
  await escribir("#invitar-email", "persona@test.local");
  await escribir("#invitar-motivo", "Se incorpora a soporte");
  await enviar();
  await enviar();
  expect(mocks.invitar).toHaveBeenCalledTimes(1);
  expect(mocks.invitar).toHaveBeenCalledWith(
    "persona@test.local",
    "SOPORTE",
    "Se incorpora a soporte",
  );
  expect(boton("Cerrar modal").disabled).toBe(true);
  await act(async () =>
    completar({
      id: "inv",
      email: "persona@test.local",
      venceEl: "2026-09-23T12:00:00Z",
      url: "https://grafo.test/backoffice/invitacion#token=prueba",
    }),
  );
  expect(container.textContent).toContain("Invitación lista");
  expect(
    container.querySelector<HTMLInputElement>("#enlace-equipo")?.value,
  ).toContain("#token=prueba");
});
it("soporte puede consultar invitaciones pero no renovarlas ni cancelarlas", async () => {
  mocks.api.mockResolvedValue({
    total: 1,
    pagina: 1,
    limite: 25,
    invitaciones: [
      {
        id: "inv",
        email: "persona@test.local",
        rol: "SOPORTE",
        creadaEl: "2026-09-20T12:00:00Z",
        venceEl: "2026-09-23T12:00:00Z",
        estado: "pendiente",
        invitador: "Admin",
      },
    ],
  });
  await act(async () =>
    root.render(<InvitacionesEquipoView puedeGestionar={false} version={0} />),
  );
  expect(container.textContent).toContain("persona@test.local");
  expect(container.textContent).not.toContain("Renovar enlace");
  expect(container.textContent).not.toContain("Cancelar invitación");
});
it("la cuenta existente verifica MFA antes de guardar una sesión o navegar", async () => {
  mocks.consultar.mockResolvedValue({
    email: "persona@test.local",
    rol: "SOPORTE",
    venceEl: "2026-09-23T12:00:00Z",
    requiereCrearClave: false,
  });
  mocks.aceptar.mockResolvedValue({
    requiereMfa: true,
    challengeToken: "desafio",
    accessToken: null,
    expiresIn: 300,
  });
  await act(async () => root.render(<InvitacionBackoffice />));
  expect(mocks.consultar).toHaveBeenCalledWith("a".repeat(64));
  expect(container.querySelector("#invitado-nombre")).toBeNull();
  await escribir("#invitado-password", "mi-password");
  await enviar();
  expect(container.textContent).toContain("Verificá tu segundo factor");
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => boton("Código correcto").click());
  expect(mocks.token).toHaveBeenCalledWith("sesion-verificada");
  expect(mocks.replace).toHaveBeenCalledWith("/backoffice/seguridad");
  expect(window.location.hash).toBe("");
});
it("un enlace inválido no permite crear una cuenta ni aceptar", async () => {
  mocks.consultar.mockRejectedValue(new Error("La invitación venció"));
  await act(async () => root.render(<InvitacionBackoffice />));
  expect(container.textContent).toContain("La invitación venció");
  expect(container.querySelector("form")).toBeNull();
  expect(mocks.aceptar).not.toHaveBeenCalled();
});
