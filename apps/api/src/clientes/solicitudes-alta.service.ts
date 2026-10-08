import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma, SolicitudAltaCliente } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import { expandir, permisosDeRolBase } from '../auth/permisos';
import { CurrentAuth } from '../auth/auth.types';
import { normalizarTelefonoCliente } from '../common/telefono-cliente';
import { firmaActor } from '../common/firma-actor';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { ResolverAltaDto, SolicitudAltaDto } from './dto/solicitud-alta.dto';
import {
  dniDeCuit,
  nombreComparable,
  telefonoComparable,
  validarSolicitud,
} from './solicitudes-alta.validacion';

const TIPO = 'ALTA_CLIENTE' as const;
const RECIBIDA = { recibida: true };
@Injectable()
export class SolicitudesAltaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly eventos: EventosSistemaService = new EventosSistemaService(
      prisma,
    ),
  ) {}

  async enlace(tenantId: string) {
    const link = await this.prisma.enlacePublico.findFirst({
      where: { tenantId, tipo: TIPO, revocadoEl: null },
    });
    return { token: link?.token ?? null };
  }
  async habilitar(tenantId: string) {
    await this.capacidades.exigir(tenantId, 'clientes');
    // Una habilitación concurrente conserva el mismo enlace: sólo renovar lo cambia.
    const link = await this.prisma.enlacePublico.upsert({
      where: { tipo_entidadId: { tipo: TIPO, entidadId: tenantId } },
      create: {
        tenantId,
        entidadId: tenantId,
        tipo: TIPO,
        token: randomBytes(24).toString('base64url'),
      },
      update: { revocadoEl: null, expiraEl: null },
    });
    return { token: link.token };
  }
  async cambiarEnlace(tenantId: string, renovar: boolean) {
    await this.capacidades.exigir(tenantId, 'clientes');
    await this.prisma.enlacePublico.updateMany({
      where: { tenantId, tipo: TIPO },
      data: renovar
        ? {
            token: randomBytes(24).toString('base64url'),
            revocadoEl: null,
            expiraEl: null,
          }
        : { revocadoEl: new Date() },
    });
    return this.enlace(tenantId);
  }
  private async resolver(
    token: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token))
      throw new NotFoundException('El enlace no está disponible.');
    const link = await db.enlacePublico.findUnique({ where: { token } });
    if (
      !link ||
      link.tipo !== TIPO ||
      link.revocadoEl ||
      (link.expiraEl && link.expiraEl <= new Date())
    )
      throw new NotFoundException('El enlace no está disponible.');
    if (!(await this.capacidades.puedeOperar(link.tenantId, 'clientes', db)))
      throw new NotFoundException('El enlace no está disponible.');
    return link;
  }
  async publico(token: string) {
    const link = await this.resolver(token);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: link.tenantId },
      select: { nombre: true },
    });
    const regional = await this.prisma.datosEmpresa.findUnique({
      where: { tenantId: link.tenantId },
      select: { paisCodigo: true },
    });
    return { empresa: tenant.nombre, paisCodigo: regional?.paisCodigo ?? 'AR' };
  }
  async solicitar(token: string, dto: SolicitudAltaDto) {
    return this.prisma.$transaction(async (db) => {
      const link = await this.resolver(token, db);
      const regional = await db.datosEmpresa.findUnique({
        where: { tenantId: link.tenantId },
        select: { paisCodigo: true },
      });
      const datos = validarSolicitud(dto, regional?.paisCodigo ?? 'AR');
      // Serializa envíos por enlace y espera cualquier revocación concurrente.
      await db.$queryRaw`SELECT "id" FROM "EnlacePublico" WHERE "id" = ${link.id}::uuid FOR UPDATE`;
      await this.resolver(token, db);
      if (dto.sitioWeb) return RECIBIDA;
      const pendiente = await db.solicitudAltaCliente.findFirst({
        where: {
          tenantId: link.tenantId,
          documentoTipo: datos.documentoTipo,
          documentoNumero: datos.documentoNumero,
          estado: 'PENDIENTE',
        },
      });
      if (pendiente) return RECIBIDA;
      const recientes = await db.solicitudAltaCliente.count({
        where: {
          tenantId: link.tenantId,
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });
      if (recientes >= 100)
        throw new HttpException(
          'Se alcanzó el límite de solicitudes. Intentá más tarde o contactá a la empresa.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const solicitud = await db.solicitudAltaCliente.create({
        data: { tenantId: link.tenantId, ...datos },
      });
      const miembros = await db.membership.findMany({
        where: {
          tenantId: link.tenantId,
          activa: true,
          user: { activo: true },
        },
        select: {
          userId: true,
          rol: true,
          rolDelTenant: { select: { permisos: true } },
        },
      });
      const destinatariosUserId = miembros
        .filter((m) =>
          expandir(m.rolDelTenant?.permisos ?? permisosDeRolBase(m.rol)).has(
            'crm.aprobar_altas',
          ),
        )
        .map((m) => m.userId);
      // Solicitud y aviso se confirman juntos. Un reintento del formulario no
      // crea otra solicitud ni otra notificación para el mismo documento pendiente.
      await this.eventos.publicar(
        {
          tenantId: link.tenantId,
          actorNombre: 'Formulario de clientes',
          tipo: 'clientes.alta_solicitada',
          entidadTipo: 'solicitud_alta_cliente',
          entidadId: solicitud.id,
          titulo: 'Nueva solicitud de alta de cliente',
          mensaje: `${solicitud.nombre} completó el formulario. Revisá sus datos para aprobar o rechazar el alta.`,
          href: '/crm/clientes/solicitudes',
          topicos: ['clientes', 'solicitudes-alta-clientes', 'notificaciones'],
          destinatariosUserId,
        },
        db,
      );
      // Nunca revelar públicamente si el documento ya pertenece a un cliente.
      return RECIBIDA;
    });
  }
  async listar(tenantId: string, estado = 'PENDIENTE', pagina = 1) {
    if (!['PENDIENTE', 'APROBADA', 'RECHAZADA', 'VINCULADA'].includes(estado))
      throw new BadRequestException('Estado inválido.');
    const where = { tenantId, estado };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.solicitudAltaCliente.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * 20,
        take: 20,
      }),
      this.prisma.solicitudAltaCliente.count({ where }),
    ]);
    return { items, total, pagina };
  }
  private async obtener(
    db: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const solicitud = await db.solicitudAltaCliente.findFirst({
      where: { tenantId, id },
    });
    if (!solicitud) throw new NotFoundException('No se encontró la solicitud.');
    return solicitud;
  }
  private async coincidencias(
    db: Prisma.TransactionClient,
    solicitud: SolicitudAltaCliente,
  ) {
    const dni =
      solicitud.documentoTipo === 'DNI'
        ? solicitud.documentoNumero
        : dniDeCuit(solicitud.documentoNumero);
    // Sólo identificación, no saldos ni actividad. Incluye inactivos: tampoco se duplican.
    const clientes = await db.cliente.findMany({
      where: { tenantId: solicitud.tenantId },
      select: {
        id: true,
        nombre: true,
        razonSocial: true,
        cuit: true,
        documentoNumero: true,
        telefonoCodigo: true,
        telefonoNumero: true,
        activo: true,
      },
    });
    return clientes.flatMap((cliente) => {
      const documento =
        (solicitud.documentoTipo === 'CUIT' &&
          cliente.cuit === solicitud.documentoNumero) ||
        !!(
          dni &&
          (cliente.documentoNumero === dni ||
            (cliente.cuit && dniDeCuit(cliente.cuit) === dni))
        );
      const normalizado = normalizarTelefonoCliente(
        cliente.telefonoCodigo,
        cliente.telefonoNumero,
      );
      const telefono =
        !!cliente.telefonoNumero &&
        (normalizado.ok
          ? `+${normalizado.telefonoCodigo}${normalizado.telefonoNumero}`
          : telefonoComparable(
              `${cliente.telefonoCodigo} ${cliente.telefonoNumero}`,
            )) === solicitud.telefono;
      const nombre = [cliente.nombre, cliente.razonSocial].some(
        (n) =>
          !!n && nombreComparable(n) === nombreComparable(solicitud.nombre),
      );
      return documento || telefono || nombre
        ? [
            {
              id: cliente.id,
              nombre: cliente.nombre,
              activo: cliente.activo,
              documento: !!documento,
              motivos: [
                documento && 'Documento',
                telefono && 'Teléfono',
                nombre && 'Nombre',
              ].filter(Boolean) as string[],
            },
          ]
        : [];
    });
  }
  async detalle(tenantId: string, id: string) {
    const solicitud = await this.obtener(this.prisma, tenantId, id);
    return {
      ...solicitud,
      coincidencias: await this.coincidencias(this.prisma, solicitud),
    };
  }
  async decidir(auth: CurrentAuth, id: string, dto: ResolverAltaDto) {
    try {
      return await this.prisma.$transaction(async (db) => {
        await this.capacidades.exigirOperacionTx(db, auth.tenantId, [
          'clientes',
        ]);
        await db.$queryRaw`SELECT "id" FROM "SolicitudAltaCliente" WHERE "id" = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const solicitud = await this.obtener(db, auth.tenantId, id);
        if (solicitud.estado !== 'PENDIENTE')
          throw new ConflictException(
            'Esta solicitud ya fue resuelta. Actualizá la lista.',
          );
        const user = await db.user.findUnique({
          where: { id: auth.userId },
          select: { nombreCompleto: true },
        });
        const actorId = auth.impersonacion?.actorUserId ?? auth.userId;
        const actorNombre = firmaActor(auth, user?.nombreCompleto ?? 'Equipo');
        let clienteId: string | null = null;
        if (dto.accion !== 'rechazar') {
          const coincidencias = await this.coincidencias(db, solicitud);
          if (dto.accion === 'vincular') {
            const candidato = coincidencias.find((c) => c.id === dto.clienteId);
            if (!candidato?.activo)
              throw new BadRequestException(
                'Elegí un cliente activo entre las coincidencias.',
              );
            if (coincidencias.some((c) => c.documento && c.id !== candidato.id))
              throw new ConflictException(
                'El documento corresponde a otro cliente. Vinculá la solicitud a ese cliente.',
              );
            clienteId = candidato.id;
          } else {
            if (coincidencias.some((c) => c.documento))
              throw new ConflictException(
                'El documento ya existe. Vinculá la solicitud al cliente existente o rechazala.',
              );
            if (coincidencias.length && !dto.confirmarCoincidencias)
              throw new ConflictException(
                'Revisá las coincidencias y confirmá que se trata de otra persona.',
              );
            const telefono = parsePhoneNumberFromString(solicitud.telefono)!;
            const cliente = await db.cliente.create({
              data: {
                tenantId: auth.tenantId,
                nombre: solicitud.nombre,
                razonSocial: solicitud.nombre,
                cuit:
                  solicitud.documentoTipo === 'CUIT'
                    ? solicitud.documentoNumero
                    : null,
                documentoNumero:
                  solicitud.documentoTipo === 'DNI'
                    ? solicitud.documentoNumero
                    : dniDeCuit(solicitud.documentoNumero),
                condicionFiscal: solicitud.condicionFiscal,
                paisCodigo: 'AR',
                telefonoCodigo: telefono.countryCallingCode,
                telefonoNumero: String(telefono.nationalNumber),
                origenAlta: 'autoregistro',
                direcciones: {
                  create: {
                    tenantId: auth.tenantId,
                    descripcion: 'Domicilio fiscal',
                    paisCodigo: 'AR',
                    direccion: solicitud.direccion,
                    ciudad: solicitud.ciudad,
                    tipo: 'FACTURACION',
                    principal: true,
                  },
                },
              },
            });
            clienteId = cliente.id;
          }
          await db.clienteEvento.create({
            data: {
              tenantId: auth.tenantId,
              clienteId: clienteId!,
              tipo: dto.accion === 'aprobar' ? 'creado' : 'solicitud_vinculada',
              actorId,
              actorNombre,
              detalle: {
                solicitudId: id,
                origen: 'autoregistro',
                coincidenciasRevisadas: !!dto.confirmarCoincidencias,
              },
            },
          });
        }
        return db.solicitudAltaCliente.update({
          where: { id, tenantId: auth.tenantId },
          data: {
            estado:
              dto.accion === 'aprobar'
                ? 'APROBADA'
                : dto.accion === 'vincular'
                  ? 'VINCULADA'
                  : 'RECHAZADA',
            clienteId,
            resueltoPorId: actorId,
            resueltoPorNombre: actorNombre,
            resueltoEl: new Date(),
            motivo: dto.motivo || null,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Ya existe un cliente con ese nombre o documento. Revisá la ficha existente antes de aprobar.',
        );
      throw error;
    }
  }
}
