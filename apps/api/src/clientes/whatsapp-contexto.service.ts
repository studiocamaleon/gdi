import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { aE164 } from '../integraciones/telefono';
import { PrismaService } from '../prisma/prisma.service';
import type { WhatsappContextoDto } from './dto/whatsapp-contexto.dto';

type CandidatoTelefono = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  activo: boolean;
  telefonoCodigo: string | null;
  telefonoNumero: string | null;
  paisCodigo: string;
  contactoNombre: string | null;
};

@Injectable()
export class WhatsappContextoService {
  constructor(private readonly prisma: PrismaService) {}

  async sesion(auth: CurrentAuth) {
    const empresa = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: auth.tenantId },
      select: { id: true, nombre: true },
    });
    return {
      empresa,
      permisos: {
        clientes: auth.permisos?.has('crm.ver') === true,
        ordenes: [
          'produccion.ver',
          'comercial.ver',
          'administracion.ver',
          'administracion.gestionar',
        ].some((permiso) => auth.permisos?.has(permiso)),
      },
    };
  }

  async contexto(auth: CurrentAuth, input: WhatsappContextoDto) {
    if (!auth.permisos?.has('crm.ver'))
      throw new ForbiddenException('No tenés permiso para consultar clientes.');
    if (!/^\+[\d\s().-]{7,39}$/.test(input.telefono))
      throw new BadRequestException(
        'Ingresá el teléfono completo con + y código de país.',
      );
    const numero = aE164({ telefonoNumero: input.telefono, paisCodigo: 'AR' });
    if (!numero.ok)
      throw new BadRequestException(
        'Ingresá un teléfono válido, con código de país y de área.',
      );
    // El sufijo sólo reduce candidatos en SQL. La identidad se decide por
    // igualdad E.164 completa, nunca por los últimos dígitos ni por el nombre.
    const sufijo = `%${numero.e164.slice(-6)}`;
    const candidatos = await this.prisma.$queryRaw<CandidatoTelefono[]>`
      SELECT c.id, c.nombre, c."razonSocial", c.activo, c."telefonoCodigo",
             c."telefonoNumero", c."paisCodigo", NULL::text AS "contactoNombre"
      FROM "Cliente" c
      WHERE c."tenantId" = ${auth.tenantId}::uuid
        AND regexp_replace(c."telefonoNumero", '[^0-9]', '', 'g') LIKE ${sufijo}
      UNION ALL
      SELECT c.id, c.nombre, c."razonSocial", c.activo, t."telefonoCodigo",
             t."telefonoNumero", c."paisCodigo", t.nombre AS "contactoNombre"
      FROM "ClienteContacto" t JOIN "Cliente" c ON c.id = t."clienteId"
      WHERE t."tenantId" = ${auth.tenantId}::uuid AND c."tenantId" = ${auth.tenantId}::uuid
        AND regexp_replace(t."telefonoNumero", '[^0-9]', '', 'g') LIKE ${sufijo}
    `;
    const unicos = new Map<
      string,
      {
        id: string;
        nombre: string;
        razonSocial: string | null;
        activo: boolean;
        contactos: string[];
      }
    >();
    for (const candidato of candidatos) {
      const normalizado = aE164(candidato);
      if (!normalizado.ok || normalizado.e164 !== numero.e164) continue;
      const cliente = unicos.get(candidato.id) ?? {
        id: candidato.id,
        nombre: candidato.nombre,
        razonSocial: candidato.razonSocial,
        activo: candidato.activo,
        contactos: [],
      };
      if (
        candidato.contactoNombre &&
        !cliente.contactos.includes(candidato.contactoNombre)
      ) {
        cliente.contactos.push(candidato.contactoNombre);
      }
      unicos.set(cliente.id, cliente);
    }
    const coincidencias = [...unicos.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
    const cliente = input.clienteId
      ? unicos.get(input.clienteId)
      : coincidencias.length === 1
        ? coincidencias[0]
        : undefined;
    if (input.clienteId && !cliente)
      throw new NotFoundException(
        'Esa ficha no corresponde al teléfono consultado.',
      );
    const sesion = await this.sesion(auth);
    const ordenes =
      cliente && sesion.permisos.ordenes
        ? await this.prisma.ordenTrabajo.findMany({
            where: { tenantId: auth.tenantId, clienteId: cliente.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 10,
            select: {
              id: true,
              numero: true,
              estado: true,
              fechaEntrega: true,
              createdAt: true,
              items: {
                where: { parentItemId: null },
                orderBy: { ordenIndice: 'asc' },
                take: 3,
                select: { nombre: true, cantidad: true, cantidadUnidad: true },
              },
            },
          })
        : [];
    return {
      ...sesion,
      telefono: `+${numero.e164}`,
      estado: cliente
        ? 'encontrado'
        : coincidencias.length
          ? 'seleccionar_cliente'
          : 'sin_coincidencias',
      coincidencias,
      cliente: cliente ?? null,
      ordenes: ordenes.map((orden) => ({
        ...orden,
        fechaEntrega: orden.fechaEntrega?.toISOString().slice(0, 10) ?? null,
        createdAt: orden.createdAt.toISOString(),
        items: orden.items.map((item) => ({
          ...item,
          cantidad: Number(item.cantidad),
        })),
      })),
    };
  }
}
