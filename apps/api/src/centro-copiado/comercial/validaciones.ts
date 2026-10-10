import { Decimal } from '@prisma/client/runtime/library';
import {
  CENTRO_COPIADO_COBERTURAS,
  CENTRO_COPIADO_FORMATOS,
} from '../centro-copiado.domain';
import type {
  CombinacionComercialHojas,
  FilaMatrizHojas,
  ReglasComercialesHojas,
  TarifarioCalculoHojas,
} from './tipos';

/** Precisión local: no modifica la configuración decimal usada por el motor. */
export const DecimalComercial = Decimal.clone({ precision: 50 });

export class ErrorCalculoComercial extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorCalculoComercial';
  }
}

export function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorCalculoComercial(mensaje);
}

export function identificador(valor: string, etiqueta: string) {
  exigir(
    typeof valor === 'string' && valor.trim().length > 0,
    `${etiqueta}: falta un identificador.`,
  );
}

export function enteroPositivo(valor: number, etiqueta: string) {
  exigir(
    Number.isSafeInteger(valor) && valor > 0,
    `${etiqueta}: debe ser un entero positivo seguro.`,
  );
}

export function sumarCantidad(a: number, b: number): number {
  const total = a + b;
  exigir(
    Number.isSafeInteger(total) && total >= 0,
    'La cantidad acumulada excede el límite de cálculo.',
  );
  return total;
}

export function claveCombinacion(
  c: Readonly<CombinacionComercialHojas>,
): string {
  // Tupla explícita: no depende del orden de las propiedades ni de separadores en IDs.
  return JSON.stringify([
    c.papelMateriaPrimaId,
    c.gramaje,
    c.tamano,
    c.color,
    c.faz,
    c.cobertura,
  ]);
}

export function validarCombinacion(
  c: Readonly<CombinacionComercialHojas>,
  reglas: Readonly<ReglasComercialesHojas>,
) {
  identificador(c.papelMateriaPrimaId, 'Papel');
  if (c.gramaje !== null) enteroPositivo(c.gramaje, 'Gramaje efectivo');
  exigir(
    CENTRO_COPIADO_FORMATOS.some((f) => f.nombre === c.tamano),
    'El tamaño no pertenece al catálogo de hojas.',
  );
  exigir(
    c.color === 'BN' || c.color === 'COLOR',
    'El tipo de impresión debe ser K o CMYK.',
  );
  exigir(c.faz === 1 || c.faz === 2, 'Las caras deben ser simple o doble faz.');
  exigir(
    reglas.cobertura === 'UNICA'
      ? c.cobertura === null
      : CENTRO_COPIADO_COBERTURAS.some((v) => v === c.cobertura),
    'La cobertura de la combinación no coincide con la modalidad del tarifario.',
  );
}

export function validarRangos(rangos: readonly number[]) {
  exigir(
    rangos.length > 0 && rangos[0] === 1,
    'Los rangos de hojas deben comenzar en 1.',
  );
  rangos.forEach((desde, i) => {
    enteroPositivo(desde, 'Inicio de tramo');
    exigir(
      i === 0 || desde > rangos[i - 1],
      'Los rangos deben estar ordenados y no repetirse.',
    );
  });
}

export function indexarTarifario(
  tarifario: TarifarioCalculoHojas,
): Map<string, FilaMatrizHojas> {
  identificador(tarifario.tenantId, 'Empresa del tarifario');
  identificador(tarifario.tarifarioId, 'Tarifario');
  identificador(tarifario.versionId, 'Versión del tarifario');
  const r = tarifario.reglas;
  exigir(
    r.unidad === 'HOJA' || r.unidad === 'CARILLA',
    'Unidad comercial de hojas inválida.',
  );
  exigir(
    r.acumulacion === 'COMBINACION' || r.acumulacion === 'ARCHIVO',
    'Modalidad de acumulación inválida.',
  );
  exigir(
    r.ultimaHojaImpar === 'MANTENER_DOBLE' ||
      r.ultimaHojaImpar === 'COBRAR_SIMPLE',
    'Política de última hoja impar inválida.',
  );
  exigir(
    r.cobertura === 'UNICA' || r.cobertura === 'DIFERENCIADA',
    'Modalidad de cobertura inválida.',
  );
  validarRangos(tarifario.rangosGenerales);
  const filas = new Map<string, FilaMatrizHojas>();
  for (const fila of tarifario.filas) {
    validarCombinacion(fila.combinacion, r);
    const clave = claveCombinacion(fila.combinacion);
    exigir(!filas.has(clave), 'La matriz repite una combinación.');
    const rangos = fila.rangosPropios ?? tarifario.rangosGenerales;
    validarRangos(rangos);
    const celdas = new Set<number>();
    for (const celda of fila.precios) {
      exigir(
        rangos.includes(celda.desdeCantidad),
        'Un precio refiere a un tramo inexistente. Revisá los límites y precios juntos.',
      );
      exigir(
        !celdas.has(celda.desdeCantidad),
        'La combinación repite un precio para el mismo tramo.',
      );
      celdas.add(celda.desdeCantidad);
      if (celda.precioUnitario !== null) {
        // 18 enteros + 8 decimales y cantidades seguras caben en la precisión local.
        exigir(
          typeof celda.precioUnitario === 'string' &&
            /^\d{1,18}(\.\d{1,8})?$/.test(celda.precioUnitario),
          'El precio debe ser un decimal no negativo (hasta 18 enteros y 8 decimales) o quedar pendiente.',
        );
      }
    }
    filas.set(clave, fila);
  }
  return filas;
}
