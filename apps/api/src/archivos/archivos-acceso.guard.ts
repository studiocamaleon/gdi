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
  CLIENTE: { leer: ['crm.ver'], escribir: ['crm.gestionar'] },
  CAMPANA: { leer: ['comercial.ver'], escribir: ['comercial.gestionar'] },
  COTIZACION: { leer: ['comercial.ver'], escribir: ['comercial.gestionar'] },
  ORDEN: {
    leer: ['produccion.ver'],
    escribir: [
      'comercial.gestionar',
      'produccion.ejecutar',
      'produccion.supervisar',
    ],
  },
  ORDEN_ITEM: {
    leer: ['produccion.ver'],
    escribir: [
      'comercial.gestionar',
      'produccion.ejecutar',
      'produccion.supervisar',
    ],
  },
  COMPROBANTE: {
    leer: ['administracion.ver'],
    escribir: ['administracion.gestionar'],
  },
  COBRO: {
    leer: ['administracion.ver', 'administracion.cobrar'],
    escribir: ['administracion.gestionar', 'administracion.cobrar'],
  },
  EGRESO: {
    leer: ['administracion.ver'],
    escribir: ['administracion.gestionar'],
  },
  PRODUCTO: { leer: ['costos.ver'], escribir: ['costos.gestionar'] },
  PROVEEDOR: { leer: ['registros.ver'], escribir: ['registros.gestionar'] },
  TENANT_BRANDING: {
    leer: 'autenticado',
    escribir: ['configuracion.gestionar'],
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
      body?: { scope?: unknown };
      query: { scope?: unknown };
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
    if (politica.origen === 'archivo') {
      const id = req.params.id;
      if (!isUUID(id))
        throw new BadRequestException('Identificador de archivo inválido.');
      // Los guards corren ANTES del contexto automático de empresa: el tenant
      // debe ser explícito, y el scope debe salir de la base, nunca del cliente.
      const archivo = await this.prisma.archivo.findFirst({
        where: { id, tenantId: auth.tenantId },
        select: { scope: true },
      });
      if (!archivo || archivo.scope === ArchivoScope.INBOX)
        throw new NotFoundException('Archivo no encontrado.');
      scope = archivo.scope;
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
    return true;
  }
}
