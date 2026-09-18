import { describe, expect, it } from "vitest";
import { eventoImpresora } from "./qz-eventos";
const trabajos = new Set(["prueba"]);
const base = {
  printerName: "Ricoh",
  eventType: "JOB",
  jobName: "prueba",
  statusText: "COMPLETE",
  severity: "INFO",
};
describe("eventos de impresión", () => {
  it("no equipara el final de cola a una verificación física", () => {
    expect(eventoImpresora(base, "Ricoh", trabajos)?.detalle).toBe(
      "Finalizado según la cola",
    );
    expect(
      eventoImpresora({ ...base, statusText: "DELETED" }, "Ricoh", trabajos)
        ?.detalle,
    ).toBe("Retirado de la cola");
  });
  it("filtra otras impresoras y trabajos ajenos", () => {
    expect(eventoImpresora(base, "Xprinter", trabajos)).toBeNull();
    expect(
      eventoImpresora({ ...base, jobName: "otro-cliente" }, "Ricoh", trabajos),
    ).toBeNull();
    expect(eventoImpresora(null, "Ricoh", trabajos)).toBeNull();
  });
  it("traduce avisos de la impresora sin depender de un documento", () => {
    expect(
      eventoImpresora(
        {
          ...base,
          eventType: "PRINTER",
          jobName: undefined,
          statusText: "PAPER_OUT",
          severity: "WARN",
        },
        "Ricoh",
        trabajos,
      ),
    ).toMatchObject({ detalle: "Sin papel", severidad: "WARN" });
  });
});
