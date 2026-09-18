import { esConfiguracionCad } from './cad.domain';
import { enlacePerfilCad } from './perfiles-cad.domain';
export type ConfiguracionDocumento = {
  cad?: {
    perfilId: string;
    versionPerfil: number;
    versionDestino: number;
    materialVarianteId: string;
    rutaAlternativaId: string;
  };
  papelMateriaPrimaId: string;
  papelNombre: string;
  gramaje: number | null;
  tamano: string;
  color: string;
  faz: number;
};
export type PerfilDisponible = {
  cad?: unknown;
  id: string;
  nombre: string;
  papelMateriaPrimaId: string;
  gramaje: number;
  tamano: string;
  color: string;
  faz: number;
  modo: string;
  probado: boolean;
  activo: boolean;
  prioridad: number;
  version: number;
  bandeja: {
    id: string;
    nombre: string;
    codigo: string;
    version: number;
    papelPreparadoId: string | null;
    gramajePreparado: number | null;
    destino: {
      id: string;
      nombre: string;
      host: string;
      impresora: string;
      maquinaId: string;
      activo: boolean;
      version: number;
      cad?: unknown;
    };
  };
};
export type RutaImpresion = {
  estado: 'LISTO' | 'PREPARACION' | 'REVISAR';
  motivo: string | null;
  perfil: PerfilDisponible | null;
};
/** Sólo perfiles exactos. Una preferencia empatada nunca elige por orden de DB. */
export function resolverPerfil(
  doc: ConfiguracionDocumento,
  perfiles: PerfilDisponible[],
  maquinas?: string[],
): RutaImpresion {
  if (doc.cad) {
    const p = perfiles.find((p) => p.id === doc.cad!.perfilId);
    const enlace = enlacePerfilCad(p?.cad);
    const motivo =
      !p ||
      !p.activo ||
      !p.bandeja.destino.activo ||
      !esConfiguracionCad(p.bandeja.destino.cad) ||
      p.version !== doc.cad.versionPerfil ||
      p.bandeja.destino.version !== doc.cad.versionDestino ||
      p.tamano !== 'CAD' ||
      p.color !== doc.color ||
      p.faz !== 1 ||
      p.papelMateriaPrimaId !== doc.papelMateriaPrimaId ||
      p.gramaje !== doc.gramaje ||
      enlace?.materialVarianteId !== doc.cad.materialVarianteId ||
      enlace?.rutaAlternativaId !== doc.cad.rutaAlternativaId ||
      (maquinas !== undefined &&
        !maquinas.includes(p.bandeja.destino.maquinaId))
        ? 'El perfil CAD cambió o no coincide con el plano. Revisá la configuración y volvé a cotizar.'
        : !p.probado
          ? 'Falta verificar la prueba física de este perfil CAD.'
          : null;
    if (motivo || !p) return { estado: 'REVISAR', motivo, perfil: p ?? null };
    return p.modo === 'AUTOMATICO'
      ? { estado: 'LISTO', motivo: null, perfil: p }
      : {
          estado: 'PREPARACION',
          motivo: 'Confirmá el rollo cargado antes de enviar.',
          perfil: p,
        };
  }
  const compatibles = perfiles
    .filter(
      (p) =>
        p.activo &&
        p.bandeja.destino.activo &&
        !p.bandeja.destino.cad &&
        p.papelMateriaPrimaId === doc.papelMateriaPrimaId &&
        p.gramaje === doc.gramaje &&
        p.tamano === doc.tamano &&
        p.color === doc.color &&
        p.faz === doc.faz &&
        (maquinas === undefined ||
          maquinas.includes(p.bandeja.destino.maquinaId)),
    )
    .sort((a, b) => b.prioridad - a.prioridad);
  if (!compatibles.length)
    return {
      estado: 'REVISAR',
      motivo:
        'No hay un perfil compatible para este papel, configuración y máquina.',
      perfil: null,
    };
  if (compatibles[1]?.prioridad === compatibles[0].prioridad)
    return {
      estado: 'REVISAR',
      motivo:
        'Hay varios perfiles con la misma prioridad. Definí un destino preferido en Impresoras.',
      perfil: null,
    };
  const perfil = compatibles[0];
  if (!perfil.probado)
    return {
      estado: 'REVISAR',
      motivo: 'Falta verificar la prueba física de este perfil.',
      perfil,
    };
  if (perfil.modo !== 'AUTOMATICO')
    return {
      estado: 'PREPARACION',
      motivo:
        'Este perfil requiere que un operario prepare el papel antes de enviar.',
      perfil,
    };
  if (
    perfil.bandeja.papelPreparadoId !== doc.papelMateriaPrimaId ||
    perfil.bandeja.gramajePreparado !== doc.gramaje
  )
    return {
      estado: 'PREPARACION',
      motivo: 'Confirmá el papel cargado en la bandeja.',
      perfil,
    };
  return { estado: 'LISTO', motivo: null, perfil };
}
/** Token de concurrencia para detectar cambios entre resumen y despacho. */
export function revisionPerfil(p: PerfilDisponible) {
  return `${p.version}:${p.bandeja.version}:${p.bandeja.destino.version}`;
}
