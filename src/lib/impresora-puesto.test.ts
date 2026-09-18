import { describe, expect, it, vi, afterEach } from "vitest";
import {
  hostQzValido,
  leerImpresora,
  guardarImpresora,
} from "./impresora-puesto";
afterEach(() => vi.unstubAllGlobals());
describe("impresora por puesto y empresa", () => {
  it.each(["localhost", "192.168.88.164", "pc-taller.local"])(
    "acepta %s",
    (host) => expect(hostQzValido(host)).toBe(true),
  );
  it.each(["", "https://pc", "pc:8181", "usuario@pc", "pc/ruta"])(
    "rechaza %s",
    (host) => expect(hostQzValido(host)).toBe(false),
  );
  it("aísla por empresa y recupera una configuración inválida", () => {
    const datos = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => datos.get(k) ?? null,
      setItem: (k: string, v: string) => datos.set(k, v),
    });
    guardarImpresora("a", {
      host: "192.168.88.164",
      impresora: "Xprinter XP-410B",
    });
    expect(leerImpresora("a").impresora).toBe("Xprinter XP-410B");
    expect(leerImpresora("b").impresora).toBe("");
    guardarImpresora(
      "a",
      { host: "192.168.88.164", impresora: "Ricoh" },
      "documentos",
    );
    expect(leerImpresora("a", "documentos").impresora).toBe("Ricoh");
    expect(leerImpresora("a").impresora).toBe("Xprinter XP-410B");
    expect(leerImpresora("b", "documentos").impresora).toBe("");
    datos.set("grafo:impresora-etiquetas:v1:a", "corrupto");
    expect(leerImpresora("a").host).toBe("localhost");
  });
});
