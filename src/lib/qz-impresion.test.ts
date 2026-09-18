import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  preparar: vi.fn(),
  print: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("./impresion-api", () => ({
  getConfiguracionImpresion: mocks.config,
  prepararEtiqueta: mocks.preparar,
  getFirmaImpresoras: vi.fn(),
}));
vi.mock("qz-tray", () => ({
  default: {
    websocket: {
      isActive: () => true,
      connect: mocks.connect,
      disconnect: mocks.disconnect,
    },
    security: {
      setCertificatePromise: vi.fn(),
      setSignatureAlgorithm: vi.fn(),
      setSignaturePromise: vi.fn(),
    },
    api: { getVersion: async () => "2.2.6" },
    print: mocks.print,
  },
}));
const trabajo = {
  params: {
    printer: { name: "Xprinter" },
    options: { copies: 1, jobName: "OT" },
    data: [],
  },
  totalPaginas: 1,
  hash: "hash",
  firma: "firma",
  timestamp: Date.now(),
};
const puesto = { host: "192.168.88.164", impresora: "Xprinter" };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({ tenantId: "a", certificado: "publico" });
  mocks.preparar.mockResolvedValue(trabajo);
  mocks.print.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
});
describe("envío de etiquetas", () => {
  it("no imprime si cambió la empresa activa", async () => {
    mocks.config.mockResolvedValue({ tenantId: "b", certificado: "publico" });
    const { imprimirOrden } = await import("./qz-impresion");
    await expect(imprimirOrden("ot", "a", puesto, 1, vi.fn())).rejects.toThrow(
      "Cambiaste de empresa",
    );
    expect(mocks.print).not.toHaveBeenCalled();
    expect(mocks.preparar).not.toHaveBeenCalled();
  });
  it("no reintenta automáticamente una impresión cuyo resultado es incierto", async () => {
    mocks.print.mockRejectedValue(new Error("WebSocket cerrado"));
    const { imprimirOrden } = await import("./qz-impresion");
    await expect(imprimirOrden("ot", "a", puesto, 1, vi.fn())).rejects.toThrow(
      "evitar duplicados",
    );
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });
  it("informa lo ya enviado si falla la preparación de otra página", async () => {
    mocks.preparar
      .mockResolvedValueOnce({ ...trabajo, totalPaginas: 2 })
      .mockRejectedValueOnce(new Error("API no disponible"));
    const { imprimirOrden } = await import("./qz-impresion");
    const progreso = vi.fn();
    await expect(imprimirOrden("ot", "a", puesto, 2, progreso)).rejects.toThrow(
      "1 de 2 páginas ya fueron enviadas",
    );
    expect(progreso).toHaveBeenCalledWith(1, 2);
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });
  it("impide envíos simultáneos desde el mismo puesto", async () => {
    let completar!: () => void;
    mocks.print.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completar = resolve;
        }),
    );
    const { imprimirOrden } = await import("./qz-impresion");
    const primera = imprimirOrden("ot", "a", puesto, 1, vi.fn());
    await vi.waitFor(() => expect(mocks.print).toHaveBeenCalledTimes(1));
    await expect(imprimirOrden("ot", "a", puesto, 1, vi.fn())).rejects.toThrow(
      "otra operación",
    );
    completar();
    await primera;
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });
});
