// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://grafo.example.invalid/inbox"}
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cargarMetaSdk } from "@/lib/meta-signup-sdk";
vi.mock("@/lib/meta-signup-sdk", async (original) => ({
  ...(await original<typeof import("@/lib/meta-signup-sdk")>()),
  cargarMetaSdk: vi.fn(),
}));
import { InboxConexion } from "./inbox-conexion";
import type {
  EstadoConexionMeta,
  MetaConexionApi,
} from "@/lib/meta-conexion-api";
const identidad = {
  empresaId: "empresa",
  usuarioId: "operador",
  empresa: "Gráfica ficticia",
  operador: "Persona ficticia",
};
const base: EstadoConexionMeta = {
  empresaId: "empresa",
  usuarioId: "operador",
  disponible: false,
  modo: null,
  sandboxVerificadoEl: null,
  canal: null,
};
let root: Root, container: HTMLDivElement, api: MetaConexionApi;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api = {
    estado: vi.fn().mockResolvedValue(base),
    preparar: vi.fn(),
    consultar: vi.fn(),
    canjear: vi.fn(),
    verificar: vi.fn(),
    cancelar: vi.fn(),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(estado: EstadoConexionMeta = base) {
  vi.mocked(api.estado).mockResolvedValue(estado);
  await act(async () =>
    root.render(<InboxConexion identidad={identidad} api={api} />),
  );
}
it("abrir Inbox sólo consulta; no carga el SDK ni inicia un alta", async () => {
  await render();
  expect(api.estado).toHaveBeenCalledOnce();
  expect(api.preparar).not.toHaveBeenCalled();
  expect(container.textContent).toContain("disponible próximamente");
  expect(container.querySelector("button")?.disabled).toBe(true);
  expect(document.querySelector('script[src*="facebook"]')).toBeNull();
});
it("sandbox verificado no aparece como número conectado ni permite mensajes", async () => {
  await render({
    ...base,
    modo: "SANDBOX",
    disponible: true,
    sandboxVerificadoEl: "2026-09-26T10:00:00Z",
  });
  expect(container.textContent).toContain("Autorización de prueba verificada");
  expect(container.textContent).toContain("No permite enviar mensajes");
  expect(container.textContent).toContain("Todavía no hay un número operativo");
});
it("una respuesta de otra empresa no muestra su número ni habilita la conexión", async () => {
  await render({ ...base, empresaId: "ajena", disponible: true });
  expect(container.textContent).toContain("No pudimos consultar");
  expect(container.querySelector("button")?.disabled).toBe(true);
});
it("100% informado por Meta no afirma importación completa", async () => {
  await render({
    ...base,
    canal: {
      numero: "+16505550123",
      estado: "VERIFICADO",
      credencialVencida: false,
      recepcionPreparada: true,
      alta: {
        estado: "SOLICITUDES_COMPLETADAS",
        falloCodigo: null,
        updatedAt: "2026-09-26",
      },
      pendientes: 3,
      revisiones: 0,
      importacion: {
        progresoInformado: 100,
        finInformadoEl: "2026-09-26",
        historialRechazado: false,
        necesitaRevision: false,
      },
    },
  });
  expect(container.textContent).toContain("todavía debe comprobar");
  expect(container.textContent).toContain("3 eventos");
  expect(container.textContent).not.toContain("Importación completa");
});
const canalDePrueba: NonNullable<EstadoConexionMeta["canal"]> = {
  numero: "+16505550123",
  estado: "VERIFICADO",
  credencialVencida: false,
  recepcionPreparada: true,
  alta: {
    estado: "SOLICITUDES_COMPLETADAS",
    falloCodigo: null,
    updatedAt: "2026-09-26",
  },
  pendientes: 0,
  revisiones: 0,
  importacion: {
    progresoInformado: 100,
    finInformadoEl: "2026-09-26",
    historialRechazado: false,
    necesitaRevision: false,
  },
  resumen: {
    estado: "RECIBIDO_PROCESADO",
    pendientes: 0,
    revisiones: 0,
    bloquesProcesados: 3,
    ultimoRecibidoEl: "2026-09-26",
  },
};
it("distingue los datos recibidos procesados de garantizar todo el historial", async () => {
  await render({ ...base, canal: canalDePrueba });
  expect(container.textContent).toContain("Datos recibidos procesados");
  expect(container.textContent).toContain("3 bloques");
  expect(container.textContent).toContain("no certifica seis meses completos");
});
it("una pausa temporal explica la reconexión desde el celular y no ofrece otra alta", async () => {
  await render({ ...base, canal: { ...canalDePrueba, estado: "SUSPENDIDO" } });
  expect(container.textContent).toContain("Esperando reconexión");
  expect(container.textContent).toContain(
    "no se vuelve a solicitar el historial",
  );
  expect(container.textContent).not.toContain("Volver a conectar WhatsApp");
});
it("una desvinculación confirmada permite iniciar de nuevo sólo con disponibilidad del servidor", async () => {
  await render({
    ...base,
    modo: "COEXISTENCIA",
    disponible: true,
    canal: {
      ...canalDePrueba,
      estado: "DESCONECTADO",
      reconexionPermitida: true,
    },
  });
  const conectar = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Volver a conectar WhatsApp"),
  );
  expect(conectar?.disabled).toBe(false);
  expect(api.preparar).not.toHaveBeenCalled();
});
it("un descarte local no ofrece reconectar como si Meta hubiera confirmado la desvinculación", async () => {
  await render({
    ...base,
    canal: {
      ...canalDePrueba,
      estado: "DESCONECTADO",
      reconexionPermitida: false,
    },
  });
  expect(container.textContent).toContain(
    "confirmar la desvinculación en Meta",
  );
  expect(container.textContent).not.toContain("Volver a conectar WhatsApp");
});
it("un resultado incierto pide revisión y no ofrece reconectar automáticamente", async () => {
  await render({
    ...base,
    canal: {
      numero: "+16505550123",
      estado: "VERIFICADO",
      credencialVencida: false,
      recepcionPreparada: true,
      alta: {
        estado: "REVISION",
        falloCodigo: "RESPUESTA_INCIERTA",
        updatedAt: "2026-09-26",
      },
      pendientes: 0,
      revisiones: 0,
      importacion: null,
    },
  });
  expect(container.textContent).toContain("No vuelvas a dar de alta");
  expect(
    [...container.querySelectorAll("button")].map((b) => b.textContent),
  ).toEqual(["Actualizar estado"]);
});
const intento = {
  id: "intento",
  estadoSecreto: "secreto",
  venceEl: "2099-01-01T00:00:00Z",
  appId: "100001",
  configId: "100002",
  graphVersion: "v26.0",
  modo: "SANDBOX" as const,
};
async function click(texto: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === texto,
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
it("prepara primero y abre Meta sólo desde el segundo clic explícito", async () => {
  let callback!: (r: unknown) => void;
  const sdk = {
    init: vi.fn(),
    login: vi.fn().mockImplementation((cb) => (callback = cb)),
  };
  vi.mocked(cargarMetaSdk).mockResolvedValue(sdk);
  vi.mocked(api.preparar).mockResolvedValue({
    ...intento,
    venceEl: new Date(Date.now() + 900000).toISOString(),
  });
  vi.mocked(api.cancelar).mockResolvedValue({
    id: "intento",
    estado: "CANCELADA",
    modo: "SANDBOX",
    falloCodigo: null,
  });
  await render({ ...base, disponible: true, modo: "SANDBOX" });
  await click("Probar autorización");
  expect(sdk.login).not.toHaveBeenCalled();
  await click("Continuar con Meta");
  expect(sdk.login).toHaveBeenCalledOnce();
  await act(async () => callback({}));
  expect(container.textContent).toContain("Cancelaste el intento");
});
it("cancelar durante la preparación invalida la respuesta tardía", async () => {
  let terminar!: (x: typeof intento) => void;
  vi.mocked(api.preparar).mockReturnValue(
    new Promise((resolve) => (terminar = resolve)),
  );
  vi.mocked(api.cancelar).mockResolvedValue({
    id: "intento",
    estado: "CANCELADA",
    modo: "SANDBOX",
    falloCodigo: null,
  });
  vi.mocked(cargarMetaSdk).mockClear();
  await render({ ...base, disponible: true, modo: "SANDBOX" });
  await click("Probar autorización");
  await click("Cancelar");
  await act(async () => terminar(intento));
  expect(cargarMetaSdk).not.toHaveBeenCalled();
  expect(api.cancelar).toHaveBeenCalledOnce();
  expect(container.textContent).not.toContain("Continuar con Meta");
});
