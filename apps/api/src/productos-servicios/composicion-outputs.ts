import {
  outputsGeometricosDeFamilia,
  outputsPublicablesDeFamilia,
} from './pasos/capacidades';
import { resolverFamilia } from './pasos/familias';

export type SalidaPublicaComposicion = {
  clave: string;
  etiqueta: string;
  tipoDato: 'number';
  unidad: string | null;
  unidadVisible: string | null;
  familiaCodigo: string;
  pasoNombre: string;
};

type PasoPublicador = {
  familiaCodigo: string;
  nombreVisible?: string | null;
};

function unidadCanonica(clave: string): string | null {
  if (clave.endsWith('_m2')) return 'm2';
  if (clave.startsWith('ml_') || clave.endsWith('_ml')) return 'ml';
  return null;
}

function leerRuta(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }, root);
}

export function catalogoSalidasPublicasComposicion(
  pasos: PasoPublicador[],
): SalidaPublicaComposicion[] {
  const salidas: SalidaPublicaComposicion[] = [];
  const vistas = new Set<string>();
  for (const paso of pasos) {
    const familia = resolverFamilia(paso.familiaCodigo);
    if (!familia) continue;
    const pasoNombre = paso.nombreVisible?.trim() || familia.nombre;
    for (const output of outputsPublicablesDeFamilia(
      familia.outputsCanonicos,
    )) {
      if (vistas.has(output.key)) continue;
      vistas.add(output.key);
      const unidad = unidadCanonica(output.key);
      salidas.push({
        clave: output.key,
        etiqueta: `${pasoNombre} · ${output.etiqueta}`,
        tipoDato: 'number',
        unidad,
        unidadVisible: unidad,
        familiaCodigo: paso.familiaCodigo,
        pasoNombre,
      });
    }
    for (const output of outputsGeometricosDeFamilia(
      familia.derivador?.publicaCanon,
    )) {
      if (output.key.endsWith('TirasMm')) continue;
      for (const eje of ['anchoMm', 'altoMm'] as const) {
        const clave = `${output.key}.${eje}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        salidas.push({
          clave,
          etiqueta: `${pasoNombre} · ${output.etiqueta} · ${eje === 'anchoMm' ? 'ancho' : 'alto'}`,
          tipoDato: 'number',
          unidad: 'mm',
          unidadVisible: 'cm',
          familiaCodigo: paso.familiaCodigo,
          pasoNombre,
        });
      }
    }
  }
  return salidas;
}

export function extraerSalidasPublicasComposicion(
  jobContext: Record<string, unknown>,
  catalogo: SalidaPublicaComposicion[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const salida of catalogo) {
    const value = leerRuta(jobContext, salida.clave);
    if (value !== undefined && value !== null) result[salida.clave] = value;
  }
  return result;
}
