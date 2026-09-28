// @vitest-environment jsdom
import { act, type ReactNode, type InputHTMLAttributes } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CentroCostoFicha } from "./centro-costo-ficha";
import { guardarCentroCostoPlanilla } from "@/lib/costos-api";
import type { CentroCosto } from "@/lib/costos";
import { toast } from "sonner";

const navigation = vi.hoisted(() => ({
  select: (key: string) => {
    void key;
  },
}));
vi.mock("@/lib/costos-api", () => ({
  guardarCentroCostoPlanilla: vi.fn(),
  getCentroCostoConfiguracion: vi.fn(),
  getCentroCostoTarifas: vi.fn(),
  publicarTarifaCentroCosto: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@heroui/react", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Tabs = Object.assign(
    ({
      children,
      onSelectionChange,
    }: {
      children: ReactNode;
      onSelectionChange: (key: string) => void;
    }) => {
      navigation.select = onSelectionChange;
      return <div>{children}</div>;
    },
    { Panel: Box },
  );
  return {
    Card: Box,
    Tabs,
    Input: (props: InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
    Modal: { Footer: Box },
    Drawer: {
      Backdrop: ({
        children,
        isOpen,
      }: {
        children: ReactNode;
        isOpen: boolean;
      }) => (isOpen ? <div>{children}</div> : null),
      Content: Box,
      Dialog: Box,
      Header: Box,
      Heading: Box,
      Body: Box,
      Footer: Box,
    },
  };
});
vi.mock("@/components/design-system/navigation-tab-list", () => ({
  NavigationTabList: ({
    items,
  }: {
    items: { id: string; label: string }[];
  }) => (
    <div role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          onClick={() => navigation.select(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
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
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    children,
    isOpen,
  }: {
    children: ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div>{children}</div> : null),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: () => <span />,
}));
vi.mock("@/components/design-system/choice-controls", () => ({
  SegmentedControl: ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="Tipo de centro"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

describe("alta completa de centro de costo", () => {
  let container: HTMLDivElement, root: Root;
  const onSaved = vi.fn(),
    onOpenChange = vi.fn();
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text,
    )!;
  const input = (text: string) =>
    container.querySelector<HTMLInputElement>(`input[aria-label="${text}"]`) ??
    Array.from(container.querySelectorAll("label"))
      .find((l) => l.querySelector("span")?.textContent === text)!
      .querySelector("input")!;
  async function escribir(text: string, value: string) {
    await act(async () => {
      const field = input(text);
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const ir = async (tab: string) => act(async () => button(tab).click());
  beforeEach(async () => {
    vi.clearAllMocks();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.mocked(guardarCentroCostoPlanilla).mockResolvedValue({
      centro: { id: "centro-nuevo" } as CentroCosto,
      publicacion: { periodo: "2026-09", centrosPublicados: 1 },
      advertencias: [],
      publicada: true,
    });
    await act(async () =>
      root.render(
        <CentroCostoFicha
          open
          centro={null}
          periodo="2026-09"
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />,
      ),
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  it("permite completar gastos y horas antes del primer guardado y conserva los datos al cambiar de pestaña", async () => {
    expect(
      Array.from(container.querySelectorAll('[role="tab"]')).map(
        (t) => t.textContent,
      ),
    ).toEqual(["Datos generales", "Gastos", "Ajustes", "Historial"]);
    await escribir("Nombre *", "Acabado de prueba");
    await ir("Gastos");
    await act(async () => button("Agregar").click());
    await escribir("Nombre de la línea", "Energía");
    await escribir("Valor mensual", "20000");
    await ir("Ajustes");
    await escribir("Horas productivas", "100");
    await ir("Datos generales");
    expect(input("Nombre *").value).toBe("Acabado de prueba");
    expect(container.textContent).toContain("200,00");
    await ir("Historial");
    expect(container.textContent).toContain("Sin tarifas publicadas");
    await ir("Ajustes");
    expect(input("Horas productivas").value).toBe("100");
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent?.trim().startsWith("Guardar"))!
        .click(),
    );
    expect(guardarCentroCostoPlanilla).toHaveBeenCalledWith(
      expect.objectContaining({
        id: undefined,
        periodo: "2026-09",
        horasProductivas: 100,
        centro: expect.objectContaining({
          nombre: "Acabado de prueba",
          tipoCentro: "productivo",
        }),
        lineas: [
          expect.objectContaining({ nombre: "Energía", valorMensual: 20000 }),
        ],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Centro creado"),
    );
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("un centro de estructura no pide horas ni envía capacidad productiva", async () => {
    await escribir("Nombre *", "Administración de prueba");
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "no_productivo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await ir("Ajustes");
    expect(container.textContent).not.toContain("Horas productivas");
    await act(async () => button("Guardar y recalcular").click());
    expect(guardarCentroCostoPlanilla).toHaveBeenCalledWith(
      expect.objectContaining({
        horasProductivas: 0,
        centro: expect.objectContaining({ tipoCentro: "no_productivo" }),
      }),
    );
  });
  it("conserva la planilla visible si falla el guardado", async () => {
    vi.mocked(guardarCentroCostoPlanilla).mockRejectedValue(
      new Error("No se pudo guardar"),
    );
    await escribir("Nombre *", "Conservar borrador");
    await ir("Ajustes");
    await escribir("Horas productivas", "160");
    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent?.trim().startsWith("Guardar"))!
        .click(),
    );
    expect(input("Horas productivas").value).toBe("160");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("No se pudo guardar");
  });
});
