// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AjustarAdicionales,
  CupoSuscripcionPanel,
} from "./cupo-suscripcion-panel";
import { CupoEquipo } from "../usuarios/cupo-equipo";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  guardar: vi.fn(),
  cancelar: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-suscripciones-api", () => ({
  ajustarCupoUsuarios: mocks.guardar,
}));
vi.mock("@/lib/usuarios-api", () => ({
  cancelarInvitacionUsuario: mocks.cancelar,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let container: HTMLDivElement, root: Root;
const cupo = {
  incluidos: 3,
  adicionales: 1,
  limite: 4,
  activos: 2,
  invitacionesPendientes: 1,
  ocupados: 3,
  disponibles: 1,
  excedidos: 0,
  editable: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.api.mockResolvedValue(cupo);
  mocks.guardar.mockResolvedValue(cupo);
  mocks.cancelar.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const button = (texto: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === texto,
  )!;
async function escribir(id: string, valor: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("muestra incluidos, adicionales y pendientes; soporte no puede ajustar", async () => {
  await act(async () =>
    root.render(<CupoSuscripcionPanel id="s1" esAdmin={false} version={0} />),
  );
  expect(container.textContent).toContain("3 + 1");
  expect(container.textContent).toContain("Invitaciones pendientes");
  expect(button("Ajustar adicionales")).toBeUndefined();
  expect(mocks.guardar).not.toHaveBeenCalled();
});
it("no ofrece ajustes manuales de una suscripción cobrada por pasarela", async () => {
  mocks.api.mockResolvedValue({ ...cupo, editable: false });
  await act(async () =>
    root.render(<CupoSuscripcionPanel id="s1" esAdmin version={0} />),
  );
  expect(button("Ajustar adicionales")).toBeUndefined();
  expect(container.textContent).toContain("pasarela aún no está habilitada");
});
it("envía la cantidad y valor anterior sólo al guardar, conservando el formulario si falla", async () => {
  const guardado = vi.fn();
  await act(async () =>
    root.render(
      <AjustarAdicionales
        id="s1"
        datos={cupo}
        cerrar={vi.fn()}
        guardado={guardado}
      />,
    ),
  );
  expect(button("Guardar cupo").disabled).toBe(true);
  await escribir("usuarios-adicionales", "2");
  await escribir("motivo-adicionales", "Ampliación acordada");
  expect(mocks.guardar).not.toHaveBeenCalled();
  mocks.guardar.mockRejectedValueOnce(
    new Error("El cupo cambió. Actualizá la ficha."),
  );
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mocks.guardar).toHaveBeenCalledWith("s1", {
    adicionales: 2,
    anteriores: 1,
    motivo: "Ampliación acordada",
  });
  expect(guardado).not.toHaveBeenCalled();
  expect(container.textContent).toContain("El cupo cambió");
});
it("impide reducir cupo por debajo de lo ocupado", async () => {
  await act(async () =>
    root.render(
      <AjustarAdicionales
        id="s1"
        datos={{ ...cupo, ocupados: 4 }}
        cerrar={vi.fn()}
        guardado={vi.fn()}
      />,
    ),
  );
  await escribir("usuarios-adicionales", "0");
  await escribir("motivo-adicionales", "Reducir lugares");
  expect(button("Guardar cupo").disabled).toBe(true);
  expect(container.textContent).toContain("debe cubrir los lugares ocupados");
});
it("cancelar una invitación del equipo refresca la ocupación", async () => {
  const recargar = vi.fn().mockResolvedValue(undefined);
  await act(async () =>
    root.render(
      <CupoEquipo
        datos={{
          usuarios: [],
          limite: 4,
          enUso: 3,
          cupo,
          invitaciones: [
            {
              id: "i1",
              email: "persona@test.invalid",
              venceEl: "2026-10-01T12:00:00Z",
            },
          ],
        }}
        recargar={recargar}
      />,
    ),
  );
  expect(container.textContent).toContain("3 de 4 lugares ocupados");
  expect(container.textContent).toContain("3 incluidos + 1 adicionales");
  await act(async () => button("Cancelar invitación").click());
  expect(mocks.cancelar).toHaveBeenCalledWith("i1");
  expect(recargar).toHaveBeenCalled();
});
