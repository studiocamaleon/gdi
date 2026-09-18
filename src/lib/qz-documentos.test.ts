import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import qz from "qz-tray";
const mocks = vi.hoisted(() => ({ escuchar: vi.fn(), preparar: vi.fn() }));
vi.mock("./impresion-api", () => ({
  getConfiguracionImpresion: async () => ({
    tenantId: "tenant",
    certificado: "publico",
  }),
  getFirmaEscucha: mocks.escuchar,
  prepararPruebaDocumento: mocks.preparar,
}));
const hash = (call: string, params: object, timestamp: number) =>
  createHash("sha256")
    .update(JSON.stringify({ call, params, timestamp }))
    .digest("hex");
const mensajes: Array<{
  call: string;
  params: Record<string, unknown>;
  timestamp: number;
  signature: string;
}> = [];
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
            result: d.call === "getVersion" ? "2.2.6" : null,
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
