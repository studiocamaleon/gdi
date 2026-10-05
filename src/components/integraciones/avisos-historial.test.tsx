// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IntegracionesView, MensajesTab } from "./integraciones-view";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import {
  getLogNotificaciones,
  resolverAviso,
  reintentarAviso,
} from "@/lib/integraciones-api";
import type { LineaLog } from "@/lib/integraciones";

vi.mock("@/lib/integraciones-api", async (original) => ({
  ...(await original<typeof import("@/lib/integraciones-api")>()),
  getLogNotificaciones: vi.fn(),
  resolverAviso: vi.fn(),
  reintentarAviso: vi.fn(),
}));
vi.mock("@/components/navigation/config-regional-provider", () => ({
  useFecha: () => ({ fechaHora: (v: string) => v }),
}));
vi.mock("@/components/configuracion/configuracion-workspace", () => ({
  ConfiguracionPage: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ConfiguracionHeader: ({
    titulo,
    acciones,
  }: {
    titulo: string;
    acciones?: ReactNode;
  }) => (
    <header>
      <h1>{titulo}</h1>
      {acciones}
    </header>
  ),
  useConfiguracionInicio: () => {},
}));
vi.mock("@/components/design-system/action-button", () => ({
  ActionButton: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
vi.mock("@/components/ui/confirmacion-destructiva", () => ({
  ConfirmacionDestructiva: ({
    open,
    descripcion,
    onConfirmar,
    accionLabel,
  }: {
    open: boolean;
    descripcion: ReactNode;
    onConfirmar: (m: string) => Promise<void>;
    accionLabel: string;
  }) =>
    open ? (
      <div role="dialog">
        {descripcion}
        <button onClick={() => void onConfirmar("Verificado en WhatsApp")}>
          {accionLabel}
        </button>
      </div>
    ) : null,
}));

let container: HTMLDivElement, root: Root;
const fila = (estado: string): LineaLog => ({
  id: estado,
  estado,
  canal: estado.startsWith("web") ? "WHATSAPP_WEB" : "WATI",
  evento: "orden_recibida",
  titulo: "Orden recibida",
  cliente: "Cliente",
  telefono: "5491111111111",
  motivo: "Revisar resultado",
  intentos: 1,
  programadaPara: null,
  enviadaEl: null,
  createdAt: "2026-09-22T12:00:00Z",
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(getLogNotificaciones).mockResolvedValue([
    fila("web_incierta"),
    fila("enviando"),
  ]);
  vi.mocked(resolverAviso).mockResolvedValue({ ok: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const boton = (texto: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === texto,
  )!;

it("lectura de Integraciones muestra estados sin abrir credenciales ni la ficha fiscal", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={["acceso.por_vista", "configuracion.integraciones.ver"]}
      >
        <IntegracionesView
          inicial={{ integraciones: [], cifradoDisponible: true }}
        />
      </PermisosProvider>,
    ),
  );
  expect(container.querySelector('.int-card[role="button"]')).toBeNull();
  expect(container.querySelector(".int-card .cta")).toBeNull();
  expect(boton("Historial de avisos")).toBeDefined();
});

it("gestionar Integraciones no concede implícitamente acceso a configuración fiscal", async () => {
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={["acceso.por_vista", "configuracion.integraciones.gestionar"]}
      >
        <IntegracionesView
          inicial={{ integraciones: [], cifradoDisponible: true }}
        />
      </PermisosProvider>,
    ),
  );
  const fiscal = [...container.querySelectorAll(".int-card")].find((c) =>
    c.textContent?.includes("ARCA"),
  )!;
  expect(fiscal).toBeDefined();
  expect(fiscal.getAttribute("role")).toBeNull();
});

it("conserva acceso al historial aunque los dos canales estén fuera del plan", async () => {
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{
          funciones: {
            identidad: true,
            whatsapp_web: false,
            whatsapp_automatico: false,
          },
        }}
      >
        <IntegracionesView
          inicial={{ integraciones: [], cifradoDisponible: true }}
        />
      </CapacidadesProvider>,
    ),
  );
  await act(async () => boton("Historial de avisos").click());
  expect(container.textContent).toContain("Por confirmar");
  expect(container.textContent).toContain("WhatsApp Web");
  expect(container.textContent).not.toContain("Confirmar enviada");
});

it("permite resolver un incierto, informa que no reenvía y manda el estado esperado con motivo", async () => {
  await act(async () =>
    root.render(
      <CapacidadesProvider capacidades={{ funciones: { identidad: true } }}>
        <MensajesTab puedeResolver />
      </CapacidadesProvider>,
    ),
  );
  expect(
    [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Descartar",
    ),
  ).toHaveLength(1);
  await act(async () => boton("Confirmar enviada").click());
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
    "sin volver a enviarlo",
  );
  await act(async () => boton("Guardar resolución").click());
  expect(resolverAviso).toHaveBeenCalledWith("web_incierta", {
    accion: "confirmar_enviada",
    estadoEsperado: "web_incierta",
    motivo: "Verificado en WhatsApp",
  });
});

it("una empresa en sólo lectura conserva el historial sin acciones de resolución", async () => {
  await act(async () =>
    root.render(
      <CapacidadesProvider capacidades={{ funciones: { identidad: false } }}>
        <MensajesTab puedeResolver />
      </CapacidadesProvider>,
    ),
  );
  expect(container.textContent).toContain("Por confirmar");
  expect(boton("Confirmar enviada")).toBeUndefined();
  expect(boton("Descartar")).toBeUndefined();
});

it("ofrece reintento sólo al administrador y pide confirmar el destinatario antes del POST", async () => {
  const fallido = { ...fila("fallida"), versionReintento: "a".repeat(64) };
  vi.mocked(getLogNotificaciones).mockResolvedValue([
    fallido,
    fila("wati_incierta"),
    fila("enviada"),
  ]);
  vi.mocked(reintentarAviso).mockResolvedValue({ ok: true });
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{
          funciones: { identidad: true, whatsapp_automatico: true },
        }}
      >
        <MensajesTab puedeResolver />
      </CapacidadesProvider>,
    ),
  );
  expect(
    [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Reintentar envío",
    ),
  ).toHaveLength(1);
  await act(async () => boton("Reintentar envío").click());
  expect(reintentarAviso).not.toHaveBeenCalled();
  const dialog = container.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain(fallido.telefono);
  expect(dialog.textContent).toContain("mensaje original");
  await act(async () => dialog.querySelector("button")!.click());
  expect(reintentarAviso).toHaveBeenCalledWith("fallida", "a".repeat(64));
  expect(getLogNotificaciones).toHaveBeenCalledTimes(2);
});

it.each([false, true])(
  "sin permiso o sin canal contratado no ofrece reintento (%s)",
  async (permiso) => {
    vi.mocked(getLogNotificaciones).mockResolvedValue([
      { ...fila("fallida"), versionReintento: "a".repeat(64) },
    ]);
    await act(async () =>
      root.render(
        <CapacidadesProvider
          capacidades={{
            funciones: { identidad: true, whatsapp_automatico: !permiso },
          }}
        >
          <MensajesTab puedeResolver={permiso} />
        </CapacidadesProvider>,
      ),
    );
    expect(boton("Reintentar envío")).toBeUndefined();
  },
);
