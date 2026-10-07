// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import * as api from "@/lib/notificaciones-internas-api";
import {
  NotificacionesProvider,
  useNotificaciones,
} from "./notificaciones-provider";
import { NotificacionesBell } from "./notificaciones-bell";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/notificaciones-internas-api", () => ({
  listarNotificacionesInternas: vi.fn(),
  contarNotificacionesNoLeidas: vi.fn(),
  marcarNotificacionLeida: vi.fn(),
  marcarTodasLasNotificacionesLeidas: vi.fn(),
  consultarCambiosSistema: vi.fn(),
}));
class Fuente extends EventTarget {
  static actual: Fuente;
  onerror: (() => void) | null = null;
  constructor() {
    super();
    Fuente.actual = this;
  }
  close() {}
  emitir(tipo: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(tipo, { data: JSON.stringify(data) }));
  }
}
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
let datos: api.NotificacionInterna[],
  contexto: ReturnType<typeof useNotificaciones>;
const hora = "2026-10-07T20:30:00Z";
const lectura = { id: "l1", nombre: "Alex Demo", leidaEl: hora };
function Capturar() {
  contexto = useNotificaciones();
  return null;
}
function fixture(id: string): api.NotificacionInterna {
  return {
    id,
    leidaEl: null,
    lecturas: [],
    createdAt: hora,
    evento: {
      id,
      tipo: "qa",
      actorNombre: "Sistema",
      titulo: `Aviso ${id}`,
      mensaje: "Presupuesto ficticio aprobado.",
      href: `/comercial/presupuestos/${id}`,
      severidad: "EXITO",
      createdAt: hora,
    },
  };
}
function boton(texto: string) {
  const resultado = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(texto),
  );
  if (!resultado) throw new Error(`No existe el botón ${texto}`);
  return resultado;
}
const abrir = async () =>
  act(async () => {
    container
      .querySelector<HTMLButtonElement>('[aria-label^="Notificaciones"]')!
      .click();
  });
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubGlobal("EventSource", Fuente);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  datos = [fixture("1"), fixture("2")];
  vi.mocked(api.listarNotificacionesInternas).mockImplementation(async () =>
    structuredClone(datos),
  );
  vi.mocked(api.contarNotificacionesNoLeidas).mockImplementation(async () => ({
    cantidad: datos.filter((d) => !d.leidaEl).length,
  }));
  vi.mocked(api.marcarNotificacionLeida).mockImplementation(async (id) => {
    datos = datos.map((d) =>
      d.id === id && !d.leidaEl
        ? { ...d, leidaEl: hora, lecturas: [lectura] }
        : d,
    );
    return { ok: true };
  });
  vi.mocked(api.marcarTodasLasNotificacionesLeidas).mockImplementation(
    async () => {
      const actualizadas = datos.filter((d) => !d.leidaEl).length;
      datos = datos.map((d) =>
        d.leidaEl ? d : { ...d, leidaEl: hora, lecturas: [lectura] },
      );
      return { actualizadas };
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <NotificacionesProvider>
        <Capturar />
        <NotificacionesBell />
      </NotificacionesProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("abrir la campana no marca: el botón individual guarda y muestra lectores sin navegar", async () => {
  await abrir();
  expect(api.marcarNotificacionLeida).not.toHaveBeenCalled();
  await act(async () => boton("Marcar leído").click());
  expect(push).not.toHaveBeenCalled();
  expect(contexto.noLeidas).toBe(1);
  expect(container.textContent).toContain("Visto por Alex Demo");
  expect(container.textContent).toContain("Leída");
  expect(container.querySelector("time")?.dateTime).toBe(hora);
  expect(container.querySelector("time")?.textContent).toContain("17:30");
  expect(container.querySelector("button button")).toBeNull();
});

it("volver a abrir un aviso leído no resta pendientes de otros avisos ni cambia la primera fecha", async () => {
  await abrir();
  await act(async () => boton("Marcar leído").click());
  await act(async () => boton("Aviso 1").click());
  expect(push).toHaveBeenCalledWith("/comercial/presupuestos/1");
  expect(contexto.noLeidas).toBe(1);
  expect(contexto.notificaciones[0].lecturas).toEqual([lectura]);
});

it("muestra lecturas de compañeros recibidas en vivo y al reconectar, manteniendo mi pendiente", async () => {
  await abrir();
  datos[0].lecturas = [{ ...lectura, nombre: "Marina Demo" }];
  await act(async () => {
    Fuente.actual.emitir("cambio", {
      eventoId: "42",
      tipo: "notificaciones.lectura_registrada",
      topicos: ["notificaciones"],
      createdAt: hora,
    });
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(container.textContent).toContain("Visto por Marina Demo");
  expect(contexto.noLeidas).toBe(2);
  expect(api.marcarNotificacionLeida).not.toHaveBeenCalled();
  datos[0].lecturas.push({ ...lectura, id: "l2", nombre: "Tomás Demo" });
  await act(async () => {
    Fuente.actual.emitir("ready", { noLeidas: 2, ultimoId: "43" });
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(container.textContent).toContain("Marina Demo, Tomás Demo");
});

it("Marcar todas conserva el registro previo y admite avisos nuevos recibidos durante la operación", async () => {
  datos[0] = {
    ...datos[0],
    leidaEl: "2026-10-06T15:00:00Z",
    lecturas: [{ ...lectura, leidaEl: "2026-10-06T15:00:00Z" }],
  };
  await act(async () => contexto.recargar());
  const prev = structuredClone(datos[0]);
  vi.mocked(api.marcarTodasLasNotificacionesLeidas).mockImplementationOnce(
    async () => {
      datos[1] = { ...datos[1], leidaEl: hora, lecturas: [lectura] };
      datos.push(fixture("3"));
      return { actualizadas: 1 };
    },
  );
  await abrir();
  await act(async () => boton("Marcar todas").click());
  expect(contexto.noLeidas).toBe(1);
  expect(contexto.notificaciones[0]).toEqual(prev);
  expect(contexto.notificaciones[1].lecturas).toEqual([lectura]);
});

it("ante un error mantiene el pendiente, informa y permite reintentar", async () => {
  vi.mocked(api.marcarNotificacionLeida).mockRejectedValueOnce(
    new Error("Sin conexión"),
  );
  await abrir();
  await act(async () => boton("Marcar leído").click());
  expect(toast.error).toHaveBeenCalled();
  expect(contexto.noLeidas).toBe(2);
  expect(container.textContent).not.toContain("Visto por");
  expect(boton("Marcar leído").disabled).toBe(false);
  await act(async () => boton("Marcar leído").click());
  expect(contexto.noLeidas).toBe(1);
});

it("una recarga antigua no borra una lectura que el servidor ya confirmó", async () => {
  const anteriores = structuredClone(datos);
  let resolver!: (items: api.NotificacionInterna[]) => void;
  vi.mocked(api.listarNotificacionesInternas).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  let pendiente!: Promise<void>;
  await act(async () => {
    pendiente = contexto.recargar();
  });
  await abrir();
  await act(async () => boton("Marcar leído").click());
  await act(async () => {
    resolver(anteriores);
    await pendiente;
  });
  expect(contexto.noLeidas).toBe(1);
  expect(contexto.notificaciones[0].lecturas).toEqual([lectura]);
});

it("una lectura histórica no muestra un autor inventado", async () => {
  datos[0].leidaEl = hora;
  await act(async () => contexto.recargar());
  await abrir();
  expect(container.textContent).toContain(
    "Lectura anterior sin registro de autor",
  );
  expect(container.textContent).not.toContain("Visto por");
});
