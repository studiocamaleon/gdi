import {
  contratoCompatible,
  type ContratoCapacidades,
} from './evaluador-capacidades';
import type { ContenidoPlan } from '../plataforma/planes/catalogo-planes';

export type VersionContrato = {
  id: string;
  numero: number;
  catalogoVersion: number;
  contenido: unknown;
};
type SuscripcionContrato = {
  plan: {
    nombre?: string;
    featuresJson: unknown;
    comercialVersionado?: boolean;
  };
  planVersion?: VersionContrato | null;
  usuariosAdicionales?: number;
};

/** Los snapshots del catálogo ya fueron validados al publicar. No se
 * reinterpretan con dependencias comerciales que cambien en el futuro. */
export function contratoPublicado(
  version: VersionContrato,
): ContratoCapacidades {
  if (![1, 2].includes(version.catalogoVersion))
    throw new Error('Versión de contrato no soportada.');
  const p = version.contenido as ContenidoPlan;
  if (
    !p?.funciones ||
    !Number.isInteger(p.usuariosIncluidos) ||
    p.almacenamientoModo === 'pendiente'
  )
    throw new Error('La versión publicada no tiene condiciones válidas.');
  return {
    origen: 'version',
    versionId: version.id,
    numeroVersion: version.numero,
    catalogoVersion: version.catalogoVersion,
    nombre: p.nombre,
    funciones: {
      ...p.funciones,
      // El catálogo v1 incluía ambos algoritmos en aprovechamiento. Las
      // versiones publicadas conservan esos derechos; v2 exige la selección.
      nesting_irregular:
        version.catalogoVersion === 1 &&
        !Object.hasOwn(p.funciones, 'nesting_irregular')
          ? p.funciones.aprovechamiento_cotizacion === true
          : p.funciones.nesting_irregular === true,
    },
    adicionalesPermitidos: p.adicionalesPermitidos,
    limites: {
      usuariosMax: p.usuariosIncluidos,
      ordenesMesMax: null,
      almacenamiento: { modo: p.almacenamientoModo, gb: p.almacenamientoGb },
    },
  };
}

/** Único resolvedor de condiciones: versión asignada o compatibilidad; nunca borradores. */
export function contratoSuscripcion(
  s: SuscripcionContrato | null | undefined,
): ContratoCapacidades {
  if (s?.plan.comercialVersionado && !s.planVersion)
    throw new Error(
      'La suscripción de un plan comercial versionado necesita una versión asignada.',
    );
  const contrato = s?.planVersion
    ? contratoPublicado(s.planVersion)
    : contratoCompatible(s?.plan ?? null);
  if (contrato.limites.usuariosMax !== null)
    contrato.limites.usuariosMax += s?.usuariosAdicionales ?? 0;
  return contrato;
}

export function funcionHistoricaEnContrato(
  contrato: ContratoCapacidades,
  clave: 'afip' | 'whatsapp' | 'centroCopiado' | 'impresionDirecta',
) {
  const claves = {
    afip: ['fiscal_argentina'],
    whatsapp: ['whatsapp_automatico', 'whatsapp_web'],
    centroCopiado: ['centro_copiado'],
    impresionDirecta: ['impresion_directa'],
  };
  return claves[clave].some((c) => contrato.funciones[c] === true);
}
