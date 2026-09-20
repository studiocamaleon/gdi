// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MaterialesOrdenTab } from "./materiales-orden-tab";
import {
  getMaterialesOrden,
  type MaterialesOrden,
} from "@/lib/materiales-orden-api";

vi.mock("@/lib/materiales-orden-api", () => ({ getMaterialesOrden: vi.fn() }));
vi.mock("@/components/inventario/stock-conversion-fields", () => ({
  stockUnitLabel: (unit: string) => unit,
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
    isDisabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    isDisabled?: boolean;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
const response = (id = "ot-1"): MaterialesOrden => ({
  ordenId: id,
  revision: "r1",
  pendientes: [],
  resumen: {
    variantes: 1,
    calculadas: 1,
    porRevisar: 0,
    desgastesExcluidos: 0,
  },
  necesidades: [
    {
      varianteId: "placa",
      nombre: "PVC 3 mm",
      estado: "calculada",
      cantidad: 2,
      unidad: "placa",
      origenes: [
        {
          itemId: "item",
          producto: "Cartel",
          pasoId: "paso",
          paso: "Imprimir",
          tipo: "material",
          loteCompartido: false,
          cantidadCalculada: 2,
          unidadCalculada: "placa",
          cantidadStock: 2,
          unidadStock: "placa",
          observacion: null,
        },
      ],
    },
  ],
});
describe("Materiales de la OT", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("muestra las cantidades y el origen del cálculo", async () => {
    vi.mocked(getMaterialesOrden).mockResolvedValue(response());
    await act(async () => root.render(<MaterialesOrdenTab ordenId="ot-1" />));
    expect(container.textContent).toContain("PVC 3 mm");
    expect(container.textContent).toContain("2 placa");
    expect(container.textContent).toContain("disponibilidad de materiales");
    expect(container.textContent).not.toContain("Por determinar");
  });

  it("una consulta fallida nunca aparece como cero materiales", async () => {
    vi.mocked(getMaterialesOrden).mockRejectedValue(
      new Error("No se pudo consultar la OT"),
    );
    await act(async () => root.render(<MaterialesOrdenTab ordenId="ot-1" />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "No se pudo consultar",
    );
    expect(container.textContent).not.toContain("no requiere materiales");
  });

  it("mantiene visibles las advertencias de una OT manual sin inventar consumos", async () => {
    const data = response();
    data.necesidades = [];
    data.pendientes = [
      {
        itemId: "i",
        producto: "Trabajo manual",
        paso: null,
        motivo: "Requiere revisión",
      },
    ];
    data.resumen = {
      variantes: 0,
      calculadas: 0,
      porRevisar: 1,
      desgastesExcluidos: 0,
    };
    vi.mocked(getMaterialesOrden).mockResolvedValue(data);
    await act(async () => root.render(<MaterialesOrdenTab ordenId="ot-1" />));
    expect(container.textContent).toContain("Trabajo manual");
    expect(container.textContent).toContain("Requiere revisión");
    expect(container.textContent).not.toContain("no requiere materiales");
  });

  it("descarta respuestas de otra orden y actualizar vuelve a consultar", async () => {
    let resolveFirst!: (data: MaterialesOrden) => void;
    vi.mocked(getMaterialesOrden)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(response("ot-2"));
    await act(async () => root.render(<MaterialesOrdenTab ordenId="ot-1" />));
    expect(container.textContent).toContain("Consultando materiales");
    await act(async () => root.render(<MaterialesOrdenTab ordenId="ot-2" />));
    const stale = response();
    stale.necesidades[0].nombre = "Material de otra OT";
    await act(async () => resolveFirst(stale));
    expect(container.textContent).not.toContain("Material de otra OT");
    await act(async () => container.querySelector("button")!.click());
    expect(getMaterialesOrden).toHaveBeenCalledTimes(3);
  });
});
