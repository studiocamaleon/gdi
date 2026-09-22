// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContratacionDialog } from "./contratacion-dialog";
import type { PlanContratable, VistaContratacion } from "@/lib/suscripcion-api";
const mocks = vi.hoisted(() => ({
  revisar: vi.fn(),
  confirmar: vi.fn(),
  consultar: vi.fn(),
  descartar: vi.fn(),
}));
vi.mock("@/lib/suscripcion-api", () => ({
  revisarContratacion: mocks.revisar,
  confirmarContratacion: mocks.confirmar,
  consultarContratacion: mocks.consultar,
  descartarContratacion: mocks.descartar,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
const plan: PlanContratable = {
  codigo: "esencial",
  nombre: "Grafo Esencial",
  descripcion: "Cotizá y organizá tus trabajos",
  ofertaId: "oferta-1",
  precioMensual: 190,
  moneda: "USD",
  priceId: "pri_base",
  anual: null,
  usuarioMensual: { importe: 15, cantidadMaxima: 99 },
  esActual: false,
  features: { usuariosMax: 3, storageGb: 250 },
};
const preparada = (): VistaContratacion => ({
  id: "revision-1",
  ofertaId: "oferta-1",
  tipo: "checkout",
  estado: "preparada",
  expiraEl: "2026-09-22T12:00:00Z",
  transaccionId: null,
  detalle: null,
  revision: {
    actual: { nombre: "Prueba", adicionales: 0 },
    destino: {
      nombre: "Grafo Esencial",
      version: 1,
      incluidos: 3,
      adicionales: 2,
      totalUsuarios: 5,
      gb: 250,
    },
    diferencias: [],
    bloqueos: [],
    revisiones: [],
    ciclo: "mensual",
    precioBase: 190,
    precioUsuario: 15,
    totalPeriodo: 220,
    diagnostico: {
      estado: "sin_excedentes",
      usuariosCupoResultante: 5,
      usuariosExcedidos: 0,
      almacenamientoCupoBytes: "268435456000",
      almacenamientoExcedidoBytes: "0",
      funcionesAgregadas: 0,
      funcionesRetiradas: 0,
      hallazgos: [],
    },
  },
  cobro: {
    aCobrar: null,
    aCredito: 0,
    moneda: "USD",
    impuestosEnCheckout: true,
  },
});
let container: HTMLDivElement, root: Root;
const onEstado = vi.fn(),
  abrirPago = vi.fn(),
  completada = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.revisar.mockResolvedValue(preparada());
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  container.remove();
  vi.unstubAllGlobals();
});

it("espera la confirmación tardía sin repetir el pago y deja de consultar al aplicarse", async () => {
  vi.useFakeTimers();
  const r = { ...preparada(), estado: "checkout", transaccionId: "txn_1" };
  mocks.consultar.mockResolvedValueOnce(r).mockResolvedValueOnce({
    ...r,
    estado: "aplicada",
    detalle: "Contrato confirmado por Paddle.",
  });
  await render(r);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(completada).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Suscripción actualizada");
  expect(container.textContent).not.toContain("Paddle mostrará los impuestos");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(mocks.consultar).toHaveBeenCalledTimes(2);
  expect(mocks.confirmar).not.toHaveBeenCalled();
});

it("acota la consulta automática y conserva la recuperación manual ante fallos de red", async () => {
  vi.useFakeTimers();
  mocks.consultar.mockRejectedValue(new Error("Sin red"));
  await render({ ...preparada(), estado: "verificar" });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120000);
  });
  expect(mocks.consultar).toHaveBeenCalledTimes(12);
  expect(button("Consultar estado")).toBeDefined();
  expect(mocks.confirmar).not.toHaveBeenCalled();
});
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
const click = async (text: string) => act(async () => button(text)!.click());
const render = async (inicial: VistaContratacion | null = null) =>
  act(async () =>
    root.render(
      <ContratacionDialog
        plan={plan}
        inicial={inicial}
        cicloInicial="mensual"
        adicionalesIniciales={2}
        cerrar={vi.fn()}
        onEstado={onEstado}
        abrirPago={abrirPago}
        completada={completada}
      />,
    ),
  );

it("revisa la oferta y los adicionales antes de pedir un cobro", async () => {
  await render();
  expect(mocks.revisar).not.toHaveBeenCalled();
  expect(mocks.confirmar).not.toHaveBeenCalled();
  await click("Revisar condiciones y cobro");
  expect(mocks.revisar).toHaveBeenCalledWith({
    ofertaId: "oferta-1",
    ciclo: "mensual",
    adicionales: 2,
  });
  expect(container.textContent).toContain("5 usuarios");
  expect(container.textContent).toContain("US$ 220 / mes");
  expect(container.textContent).toContain("total definitivo");
  expect(mocks.confirmar).not.toHaveBeenCalled();
  mocks.confirmar.mockResolvedValue({
    ...preparada(),
    estado: "checkout",
    transaccionId: "txn_1",
  });
  await click("Continuar al pago");
  expect(mocks.confirmar).toHaveBeenCalledWith("revision-1", []);
  expect(abrirPago).toHaveBeenCalledWith(
    expect.objectContaining({ transaccionId: "txn_1" }),
  );
  expect(completada).not.toHaveBeenCalled();
});

