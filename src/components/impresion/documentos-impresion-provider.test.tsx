// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { perfilPrueba } from "../../../apps/api/src/impresion/perfiles-impresion.fixture";
import {
  DocumentosImpresionProvider,
  useImpresionDocumentos,
} from "./documentos-impresion-provider";
import type { EnvioDocumento, VistaDocumentos } from "@/lib/impresion-api";
const mocks = vi.hoisted(() => ({
  vista: vi.fn(),
  cola: vi.fn(),
  solicitar: vi.fn(),
  liberar: vi.fn(),
  estado: vi.fn(),
  imprimir: vi.fn(),
  escuchar: vi.fn(),
  cerrar: vi.fn(),
  confirmar: vi.fn(),
}));
vi.mock("@/lib/impresion-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impresion-api")>()),
  getDocumentosOrden: mocks.vista,
  getColaImpresion: mocks.cola,
  solicitarImpresionOrden: mocks.solicitar,
  liberarLoteImpresion: mocks.liberar,
  registrarEstadoDocumento: mocks.estado,
  confirmarDocumentosImpresos: mocks.confirmar,
}));
vi.mock("@/lib/qz-impresion", () => ({
  imprimirDocumentoOrden: mocks.imprimir,
  escucharImpresora: mocks.escuchar,
}));
vi.mock("@/components/navigation/permisos-provider", () => ({
  usePuede: () => true,
}));
vi.mock("@/components/design-system/appearance", () => ({
  useDesignTheme: () => "tema-grafo",
  useDesignScope: () => ({ "data-ui": "heroui", "data-appearance": "light" }),
  DesignSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <section>
        <h2>{title}</h2>
        {children}
      </section>
    ) : null,
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    onPress,
    isDisabled,
    children,
    "aria-label": ariaLabel,
    className,
  }: {
    onPress: () => void;
    isDisabled?: boolean;
    children: ReactNode;
    "aria-label"?: string;
    className?: string;
  }) => (
    <button
      disabled={isDisabled}
      onClick={onPress}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  ),
}));
function Abrir() {
  const p = useImpresionDocumentos();
  return <button onClick={() => p.abrir("ot", true)}>Emitida</button>;
}
let root: Root, el: HTMLDivElement, vista: VistaDocumentos;
const base: EnvioDocumento = {
  id: "envio",
  itemId: "item",
  nombre: "Documento.pdf",
  copias: 2,
  paginas: 3,
  hojas: 4,
  faz: 2,
  host: "localhost",
  impresora: "RICOH",
  jobName: "Grafo OT-1 envio",
  estado: "PREPARADO",
  fecha: "2026-09-18T12:00:00Z",
  actualizadoEl: "2026-09-18T12:00:00Z",
  usuario: "Operario",
  eventos: [],
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  vista = {
    ordenId: "ot",
    numero: "OT-1",
    estado: "pendiente",
    documentos: [
      {
        configuracion: {
          papelMateriaPrimaId: "papel",
          papelNombre: "Obra",
          gramaje: 75,
          tamano: "A4",
          color: "BN",
          faz: 2,
        },
        ruta: {
          estado: "LISTO",
          motivo: null,
          perfil: structuredClone(perfilPrueba),
        },
        itemId: "item",
        nombre: base.nombre,
        copias: 2,
        paginas: 3,
        hojas: 4,
        faz: 2,
        motivo: null,
        archivos: ["archivo"],
        documentos: 1,
      },
    ],
    historial: [],
  };
  mocks.vista.mockImplementation(async () => structuredClone(vista));
  mocks.cola.mockImplementation(async () => ({
    vistas: [structuredClone(vista)],
    total: vista.documentos.length,
    siguiente: null,
  }));
  mocks.solicitar.mockImplementation(async () => structuredClone(vista));
  mocks.estado.mockImplementation(async (_ot, id, estado, detalle) => {
    const e = vista.historial.find((e) => e.id === id);
    if (e) {
      e.estado = ["COMPLETE", "PRINTED"].includes(e.estado) ? e.estado : estado;
      e.eventos.push({ estado, detalle, fecha: base.fecha });
    }
    return e;
  });
  mocks.confirmar.mockImplementation(async (_ot, ids: string[]) => {
    vista.historial.forEach((e) => {
      if (ids.includes(e.id))
        e.confirmacion = {
          usuario: "Operario",
          usuarioId: "u",
          fecha: base.fecha,
        };
    });
    return { ok: true };
  });
  mocks.escuchar.mockResolvedValue({
    cerrar: mocks.cerrar,
    consultar: vi.fn(),
  });
  mocks.imprimir.mockImplementation(
    async (_tenant, c, orden, item, _id, _prev, preparado, pagina) => {
      const envio = {
        ...structuredClone(base),
        id: `envio-${item}-${pagina ?? 0}`,
        itemId: item,
        pagina,
        trabajoId: `${item}:${pagina ?? 0}`,
        impresora: c.impresora,
        jobName: `Grafo ${orden} ${item} ${pagina ?? 0}`,
      };
      vista.historial = [envio, ...vista.historial];
      preparado(envio);
      return envio;
    },
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
async function montar() {
  await act(async () =>
    root.render(
      <DocumentosImpresionProvider tenantId="tenant">
        <Abrir />
      </DocumentosImpresionProvider>,
    ),
  );
}
async function click(text: string, indice = 0) {
  const b = Array.from(el.querySelectorAll("button")).filter(
    (b) => b.textContent === text || b.getAttribute("aria-label") === text,
  )[indice];
  expect(b, text).toBeDefined();
  await act(async () => b!.click());
}
it("recupera la cola sin imprimir al cargar; emitir persiste primero y envía una sola vez", async () => {
  await montar();
  expect(mocks.imprimir).not.toHaveBeenCalled();
  await click("Emitida");
  expect(mocks.solicitar).toHaveBeenCalledWith("ot");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
  expect(el.textContent).toContain("Enviado a Windows");
  await click("Emitida");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
});
it("minimizar mantiene todos los eventos y un ACK o DELETED no borra COMPLETE", async () => {
  await montar();
  await click("Emitida");
  await click("Minimizar");
  const widget = el.querySelector('[data-ui="heroui"]')!;
  expect(widget.classList.contains("tema-grafo")).toBe(true);
  expect(widget.textContent).toContain("Asistente Grafo");
  expect(mocks.cerrar).not.toHaveBeenCalled();
  const recibir = mocks.escuchar.mock.calls[0][2],
    e = vista.historial[0];
  await act(async () => {
    recibir({
      printerName: "RICOH",
      eventType: "JOB",
      jobName: e.jobName,
      statusText: "COMPLETE",
    });
    recibir({
      printerName: "RICOH",
      eventType: "JOB",
      jobName: e.jobName,
      statusText: "DELETED",
    });
  });
  await click("Colas de impresión · 1");
  expect(el.textContent).toContain("Finalizado según la cola");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
});

it("verifica varios juntos, permite seleccionar por impresora y excluye pendientes e inciertos", async () => {
  const color = structuredClone(perfilPrueba);
  color.bandeja.destino = {
    ...color.bandeja.destino,
    maquinaId: "color",
    nombre: "Color",
  };
  vista.documentos.push(
    {
      ...vista.documentos[0],
      itemId: "item-color",
      nombre: "Color.pdf",
      ruta: { estado: "LISTO", motivo: null, perfil: color },
    },
    { ...vista.documentos[0], itemId: "pendiente", nombre: "Pendiente.pdf" },
    { ...vista.documentos[0], itemId: "incierto", nombre: "Incierto.pdf" },
  );
  vista.historial = [
    { ...base, estado: "COMPLETE" },
    { ...base, id: "envio-color", itemId: "item-color", estado: "ENVIADO" },
    {
      ...base,
      id: "envio-incierto",
      itemId: "incierto",
      estado: "SIN_CONFIRMAR",
    },
  ];
  await montar();
  await click("Colas de impresión · 4");
  await click("Verificar varios (2)");
  await click("Seleccionar salidas de Color");
  expect(el.textContent).toContain("1 salida seleccionada");
  await click("Quitar selección de Color");
  expect(el.textContent).toContain("0 salidas seleccionadas");
  await click("Seleccionar todos (2)");
  const seleccion = el.querySelectorAll('input[aria-label^="Verificar "]');
  expect(seleccion).toHaveLength(2);
  expect([...seleccion].every((x) => (x as HTMLInputElement).checked)).toBe(
    true,
  );
  expect(el.textContent).toContain("Verifiqué la salida"); // Incierto: revisión individual.
  await click("Verifiqué los seleccionados (2)");
  expect(mocks.confirmar).toHaveBeenCalledExactlyOnceWith("ot", [
    "envio",
    "envio-color",
  ]);
  expect(vista.historial.filter((e) => !!e.confirmacion)).toHaveLength(2);
  expect(mocks.imprimir).not.toHaveBeenCalled();
});

it("conserva sólo los fallidos seleccionados si la verificación entre OT tiene un resultado parcial", async () => {
  vista.historial = [{ ...base, estado: "COMPLETE" }];
  const otra = structuredClone(vista);
  otra.ordenId = "ot-2";
  otra.numero = "OT-2";
  otra.documentos[0].itemId = "item-2";
  otra.historial = [
    { ...base, id: "envio-2", itemId: "item-2", estado: "PRINTED" },
  ];
  mocks.cola.mockImplementation(async () => ({
    vistas: [structuredClone(vista), structuredClone(otra)],
    total: 2,
    siguiente: null,
  }));
  mocks.vista.mockImplementation(async (id) =>
    structuredClone(id === "ot" ? vista : otra),
  );
  let fallo = true;
  mocks.confirmar.mockImplementation(async (id, ids: string[]) => {
    if (id === "ot-2" && fallo) {
      fallo = false;
      throw new Error("No se pudo guardar");
    }
    const v = id === "ot" ? vista : otra;
    for (const e of v.historial)
      if (ids.includes(e.id))
        e.confirmacion = {
          usuario: "Operario",
          usuarioId: "u",
          fecha: base.fecha,
        };
    return { ok: true };
  });
  await montar();
  await click("Colas de impresión · 2");
  await click("Verificar varios (2)");
  await click("Seleccionar todos (2)");
  await click("Verifiqué los seleccionados (2)");
  expect(el.textContent).toContain("OT-2: No se pudo guardar");
  expect(vista.historial[0].confirmacion).toBeDefined();
  expect(otra.historial[0].confirmacion).toBeUndefined();
  await click("Verifiqué los seleccionados (1)");
  expect(mocks.confirmar.mock.calls.map((c) => c[0])).toEqual([
    "ot",
    "ot-2",
    "ot-2",
  ]);
  expect(otra.historial[0].confirmacion).toBeDefined();
  await click("Minimizar");
  expect(el.textContent).toContain("Cola de impresión al día");
});

it("una selección no verifica una reimpresión posterior del mismo archivo", async () => {
  vista.documentos.push({
    ...vista.documentos[0],
    itemId: "item-2",
    nombre: "Otro.pdf",
  });
  vista.historial = [
    { ...base, estado: "COMPLETE" },
    { ...base, id: "envio-2", itemId: "item-2", estado: "COMPLETE" },
  ];
  await montar();
  await click("Colas de impresión · 2");
  await click("Verificar varios (2)");
  await click("Seleccionar todos (2)");
  vista.historial.unshift({
    ...base,
    id: "envio-nuevo",
    estado: "ENVIADO",
    fecha: "2026-09-18T13:00:00Z",
  });
  await click("Actualizar");
  await click("Verifiqué los seleccionados (1)");
  expect(mocks.confirmar).toHaveBeenCalledExactlyOnceWith("ot", ["envio-2"]);
  expect(vista.historial[0].confirmacion).toBeUndefined();
});
it("usa una única escucha para ambas impresoras y envía a cada destino sin esperar su salida física", async () => {
  const p = structuredClone(perfilPrueba);
  p.id = "color";
  p.bandeja.destino = {
    ...p.bandeja.destino,
    maquinaId: "color",
    nombre: "Color",
    impresora: "COLOR",
  };
  vista.documentos.push({
    ...vista.documentos[0],
    itemId: "color",
    nombre: "Color.pdf",
    ruta: { estado: "LISTO", motivo: null, perfil: p },
  });
  await montar();
  await click("Emitida");
  expect(mocks.escuchar).toHaveBeenCalledTimes(1);
  expect(mocks.escuchar.mock.calls[0][4]).toEqual(["COLOR", "RICOH"]);
  expect(mocks.imprimir.mock.calls.map((c) => c[1].impresora)).toEqual([
    "COLOR",
    "RICOH",
  ]);
});
it("un fallo reserva el intento, detiene esa máquina y deja avanzar la otra", async () => {
  const p = structuredClone(perfilPrueba);
  p.bandeja.destino.maquinaId = "otra";
  p.bandeja.destino.impresora = "OTRA";
  vista.documentos.push(
    { ...vista.documentos[0], itemId: "item-2" },
    {
      ...vista.documentos[0],
      itemId: "z-otra",
      ruta: { estado: "LISTO", motivo: null, perfil: p },
    },
  );
  const normal = mocks.imprimir.getMockImplementation()!;
  mocks.imprimir.mockImplementation(async (...args) => {
    const e = await normal(...args);
    if (args[3] === "item") throw new Error("Se cortó QZ");
    return e;
  });
  await montar();
  await click("Emitida");
  expect(mocks.imprimir.mock.calls.map((c) => c[3])).toEqual([
    "item",
    "z-otra",
  ]);
  expect(el.textContent).toContain("Envío sin confirmar");
  expect(el.textContent).toContain("Se cortó QZ");
  await click("Enviar listos");
  expect(mocks.imprimir).toHaveBeenCalledTimes(2);
});
it("una reimpresión necesita confirmación y refiere al último intento de esa página", async () => {
  vista.documentos[0].paginaCad = {
    pagina: 3,
    copias: 2,
    anchoMm: 841,
    altoMm: 594,
  };
  vista.documentos[0].trabajoId = "item:3";
  vista.historial = [
    { ...base, pagina: 3, trabajoId: "item:3", estado: "SIN_CONFIRMAR" },
  ];
  await montar();
  await click("Emitida");
  expect(mocks.imprimir).not.toHaveBeenCalled();
  await click("Reimprimir");
  expect(mocks.imprimir).not.toHaveBeenCalled();
  await click("Confirmar reimpresión");
  expect(mocks.imprimir.mock.calls[0][5]).toBe("envio");
  expect(mocks.imprimir.mock.calls[0][7]).toBe(3);
});
it("guarda verificación humana, conserva el panel si falla y no reimprime", async () => {
  await montar();
  await click("Emitida");
  mocks.confirmar.mockRejectedValueOnce(new Error("No se pudo guardar"));
  await click("Verifiqué la salida");
  expect(el.textContent).toContain("No se pudo guardar");
  expect(el.textContent).toContain("Asistente de impresión");
  await click("Verifiqué la salida");
  expect(el.textContent).toContain("Salida verificada");
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
});
it("el papel pendiente se selecciona y libera explícitamente antes de enviar", async () => {
  vista.documentos[0].motivo = "Cargar papel";
  vista.documentos[0].ruta.estado = "PREPARACION";
  mocks.liberar.mockImplementation(async () => {
    vista.documentos[0].motivo = null;
    vista.documentos[0].ruta.estado = "LISTO";
    return { ok: true };
  });
  await montar();
  await click("Emitida");
  expect(mocks.imprimir).not.toHaveBeenCalled();
  await act(async () =>
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(),
  );
  await click("Papel cargado · enviar");
  expect(mocks.liberar).toHaveBeenCalledWith(
    [{ ordenId: "ot", trabajos: ["item:0"] }],
    "perfil",
    "1:1:1",
  );
  expect(mocks.imprimir).toHaveBeenCalledTimes(1);
});
