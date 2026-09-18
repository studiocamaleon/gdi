import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import qz from "qz-tray";
const mocks = vi.hoisted(() => ({
  escuchar: vi.fn(),
  preparar: vi.fn(),
  documento: vi.fn(),
  detalles: vi.fn(),
  cad: vi.fn(),
  perfilCad: vi.fn(),
}));
vi.mock("./perfiles-cad-api", () => ({
  prepararPruebaPerfilCad: mocks.perfilCad,
}));
vi.mock("./impresion-api", () => ({
  getConfiguracionImpresion: async () => ({
    tenantId: "tenant",
    certificado: "publico",
  }),
  getFirmaEscucha: mocks.escuchar,
  getFirmaDetallesImpresoras: mocks.detalles,
  prepararPruebaDocumento: mocks.preparar,
  prepararDocumentoOrden: mocks.documento,
  prepararPruebaCad: mocks.cad,
}));
const hash = (call: string, params: object | undefined, timestamp: number) =>
  createHash("sha256")
    .update(JSON.stringify({ call, params, timestamp }))
    .digest("hex");
const mensajes: Array<{
  call: string;
  params: Record<string, unknown>;
  timestamp: number;
  signature: string;
}> = [];

it.each(["BN", "COLOR"] as const)(
  "envía la prueba CAD %s firmada sin modificar tamaño, giro ni escala",
  async (color) => {
    qz.api.setWebSocketType(Socket);
    const timestamp = Date.now();
    const params = {
      printer: { name: "HP T950 TEST" },
      options: {
        copies: 1,
        jobName: "CAD test",
        units: "mm",
        size: { width: 914, height: 604, custom: true },
        scaleContent: false,
        rasterize: false,
        orientation: "portrait",
        rotation: 0,
        margins: 0,
        printerTray: "roll",
        duplex: "one-sided",
        colorType: color === "BN" ? "grayscale" : "color",
      },
      data: [{ type: "pixel", format: "pdf", flavor: "base64", data: "cGRm" }],
    };
    mocks.cad.mockResolvedValue({
      params,
      timestamp,
      hash: hash("print", params, timestamp),
      firma: "firma-cad",
      totalPaginas: 1,
      plan: { escala: 100 },
    });
    const { imprimirPruebaCad } = await import("./qz-impresion");
    await expect(
      imprimirPruebaCad("tenant", "localhost", "destino-cad", 2, "A1", color),
    ).resolves.toEqual({ escala: 100 });
    expect(mocks.cad).toHaveBeenCalledExactlyOnceWith(
      "destino-cad",
      2,
      "A1",
      color,
    );
    expect(mensajes.filter((m) => m.call === "print")).toEqual([
      expect.objectContaining({ params, timestamp, signature: "firma-cad" }),
    ]);
    mocks.cad.mockRejectedValueOnce(new Error("La impresora cambió"));
    await expect(
      imprimirPruebaCad("tenant", "localhost", "destino-cad", 2, "A1"),
    ).rejects.toThrow("cambió");
    expect(mensajes.filter((m) => m.call === "print")).toHaveLength(1);
  },
);
it.each(["BN", "COLOR"] as const)(
  "envía el perfil CAD %s con su versión y conserva todos los parámetros firmados",
  async (color) => {
    qz.api.setWebSocketType(Socket);
    const timestamp = Date.now();
    const params = {
      printer: { name: "HP T950 TEST" },
      options: {
        copies: 1,
        jobName: `Perfil CAD ${color}`,
        units: "mm",
        size: { width: 914, height: 604, custom: true },
        scaleContent: false,
        rasterize: false,
        orientation: "portrait",
        rotation: 0,
        margins: 0,
        printerTray: "Rollo 1",
        duplex: "one-sided",
        colorType: color === "BN" ? "grayscale" : "color",
      },
      data: [{ type: "pixel", format: "pdf", flavor: "base64", data: "cGRm" }],
    };
    mocks.perfilCad.mockResolvedValue({
      params,
      timestamp,
      hash: hash("print", params, timestamp),
      firma: "firma-perfil-cad",
    });
    const { imprimirPruebaPerfilCad } = await import("./qz-impresion");
    const datos = { version: 3, versionDestino: 7, formato: "A1" as const };
    await imprimirPruebaPerfilCad("tenant", "localhost", "perfil", datos);
    expect(mocks.perfilCad).toHaveBeenCalledExactlyOnceWith("perfil", datos);
    expect(mensajes.filter((m) => m.call === "print")).toEqual([
      expect.objectContaining({
        params,
        timestamp,
        signature: "firma-perfil-cad",
      }),
    ]);
    mocks.perfilCad.mockRejectedValueOnce(new Error("El perfil cambió"));
    await expect(
      imprimirPruebaPerfilCad("tenant", "localhost", "perfil", datos),
    ).rejects.toThrow("El perfil cambió");
    expect(mensajes.filter((m) => m.call === "print")).toHaveLength(1);
  },
);
let detalles: unknown;
class Socket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: object) => void;
  onmessage?: (event: { data: string }) => void;
  constructor() {
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }
  send(raw: string) {
    const d = JSON.parse(raw);
    mensajes.push(d);
    setTimeout(
      () =>
        this.onmessage?.({
          data: JSON.stringify({
            uid: d.uid,
            result:
              d.call === "getVersion"
                ? "2.2.6"
                : d.call === "printers.detail"
                  ? detalles
                  : null,
          }),
        }),
      0,
    );
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
}
afterEach(async () => {
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
  mensajes.length = 0;
  vi.clearAllMocks();
});
describe("detección de bandejas con SDK QZ real", () => {
  beforeEach(() => {
    qz.api.setWebSocketType(Socket);
    detalles = [
      { name: "Xprinter", trays: ["Otra bandeja"] },
      {
        name: "RICOH MP 9003 PCL 6",
        trays: ["Automatic-Feeder", "top", "middle", "bottom", "manual", "top"],
      },
    ];
    mocks.detalles.mockImplementation(async (timestamp) => ({
      hash: hash("printers.detail", undefined, timestamp),
      firma: "firma-detalles",
      timestamp,
    }));
  });
  it("consulta firmada sin params, conserva los códigos de la impresora exacta y no imprime", async () => {
    const { buscarBandejas } = await import("./qz-impresion");
    await expect(
      buscarBandejas("localhost", "tenant", "RICOH MP 9003 PCL 6"),
    ).resolves.toEqual([
      "Automatic-Feeder",
      "top",
      "middle",
      "bottom",
      "manual",
    ]);
    const mensaje = mensajes.find((m) => m.call === "printers.detail")!;
    expect(mensaje.signature).toBe("firma-detalles");
    expect(mensaje).not.toHaveProperty("params");
    expect(mocks.detalles).toHaveBeenCalledExactlyOnceWith(mensaje.timestamp);
    expect(mensajes.some((m) => m.call === "print")).toBe(false);
  });
  it("no usa bandejas de otra cola si no encuentra la impresora configurada", async () => {
    const { buscarBandejas } = await import("./qz-impresion");
    await expect(
      buscarBandejas("localhost", "tenant", "Ricoh"),
    ).rejects.toThrow("No se encontró");
  });
  it.each([undefined, null, []])(
    "acepta que el controlador no informe bandejas: %s",
    async (trays) => {
      detalles = [{ name: "Ricoh", trays }];
      const { buscarBandejas } = await import("./qz-impresion");
      await expect(
        buscarBandejas("localhost", "tenant", "Ricoh"),
      ).resolves.toEqual([]);
    },
  );
  it.each(["top,manual", [17], ["top", ""]])(
    "rechaza datos inválidos: %s",
    async (trays) => {
      detalles = [{ name: "Ricoh", trays }];
      const { buscarBandejas } = await import("./qz-impresion");
      await expect(
        buscarBandejas("localhost", "tenant", "Ricoh"),
      ).rejects.toThrow("lista de bandejas inválida");
    },
  );
  it("no envía la consulta si la firma no coincide y permite reintentar tras un error", async () => {
    mocks.detalles.mockResolvedValueOnce({
      hash: "alterado",
      firma: "firma",
      timestamp: Date.now(),
    });
    const { buscarBandejas } = await import("./qz-impresion");
    await expect(
      buscarBandejas("localhost", "tenant", "RICOH MP 9003 PCL 6"),
    ).rejects.toThrow("firma de la consulta no coincide");
    expect(mensajes.some((m) => m.call === "printers.detail")).toBe(false);
    await expect(
      buscarBandejas("localhost", "tenant", "RICOH MP 9003 PCL 6"),
    ).resolves.toContain("manual");
  });
});
describe("documentos y escucha con SDK QZ real", () => {
  it("firma startListening con su timestamp real y conserva A4, copias y doble faz al imprimir", async () => {
    qz.api.setWebSocketType(Socket);
    mocks.escuchar.mockImplementation(async (impresora, timestamp) => ({
      hash: hash(
        "printers.startListening",
        { printerNames: [impresora] },
        timestamp,
      ),
      firma: "firma-escucha",
      timestamp,
    }));
    const timestamp = Date.now();
    const params = {
      printer: { name: "RICOH MP 9003 PCL 6" },
      options: {
        copies: 2,
        jobName: "Grafo prueba A4 test",
        units: "mm",
        size: { width: 210, height: 297 },
        colorType: "grayscale",
        duplex: "long-edge",
        orientation: "portrait",
        scaleContent: true,
        rasterize: false,
      },
      data: [{ type: "pixel", format: "pdf", flavor: "base64", data: "cGRm" }],
    };
    mocks.preparar.mockResolvedValue({
      params,
      timestamp,
      hash: hash("print", params, timestamp),
      firma: "firma-pdf",
      totalPaginas: 2,
    });
    const { escucharImpresora, imprimirPruebaDocumento } =
      await import("./qz-impresion");
    const puesto = { host: "localhost", impresora: params.printer.name };
    const desconectado = vi.fn();
    const escucha = await escucharImpresora(
      "tenant",
      puesto,
      vi.fn(),
      desconectado,
    );
    const mensaje = mensajes.find((m) => m.call === "printers.startListening")!;
    expect(mensaje).toMatchObject({
      params: { printerNames: [puesto.impresora] },
      signature: "firma-escucha",
    });
    expect(mocks.escuchar).toHaveBeenCalledExactlyOnceWith(
      puesto.impresora,
      mensaje.timestamp,
    );
    const preparada = vi.fn();
    await imprimirPruebaDocumento("tenant", puesto, 2, true, preparada);
    expect(preparada).toHaveBeenCalledExactlyOnceWith(params.options.jobName);
    expect(mensajes.find((m) => m.call === "print")).toMatchObject({
      params,
      timestamp,
      signature: "firma-pdf",
    });
    await qz.websocket.disconnect();
    expect(desconectado).toHaveBeenCalledOnce();
    await expect(escucha.consultar()).rejects.toThrow("desconectada");
  });
  it.each(["grayscale", "color"])(
    "envía una OT en %s con sus parámetros firmados y no la repite ante rechazo",
    async (colorType) => {
      qz.api.setWebSocketType(Socket);
      const timestamp = Date.now();
      const params = {
        printer: { name: "RICOH" },
        options: {
          copies: 7,
          colorType,
          duplex: "one-sided",
          orientation: null,
          jobName: "Grafo OT-1 intento-1",
        },
        data: [
          { type: "pixel", format: "pdf", flavor: "base64", data: "cGRm" },
        ],
      };
      const intento = { id: "intento-1", jobName: params.options.jobName };
      mocks.documento.mockResolvedValue({
        params,
        intento,
        timestamp,
        hash: hash("print", params, timestamp),
        firma: "firma-ot",
        totalPaginas: 3,
      });
      const { imprimirDocumentoOrden } = await import("./qz-impresion");
      const preparado = vi.fn();
      await imprimirDocumentoOrden(
        "tenant",
        {
          host: "localhost",
          impresora: "RICOH",
          perfilId: "perfil",
          revisionPerfil: "1:1:1",
        },
        "ot-1",
        "item-1",
        "intento-1",
        undefined,
        preparado,
      );
      expect(preparado).toHaveBeenCalledExactlyOnceWith(intento);
      expect(mensajes.filter((m) => m.call === "print")).toEqual([
        expect.objectContaining({ params, signature: "firma-ot" }),
      ]);
      expect(mocks.documento).toHaveBeenCalledExactlyOnceWith(
        "ot-1",
        "item-1",
        {
          host: "localhost",
          impresora: "RICOH",
          intentoId: "intento-1",
          perfilId: "perfil",
          revisionPerfil: "1:1:1",
          reimpresionDe: undefined,
        },
      );
      mocks.documento.mockRejectedValue(new Error("Ya enviado"));
      await expect(
        imprimirDocumentoOrden(
          "tenant",
          {
            host: "localhost",
            impresora: "RICOH",
            perfilId: "perfil",
            revisionPerfil: "1:1:1",
          },
          "ot-1",
          "item-1",
          "intento-1",
          undefined,
          preparado,
        ),
      ).rejects.toThrow("Ya enviado");
      expect(mensajes.filter((m) => m.call === "print")).toHaveLength(1);
    },
  );
  it("rechaza una firma de escucha alterada sin enviar startListening a QZ", async () => {
    mocks.escuchar.mockResolvedValue({
      hash: "otro",
      firma: "firma",
      timestamp: Date.now(),
    });
    const { escucharImpresora } = await import("./qz-impresion");
    await expect(
      escucharImpresora(
        "tenant",
        { host: "localhost", impresora: "Ricoh" },
        vi.fn(),
        vi.fn(),
      ),
    ).rejects.toThrow();
    expect(mensajes.some((m) => m.call === "printers.startListening")).toBe(
      false,
    );
  });
});

it("firma una escucha conjunta de láser y CAD sin incluir otras impresoras", async () => {
  qz.api.setWebSocketType(Socket);
  const impresoras = ["RICOH", "HP T950"];
  mocks.escuchar.mockImplementation(async (nombres, timestamp) => ({
    hash: hash("printers.startListening", { printerNames: nombres }, timestamp),
    firma: "multi",
    timestamp,
  }));
  const { escucharImpresora } = await import("./qz-impresion");
  const h = await escucharImpresora(
    "tenant",
    { host: "localhost", impresora: "RICOH" },
    () => {},
    () => {},
    impresoras,
  );
  expect(
    mensajes.find((m) => m.call === "printers.startListening"),
  ).toMatchObject({ params: { printerNames: impresoras }, signature: "multi" });
  await h.cerrar();
});
