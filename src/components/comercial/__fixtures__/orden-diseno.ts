import type { PropuestaItem } from "@/lib/propuestas";

/** Datos ficticios para el catálogo visual y pruebas, sin acceso a tenants. */
export function productoDiseno(
  id: string,
  nombre: string,
  cantidad: number,
  neto: number,
): PropuestaItem {
  return {
    id,
    productoNombre: nombre,
    productoCodigo: id,
    motorCodigo: "",
    categoriaComercialCodigo: "impresion",
    categoriaComercialNombre: "Impresión",
    subcategoriaComercialCodigo: "digital",
    subcategoriaComercialNombre: "Digital",
    unidadMedida: "unidad",
    cantidad,
    precioUnitario: neto / cantidad,
    subtotal: neto,
    impuestoPorcentaje: 21,
    impuestoMonto: neto * 0.21,
    total: neto * 1.21,
    especificaciones: {
      Material: "Ilustración mate",
      Impresión: "Color · doble faz",
    },
    // Este fixture sólo ejerce la tabla y el resumen. No representa un cálculo del motor.
    cotizacion: {
      productoId: id,
      productoNombre: nombre,
      rutaNombre: "Digital",
      cantidadEfectiva: cantidad,
      cantidadPedida: cantidad,
      costos: {
        tiempoTotal: 0,
        materialesTotal: neto * 0.6,
        cargosDirectosTotal: 0,
        total: neto * 0.6,
        unitario: (neto * 0.6) / cantidad,
      },
      pasos: [],
      cargosDirectosCotizacion: [],
    },
    pasos: [],
    adicionales: [],
    atributosSchema: [],
  };
}
export const productosDiseno = [
  productoDiseno("demo-tarjetas", "Tarjetas personales", 500, 45000),
  productoDiseno("demo-folletos", "Folletos A5", 1000, 128000),
  productoDiseno("demo-etiquetas", "Etiquetas autoadhesivas", 200, 32500),
];
