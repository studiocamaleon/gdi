// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  iniciarAltaMeta,
  type MetaSdk,
  type PasoAltaMeta,
} from "./meta-signup-sdk";
import type {
  MetaConexionApi,
  PreparacionMeta,
  RespuestaIntentoMeta,
} from "./meta-conexion-api";
const preparacion: PreparacionMeta = {
  id: "intento",
  estadoSecreto: "secreto-local",
  venceEl: "2099-01-01T00:00:00.000Z",
  appId: "100001",
  configId: "100002",
  graphVersion: "v26.0",
  modo: "SANDBOX",
};
let api: MetaConexionApi,
  sdk: MetaSdk,
  callback: (r: unknown) => void,
  cambiar: ReturnType<typeof vi.fn<(paso: PasoAltaMeta) => void>>,
  cancelar: (() => void) | undefined;
const respuesta = (estado: RespuestaIntentoMeta["estado"]) => ({
  id: "intento",
  estado,
  modo: "SANDBOX" as const,
  falloCodigo: null,
});
beforeEach(() => {
  vi.useFakeTimers();
  preparacion.venceEl = new Date(Date.now() + 15 * 60_000).toISOString();
  api = {
    estado: vi.fn(),
    preparar: vi.fn(),
    consultar: vi.fn(),
    canjear: vi.fn().mockResolvedValue(respuesta("CANJEADA")),
    verificar: vi.fn().mockResolvedValue(respuesta("VERIFICADA")),
    cancelar: vi.fn().mockResolvedValue(respuesta("CANCELADA")),
  };
  sdk = {
    init: vi.fn(),
    login: vi.fn().mockImplementation((cb) => {
      callback = cb;
    }),
  };
  cambiar = vi.fn<(paso: PasoAltaMeta) => void>();
});
afterEach(() => {
  cancelar?.();
  vi.useRealTimers();
});
function iniciar(modo: "SANDBOX" | "COEXISTENCIA" = "SANDBOX") {
  if (modo === "COEXISTENCIA") {
    vi.mocked(api.canjear).mockResolvedValue({
      ...respuesta("CANJEADA"),
      modo,
    });
    vi.mocked(api.verificar).mockResolvedValue({
      ...respuesta("VERIFICADA"),
      modo,
    });
  }
  cancelar = iniciarAltaMeta({
    sdk,
    preparacion: { ...preparacion, modo },
    api,
    cambiar,
  });
}
function mensaje(
  origin = "https://www.facebook.com",
  event = "FINISH",
  data: unknown = { waba_id: "200001", phone_number_id: "300001" },
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin,
      data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event, data }),
    }),
  );
}
async function resolver() {
  await vi.advanceTimersByTimeAsync(1);
}
it.each(["codigo-primero", "activos-primero"])(
  "canje inmediato y verificación única con %s",
  async (orden) => {
    iniciar();
    if (orden === "activos-primero") mensaje();
    callback({ authResponse: { code: "codigo" } });
    expect(api.canjear).toHaveBeenCalledTimes(1);
    if (orden === "codigo-primero") {
      expect(api.verificar).not.toHaveBeenCalled();
      mensaje();
    }
    callback({ authResponse: { code: "duplicado" } });
    mensaje();
    await resolver();
    expect(api.verificar).toHaveBeenCalledTimes(1);
    expect(api.verificar).toHaveBeenCalledWith(
      { id: "intento", estadoSecreto: "secreto-local" },
      { wabaId: "200001", phoneNumberId: "300001" },
    );
    expect(cambiar).toHaveBeenLastCalledWith("completado");
    expect(api.cancelar).not.toHaveBeenCalled();
  },
);
it.each([
  "https://evilfacebook.com",
  "https://facebook.com.ejemplo.invalid",
  "http://www.facebook.com",
  "https://www.facebook.com:8443",
])("ignora origen suplantado %s", async (origin) => {
  iniciar();
  callback({ authResponse: { code: "codigo" } });
  mensaje(origin);
  await resolver();
  expect(api.verificar).not.toHaveBeenCalled();
});
it("coexistencia requiere el evento propio; sandbox no solicita esta variante", async () => {
  iniciar("COEXISTENCIA");
  callback({ authResponse: { code: "codigo" } });
  mensaje();
  await resolver();
  expect(api.verificar).not.toHaveBeenCalled();
  expect(vi.mocked(sdk.login).mock.calls[0][1].extras.featureType).toBe(
    "whatsapp_business_app_onboarding",
  );
  mensaje(
    "https://www.facebook.com",
    "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
  );
  await resolver();
  expect(api.verificar).toHaveBeenCalledTimes(1);
});
it("cancelar quita listeners e ignora callbacks tardíos", async () => {
  iniciar();
  cancelar!();
  callback({ authResponse: { code: "codigo" } });
  mensaje();
  await resolver();
  expect(api.canjear).not.toHaveBeenCalled();
  expect(api.cancelar).toHaveBeenCalledTimes(1);
  expect(cambiar).toHaveBeenLastCalledWith("cancelado");
});
it("timeout cancela el intento sin registrar códigos ni repetir canjes", async () => {
  iniciar();
  callback({ authResponse: { code: "codigo" } });
  await vi.advanceTimersByTimeAsync(15 * 60_000);
  expect(api.canjear).toHaveBeenCalledTimes(1);
  expect(api.cancelar).toHaveBeenCalledTimes(1);
  expect(cambiar).toHaveBeenLastCalledWith("error");
});
it("red incierta no reenvía el código", async () => {
  vi.mocked(api.canjear).mockRejectedValueOnce(new Error("red"));
  iniciar();
  callback({ authResponse: { code: "codigo" } });
  await resolver();
  callback({ authResponse: { code: "codigo" } });
  expect(api.canjear).toHaveBeenCalledTimes(1);
  expect(api.verificar).not.toHaveBeenCalled();
  expect(cambiar).toHaveBeenLastCalledWith("error");
});
it("mientras un canje está en curso sólo consulta su estado", async () => {
  vi.mocked(api.canjear).mockResolvedValueOnce(respuesta("CANJEANDO"));
  vi.mocked(api.consultar).mockResolvedValueOnce(respuesta("CANJEADA"));
  iniciar();
  callback({ authResponse: { code: "codigo" } });
  mensaje();
  await vi.advanceTimersByTimeAsync(1001);
  expect(api.canjear).toHaveBeenCalledTimes(1);
  expect(api.consultar).toHaveBeenCalledTimes(1);
  expect(api.verificar).toHaveBeenCalledTimes(1);
});
it("identificadores inválidos y mensajes fuera del esquema no se verifican", async () => {
  iniciar();
  callback({ authResponse: { code: "codigo" } });
  mensaje(undefined, undefined, { waba_id: "https://ajeno" });
  await resolver();
  expect(api.verificar).not.toHaveBeenCalled();
});
