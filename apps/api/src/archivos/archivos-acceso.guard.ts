import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ArchivoScope } from '@prisma/client';
import { isUUID } from 'class-validator';
import type { CurrentAuth } from '../auth/auth.types';
import type { PermisoClave } from '../auth/permisos';
import { alcanceCuentas, exigirCuenta } from '../administracion/acceso-cuentas';
import { PrismaService } from '../prisma/prisma.service';

type Accion = 'leer' | 'escribir';
type Politica =
  | { origen: 'archivo' | 'body' | 'query'; accion: Accion }
  | { origen: 'orden'; accion: 'leer' }
  | { origen: 'uso' };
const ACCESO_ARCHIVO = 'accesoArchivo';
export const AccesoArchivo = (politica: Politica) =>
  SetMetadata(ACCESO_ARCHIVO, politica);

const PERMISOS: Record<
  Exclude<ArchivoScope, 'INBOX'>,
  { leer: PermisoClave[] | 'autenticado'; escribir: PermisoClave[] }
> = {
  CLIENTE: { leer: ['crm.clientes.ver'], escribir: ['crm.clientes.gestionar'] },
  CAMPANA: {
    leer: ['comercial.campanas.ver'],
    escribir: ['comercial.campanas.gestionar'],
  },
  COTIZACION: {
    leer: ['comercial.presupuestos.ver', 'comercial.ordenes.ver'],
    escribir: [
      'comercial.presupuestos.gestionar',
      'comercial.ordenes.gestionar',
    ],
  },
  ORDEN: {
    leer: ['comercial.ordenes.ver', 'produccion.tablero.ver'],
    escribir: [
      'comercial.ordenes.gestionar',
      'produccion.ejecutar',
      'produccion.supervisar',
    ],
  },
  ORDEN_ITEM: {
    leer: ['comercial.ordenes.ver', 'produccion.tablero.ver'],
    escribir: [
      'comercial.ordenes.gestionar',
      'produccion.ejecutar',
      'produccion.supervisar',
    ],
  },
  COMPROBANTE: {
    leer: ['administracion.comprobantes.ver'],
    escribir: ['administracion.comprobantes.gestionar'],
  },
  COBRO: {
    leer: ['administracion.cobrar.ver', 'administracion.cobrar'],
    escribir: ['administracion.cobrar.gestionar', 'administracion.cobrar'],
  },
  EGRESO: {
    leer: ['administracion.egresos.ver'],
    escribir: ['administracion.egresos.gestionar'],
  },
  PRODUCTO: {
    leer: [
      'costos.catalogo.ver',
      'comercial.ordenes.ver',
      'comercial.presupuestos.ver',
    ],
    escribir: ['costos.catalogo.gestionar'],
  },
  PROVEEDOR: {
    leer: ['registros.proveedores.ver'],
    escribir: ['registros.proveedores.gestionar'],
  },
  TENANT_BRANDING: {
    leer: 'autenticado',
    escribir: ['configuracion.empresa.gestionar'],
  },
};

/** Los adjuntos heredan permisos del módulo al que pertenecen, también cuando
 * alguien llama directamente al API. Inbox conserva su circuito específico.
 * No se aplica a servicios internos ni a enlaces públicos con firma/token. */
@Injectable()
export class ArchivosAccesoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      auth?: CurrentAuth;
      params: Record<string, string>;
      body?: { scope?: unknown; entidadId?: string };
      query: { scope?: unknown; entidadId?: string };
    }>();
    const auth = req.auth;
    if (!auth?.tenantId)
      throw new UnauthorizedException('Debes iniciar sesion.');
    const politica = this.reflector.get<Politica>(
      ACCESO_ARCHIVO,
      context.getHandler(),
    );
    // Una ruta nueva sin política nunca queda abierta por @SoloAutenticado.
    if (!politica)
      throw new ForbiddenException('Esta acción no está disponible.');
    if (politica.origen === 'uso') return true;

    let scope: ArchivoScope;
    let cobroId: string | undefined;
    let cotizacionId: string | undefined;
    if (politica.origen === 'archivo') {
      const id = req.params.id;
      if (!isUUID(id))
        throw new BadRequestException('Identificador de archivo inválido.');
      // Los guards corren ANTES del contexto automático de empresa: el tenant
      // debe ser explícito, y el scope debe salir de la base, nunca del cliente.
      const archivo = await this.prisma.archivo.findFirst({
        where: { id, tenantId: auth.tenantId },
        select: { scope: true, cobroId: true, cotizacionId: true },
      });
      if (!archivo || archivo.scope === ArchivoScope.INBOX)
        throw new NotFoundException('Archivo no encontrado.');
      scope = archivo.scope;
      cobroId = archivo.cobroId ?? undefined;
      cotizacionId = archivo.cotizacionId ?? undefined;
    } else if (politica.origen === 'orden') {
      scope = ArchivoScope.ORDEN;
    } else {
      const declarado = req[politica.origen]?.scope;
      if (
        typeof declarado !== 'string' ||
        !Object.values(ArchivoScope).includes(declarado as ArchivoScope)
      )
        throw new BadRequestException('Tipo de archivo inválido.');
      scope = declarado as ArchivoScope;
      if (scope === ArchivoScope.COBRO)
        cobroId = req[politica.origen]?.entidadId;
      if (scope === ArchivoScope.COTIZACION)
        cotizacionId = req[politica.origen]?.entidadId;
    }
    if (scope === ArchivoScope.INBOX)
      throw new ForbiddenException(
        'Los archivos del Inbox se consultan desde la conversación.',
      );
    const requeridos = PERMISOS[scope]?.[politica.accion];
    if (requeridos === 'autenticado') return true;
    if (!requeridos?.some((permiso) => auth.permisos?.has(permiso)))
      throw new ForbiddenException(
        'No tenés permisos para acceder a estos archivos.',
      );
    if (
      (scope === ArchivoScope.ORDEN || scope === ArchivoScope.ORDEN_ITEM) &&
      politica.accion === 'escribir' &&
      !auth.permisos?.has('comercial.ordenes.gestionar') &&
      !auth.permisos?.has('produccion.tablero.ver')
    )
      throw new ForbiddenException('No tenés acceso a esta vista.');
    if (
      scope === ArchivoScope.COTIZACION &&
      !auth.permisos?.has(
        politica.accion === 'leer'
          ? 'comercial.presupuestos.ver'
          : 'comercial.presupuestos.gestionar',
      )
    ) {
      if (!cotizacionId || !isUUID(cotizacionId))
        throw new ForbiddenException('Elegí una cotización de la orden.');
      const cotizacion = await this.prisma.cotizacion.findFirst({
        where: { id: cotizacionId, tenantId: auth.tenantId },
        select: { numero: true },
      });
      if (!cotizacion || cotizacion.numero)
        throw new ForbiddenException(
          'No tenés acceso a los archivos de este presupuesto.',
        );
    }
    if (scope === ArchivoScope.COBRO) {
      const alcance = await alcanceCuentas(this.prisma, auth);
      if (alcance.restringido) {
        if (!cobroId || !isUUID(cobroId))
          throw new ForbiddenException(
            'Elegí un cobro de una cuenta asignada.',
          );
        const cobro = await this.prisma.cobro.findFirst({
          where: { id: cobroId, tenantId: auth.tenantId },
          select: { cuentaDestinoId: true },
        });
        if (!cobro?.cuentaDestinoId)
          throw new ForbiddenException('No tenés acceso a este recibo.');
        exigirCuenta(alcance, cobro.cuentaDestinoId);
      }
    }
    return true;
  }
}
