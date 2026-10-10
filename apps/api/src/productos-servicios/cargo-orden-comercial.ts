import type { CargoDirectoCatalogo } from '@prisma/client';

type CargoComercial = Pick<
  CargoDirectoCatalogo,
  | 'id'
  | 'codigo'
  | 'nombre'
  | 'descripcion'
  | 'modoCalculo'
  | 'modosActivacionSoportados'
  | 'activo'
  | 'configJson'
>;

const CAMPOS_CONFIG = new Set([
  'monto',
  'porcentaje',
  'porcentajeDefault',
  'precioPorUnidad',
  'inputCantidad',
  'inputNombre',
  'inputLabel',
  'inputUnidad',
  'unidad',
  'cantidadDefault',
  'cantidadMinima',
  'cantidadMaxima',
  'decimales',
  'permiteDecimales',
  'label',
  'descripcion',
]);

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function camposEscalares(valor: unknown, campos: ReadonlySet<string>) {
  return Object.fromEntries(
    Object.entries(objeto(valor)).filter(
      ([clave, dato]) =>
        campos.has(clave) &&
        (typeof dato === 'string' ||
          typeof dato === 'boolean' ||
          (typeof dato === 'number' && Number.isFinite(dato))),
    ),
  );
}

/** Importes que el comercial cobra al agregar un cargo a la orden.
 * No usar para costos de pasos/productos: éstos mantienen su proyección privada.
 * La emisión vuelve a consultar el catálogo y valida la zona del tenant. */
export function cargoParaOrden(cargo: CargoComercial) {
  const config = objeto(cargo.configJson);
  const configJson: Record<string, unknown> = camposEscalares(
    config,
    CAMPOS_CONFIG,
  );
  if (Array.isArray(config.zonas)) {
    configJson.zonas = config.zonas.map((zona) =>
      camposEscalares(zona, new Set(['codigo', 'nombre', 'monto'])),
    );
  }
  return {
    id: cargo.id,
    codigo: cargo.codigo,
    nombre: cargo.nombre,
    descripcion: cargo.descripcion,
    modoCalculo: cargo.modoCalculo,
    modosActivacionSoportados: cargo.modosActivacionSoportados,
    activo: cargo.activo,
    configJson,
  };
}
