import type { OfertaCompra, VarianteCompra } from "./compras-api";
import {
  materialPriceContext,
  materialPriceInUnit,
  materialUnitConversion,
  normalizeMaterialUnit,
} from "./material-units";

export const numeroCompraInput = (n: number, decimales = 8) =>
  String(Number(n.toFixed(decimales)));
const positivo = (n: unknown): n is number | string =>
  n != null && Number.isFinite(Number(n)) && Number(n) > 0;
const mismaUnidad = (a: string, b: string) =>
  normalizeMaterialUnit(a) === normalizeMaterialUnit(b);
const contexto = (v: VarianteCompra) =>
  v.contextoUnidades ?? materialPriceContext(v);

export function ofertaCompraVigente(v: VarianteCompra, proveedor: string) {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return v.ofertasCompra.find(
    (o) =>
      o.proveedorId === proveedor &&
      o.activo &&
      (!o.vigenteHasta || o.vigenteHasta.slice(0, 10) >= fecha),
  );
}

/** Contenido de la presentación del proveedor o conversión ya definida en inventario. */
export function factorCompra(
  v: VarianteCompra,
  unidad: string,
  oferta?: OfertaCompra,
): number | null {
  const ctx = contexto(v);
  if (
    oferta &&
    mismaUnidad(unidad, oferta.unidadCompra) &&
    mismaUnidad(ctx.unidadStock, oferta.unidadStock) &&
    positivo(oferta.factorStock)
  )
    return Number(oferta.factorStock);
  const conversion = materialUnitConversion(ctx, unidad, ctx.unidadStock);
  return conversion.ok ? conversion.factor : null;
}

/** Los importes siempre conservan su moneda y la unidad a la que corresponden. */
export function sugerirPrecioCompra(
  v: VarianteCompra,
  unidad: string,
  factor: number | null,
  oferta: OfertaCompra | undefined,
  moneda: string,
  monedaStock: string,
): { precio: string; origen: string | null; aviso: string | null } {
  const ctx = contexto(v);
  const usaOferta = oferta && positivo(oferta.precio);
  const precio = usaOferta ? Number(oferta.precio) : Number(v.precioReferencia);
  const unidadPrecio = usaOferta ? oferta.unidadCompra : ctx.unidadPrecio;
  const monedaPrecio = (
    usaOferta ? oferta.moneda : v.moneda || monedaStock
  ).toUpperCase();
  const origen = usaOferta ? "Precio del proveedor" : "Costo del inventario";
  const pendiente = (aviso: string) => ({ precio: "", origen: null, aviso });
  if (!positivo(precio))
    return pendiente(
      "Este material todavía no tiene un costo cargado. Indicá el precio de compra.",
    );
  if (monedaPrecio !== moneda)
    return pendiente(
      `${usaOferta ? "La oferta" : "El costo del inventario"} está en ${monedaPrecio}. Cambiá la moneda de la compra o confirmá el precio en ${moneda}.`,
    );
  if (!unidadPrecio)
    return pendiente(
      "Confirmá la unidad del precio en la ficha del material para reutilizar su costo.",
    );

  // Pasar por stock permite reutilizar también una presentación particular del proveedor.
  const origenStock = usaOferta
    ? factorCompra(v, unidadPrecio, oferta)
    : (() => {
        const c = materialUnitConversion(ctx, unidadPrecio, ctx.unidadStock);
        return c.ok ? c.factor : null;
      })();
  const convertido = mismaUnidad(unidadPrecio, unidad)
    ? precio
    : factor && origenStock
      ? (precio * factor) / origenStock
      : null;
  if (convertido != null)
    return { precio: numeroCompraInput(convertido, 6), origen, aviso: null };
  const conversion = materialPriceInUnit(
    { ...ctx, unidadPrecio },
    precio,
    unidad,
  );
  return conversion.ok
    ? { precio: numeroCompraInput(conversion.precio, 6), origen, aviso: null }
    : pendiente(
        "Falta el contenido de esta presentación para convertir el costo guardado.",
      );
}
