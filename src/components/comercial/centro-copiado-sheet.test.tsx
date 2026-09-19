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
  opcionesCad: vi.fn(),
  leerPdf: vi.fn(),
}));
vi.mock("@/lib/pdf-medidas", () => ({ leerMedidasPdf: mocks.leerPdf }));
vi.mock("@/lib/centro-copiado-cad", async (original) => ({
  ...(await original<object>()),
  opcionesCadCopiado: mocks.opcionesCad,
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
    "aria-label": ariaLabel,
  }: {
    "aria-label"?: string;
    children: ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={isDisabled} onClick={onPress} aria-label={ariaLabel}>
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
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.opcionesCad.mockResolvedValue({ perfiles: [] });
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
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "getAnimations");
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

it("conserva la orientación de cada página al editar y muestra la del rango seleccionado", async () => {
  const orientacionesPaginas = Array.from({ length: 20 }, (_, i) =>
    i < 10 ? ("vertical" as const) : ("horizontal" as const),
  );
  await montar({ ...doc, orientacionesPaginas });
  expect(el.querySelector('[aria-label="Orientación: Mixto"]')).not.toBeNull();
  await rango("1-3");
  expect(
    el.querySelector('[aria-label="Orientación: Vertical"]'),
  ).not.toBeNull();
  await rango("11-20");
  expect(
    el.querySelector('[aria-label="Orientación: Horizontal"]'),
  ).not.toBeNull();
  await avanzar();
  await act(async () => guardar()!.click());
  expect(mocks.construir.mock.calls[0][0].documentos[0]).toMatchObject({
    paginas: 10,
    paginasOriginales: 20,
    rangoPaginas: "11-20",
    orientacionesPaginas,
  });
});

it("conserva el modo CAD, perfil, medidas originales y copias al editar rangos y agregar", async () => {
  const cad = { perfilId: "perfil-cad", versionPerfil: 3, versionDestino: 2 };
  const medidasPaginas = [
    { anchoMm: 594, altoMm: 841 },
    { anchoMm: 841, altoMm: 1189 },
    { anchoMm: 300, altoMm: 600 },
  ];
  mocks.opcionesCad.mockResolvedValue({
    perfiles: [
      {
        ...cad,
        nombre: "B/N",
        color: "BN",
        gramaje: 80,
        papelMateriaPrimaId: "rollo",
        maquinaNombre: "HP",
        materialNombre: "Obra",
        rollo: { anchoRolloMm: 914, margenMm: 5 },
      },
    ],
  });
  await montar({
    ...doc,
    modo: "CAD",
    cad,
    medidasPaginas,
    paginasOriginales: 3,
    paginas: 3,
    faz: 1,
    tamano: "CAD",
    papelMateriaPrimaId: "rollo",
    gramaje: 80,
  });
  expect(el.textContent).toContain("Tamaños mixtos");
  expect(el.textContent).toContain("Escala 100%");
  expect(
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled,
  ).toBe(true);
  await rango("2");
  expect(el.textContent).toContain("A0");
  await avanzar();
  await act(async () => guardar()!.click());
  expect(mocks.construir.mock.calls[0][0].documentos[0]).toMatchObject({
    modo: "CAD",
    cad,
    medidasPaginas,
    rangoPaginas: "2",
    paginas: 1,
    paginasOriginales: 3,
    copias: 2,
    faz: 1,
  });
});

const perfilCarga = {
  id: "perfil-cad",
  revision: "a".repeat(64),
  nombre: "Planos B/N",
  color: "BN",
  prioridad: 1,
  gramaje: 80,
  papelMateriaPrimaId: "rollo",
  maquinaNombre: "HP",
  materialNombre: "Obra",
  rollo: { anchoRolloMm: 914, margenMm: 5 },
};
async function montarCarga(perfiles: object[] = [perfilCarga]) {
  mocks.opciones.mockResolvedValue({
    papelDefaultId: "papel",
    papeles: [
      {
        materiaPrimaId: "papel",
        nombre: "Obra",
        gramajes: [75],
        variantes: [{ anchoMm: 297, altoMm: 420, gramajeGr: 75 }],
      },
    ],
    tamanosOfrecidos: ["A4", "A3"],
    terminaciones: [],
  });
  mocks.opcionesCad.mockResolvedValue({ perfiles });
  await act(async () =>
    root.render(
      <CentroCopiadoSheet
        open
        onOpenChange={() => {}}
        onAgregar={() => false}
      />,
    ),
  );
}
async function pestaña(texto: string) {
  const tab = Array.from(
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((t) => t.textContent?.startsWith(texto));
  expect(tab).toBeDefined();
  await act(async () => tab!.click());
}
async function cargarPdfs(
  medidas: { anchoMm: number; altoMm: number }[][],
  arrastrar = false,
) {
  const files = medidas.map(
    (_, i) =>
      new File(["pdf"], `archivo-${i + 1}.pdf`, { type: "application/pdf" }),
  );
  mocks.leerPdf.mockResolvedValue(
    medidas.map((paginas, i) => ({
      ok: true,
      archivoNombre: files[i].name,
      paginas: paginas.map((medidaVisible) => ({
        medidaVisible,
        totalPaginas: paginas.length,
        orientacion: "vertical",
      })),
    })),
  );
  if (arrastrar) {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { files, types: ["Files"] },
    });
    await act(async () =>
      el.querySelector('[role="tabpanel"]')!.dispatchEvent(event),
    );
    return;
  }
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}
const a4 = { anchoMm: 210, altoMm: 297 };
const a1 = { anchoMm: 594, altoMm: 841 };
it("clasifica una carga mixta por el máximo disponible, conserva originales y cotiza ambas pestañas", async () => {
  await montarCarga();
  await cargarPdfs([[{ anchoMm: 420, altoMm: 297 }], [a1], [a4, a1]]);
  expect(
    el.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe("Documentos1");
  expect(
    el.querySelectorAll('input[aria-label^="Nombre del documento"]'),
  ).toHaveLength(1);
  await pestaña("Planos CAD");
  expect(
    el.querySelectorAll('input[aria-label^="Nombre del documento"]'),
  ).toHaveLength(2);
  await rango("2", 1);
  await pestaña("Documentos");
  await avanzar();
  const docs = mocks.cotizar.mock.calls.at(-1)![0].documentos;
  expect(docs).toHaveLength(3);
  expect(docs[0]).toMatchObject({ modo: "HOJAS", tamano: "A4" });
  expect(docs[1]).toMatchObject({
    modo: "CAD",
    faz: 1,
    cad: { cotizacion: { id: "perfil-cad" } },
  });
  expect(docs[2]).toMatchObject({
    modo: "CAD",
    rangoPaginas: "2",
    paginas: 1,
    paginasOriginales: 2,
    medidasPaginas: [a4, a1],
  });
  await pestaña("Planos CAD");
  expect(
    el.querySelectorAll<HTMLInputElement>('input[placeholder^="Todas"]')[1]
      .value,
  ).toBe("2");
});
it("admite un plano A4 desde CAD y aplicar configuración en Documentos no lo modifica", async () => {
  await montarCarga();
  await pestaña("Planos CAD");
  expect(el.querySelector('input[type="file"]')?.getAttribute("accept")).toBe(
    ".pdf",
  );
  await cargarPdfs([[a4]], true);
  await pestaña("Documentos");
  await cargarPdfs([[a4]]);
  const aplicar = Array.from(el.querySelectorAll("button")).find(
    (b) => b.textContent === "Aplicar a documentos",
  )!;
  await act(async () => aplicar.click());
  await avanzar();
  expect(mocks.cotizar.mock.calls.at(-1)![0].documentos).toEqual([
    expect.objectContaining({
      modo: "CAD",
      papelMateriaPrimaId: "rollo",
      gramaje: 80,
    }),
    expect.objectContaining({
      modo: "HOJAS",
      papelMateriaPrimaId: "papel",
      gramaje: 75,
    }),
  ]);
});
it("muestra la falta de perfil en la pestaña CAD y bloquea agregar incluso al ver Documentos", async () => {
  await montarCarga([]);
  await cargarPdfs([[a1]]);
  expect(
    el.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  ).toBe("Planos CAD1");
  await pestaña("Documentos");
  expect(
    el
      .querySelector('[role="tab"][aria-label^="Planos CAD"]')
      ?.getAttribute("aria-label"),
  ).toContain("Revisar archivos");
  const agregar = Array.from(el.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Completá 1 fila"),
  );
  expect(agregar?.disabled).toBe(true);
  expect(mocks.cotizar).not.toHaveBeenCalled();
});

const boton = (texto: string) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent === texto,
  )!;
async function cambiarCopiasPagina(pagina: number, valor: number) {
  const input = el.querySelector<HTMLInputElement>(
    `input[aria-label^="Copias de la página ${pagina} de"]`,
  )!;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(valor));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("desglosa sólo CAD, conserva copias al cambiar rangos y envía un solo documento", async () => {
  await montarCarga();
  await cargarPdfs([
    [a4, a4],
    [a1, a1, a1],
  ]);
  expect(boton("Desglosar páginas")).toBeUndefined();
  await pestaña("Planos CAD");
  await act(async () => boton("Desglosar páginas").click());
  await cambiarCopiasPagina(1, 3);
  await cambiarCopiasPagina(3, 2);
  expect(
    el.querySelector('[aria-label^="Editar copias por página"]')?.textContent,
  ).toBe("6Por página");
  await rango("2-3");
  expect(
    el.querySelector('[aria-label^="Editar copias por página"]')?.textContent,
  ).toBe("3Por página");
  expect(
    el.querySelector('[aria-label^="Copias de la página 1 de"]'),
  ).toBeNull();
  await rango("1-3");
  expect(
    el.querySelector<HTMLInputElement>(
      '[aria-label^="Copias de la página 1 de"]',
    )?.value,
  ).toBe("3");
  await avanzar();
  const request = mocks.cotizar.mock.calls.at(-1)![0];
  expect(request.documentos).toHaveLength(2);
  expect(request.documentos[0].copiasPorPagina).toBeUndefined();
  expect(request.documentos[1]).toMatchObject({
    copias: 1,
    copiasPorPagina: [
      { pagina: 1, copias: 3 },
      { pagina: 3, copias: 2 },
    ],
  });
  expect(boton("Mover a Documentos").disabled).toBe(true);
  await act(async () => boton("Usar 1 copia en todas").click());
  expect(el.querySelector('[aria-label^="Copias de la página"]')).toBeNull();
  expect(boton("Mover a Documentos").disabled).toBe(false);
});
it("rehidrata copias por página, edita páginas posteriores a la 100 y conserva el desglose al guardar", async () => {
  mocks.opcionesCad.mockResolvedValue({ perfiles: [perfilCarga] });
  await montar({
    ...doc,
    modo: "CAD",
    paginas: 101,
    paginasOriginales: 101,
    copias: 1,
    medidasPaginas: Array.from({ length: 101 }, () => a1),
    cad: {
      cotizacion: { id: perfilCarga.id, revision: perfilCarga.revision },
    },
    faz: 1,
    papelMateriaPrimaId: "rollo",
    tamano: "CAD",
    gramaje: 80,
    copiasPorPagina: [
      { pagina: 1, copias: 3 },
      { pagina: 101, copias: 2 },
    ],
  });
  await act(async () =>
    el
      .querySelector<HTMLButtonElement>(
        '[aria-label^="Editar copias por página"]',
      )!
      .click(),
  );
  expect(
    el.querySelector<HTMLInputElement>(
      '[aria-label^="Copias de la página 1 de"]',
    )?.value,
  ).toBe("3");
  await act(async () => boton("Siguiente").click());
  await act(async () => boton("Siguiente").click());
  expect(
    el.querySelector<HTMLInputElement>(
      '[aria-label^="Copias de la página 101 de"]',
    )?.value,
  ).toBe("2");
  await cambiarCopiasPagina(101, 4);
  await rango("1,101");
  expect(
    el.querySelector<HTMLInputElement>(
      '[aria-label^="Copias de la página 1 de"]',
    )?.value,
  ).toBe("3");
  await avanzar();
  await act(async () => guardar()!.click());
  expect(mocks.construir.mock.calls[0][0].documentos).toHaveLength(1);
  expect(mocks.construir.mock.calls[0][0].documentos[0]).toMatchObject({
    paginas: 2,
    paginasOriginales: 101,
    rangoPaginas: "1,101",
    copias: 1,
    copiasPorPagina: [
      { pagina: 1, copias: 3 },
      { pagina: 101, copias: 4 },
    ],
  });
});
