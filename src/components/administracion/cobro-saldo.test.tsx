// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CobroFormulario, type CobroDraft } from "./cobro-formulario";
import { RegistrarCobroView } from "./registrar-cobro-view";
import { PagosStagingTab } from "../comercial/pagos-staging-tab";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const mocks = vi.hoisted(() => ({
  crear: vi.fn(),
  metodos: vi.fn(),
  cuentas: vi.fn(),
}));
vi.mock("@/lib/administracion-api", () => ({
  crearCobro: mocks.crear,
  getMetodosPago: mocks.metodos,
  getCuentasCobro: mocks.cuentas,
}));
vi.mock("../navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
vi.mock("../navigation/permisos-provider", () => ({ usePuede: () => true }));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const metodos = [
  {
    id: "efectivo",
    nombre: "Efectivo",
    tipo: "efectivo",
    activo: true,
    comisionPct: 0,
    ivaComisionPct: 0,
    plazoAcreditacionDias: 0,
    cuentaDestinoId: "caja",
  },
] as MetodoPago[];
const cuentas = [
  { id: "caja", nombre: "Caja ficticia", tipo: "caja", moneda: "ARS" },
] as CuentaFondosResumen[];
let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.metodos.mockResolvedValue(metodos);
  mocks.cuentas.mockResolvedValue(cuentas);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const dialogo = () => document.querySelector<HTMLElement>('[role="dialog"]');
const confirmar = () => [...dialogo()!.querySelectorAll("button")]
  .find(b => /Confirmar y|Registrando/.test(b.textContent!))!;
const corregir = () => [...dialogo()!.querySelectorAll("button")]
  .find(b => b.textContent === "Volver a corregir")!;
async function elegirMetodo(id = "efectivo") {
  const select = el.querySelector<HTMLSelectElement>("#cobro-metodo-pago")!;
  await act(async () => {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const boton = () =>
  [...el.querySelectorAll("button")].find((b) =>
    /Registrar cobro|Registrando/.test(b.textContent!),
  )!;
async function monto(valor: string) {
  const input = el.querySelector<HTMLInputElement>(
    '[aria-label="Monto a cobrar"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function formulario(
  saldo: number,
  enviar = vi.fn(),
  limitarAlSaldo = true,
) {
  await act(async () =>
    root.render(
      <CobroFormulario
        saldo={saldo}
        limitarAlSaldo={limitarAlSaldo}
        metodos={metodos}
        cuentas={cuentas}
        guardando={false}
        onSubmit={enviar}
      />,
    ),
  );
}
it("no permite cobrar una OT saldada ni un importe superior al saldo", async () => {
  await formulario(100.25);
  await elegirMetodo();
  await monto("100,26");
  expect(boton().disabled).toBe(true);
  expect(el.querySelector('[role="alert"]')?.textContent).toContain(
    "saldo pendiente",
  );
  await monto("100,25");
  expect(boton().disabled).toBe(false);
  await formulario(0);
  expect(boton().disabled).toBe(true);
});
it("bloquea dos clics antes de que llegue la respuesta y conserva centavos", async () => {
  let resolver!: () => void;
  const enviar = vi.fn<(draft: CobroDraft) => Promise<void>>(
    () =>
      new Promise<void>((r) => {
        resolver = r;
      }),
  );
  await formulario(100.25, enviar);
  await elegirMetodo();
  await act(async () => boton().click());
  expect(enviar).not.toHaveBeenCalled();
  await act(async () => {
    confirmar().click();
    confirmar().click();
  });
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(enviar.mock.calls[0][0].payload.montoBruto).toBe(100.25);
  expect(confirmar().disabled).toBe(true);
  expect(corregir().disabled).toBe(true);
  await act(async () => resolver());
});
it("reintentar una respuesta perdida usa la misma clave; editar el cobro crea otra", async () => {
  const enviar = vi.fn().mockRejectedValue(new Error("Respuesta perdida"));
  await formulario(100.25, enviar);
  await elegirMetodo();
  await act(async () => boton().click());
  await act(async () => confirmar().click());
  await act(async () => confirmar().click());
  expect(enviar.mock.calls[1][0].payload.idempotencyKey).toBe(
    enviar.mock.calls[0][0].payload.idempotencyKey,
  );
  await act(async () => corregir().click());
  await monto("50");
  await act(async () => boton().click());
  await act(async () => confirmar().click());
  expect(enviar.mock.calls[2][0].payload.idempotencyKey).not.toBe(
    enviar.mock.calls[0][0].payload.idempotencyKey,
  );
});
it("el registro general de anticipos no queda limitado al saldo de una OT", async () => {
  const enviar = vi.fn();
  await formulario(0, enviar, false);
  await elegirMetodo();
  await monto("200");
  await act(async () => boton().click());
  expect(enviar).not.toHaveBeenCalled();
  await act(async () => confirmar().click());
  expect(enviar).toHaveBeenCalledTimes(1);
});
it("abrir la URL de una OT saldada no ofrece un formulario de cobro", async () => {
  await act(async () =>
    root.render(
      <RegistrarCobroView
        contexto={{
          tipo: "orden",
          id: "orden",
          numero: "OT-TEST",
          clienteId: null,
          clienteNombre: "Cliente ficticio",
          resumen: "",
          total: 100,
          cobradoBruto: 100,
        }}
        metodos={metodos}
        cuentas={cuentas}
      />,
    ),
  );
  expect(el.textContent).toContain("Orden totalmente saldada");
  expect(el.querySelector('[aria-label="Monto a cobrar"]')).toBeNull();
});
it("no permite agregar pagos en la OT nueva cuando ya se cargó su total", async () => {
  await act(async () =>
    root.render(
      <PagosStagingTab
        total={0}
        cobros={[]}
        onAgregar={vi.fn()}
        onQuitar={vi.fn()}
      />,
    ),
  );
  const agregar = [...el.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Agregar cobro"),
  );
  expect(agregar?.disabled).toBe(true);
});

it.each(["transferencia", "tarjeta_debito", "tarjeta_credito"])("%s nunca ofrece ni selecciona efectivo, aunque sea el destino predeterminado", async tipo => {
  const medios = [{ ...metodos[0], id: tipo, tipo, nombre: tipo } as MetodoPago];
  await act(async () => root.render(<CobroFormulario saldo={100} metodos={medios} cuentas={[
    ...cuentas, { id: "banco", nombre: "Banco ficticio", tipo: "banco", moneda: "ARS" },
  ]} guardando={false} onSubmit={vi.fn()} />));
  await elegirMetodo(tipo);
  const selector = el.querySelector<HTMLSelectElement>("#cobro-cuenta-destino")!;
  expect([...selector.options].map(o => o.value)).toEqual(["banco"]);
  expect(selector.value).toBe("banco");
  await act(async () => root.render(<CobroFormulario saldo={100} metodos={medios} cuentas={cuentas} guardando={false} onSubmit={vi.fn()} />));
  expect(selector.value).toBe("");
  expect(boton().disabled).toBe(true);
});

it("obliga a elegir el medio aunque haya uno solo y no informa un error de cuenta antes de elegir", async () => {
  const enviar = vi.fn();
  await formulario(100.25, enviar);
  const select = el.querySelector<HTMLSelectElement>("#cobro-metodo-pago")!;
  expect(select.value).toBe("");
  expect(select.selectedOptions[0].text).toBe("Elegí un medio de pago");
  expect(select.required).toBe(true);
  expect(el.textContent).not.toContain("No hay una cuenta compatible");
  expect(boton().disabled).toBe(true);
  await act(async () => boton().click());
  expect(dialogo()).toBeNull();
  expect(enviar).not.toHaveBeenCalled();
  await elegirMetodo();
  expect(boton().disabled).toBe(false);
});

it("cancelar la confirmación conserva los datos y permite revisar el monto y medio corregidos sin enviar antes", async () => {
  const enviar = vi.fn();
  await act(async () => root.render(<CobroFormulario saldo={100.25} metodos={[
    ...metodos, { ...metodos[0], id: "transferencia", tipo: "transferencia", nombre: "Transferencia bancaria" },
  ]} cuentas={[...cuentas, { id: "banco", nombre: "Banco ficticio", tipo: "banco", moneda: "ARS" }]}
    guardando={false} onSubmit={enviar} />));
  await elegirMetodo();
  await act(async () => boton().click());
  expect(dialogo()?.textContent).toContain("100,25");
  expect(dialogo()?.textContent).toContain("Efectivo");
  expect(dialogo()?.textContent).toContain("Caja ficticia");
  expect(enviar).not.toHaveBeenCalled();
  await act(async () => corregir().click());
  expect(dialogo()).toBeNull();
  expect(el.querySelector<HTMLSelectElement>("#cobro-metodo-pago")!.value).toBe("efectivo");
  expect(el.querySelector<HTMLInputElement>('[aria-label="Monto a cobrar"]')!.value).toBe("100,25");
  await monto("50,75");
  await elegirMetodo("transferencia");
  await act(async () => boton().click());
  expect(dialogo()?.textContent).toContain("50,75");
  expect(dialogo()?.textContent).toContain("Transferencia bancaria");
  expect(dialogo()?.textContent).toContain("Banco ficticio");
  expect(dialogo()?.textContent).not.toContain("Efectivo");
  expect(enviar).not.toHaveBeenCalled();
  await act(async () => confirmar().click());
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(enviar.mock.calls[0][0].payload).toMatchObject({
    montoBruto: 50.75, metodoPagoId: "transferencia", cuentaDestinoId: "banco",
  });
});

it("cerrar la confirmación no registra el cobro", async () => {
  const enviar = vi.fn();
  await formulario(100, enviar);
  await elegirMetodo();
  await act(async () => boton().click());
  await act(async () => dialogo()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click());
  expect(dialogo()).toBeNull();
  expect(enviar).not.toHaveBeenCalled();
});

it("cada pago de una OT nueva vuelve a pedir el medio y confirma antes de agregarlo", async () => {
  const agregar = vi.fn();
  await act(async () => root.render(<PagosStagingTab total={200} cobros={[]} onAgregar={agregar} onQuitar={vi.fn()} />));
  const abrir = () => [...el.querySelectorAll("button")].find(b => b.textContent?.includes("Agregar cobro"))!;
  await act(async () => abrir().click());
  expect(el.querySelector<HTMLSelectElement>("#cobro-metodo-pago")!.value).toBe("");
  await elegirMetodo();
  await act(async () => abrir().click());
  expect(agregar).not.toHaveBeenCalled();
  expect(dialogo()?.textContent).toContain("se registrará al emitirla");
  expect(confirmar().textContent).toBe("Confirmar y agregar");
  await act(async () => confirmar().click());
  expect(agregar).toHaveBeenCalledTimes(1);
  expect(mocks.crear).not.toHaveBeenCalled();
  await act(async () => abrir().click());
  expect(el.querySelector<HTMLSelectElement>("#cobro-metodo-pago")!.value).toBe("");
});
