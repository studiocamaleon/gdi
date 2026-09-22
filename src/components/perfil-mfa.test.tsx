// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PerfilMfa } from "./perfil-mfa";
const mocks = vi.hoisted(() => ({
  estado: vi.fn(),
  iniciar: vi.fn(),
  confirmar: vi.fn(),
  reemplazar: vi.fn(),
  gestionar: vi.fn(),
  cancelar: vi.fn(),
  guardar: vi.fn(),
  olvidar: vi.fn(),
}));
vi.mock("@/lib/perfil-api", () => ({
  estadoMfa: mocks.estado,
  olvidarDispositivosMfa: mocks.olvidar,
  iniciarMfa: mocks.iniciar,
  confirmarMfa: mocks.confirmar,
  reemplazarMfa: mocks.reemplazar,
  gestionarMfa: mocks.gestionar,
  cancelarMfa: mocks.cancelar,
  confirmarRecuperacionMfa: mocks.guardar,
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
let root: Root, container: HTMLDivElement;
const estado = {
  dispositivosRecordados: 0,
  activo: true,
  activadoEl: "2026-09-20",
  codigosRestantes: 10,
  disponible: true,
  requiereMfa: true,
  recuperacionConfirmada: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.estado.mockResolvedValue(estado);
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
async function input(id: string, valor: string) {
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
it("staff puede reemplazar el autenticador con contraseña y recuperación, pero no desactivar MFA", async () => {
  const bloquear = vi.fn();
  mocks.reemplazar.mockResolvedValue({
    setupId: "setup",
    secret: "temporal",
    qrDataUrl: "data:image/png;base64,",
    expiresAt: "2026-09-20",
  });
  await act(async () => root.render(<PerfilMfa onBloqueoChange={bloquear} />));
  expect(container.textContent).not.toContain("Desactivar MFA");
  await act(async () => boton("Reemplazar autenticador").click());
  await input("#perfil-mfa-password", "password-actual");
  await input("#perfil-mfa-codigo", "codigo-respaldo");
  await enviar();
  expect(mocks.reemplazar).toHaveBeenCalledWith(
    "password-actual",
    "codigo-respaldo",
  );
  expect(container.textContent).toContain("Escaneá el QR");
  expect(
    container.querySelector<HTMLInputElement>("#perfil-mfa-codigo")?.value,
  ).toBe("");
});
it("confirma el guardado en servidor y conserva códigos y bloqueo si falla la confirmación", async () => {
  const bloquear = vi.fn();
  mocks.gestionar.mockResolvedValue({
    codigosRecuperacion: ["AAAA-BBBB-CCCC"],
    versionRecuperacion: 7,
  });
  mocks.guardar
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ ok: true });
  await act(async () => root.render(<PerfilMfa onBloqueoChange={bloquear} />));
  await act(async () => boton("Renovar códigos").click());
  await input("#perfil-mfa-password", "password-actual");
  await input("#perfil-mfa-codigo", "codigo-respaldo");
  await enviar();
  expect(boton("Listo").disabled).toBe(true);
  expect(bloquear).toHaveBeenLastCalledWith(true);
  await act(async () =>
    container.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  await act(async () => boton("Listo").click());
  expect(mocks.guardar).toHaveBeenCalledWith(7);
  expect(container.textContent).toContain("Sin conexión");
  expect(container.textContent).toContain("AAAA-BBBB-CCCC");
  expect(bloquear).toHaveBeenLastCalledWith(true);
  await act(async () => boton("Listo").click());
  expect(container.textContent).not.toContain("AAAA-BBBB-CCCC");
  expect(bloquear).toHaveBeenLastCalledWith(false);
});

it("permite revocar los accesos recordados y conserva la opción si falla", async () => {
  mocks.estado
    .mockResolvedValueOnce({ ...estado, dispositivosRecordados: 2 })
    .mockResolvedValue(estado);
  mocks.olvidar
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ ok: true, requiereLogin: false });
  await act(async () => root.render(<PerfilMfa onBloqueoChange={vi.fn()} />));
  await act(async () => boton("Olvidar dispositivos recordados").click());
  expect(container.textContent).toContain("Sin conexión");
  expect(boton("Olvidar dispositivos recordados").disabled).toBe(false);
  await act(async () => boton("Olvidar dispositivos recordados").click());
  expect(mocks.olvidar).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain(
    "Olvidar dispositivos recordados",
  );
});