it("un bloqueo de cupo impide continuar al pago y permite revisar otras opciones", async () => {
  const r = preparada();
  r.id = null;
  r.estado = "requiere_revision";
  r.revision.bloqueos = ["El equipo excede el cupo"];
  await render(r);
  expect(container.textContent).toContain("El equipo excede el cupo");
  expect(button("Continuar al pago")).toBeUndefined();
  await click("Cambiar opciones");
  expect(button("Revisar condiciones y cobro")).toBeDefined();
  expect(mocks.confirmar).not.toHaveBeenCalled();
});

it("una respuesta perdida sólo permite consultar el mismo intento", async () => {
  await render(preparada());
  mocks.confirmar.mockRejectedValue(new Error("Conexión interrumpida"));
  await click("Continuar al pago");
  expect(button("Continuar al pago")).toBeUndefined();
  expect(button("Cambiar opciones")).toBeUndefined();
  expect(onEstado).toHaveBeenCalledWith(
    expect.objectContaining({ id: "revision-1", estado: "verificar" }),
  );
  mocks.consultar.mockResolvedValue({ ...preparada(), estado: "aplicada" });
  await click("Consultar estado");
  expect(mocks.consultar).toHaveBeenCalledWith("revision-1");
  expect(mocks.confirmar).toHaveBeenCalledTimes(1);
  expect(completada).toHaveBeenCalledTimes(1);
});

it("retoma la transacción existente y no inicia otro checkout", async () => {
  const r = {
    ...preparada(),
    estado: "checkout",
    transaccionId: "txn_existente",
  };
  await render(r);
  await click("Retomar pago");
  expect(abrirPago).toHaveBeenCalledWith(r);
  expect(mocks.confirmar).not.toHaveBeenCalled();
  expect(mocks.revisar).not.toHaveBeenCalled();
  mocks.descartar.mockResolvedValue({
    ...r,
    estado: "rechazada",
    detalle: "Checkout descartado sin completar el pago.",
  });
  await click("Descartar checkout");
  expect(mocks.descartar).toHaveBeenCalledWith("revision-1");
  expect(button("Cambiar opciones")).toBeDefined();
});

it("exige aceptar cada revisión de continuidad antes de confirmar", async () => {
  const r = preparada();
  r.tipo = "cambio";
  r.revision.revisiones = ["continuidad_manual"];
  r.revision.diagnostico.hallazgos = [
    {
      codigo: "continuidad_manual",
      nivel: "revisar",
      titulo: "Revisar operaciones",
      detalle: "Confirmá la continuidad de los trabajos",
    },
  ];
  await render(r);
  expect(button("Confirmar cambio y cobro")!.disabled).toBe(true);
  await act(async () =>
    (container.querySelector('[role="checkbox"]') as HTMLElement).click(),
  );
  expect(button("Confirmar cambio y cobro")!.disabled).toBe(false);
  mocks.confirmar.mockResolvedValue({ ...r, estado: "aplicada" });
  await click("Confirmar cambio y cobro");
  expect(mocks.confirmar).toHaveBeenCalledWith("revision-1", [
    "continuidad_manual",
  ]);
});

it("muestra cantidades de impresión y no pide el cobro con una revisión incompleta", async () => {
  const r = preparada();
  r.tipo = "cambio";
  r.revision.revisiones = ["impresion_sin_envio", "impresion_sin_verificar"];
  r.revision.diagnostico.hallazgos = [
    {
      codigo: "impresion_sin_envio",
      nivel: "revisar",
      cantidad: 2,
      titulo: "Trabajos sin enviar",
      detalle: "Continuarán por la vía manual.",
    },
    {
      codigo: "impresion_sin_verificar",
      nivel: "revisar",
      cantidad: 1,
      titulo: "Salidas sin verificar",
      detalle: "Conservan su historial.",
    },
  ];
  await render(r);
  expect(container.textContent).toContain("Trabajos sin enviar · 2");
  expect(container.textContent).toContain("Salidas sin verificar · 1");
  const revisiones =
    container.querySelectorAll<HTMLElement>('[role="checkbox"]');
  expect(revisiones).toHaveLength(2);
  await act(async () => revisiones[0].click());
  expect(button("Confirmar cambio y cobro")!.disabled).toBe(true);
  await click("Confirmar cambio y cobro");
  expect(mocks.confirmar).not.toHaveBeenCalled();
  await act(async () => revisiones[1].click());
  expect(button("Confirmar cambio y cobro")!.disabled).toBe(false);
  mocks.confirmar.mockResolvedValue({ ...r, estado: "aplicada" });
  await click("Confirmar cambio y cobro");
  expect(mocks.confirmar).toHaveBeenCalledWith(
    "revision-1",
    r.revision.revisiones,
  );
});
