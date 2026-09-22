// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CrearEmpresaDialog } from "./crear-empresa-dialog";
import { InvitacionEmpresaPanel } from "./invitacion-empresa-panel";
import type {
  InvitacionEmpresa,
  PlanCatalogo,
  ResultadoInvitacionEmpresa,
} from "@/lib/plataforma-api";

const mocks = vi.hoisted(() => ({ crear: vi.fn(), reenviar: vi.fn() }));
vi.mock("@/lib/plataforma-api", () => ({
  crearTenantPlataforma: mocks.crear,
  reenviarInvitacionEmpresa: mocks.reenviar,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    id,
    value,
    onChange,
    options,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

const invitacion: InvitacionEmpresa = {
  id: "inv-1",
  email: "persona@example.com",
  venceEl: "2030-10-01T12:00:00Z",
  aceptadaEl: null,
  correoEstado: "error",
  ultimoIntentoEl: null,
  enviadoEl: null,
};
let root: Root, container: HTMLDivElement;
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
const boton = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  )!;
async function input(id: string, valor: string) {
  await act(async () => {
    const e = container.querySelector<HTMLInputElement>(`#${id}`)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(e, valor);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("si el correo falla conserva el alta y el reintento usa la misma empresa", async () => {
  mocks.crear.mockResolvedValue({
    tenantId: "empresa-1",
    invitacion,
    invitacionUrl: "https://grafo.test/invitacion",
  });
  mocks.reenviar.mockResolvedValue({
    tenantId: "empresa-1",
    invitacion: { ...invitacion, correoEstado: "enviado" },
  });
  await act(async () =>
    root.render(
      <CrearEmpresaDialog
        planes={[{ id: "plan-1", nombre: "Co-founder Pro" } as PlanCatalogo]}
        onCerrar={vi.fn()}
      />,
    ),
  );
  await input("empresa-nombre", "Empresa de prueba");
  await input("empresa-slug", "empresa-prueba");
  await input("empresa-email", "persona@example.com");
  await act(async () => {
    const s = container.querySelector<HTMLSelectElement>("select")!;
    s.value = "plan-1";
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => boton("Crear y enviar").click());
  expect(container.textContent).toContain(
    "Empresa creada · correo sin confirmar",
  );
  expect(container.textContent).not.toContain("Crear y enviar invitación");
  await act(async () => boton("Reenviar invitación").click());
  expect(mocks.crear).toHaveBeenCalledTimes(1);
  expect(mocks.reenviar).toHaveBeenCalledWith("empresa-1");
  expect(container.textContent).toContain("Invitación enviada por correo");
});

it("impide reenvíos duplicados y soporte sólo consulta el estado", async () => {
  let resolver!: (r: ResultadoInvitacionEmpresa) => void;
  mocks.reenviar.mockReturnValue(
    new Promise((r) => {
      resolver = r;
    }),
  );
  const cambio = vi.fn();
  await act(async () =>
    root.render(
      <InvitacionEmpresaPanel
        tenantId="empresa-1"
        invitacion={invitacion}
        puedeEnviar
        onCambio={cambio}
      />,
    ),
  );
  await act(async () => {
    boton("Reenviar").click();
    boton("Reenviar").click();
  });
  expect(mocks.reenviar).toHaveBeenCalledTimes(1);
  await act(async () => resolver({ tenantId: "empresa-1", invitacion }));
  await act(async () =>
    root.render(
      <InvitacionEmpresaPanel
        tenantId="empresa-1"
        invitacion={invitacion}
        puedeEnviar={false}
        onCambio={cambio}
      />,
    ),
  );
  expect(container.textContent).not.toContain("Reenviar invitación");
});
