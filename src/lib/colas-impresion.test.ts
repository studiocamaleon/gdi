import { describe, it, expect } from "vitest";
import { perfilPrueba } from "../../apps/api/src/impresion/perfiles-impresion.fixture";
import {
  siguientesEnvios,
  trabajosDeVistas,
  type TrabajoCola,
} from "./colas-impresion";
import type { DocumentoOrden, EnvioDocumento } from "./impresion-api";
function trabajo(
  id: string,
  maquina: string,
  estado: "LISTO" | "PREPARACION" = "LISTO",
): TrabajoCola {
  return {
    clave: id,
    ordenId: "ot",
    numero: "OT-1",
    estadoOrden: "pendiente",
    doc: {
      itemId: id,
      trabajoId: id,
      nombre: id,
      motivo: estado === "LISTO" ? null : "Cargar papel",
      ruta: {
        estado,
        motivo: null,
        perfil: {
          ...perfilPrueba,
          bandeja: {
            ...perfilPrueba.bandeja,
            destino: { ...perfilPrueba.bandeja.destino, maquinaId: maquina },
          },
        },
      },
    } as DocumentoOrden,
  };
}
describe("colas por máquina", () => {
  it("despacha una cabecera por máquina y no salta el trabajo que espera papel", () => {
    const lista = [
      trabajo("a", "laser", "PREPARACION"),
      trabajo("b", "laser"),
      trabajo("c", "cad"),
      trabajo("d", "color"),
    ];
    expect(siguientesEnvios(lista).map((t) => t.clave)).toEqual(["c", "d"]);
    lista[0].envio = { estado: "ENVIADO" } as EnvioDocumento;
    expect(siguientesEnvios(lista).map((t) => t.clave)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });
  it("un envío incierto detiene sólo su máquina; se retoma al verificar la salida", () => {
    const a = trabajo("a", "laser"),
      b = trabajo("b", "laser"),
      c = trabajo("c", "cad");
    a.envio = { estado: "SIN_CONFIRMAR" } as EnvioDocumento;
    expect(siguientesEnvios([a, b, c]).map((t) => t.clave)).toEqual(["c"]);
    a.envio.confirmacion = {
      usuario: "Operario",
      fecha: "hoy",
      usuarioId: "u",
    };
    expect(siguientesEnvios([a, b, c]).map((t) => t.clave)).toEqual(["b", "c"]);
  });
  it("una página enviada no oculta las demás del mismo archivo", () => {
    const p = trabajo("i", "cad").doc;
    const ts = trabajosDeVistas([
      {
        ordenId: "ot",
        numero: "OT-1",
        estado: "pendiente",
        documentos: [
          {
            ...p,
            trabajoId: "i:1",
            paginaCad: { pagina: 1, copias: 3, anchoMm: 841, altoMm: 594 },
          },
          {
            ...p,
            trabajoId: "i:3",
            paginaCad: { pagina: 3, copias: 2, anchoMm: 841, altoMm: 594 },
          },
        ],
        historial: [
          {
            itemId: "i",
            trabajoId: "i:1",
            estado: "ENVIADO",
          } as EnvioDocumento,
        ],
      },
    ]);
    expect(ts[0].envio).toBeTruthy();
    expect(ts[1].envio).toBeUndefined();
    expect(siguientesEnvios(ts).map((t) => t.clave)).toEqual(["i:3"]);
  });
});
