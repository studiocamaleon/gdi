import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, RolSistema } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { ROLES_PREDEFINIDOS } from '../auth/permisos';
import { finDePrueba } from '../suscripciones/trial';

const MONEDA_POR_PAIS: Record<string, string> = {
  AR: 'ARS',
  BO: 'BOB',
  BR: 'BRL',
  CL: 'CLP',
  CO: 'COP',
  PY: 'PYG',
  PE: 'PEN',
  UY: 'UYU',
  VE: 'USD',
  MX: 'MXN',
  GT: 'GTQ',
  HN: 'HNL',
  NI: 'NIO',
  CR: 'CRC',
  PA: 'USD',
  DO: 'DOP',
  CU: 'CUP',
  EC: 'USD',
  SV: 'USD',
};

export type ProvisionarTenantArgs = {
  nombre: string;
  plan: {
    id: string;
    trialDias: number | null;
    versionId?: string;
    ofertaId?: string | null;
  };
  origen: 'plataforma' | 'registro_publico';
  paisCodigo?: string;
  zonaHoraria?: string;
  emailEmpresa?: string;
  slug?: string;
  iniciaTrial?: boolean;
};

export type TenantProvisionado = {
  tenantId: string;
  tenantNombre: string;
  administradorRolId: string;
};

@Injectable()
export class TenantProvisioningService {
  /**
   * Núcleo compartido por Plataforma y el registro público. El caller aporta
   * la transacción para poder sumar invitación o usuario/membership de forma
   * verdaderamente atómica.
   */
  async provisionarBase(
    tx: Prisma.TransactionClient,
    args: ProvisionarTenantArgs,
  ): Promise<TenantProvisionado> {
    const plan = await tx.plan.findUniqueOrThrow({
      where: { id: args.plan.id },
    });
    if (plan.comercialVersionado && !args.plan.ofertaId && !plan.ofertaActualId)
      throw new BadRequestException(
        'El alta necesita una oferta publicada del plan elegido.',
      );
    const oferta = plan.comercialVersionado
      ? await tx.planOferta.findFirst({
          where: {
            id: (args.plan.ofertaId ?? plan.ofertaActualId)!,
            planId: plan.id,
            entorno:
              process.env.PADDLE_ENV === 'production'
                ? 'production'
                : 'sandbox',
          },
        })
      : null;
    if (
      plan.comercialVersionado &&
      (!oferta ||
        (args.plan.versionId && args.plan.versionId !== oferta.versionId))
    )
      throw new BadRequestException(
        'El alta necesita una oferta publicada del plan elegido.',
      );
    const pais = (args.paisCodigo ?? 'AR').trim().toUpperCase();
    const slug = args.slug?.trim().toLowerCase() || slugUnico(args.nombre);
    const tenant = await tx.tenant.create({
      data: {
        nombre: args.nombre.trim(),
        slug,
        origenAlta: args.origen,
        onboardingCompletadoEl:
          args.origen === 'registro_publico' ? null : new Date(),
      },
      select: { id: true, nombre: true },
    });

    await tx.rol.createMany({
      data: ROLES_PREDEFINIDOS.map((rol) => ({
        tenantId: tenant.id,
        codigo: rol.codigo,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        esDelSistema: true,
        permisos: [...rol.permisos],
      })),
    });
    const administrador = await tx.rol.findFirstOrThrow({
      where: { tenantId: tenant.id, codigo: 'administrador' },
      select: { id: true },
    });

    await tx.datosEmpresa.create({
      data: {
        tenantId: tenant.id,
        paisCodigo: pais,
        monedaCodigo: MONEDA_POR_PAIS[pais] ?? 'USD',
        zonaHoraria:
          args.zonaHoraria?.trim() || 'America/Argentina/Buenos_Aires',
        email: args.emailEmpresa?.trim().toLowerCase() || null,
      },
    });

    await tx.suscripcion.create({
      data: {
        tenantId: tenant.id,
        planId: args.plan.id,
        planVersionId: oferta?.versionId ?? args.plan.versionId,
        ofertaId: oferta?.id ?? args.plan.ofertaId,
        revisionContrato: oferta || args.plan.versionId ? 1 : 0,
        estado: 'activa',
        proveedor: 'manual',
        trialHasta:
          args.iniciaTrial === false
            ? null
            : finDePrueba(oferta ? oferta.trialDias : args.plan.trialDias),
      },
    });

    return {
      tenantId: tenant.id,
      tenantNombre: tenant.nombre,
      administradorRolId: administrador.id,
    };
  }
}

/** El slug es técnico, no una decisión del usuario. El sufijo evita carreras. */
function slugUnico(nombre: string) {
  const base =
    nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'empresa';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

export const ROL_ADMINISTRADOR = RolSistema.ADMINISTRADOR;
