import type { PlanOferta, PlanOfertaPrecio, PlanVersion } from '@prisma/client';
import {
  CATALOGO_PLANES,
  GRUPOS_PLANES,
  type ContenidoPlan,
} from './catalogo-planes';
import {
  contratoPublicado,
  funcionHistoricaEnContrato,
} from '../../suscripciones/contrato-suscripcion';

export type CicloOferta = 'mensual' | 'anual';
export type TipoPrecioOferta = 'base' | 'usuario' | 'implementacion';
export type ActivarOferta = {
  versionId: string;
  entorno: 'sandbox' | 'production';
  revision: number;
  registroPublico: boolean;
  recomendado: boolean;
  trialDias: number | null;
  precios: {
    tipo: TipoPrecioOferta;
    ciclo: CicloOferta | 'unico';
    priceId: string;
  }[];
  motivo: string;
};
export type RetirarOferta = {
  ofertaId: string;
  revision: number;
  motivo: string;
};
export type EstadoOferta = {
  entorno: 'sandbox' | 'production';
  paddleHabilitado: boolean;
  revision: number;
  actual: ReturnType<typeof presentarOferta> | null;
};
export type OfertaCompleta = PlanOferta & {
  version: PlanVersion;
  precios: PlanOfertaPrecio[];
};
export const incluirOferta = { version: true, precios: true } as const;

/** Presentación de la misma versión que usa el motor de permisos. Los alias
 * conservan compatibilidad con las tarjetas de registro y suscripción. */
export function presentarOferta(o: OfertaCompleta) {
  const p = o.version.contenido as unknown as ContenidoPlan;
  const contrato = contratoPublicado(o.version);
  const precio = (tipo: TipoPrecioOferta, ciclo: CicloOferta | 'unico') => {
    const v = o.precios.find((i) => i.tipo === tipo && i.ciclo === ciclo);
    return v
      ? {
          priceId: v.priceId,
          importe: Number(v.importe),
          cantidadMaxima: v.cantidadMaxima,
        }
      : null;
  };
  return {
    ofertaId: o.id,
    versionId: o.versionId,
    numeroVersion: o.version.numero,
    codigo: o.version.codigo,
    nombre: p.nombre,
    descripcion: p.descripcion,
    moneda: p.precios!.moneda,
    precioMensual: precio('base', 'mensual')!.importe,
    mensual: precio('base', 'mensual')!,
    anual: precio('base', 'anual'),
    usuarioMensual: precio('usuario', 'mensual'),
    usuarioAnual: precio('usuario', 'anual'),
    implementacion: precio('implementacion', 'unico'),
    acceso: p.comercial?.acceso ?? 'publico',
    trialDias: o.trialDias,
    registroPublico: o.registroPublico,
    recomendado: o.recomendado,
    precioAConsultar: false,
    prestaciones: CATALOGO_PLANES.filter(
      (c) => contrato.funciones[c.clave],
    ).map(({ clave, nombre, grupo }) => ({
      clave,
      nombre,
      grupo: GRUPOS_PLANES[grupo],
    })),
    features: {
      funciones: contrato.funciones,
      usuariosMax: p.usuariosIncluidos,
      usuariosAdicionalesPermitidos: p.adicionalesPermitidos,
      ordenesMesMax: null,
      storageGb: p.almacenamientoGb,
      afip: funcionHistoricaEnContrato(contrato, 'afip'),
      whatsapp: funcionHistoricaEnContrato(contrato, 'whatsapp'),
      centroCopiado: funcionHistoricaEnContrato(contrato, 'centroCopiado'),
      impresionDirecta: funcionHistoricaEnContrato(
        contrato,
        'impresionDirecta',
      ),
    },
  };
}
