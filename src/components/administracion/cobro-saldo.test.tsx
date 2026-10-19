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
  mocks.metodos.mockResolvedValue(metodos);
  mocks.cuentas.mockResolvedValue(cuentas);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
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
  await act(async () => {
    boton().click();
    boton().click();
  });
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(enviar.mock.calls[0][0].payload.montoBruto).toBe(100.25);
  await act(async () => resolver());
});
it("reintentar una respuesta perdida usa la misma clave; editar el cobro crea otra", async () => {
  const enviar = vi.fn().mockRejectedValue(new Error("Respuesta perdida"));
  await formulario(100.25, enviar);
  await act(async () => boton().click());
  await act(async () => boton().click());
  expect(enviar.mock.calls[1][0].payload.idempotencyKey).toBe(
    enviar.mock.calls[0][0].payload.idempotencyKey,
  );
  await monto("50");
  await act(async () => boton().click());
  expect(enviar.mock.calls[2][0].payload.idempotencyKey).not.toBe(
    enviar.mock.calls[0][0].payload.idempotencyKey,
  );
});
it("el registro general de anticipos no queda limitado al saldo de una OT", async () => {
  const enviar = vi.fn();
  await formulario(0, enviar, false);
  await monto("200");
  await act(async () => boton().click());
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
  const selector = el.querySelector<HTMLSelectElement>("#cobro-cuenta-destino")!;
  expect([...selector.options].map(o => o.value)).toEqual(["banco"]);
  expect(selector.value).toBe("banco");
  await act(async () => root.render(<CobroFormulario saldo={100} metodos={medios} cuentas={cuentas} guardando={false} onSubmit={vi.fn()} />));
  expect(selector.value).toBe("");
  expect(boton().disabled).toBe(true);
});
