// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DescuentosOrdenCreada } from "./descuentos-orden-creada";
const mocks = vi.hoisted(() => ({
  aplicar: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  actualizar: vi.fn(),
}));
vi.mock("@/lib/ordenes-trabajo-api", () => ({
  aplicarDescuentoOrden: mocks.aplicar,
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));
vi.mock("./orden-financial-actions", () => ({
  OrdenFinancialActions: ({
    operacionPendiente,
    onDescuentoOrden,
    onCuponOrden,
  }: any) => (
    <>
      <button disabled={operacionPendiente} onClick={onDescuentoOrden}>
        Descuento
      </button>
      {onCuponOrden && (
        <button disabled={operacionPendiente} onClick={onCuponOrden}>
          Cupón
        </button>
      )}
    </>
  ),
}));
vi.mock("./descuento-orden-dialog", () => ({
  DescuentoOrdenDialog: ({ target, onApply }: any) =>
    target ? (
      <button
        onClick={() =>
          onApply("orden", null, { tipo: "PORCENTAJE", valor: 10 })
        }
      >
        Aplicar
      </button>
    ) : null,
}));
vi.mock("./orden-cupon-field", () => ({
  OrdenCuponField: ({ onValidar }: any) => (
    <button onClick={() => onValidar("PROMO")}>Validar cupón</button>
  ),
}));
let root: Root, el: HTMLDivElement;
const orden = {
  id: "ot",
  version: "2026-10-06T12:00:00Z",
  estado: "finalizada",
  facturadoTotal: 0,
};
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
async function render(overrides = {}, editando = true) {
  await act(async () =>
    root.render(
      <DescuentosOrdenCreada
        orden={{ ...orden, ...overrides } as any}
        items={[{ id: "item" }] as any}
        conCupones
        bloqueado={false}
        editando={editando}
        onActualizada={mocks.actualizar}
      />,
    ),
  );
}
async function click(text: string) {
  await act(async () => {
    [...el.querySelectorAll("button")]
      .find((b) => b.textContent === text)!
      .click();
  });
}
it("aplica un descuento en una OT terminada y actualiza la ficha con la respuesta", async () => {
  mocks.aplicar.mockResolvedValue({ ...orden, total: 1089 });
  await render();
  await click("Descuento");
  await click("Aplicar");
  expect(mocks.aplicar).toHaveBeenCalledWith("ot", {
    modo: "manual",
    tipo: "PORCENTAJE",
    valor: 10,
    expectedVersion: orden.version,
  });
  expect(mocks.actualizar).toHaveBeenCalledWith(
    expect.objectContaining({ total: 1089 }),
  );
});
it("envía sólo el código y la versión, sin importes calculados por el navegador", async () => {
  mocks.aplicar.mockResolvedValue(orden);
  await render();
  await click("Cupón");
  await click("Validar cupón");
  expect(mocks.aplicar).toHaveBeenCalledWith("ot", {
    modo: "cupon",
    codigo: "PROMO",
    expectedVersion: orden.version,
  });
});
it("un rechazo por cobros conserva la ficha anterior y explica el motivo", async () => {
  mocks.aplicar.mockRejectedValue(
    new Error("El total quedaría por debajo de lo cobrado"),
  );
  await render();
  await click("Descuento");
  await click("Aplicar");
  expect(mocks.actualizar).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(
    "El total quedaría por debajo de lo cobrado",
  );
});
it("una orden facturada no permite iniciar el ajuste", async () => {
  await render({ facturadoTotal: 1 });
  expect([...el.querySelectorAll("button")].every((b) => b.disabled)).toBe(
    true,
  );
  await click("Descuento");
  expect(mocks.aplicar).not.toHaveBeenCalled();
});

it("fuera de Editar orden impide descuentos y cupones, incluso al salir con el diálogo abierto", async () => {
  await render({}, false);
  expect([...el.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
  await render();
  await click("Descuento");
  expect(el.textContent).toContain("Aplicar");
  await render({}, false);
  expect(el.textContent).not.toContain("Aplicar");
  expect(mocks.aplicar).not.toHaveBeenCalled();
});
