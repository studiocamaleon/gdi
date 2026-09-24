// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresupuestoCorreoDialog } from "./presupuesto-correo-dialog";

const api = vi.hoisted(() => ({
  preparar: vi.fn(),
  correo: vi.fn(),
  whatsapp: vi.fn(),
  previa: vi.fn(),
}));
vi.mock("@/lib/presupuestos-api", () => ({
  prepararCorreoPresupuesto: api.preparar,
  enviarCorreoPresupuesto: api.correo,
  enviarPresupuesto: api.whatsapp,
  previsualizarCorreoPresupuesto: api.previa,
}));
vi.mock("@/components/navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    isDisabled,
    onPress,
    type = "button",
  }: {
    children: React.ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    type?: "button" | "submit";
  }) => (
    <button type={type} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
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
vi.mock("@heroui/react", () => ({
  Input: (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} />,
  TextArea: (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...p} />
  ),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("editor de correo de presupuesto", () => {
  let root: Root;
  let host: HTMLDivElement;
  const cerrar = vi.fn();
  const actualizado = vi.fn();
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    api.preparar.mockResolvedValue({
      empresa: "Empresa QA",
      numero: "PRES-1",
      para: "cliente@example.test",
      responderA: "ventas@example.test",
      remitente: "Empresa vía Grafo",
      asunto: "Asunto inicial",
      mensaje: "Mensaje inicial",
      disponible: true,
      contactos: [],
    });
    api.correo.mockReset().mockResolvedValue({ estado: "PENDIENTE" });
    api.whatsapp.mockResolvedValue({ estado: "enviado" });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });
  const montar = async (
    canalInicial: "correo" | "ambos" | "whatsapp" = "correo",
  ) => {
    await act(async () =>
      root.render(
        <PresupuestoCorreoDialog
          id="presupuesto-1"
          canalInicial={canalInicial}
          onCerrar={cerrar}
          onEnviado={actualizado}
        />,
      ),
    );
  };
  const submit = () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  it("envía sólo correo, conserva asunto/mensaje y anuncia PDF más enlace", async () => {
    await montar();
    expect(host.textContent).toContain("PRES-1.pdf");
    expect(host.textContent).toContain("Ver y aprobar presupuesto");
    await act(async () => {
      submit();
    });
    expect(api.correo).toHaveBeenCalledWith(
      "presupuesto-1",
      expect.objectContaining({
        para: "cliente@example.test",
        asunto: "Asunto inicial",
        mensaje: "Mensaje inicial",
      }),
    );
    expect(api.whatsapp).not.toHaveBeenCalled();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it("evita doble submit y reutiliza la identidad del envío si falla la respuesta", async () => {
    let rechazar!: (reason: Error) => void;
    api.correo.mockReturnValueOnce(
      new Promise((_, reject) => {
        rechazar = reject;
      }),
    );
    await montar();
    await act(async () => {
      submit();
      submit();
    });
    expect(api.correo).toHaveBeenCalledTimes(1);
    await act(async () => {
      rechazar(new Error("Sin respuesta"));
    });
    expect(cerrar).not.toHaveBeenCalled();
    await act(async () => {
      submit();
    });
    expect(api.correo.mock.calls[0][1].idempotencia).toBe(
      api.correo.mock.calls[1][1].idempotencia,
    );
  });

  it("solicita ambos canales sólo cuando se eligen ambos", async () => {
    await montar("ambos");
    await act(async () => {
      submit();
    });
    expect(api.correo).toHaveBeenCalledTimes(1);
    expect(api.whatsapp).toHaveBeenCalledTimes(1);
  });

  it("WhatsApp no encola correos", async () => {
    await montar("whatsapp");
    await act(async () => {
      submit();
    });
    expect(api.correo).not.toHaveBeenCalled();
    expect(api.whatsapp).toHaveBeenCalledWith("presupuesto-1");
  });

  it("sin correo de respuesta impide el envío e indica dónde configurarlo", async () => {
    api.preparar.mockResolvedValueOnce({
      empresa: "Empresa QA",
      numero: "PRES-1",
      para: "cliente@example.test",
      responderA: "",
      remitente: "Grafo",
      asunto: "Asunto",
      mensaje: "Mensaje",
      disponible: true,
      contactos: [],
    });
    await montar();
    expect(host.textContent).toContain("Configurá el correo comercial");
    expect(
      host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled,
    ).toBe(true);
  });
});
