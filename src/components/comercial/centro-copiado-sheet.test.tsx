// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CentroCopiadoSheet from "./centro-copiado-sheet";
import { itemConstruidoAPropuestaItem } from "@/lib/centro-copiado-api";
import type { CentroCopiadoMeta } from "@/lib/centro-copiado-api";

const mocks = vi.hoisted(() => ({
  cotizar: vi.fn(),
  construir: vi.fn(),
  opciones: vi.fn(),
}));
vi.mock("./tipo-cambio-documento", () => ({
  useMotorConTipoCambio: () => ({
    cotizarCentroCopiado: mocks.cotizar,
    construirItemsCentroCopiado: mocks.construir,
  }),
}));
vi.mock("@/lib/centro-copiado-api", async (original) => ({
  ...(await original<object>()),
  opcionesCentroCopiado: mocks.opciones,
}));
vi.mock("@/components/design-system/appearance", () => ({
  DesignSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  useDesignScope: () => ({}),
  useDesignTheme: () => "",
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    children,
    isOpen,
  }: {
    children: ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <section>{children}</section> : null),
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    isDisabled,
    onPress,
  }: {
    children: ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/design-system/select-field", () => ({
  SelectField: () => null,
}));
vi.mock("@/components/design-system/choice-controls", () => ({
  SegmentedControl: () => null,
}));
vi.mock("@/components/ui/confirmacion-salida", () => ({
  ConfirmacionSalida: () => null,
}));

let el: HTMLDivElement;
let root: Root;
const doc: CentroCopiadoMeta = {
  nombre: "original.pdf",
  archivoNombre: "original.pdf",
  paginas: 20,
  paginasOriginales: 20,
  copias: 2,
  tamano: "A4",
  papelMateriaPrimaId: "papel",
  color: "BN",
  faz: 2,
  terminaciones: [],
};
const preview = {
  documentos: [],
  grupos: [],
  totales: {
    documentos: 1,
    tomos: 0,
    carillas: 26,
    hojasFisicas: 14,
    subtotal: 100,
    iva: 21,
    total: 121,
  },
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.opciones.mockResolvedValue({ papeles: [], terminaciones: [] });
  mocks.cotizar.mockResolvedValue(preview);
  mocks.construir.mockResolvedValue({ items: [] });
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.useRealTimers();
});
async function montar(meta = doc) {
  const item = itemConstruidoAPropuestaItem({
    documentoId: "item",
    grupoTomoId: null,
    nombre: "original.pdf",
    productoId: "producto",
    jobContext: { _centroCopiado: meta },
    especificaciones: {},
    cantidad: 14,
    precioUnitario: 10,
    subtotal: 140,
    impuestoPorcentaje: 21,
    impuestoMonto: 29.4,
    total: 169.4,
    cotizacion: null,
    error: null,
  });
  await act(async () =>
    root.render(
      <CentroCopiadoSheet
        open
        onOpenChange={() => {}}
        onAgregar={() => false}
        editItems={[item]}
      />,
    ),
  );
}
async function rango(value: string, index = 0) {
  const input = el.querySelectorAll<HTMLInputElement>(
    'input[placeholder^="Todas"]',
  )[index];
  expect(input).toBeDefined();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const avanzar = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
function guardar() {
  return Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === "Guardar cambios",
  );
}

it("cotiza y agrega sólo las páginas seleccionadas conservando las originales", async () => {
  await montar();
  await rango("1-7,9,12-16");
  expect(el.textContent).toContain("13 de 20 páginas");
  await avanzar();
  expect(mocks.cotizar).toHaveBeenLastCalledWith(
    expect.objectContaining({
      documentos: [
        expect.objectContaining({
          paginas: 13,
          paginasOriginales: 20,
          rangoPaginas: "1-7,9,12-16",
          copias: 2,
          faz: 2,
          archivoNombre: "original.pdf",
        }),
      ],
    }),
  );
  expect(guardar()?.disabled).toBe(false);
  await act(async () => guardar()!.click());
  expect(mocks.construir.mock.calls[0][0].documentos[0]).toMatchObject({
    paginas: 13,
    paginasOriginales: 20,
    rangoPaginas: "1-7,9,12-16",
  });
});

it("descarta una cotización en vuelo si después el usuario ingresa un rango inválido", async () => {
  let resolver!: (value: typeof preview) => void;
  mocks.cotizar.mockReturnValue(
    new Promise((resolve) => {
      resolver = resolve;
    }),
  );
  await montar();
  await avanzar();
  expect(mocks.cotizar).toHaveBeenCalledTimes(1);
  await rango("21");
  await act(async () => resolver(preview));
  expect(el.textContent).toContain("El archivo tiene 20 páginas");
  expect(el.querySelector('[aria-invalid="true"]')).not.toBeNull();
  expect(el.textContent).not.toContain("$121");
  expect(guardar()).toBeUndefined();
  expect(mocks.construir).not.toHaveBeenCalled();
});

it("rehidrata rangos de un tomo y permite volver a seleccionar todas las páginas", async () => {
  await montar({
    esTomo: true,
    juegos: 3,
    terminaciones: [],
    segmentos: [
      { ...doc, paginas: 13, rangoPaginas: "1-7,9,12-16" } as NonNullable<
        CentroCopiadoMeta["segmentos"]
      >[number],
    ],
  });
  expect(
    el.querySelector<HTMLInputElement>('input[placeholder^="Todas"]')?.value,
  ).toBe("1-7,9,12-16");
  await rango("");
  await avanzar();
  const dto = mocks.cotizar.mock.calls.at(-1)![0];
  expect(dto.documentos[0]).toMatchObject({
    paginas: 20,
    paginasOriginales: 20,
  });
  expect(dto.documentos[0].rangoPaginas).toBeUndefined();
  expect(dto.grupos[0].juegos).toBe(3);
});
