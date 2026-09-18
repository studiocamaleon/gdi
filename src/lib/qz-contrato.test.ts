import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
// SDK real con un transporte en memoria: no abre una conexión ni imprime.
import qz from "qz-tray";

describe("contrato con QZ Tray 2.2", () => {
  it("conserva exactamente los mensajes firmados de búsqueda e impresión", async () => {
    const mensajes: Array<Record<string, unknown>> = [];
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
        const dato = JSON.parse(raw);
        mensajes.push(dato);
        const result =
          dato.call === "getVersion"
            ? "2.2.6"
            : dato.call === "printers.find"
              ? ["Xprinter XP-410B"]
              : null;
        setTimeout(
          () =>
            this.onmessage?.({
              data: JSON.stringify({ uid: dato.uid, result }),
            }),
          0,
        );
      }
      close() {
        this.readyState = 3;
        this.onclose?.({ code: 1000 });
      }
    }
    qz.api.setWebSocketType(Socket);
    qz.security.setCertificatePromise((resolve: (s: string) => void) =>
      resolve("certificado-test"),
    );
    qz.security.setSignatureAlgorithm("SHA512");
    let esperado = "";
    qz.security.setSignaturePromise(
      (hash: string) =>
        (resolve: (s: string) => void, reject: (e: Error) => void) => {
          if (hash !== esperado)
            return reject(new Error("Hash distinto al mensaje del backend"));
          resolve("firma-test");
        },
    );
    await qz.websocket.connect({
      host: "localhost",
      usingSecure: true,
      port: { secure: [8181] },
      retries: 0,
      delay: 0,
      keepAlive: 0,
    });
    const timestamp = 1789686000000;
    esperado = createHash("sha256")
      .update(JSON.stringify({ call: "printers.find", params: {}, timestamp }))
      .digest("hex");
    expect(await qz.printers.find(undefined, undefined, timestamp)).toEqual([
      "Xprinter XP-410B",
    ]);
    const params = {
      printer: { name: "Xprinter XP-410B" },
      options: { copies: 1, jobName: "Grafo OT-2026-0060 (1/1)" },
      data: [
        { type: "raw", format: "command", flavor: "base64", data: "YWJj" },
      ],
    };
    esperado = createHash("sha256")
      .update(JSON.stringify({ call: "print", params, timestamp }))
      .digest("hex");
    await qz.print(
      { getPrinter: () => params.printer, getOptions: () => params.options },
      params.data,
      [],
      timestamp,
    );
    const impresion = mensajes.find((m) => m.call === "print");
    expect(impresion).toMatchObject({
      params,
      timestamp,
      signature: "firma-test",
      signAlgorithm: "SHA512",
    });
    await qz.websocket.disconnect();
  });
});
