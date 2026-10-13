import { expect, it } from "vitest";
import { cargasParaPreviewCopiado } from "./centro-copiado-contexto-pedido";
import {
  itemConstruidoAPropuestaItem,
  type CentroCopiadoMeta,
} from "./centro-copiado-api";

function item(meta: CentroCopiadoMeta) {
  return itemConstruidoAPropuestaItem({
    documentoId: "ficticio",
    grupoTomoId: null,
    nombre: "Prueba",
    productoId: "producto-ficticio",
    jobContext: { _centroCopiado: meta },
    especificaciones: {},
    cantidad: 10,
    precioUnitario: 1,
    subtotal: 10,
    impuestoPorcentaje: 0,
    impuestoMonto: 0,
    total: 10,
    cotizacion: null,
    error: null,
  });
}
const meta: CentroCopiadoMeta = {
  paginas: 20,
  copias: 1,
  tamano: "A3",
  papelMateriaPrimaId: "papel-ficticio",
  color: "COLOR",
  faz: 2,
};

it("excluye la carga editada para no contar dos veces su volumen", () => {
  const editado = item(meta),
    otro = item({ ...meta, copias: 3 });
  const cargas = cargasParaPreviewCopiado([editado, otro], [editado]);
  expect(cargas).toHaveLength(1);
  expect(cargas[0].documentos[0]).toMatchObject({
    copias: 3,
    paginas: 20,
    tamanoAnchoMm: 297,
    tamanoAltoMm: 420,
  });
  expect(cargas[0]).not.toHaveProperty("total");
});

it("los tomos conservan los segmentos, juegos y descuentos del pedido", () => {
  const tomo = item({
    esTomo: true,
    juegos: 5,
    terminaciones: ["Anillado"],
    segmentos: [meta as Required<typeof meta>],
  });
  tomo.descuentoInput = {
    tipo: "PORCENTAJE",
    valor: 10,
    cuponCodigo: "EJEMPLO",
  };
  const carga = cargasParaPreviewCopiado([tomo], [])[0];
  expect(carga.documentos[0]).toMatchObject({
    copias: 5,
    grupoId: tomo.id,
    terminaciones: [],
  });
  expect(carga.grupos?.[0]).toMatchObject({
    id: tomo.id,
    juegos: 5,
    terminaciones: ["Anillado"],
  });
  expect(carga.descuento).toEqual({ tipo: "PORCENTAJE", valor: 10 });
});
