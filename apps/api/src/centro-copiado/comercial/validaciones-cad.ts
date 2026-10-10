import { esConfiguracionCad } from '../../common/cad-geometria';
import { CENTRO_COPIADO_COBERTURAS } from '../centro-copiado.domain';
import type {
  CombinacionComercialCad,
  FilaMatrizCad,
  ReglasComercialesCad,
  TarifarioCalculoCad,
} from './tipos-cad';
import {
  DecimalComercial,
  enteroPositivo,
  exigir,
  identificador,
  validarPrecioMatriz,
} from './validaciones';

/** Límite técnico, sin redondear: hasta 12 decimales de ML y cantidad segura. */
export function cantidadMl(valor: string) {
  exigir(
    typeof valor === 'string' && /^\d{1,16}(\.\d{1,12})?$/.test(valor),
    'Los ML deben ser decimales no negativos con hasta 12 decimales.',
  );
  const cantidad = new DecimalComercial(valor);
  exigir(
    cantidad.lte(Number.MAX_SAFE_INTEGER),
    'Los ML exceden el límite de cálculo.',
  );
  return cantidad;
}

export function claveCombinacionCad(c: Readonly<CombinacionComercialCad>) {
  return JSON.stringify([
    c.papelMateriaPrimaId,
    c.gramaje,
    c.anchoRolloMm,
    c.color,
    c.cobertura,
  ]);
}

export function validarCombinacionCad(
  c: Readonly<CombinacionComercialCad>,
  reglas: Readonly<ReglasComercialesCad>,
) {
  identificador(c.papelMateriaPrimaId, 'Papel CAD');
  if (c.gramaje !== null) enteroPositivo(c.gramaje, 'Gramaje efectivo CAD');
  exigir(
    esConfiguracionCad({
      anchoRolloMm: c.anchoRolloMm,
      margenMm: 5,
      origenPapel: '',
      usarOrigenPredeterminado: true,
    }),
    'El ancho del rollo no pertenece al rango productivo CAD habilitado.',
  );
  exigir(
    c.color === 'BN' || c.color === 'COLOR',
    'La impresión CAD debe ser K o CMYK.',
  );
  exigir(
    reglas.cobertura === 'UNICA'
      ? c.cobertura === null
      : CENTRO_COPIADO_COBERTURAS.some((v) => v === c.cobertura),
    'La cobertura CAD no coincide con la modalidad del tarifario.',
  );
}

export function validarRangosCad(rangos: readonly string[]) {
  const limites = rangos.map((r) => cantidadMl(r));
  exigir(
    limites.length > 0 && limites[0].isZero(),
    'Los rangos CAD deben comenzar en 0 ML.',
  );
  limites.forEach((limite, i) => {
    exigir(
      i === 0 || limite.gt(limites[i - 1]),
      'Los rangos CAD deben estar ordenados y no repetirse.',
    );
  });
  return limites.map((r) => r.toFixed());
}

export function indexarTarifarioCad(tarifario: TarifarioCalculoCad) {
  identificador(tarifario.tenantId, 'Empresa del tarifario');
  identificador(tarifario.tarifarioId, 'Tarifario');
  identificador(tarifario.versionId, 'Versión del tarifario');
  const r = tarifario.reglas;
  exigir(r.unidad === 'ML', 'CAD sólo admite precio por ML.');
  exigir(
    r.acumulacion === 'COMBINACION' || r.acumulacion === 'ARCHIVO',
    'Acumulación CAD inválida.',
  );
  exigir(
    r.cobertura === 'UNICA' || r.cobertura === 'DIFERENCIADA',
    'Modalidad de cobertura CAD inválida.',
  );
  exigir(
    r.redondeo.modalidad === 'SIN_REDONDEO' ||
      r.redondeo.modalidad === 'HACIA_ARRIBA',
    'Modalidad de redondeo CAD inválida.',
  );
  if (r.redondeo.modalidad === 'HACIA_ARRIBA') {
    exigir(
      cantidadMl(r.redondeo.incrementoMl).gt(0),
      'El incremento de redondeo debe ser positivo.',
    );
  }
  const generales = validarRangosCad(tarifario.rangosGenerales);
  const filas = new Map<string, FilaMatrizCad>();
  for (const fila of tarifario.filas) {
    validarCombinacionCad(fila.combinacion, r);
    const clave = claveCombinacionCad(fila.combinacion);
    exigir(!filas.has(clave), 'La matriz CAD repite una combinación.');
    const rangos =
      fila.rangosPropios == null
        ? generales
        : validarRangosCad(fila.rangosPropios);
    const vistas = new Set<string>();
    for (const celda of fila.precios) {
      const desde = cantidadMl(celda.desdeCantidad).toFixed();
      exigir(
        rangos.includes(desde),
        'Un precio CAD refiere a un tramo inexistente.',
      );
      exigir(
        !vistas.has(desde),
        'La combinación CAD repite el precio del mismo tramo.',
      );
      vistas.add(desde);
      validarPrecioMatriz(celda.precioUnitario);
    }
    filas.set(clave, fila);
  }
  return filas;
}
