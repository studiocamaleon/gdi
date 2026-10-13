import { expect, it } from "vitest";
import { tandasDeOrden } from "./tandas-copiado";
import { ponerPrecioCopiado } from "./centro-copiado-pedidos-api";
import type { PropuestaItem } from "./propuestas";
const tanda = {
  version: 1 as const,
  id: "tanda-ficticia",
  documentos: 2,
  paginas: 8,
  prepara: true,
};
const meta = {
  archivoNombre: "Prueba.pdf",
  archivoBytes: 1000,
  paginas: 3,
  paginasOriginales: 3,
  copias: 1,
  faz: 2 as const,
  tandaImpresion: tanda,
};
it("usa únicamente los miembros de la orden, conserva el orden y detecta tandas incompletas", () => {
  const metas = { a: meta, b: { ...meta, copias: 2 }, ajeno: meta };
  const [grupo] = tandasDeOrden([{ itemId: "b" }, { itemId: "a" }], metas);
  expect(grupo.completa).toBe(true);
  expect(grupo.segmentos.map((s) => [s.origenItemIds, s.copias])).toEqual([
    [["b"], 2],
    [["a"], 1],
  ]);
  expect(tandasDeOrden([{ itemId: "a" }], metas)[0].completa).toBe(false);
});
it("la revisión actualiza total, buckets, pasos y plan; los productos comunes no se convierten en copiado", () => {
  const item = {
    cantidad: 1,
    jobContext: { _centroCopiado: meta },
    cotizacion: {
      costos: { total: 200, tiempoTotal: 100 },
      pasos: [],
      desglosePrecio: { descuento: { montoTotal: 0 }, margenEfectivoPct: 0 },
    },
  } as unknown as PropuestaItem;
  const ejecucion = {
    costos: { total: 120, tiempoTotal: 20 },
    pasos: [{ tiempo: { setupMin: 0 } }],
  } as unknown as Pick<PropuestaItem["cotizacion"], "costos" | "pasos">;
  const nuevo = ponerPrecioCopiado(
    item,
    {
      subtotal: 200,
      iva: 42,
      total: 242,
      tandaImpresion: tanda,
      finanzas: { costoTotal: 120, cargas: [], ejecucion },
    },
    "cotizacion-ficticia",
  );
  expect(nuevo.cotizacion.costos).toMatchObject({
    total: 120,
    tiempoTotal: 20,
  });
  expect(nuevo.cotizacion.pasos).toEqual(ejecucion.pasos);
  expect(nuevo.cotizacion.desglosePrecio?.margenEfectivoPct).toBe(40);
  expect(nuevo.jobContext?._centroCopiado).toMatchObject({
    tandaImpresion: tanda,
  });
  expect(
    ponerPrecioCopiado(
      { ...item, jobContext: { cantidad: 1 } },
      { subtotal: 200, iva: 42, total: 242 },
      "normal",
    ).jobContext,
  ).toEqual({ cantidad: 1 });
});
