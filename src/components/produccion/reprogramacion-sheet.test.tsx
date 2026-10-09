// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ReprogramacionSheet } from "./reprogramacion-sheet";
import type { RevisionReprogramacion } from "@/lib/reprogramacion-api";
vi.mock("@/lib/reprogramacion-api", () => ({
  simularReprogramacion: vi.fn(),
  confirmarReprogramacion: vi.fn(),
}));
vi.mock("@/components/design-system/form-sheet", () => ({
  FormSheet: ({
    children,
    footer,
    title,
  }: {
    children: ReactNode;
    footer: ReactNode;
    title: string;
  }) => (
    <div role="dialog">
      <h2>{title}</h2>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
    isPending,
    ...props
  }: {
    children: ReactNode;
    onPress: () => void;
    isDisabled: boolean;
    isPending: boolean;
  }) => (
    <button {...props} disabled={isDisabled || isPending} onClick={onPress}>
      {children}
    </button>
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
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
let root: Root, contenedor: HTMLDivElement;
const acciones = { simular: vi.fn(), confirmar: vi.fn() };
const onSaved = vi.fn();
const revision = (): RevisionReprogramacion => ({
  token: "revision-qa",
  venceEl: new Date(Date.now() + 120_000).toISOString(),
  viable: true,
  zona: "America/Argentina/Buenos_Aires",
  motivos: [],
  advertencias: ["La entrega comprometida se conserva."],
  alcance: "Impresión QA",
  solicitado: "2099-01-10T13:00:00Z",
  entregaOrden: { actual: "2099-01-15", propuesta: "2099-01-15" },
  pasos: [
    {
      id: "paso-qa",
      orden: "OT-QA",
      paso: "Impresión",
      trabajo: "Folleto QA",
      inicioActual: "2099-01-10T12:00:00Z",
      finActual: "2099-01-10T13:00:00Z",
      inicioPropuesto: "2099-01-10T13:00:00Z",
      finPropuesto: "2099-01-10T14:00:00Z",
      seGuarda: true,
    },
  ],
  entregas: [],
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2099-01-09T12:00:00Z"));
  vi.clearAllMocks();
  acciones.simular.mockResolvedValue(revision());
  acciones.confirmar.mockResolvedValue({ confirmado: true });
  contenedor = document.createElement("div");
  document.body.append(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  vi.restoreAllMocks();
});
const boton = (texto: string) =>
  [...contenedor.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  )!;
const montar = async (tipo: "produccion" | "entrega" = "produccion") =>
  act(async () =>
    root.render(
      <ReprogramacionSheet
        pasoId="paso-qa"
        paso="Impresión"
        trabajo="Folleto QA"
        zona="America/Argentina/Buenos_Aires"
        inicio={new Date("2099-01-10T13:00:00Z")}
        entrega="2099-01-15"
        tipo={tipo}
        onClose={vi.fn()}
        onSaved={onSaved}
        acciones={acciones}
      />,
    ),
  );

it("requiere revisar el impacto antes de confirmar, muestra hora del taller y envía sólo la propuesta firmada", async () => {
  await montar();
  expect(boton("Confirmar cambio")).toBeUndefined();
  await act(async () => boton("Revisar impacto").click());
  expect(acciones.simular).toHaveBeenCalledWith("paso-qa", {
    tipo: "produccion",
    alcance: "paso",
    fecha: "2099-01-10",
    hora: "10:00",
  });
  expect(contenedor.textContent).toContain(
    "La entrega comprometida se conserva.",
  );
  expect(contenedor.textContent).toContain("10/01/2099, 10:00");
  await act(async () => boton("Confirmar cambio").click());
  expect(acciones.confirmar).toHaveBeenCalledWith(
    "paso-qa",
    "revision-qa",
    undefined,
  );
  expect(onSaved).toHaveBeenCalledOnce();
});

it("descarta la revisión anterior al cambiar el alcance", async () => {
  await montar();
  await act(async () => boton("Revisar impacto").click());
  const select = contenedor.querySelector("select")!;
  await act(async () => {
    select.value = "item";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(boton("Confirmar cambio")).toBeUndefined();
  await act(async () => boton("Revisar impacto").click());
  expect(acciones.simular).toHaveBeenLastCalledWith(
    "paso-qa",
    expect.objectContaining({ alcance: "item" }),
  );
});

it("la entrega se revisa sin hora y un conflicto exige otra revisión", async () => {
  await montar("entrega");
  expect(contenedor.querySelector("input[type=time]")).toBeNull();
  await act(async () => boton("Revisar impacto").click());
  expect(acciones.simular).toHaveBeenCalledWith("paso-qa", {
    tipo: "entrega",
    alcance: "item",
    fecha: "2099-01-15",
  });
  acciones.confirmar.mockRejectedValueOnce(new Error("conflicto QA"));
  await act(async () => boton("Confirmar cambio").click());
  expect(contenedor.querySelector("[role=alert]")!.textContent).toContain(
    "No se guardó el cambio",
  );
  expect(boton("Confirmar cambio")).toBeUndefined();
  expect(onSaved).not.toHaveBeenCalled();
});

it("una revisión vencida o inviable no ofrece confirmar", async () => {
  acciones.simular.mockResolvedValueOnce({
    ...revision(),
    venceEl: new Date(Date.now() - 1000).toISOString(),
  });
  await montar();
  await act(async () => boton("Revisar impacto").click());
  expect(boton("Actualizar propuesta")).toBeDefined();
  expect(boton("Confirmar cambio")).toBeUndefined();
  acciones.simular.mockResolvedValueOnce({
    ...revision(),
    viable: false,
    token: null,
    motivos: ["No hay horario disponible"],
  });
  await act(async () => boton("Actualizar propuesta").click());
  expect(contenedor.textContent).toContain("No hay horario disponible");
  expect(boton("Confirmar cambio")).toBeUndefined();
});
