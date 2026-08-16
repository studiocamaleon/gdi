import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoDireccion } from '@prisma/client';
import { CurrentAuth } from '../auth/auth.types';
import { paginatedResponse } from '../common/dto/pagination.dto';
import { cuitValido } from '../common/cuit';
import { PrismaService } from '../prisma/prisma.service';
import { ProveedorContactoDto } from './dto/contacto.dto';
import { ProveedorDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { ProveedoresQueryDto } from './dto/proveedores-query.dto';
import {
  UpdateProveedorDto,
  UpsertProveedorDto,
} from './dto/upsert-proveedor.dto';

const INCLUDE_PROVEEDOR = {
  contactos: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
  direcciones: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
  eventos: { orderBy: { createdAt: 'desc' }, take: 20 },
} satisfies Prisma.ProveedorInclude;

type ProveedorCompleto = Prisma.ProveedorGetPayload<{
  include: typeof INCLUDE_PROVEEDOR;
}>;

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth, pagination: ProveedoresQueryDto) {
    const query = pagination.q?.trim();
    const where: Prisma.ProveedorWhereInput = {
      tenantId: auth.tenantId,
      ...(pagination.incluirInactivos === 'true' ? {} : { activo: true }),
      ...(query
        ? {
            OR: [
              { nombre: { contains: query, mode: 'insensitive' } },
              { razonSocial: { contains: query, mode: 'insensitive' } },
              { emailPrincipal: { contains: query, mode: 'insensitive' } },
              { telefonoNumero: { contains: query, mode: 'insensitive' } },
              { cuit: { contains: query, mode: 'insensitive' } },
              {
                contactos: {
                  some: {
                    OR: [
                      { nombre: { contains: query, mode: 'insensitive' } },
                      { email: { contains: query, mode: 'insensitive' } },
                      {
                        telefonoNumero: {
                          contains: query,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
              {
                direcciones: {
                  some: {
                    OR: [
                      { ciudad: { contains: query, mode: 'insensitive' } },
                      {
                        direccion: { contains: query, mode: 'insensitive' },
                      },
                      {
                        descripcion: { contains: query, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [proveedores, total] = await this.prisma.$transaction([
      this.prisma.proveedor.findMany({
        where,
        include: INCLUDE_PROVEEDOR,
        orderBy: { nombre: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.proveedor.count({ where }),
    ]);
    return paginatedResponse(
      proveedores.map((proveedor) => this.toResponse(proveedor)),
      total,
      pagination,
    );
  }

  /** Catálogo liviano para selectores de compras, materiales y tercerización. */
  opciones(auth: CurrentAuth) {
    return this.prisma.proveedor.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      select: {
        id: true,
        nombre: true,
        cuit: true,
        condicionIva: true,
        condicionPagoDias: true,
        cbuAlias: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(auth: CurrentAuth, id: string) {
    const proveedor = await this.findProveedorOrThrow(auth, id, this.prisma);
    return this.toResponse(proveedor);
  }

  async create(auth: CurrentAuth, payload: UpsertProveedorDto) {
    const normalized = this.normalizePayload(payload);
    try {
      const proveedor = await this.createNormalized(
        this.prisma,
        auth.tenantId,
        normalized,
        auth.userId,
        auth.email,
      );
      return this.toResponse(proveedor);
    } catch (error) {
      this.rethrowUniqueProveedor(error);
    }
  }

  async importar(auth: CurrentAuth, payloads: UpsertProveedorDto[]) {
    if (payloads.length === 0) return { data: [], total: 0 };
    const normalized = payloads.map((payload) =>
      this.normalizePayload(payload),
    );
    try {
      const creados = await this.prisma.$transaction(
        async (tx) => {
          const resultado: ProveedorCompleto[] = [];
          for (const proveedor of normalized) {
            resultado.push(
              await this.createNormalized(
                tx,
                auth.tenantId,
                proveedor,
                auth.userId,
                auth.email,
              ),
            );
          }
          return resultado;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return {
        data: creados.map((proveedor) => this.toResponse(proveedor)),
        total: creados.length,
      };
    } catch (error) {
      this.rethrowUniqueProveedor(error);
    }
  }

  private createNormalized(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    normalized: ReturnType<ProveedoresService['normalizePayload']>,
    actorId: string,
    actorNombre: string,
  ) {
    return db.proveedor.create({
      data: {
        tenantId,
        nombre: normalized.nombre,
        razonSocial: normalized.razonSocial,
        emailPrincipal: normalized.email,
        telefonoCodigo: normalized.telefonoCodigo,
        telefonoNumero: normalized.telefonoNumero,
        paisCodigo: normalized.pais,
        cuit: normalized.cuit,
        condicionIva: normalized.condicionIva,
        condicionPagoDias: normalized.condicionPagoDias,
        cbuAlias: normalized.cbuAlias,
        contactos: {
          create: normalized.contactos.map((contacto) => ({
            ...(contacto.id ? { id: contacto.id } : {}),
            tenantId,
            nombre: contacto.nombre,
            cargo: contacto.cargo,
            email: contacto.email,
            telefonoCodigo: contacto.telefonoCodigo,
            telefonoNumero: contacto.telefonoNumero,
            principal: contacto.principal,
          })),
        },
        direcciones: {
          create: normalized.direcciones.map((direccion) => ({
            ...(direccion.id ? { id: direccion.id } : {}),
            tenantId,
            descripcion: direccion.descripcion,
            paisCodigo: direccion.pais,
            codigoPostal: direccion.codigoPostal,
            direccion: direccion.direccion,
            numero: direccion.numero,
            ciudad: direccion.ciudad,
            tipo: this.toPrismaTipoDireccion(direccion.tipo),
            principal: direccion.principal,
          })),
        },
        eventos: {
          create: { tenantId, tipo: 'creado', actorId, actorNombre },
        },
      },
      include: INCLUDE_PROVEEDOR,
    });
  }

  async update(auth: CurrentAuth, id: string, payload: UpdateProveedorDto) {
    const normalized = this.normalizePayload(payload);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await this.findProveedorOrThrow(auth, id, tx);
        const actualizado = await tx.proveedor.updateMany({
          where: {
            id,
            tenantId: auth.tenantId,
            updatedAt: new Date(payload.updatedAt),
          },
          data: {
            nombre: normalized.nombre,
            razonSocial: normalized.razonSocial,
            emailPrincipal: normalized.email,
            telefonoCodigo: normalized.telefonoCodigo,
            telefonoNumero: normalized.telefonoNumero,
            paisCodigo: normalized.pais,
            cuit: normalized.cuit,
            condicionIva: normalized.condicionIva,
            condicionPagoDias: normalized.condicionPagoDias,
            cbuAlias: normalized.cbuAlias,
          },
        });
        if (actualizado.count !== 1) {
          throw new ConflictException(
            'Este proveedor fue modificado por otra persona. Recargá la ficha antes de volver a guardar.',
          );
        }
        await this.sincronizarContactos(
          tx,
          auth.tenantId,
          id,
          actual.contactos,
          normalized.contactos,
        );
        await this.sincronizarDirecciones(
          tx,
          auth.tenantId,
          id,
          actual.direcciones,
          normalized.direcciones,
        );
        await tx.proveedorEvento.create({
          data: {
            tenantId: auth.tenantId,
            proveedorId: id,
            tipo: 'editado',
            actorId: auth.userId,
            actorNombre: auth.email,
          },
        });
        return this.toResponse(await this.findProveedorOrThrow(auth, id, tx));
      });
    } catch (error) {
      this.rethrowUniqueProveedor(error);
    }
  }

  private async sincronizarContactos(
    tx: Prisma.TransactionClient,
    tenantId: string,
    proveedorId: string,
    actuales: ProveedorCompleto['contactos'],
    entrantes: ReturnType<ProveedoresService['normalizeContactos']>,
  ) {
    const idsActuales = new Set(actuales.map((contacto) => contacto.id));
    const idsConservar = entrantes
      .map((contacto) => contacto.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.proveedorContacto.deleteMany({
      where: {
        tenantId,
        proveedorId,
        ...(idsConservar.length > 0 ? { id: { notIn: idsConservar } } : {}),
      },
    });
    for (const contacto of entrantes) {
      const data = {
        nombre: contacto.nombre,
        cargo: contacto.cargo,
        email: contacto.email,
        telefonoCodigo: contacto.telefonoCodigo,
        telefonoNumero: contacto.telefonoNumero,
        principal: contacto.principal,
      };
      if (contacto.id && idsActuales.has(contacto.id)) {
        await tx.proveedorContacto.update({ where: { id: contacto.id }, data });
      } else {
        await tx.proveedorContacto.create({
          data: {
            ...(contacto.id ? { id: contacto.id } : {}),
            tenantId,
            proveedorId,
            ...data,
          },
        });
      }
    }
  }

  private async sincronizarDirecciones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    proveedorId: string,
    actuales: ProveedorCompleto['direcciones'],
    entrantes: ReturnType<ProveedoresService['normalizeDirecciones']>,
  ) {
    const idsActuales = new Set(actuales.map((direccion) => direccion.id));
    const idsConservar = entrantes
      .map((direccion) => direccion.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.proveedorDireccion.deleteMany({
      where: {
        tenantId,
        proveedorId,
        ...(idsConservar.length > 0 ? { id: { notIn: idsConservar } } : {}),
      },
    });
    for (const direccion of entrantes) {
      const data = {
        descripcion: direccion.descripcion,
        paisCodigo: direccion.pais,
        codigoPostal: direccion.codigoPostal,
        direccion: direccion.direccion,
        numero: direccion.numero,
        ciudad: direccion.ciudad,
        tipo: this.toPrismaTipoDireccion(direccion.tipo),
        principal: direccion.principal,
      };
      if (direccion.id && idsActuales.has(direccion.id)) {
        await tx.proveedorDireccion.update({
          where: { id: direccion.id },
          data,
        });
      } else {
        await tx.proveedorDireccion.create({
          data: {
            ...(direccion.id ? { id: direccion.id } : {}),
            tenantId,
            proveedorId,
            ...data,
          },
        });
      }
    }
  }

  async fijarActivo(auth: CurrentAuth, id: string, activo: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const proveedor = await this.findProveedorOrThrow(auth, id, tx);
      if (proveedor.activo === activo) return this.toResponse(proveedor);
      const actualizado = await tx.proveedor.update({
        where: { id },
        data: { activo },
        include: INCLUDE_PROVEEDOR,
      });
      await tx.proveedorEvento.create({
        data: {
          tenantId: auth.tenantId,
          proveedorId: id,
          tipo: activo ? 'habilitado' : 'inhabilitado',
          actorId: auth.userId,
          actorNombre: auth.email,
        },
      });
      return this.toResponse(actualizado);
    });
  }

  async remove(auth: CurrentAuth, id: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const proveedor = await this.findProveedorOrThrow(auth, id, tx);
          const rastro = await this.contarRastro(tx, auth.tenantId, id);
          if (rastro.total > 0) {
            throw new BadRequestException(
              `${proveedor.nombre} no se puede eliminar porque tiene ${rastro.detalle}. ` +
                'Inhabilitalo para conservar intacto el historial de compras y pagos.',
            );
          }
          await tx.proveedor.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'El proveedor recibió actividad mientras se intentaba eliminar. Inhabilitalo para conservar el historial.',
        );
      }
      throw error;
    }
  }

  private async contarRastro(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    proveedorId: string,
  ) {
    const [
      valores,
      configuraciones,
      archivos,
      variantes,
      egresos,
      pagos,
      recurrentes,
      gastosFijos,
      familias,
      pasos,
    ] = await Promise.all([
      db.valor.count({ where: { tenantId, proveedorId } }),
      db.productoConfigPaso.count({ where: { tenantId, proveedorId } }),
      db.archivo.count({ where: { tenantId, proveedorId } }),
      db.materiaPrimaVariante.count({
        where: { tenantId, proveedorReferenciaId: proveedorId },
      }),
      db.egreso.count({ where: { tenantId, proveedorId } }),
      db.pago.count({ where: { tenantId, proveedorId } }),
      db.gastoRecurrente.count({ where: { tenantId, proveedorId } }),
      db.gastoFijoEstructura.count({ where: { tenantId, proveedorId } }),
      db.familiaPasoDefaults.count({ where: { tenantId, proveedorId } }),
      db.pasoTenant.count({ where: { tenantId, proveedorId } }),
    ]);
    const partes: string[] = [];
    const sumar = (n: number, singular: string, plural: string) => {
      if (n > 0) partes.push(`${n} ${n === 1 ? singular : plural}`);
    };
    sumar(egresos, 'egreso', 'egresos');
    sumar(pagos, 'pago', 'pagos');
    sumar(valores, 'valor', 'valores');
    sumar(configuraciones, 'paso tercerizado', 'pasos tercerizados');
    sumar(variantes, 'material', 'materiales');
    sumar(recurrentes, 'gasto recurrente', 'gastos recurrentes');
    sumar(gastosFijos, 'gasto fijo', 'gastos fijos');
    sumar(
      familias + pasos,
      'configuración de producción',
      'configuraciones de producción',
    );
    sumar(archivos, 'archivo', 'archivos');
    return {
      total:
        valores +
        configuraciones +
        archivos +
        variantes +
        egresos +
        pagos +
        recurrentes +
        gastosFijos +
        familias +
        pasos,
      detalle: partes.join(', '),
    };
  }

  private async findProveedorOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const proveedor = await db.proveedor.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: INCLUDE_PROVEEDOR,
    });
    if (!proveedor) throw new NotFoundException(`No existe el proveedor ${id}`);
    return proveedor;
  }

  private normalizePayload(payload: UpsertProveedorDto) {
    const nombre = payload.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre es obligatorio.');
    const cuit = payload.cuit?.replace(/\D/g, '') || null;
    if (cuit && !cuitValido(cuit)) {
      throw new BadRequestException(
        'El CUIT no es válido (revisá los 11 dígitos y el verificador).',
      );
    }
    if (payload.condicionIva === 'RI' && !cuit) {
      throw new BadRequestException(
        'Un Responsable Inscripto necesita CUIT para registrar sus comprobantes.',
      );
    }
    return {
      ...payload,
      nombre,
      razonSocial: payload.razonSocial?.trim() || null,
      email: payload.email?.trim().toLowerCase() || '',
      pais: payload.pais.trim().toUpperCase(),
      telefonoCodigo: payload.telefonoNumero?.trim()
        ? payload.telefonoCodigo?.trim() || ''
        : '',
      telefonoNumero: payload.telefonoNumero?.trim() || '',
      cuit,
      condicionIva: payload.condicionIva ?? null,
      condicionPagoDias: payload.condicionPagoDias ?? null,
      cbuAlias: payload.cbuAlias?.trim() || null,
      contactos: this.normalizeContactos(payload.contactos),
      direcciones: this.normalizeDirecciones(payload.direcciones),
    };
  }

  private normalizeContactos(contactos: ProveedorContactoDto[]) {
    if (contactos.length === 0) return [];
    const base = contactos.map((contacto, index) => {
      const nombre = contacto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException(
          `El contacto ${index + 1} necesita un nombre.`,
        );
      }
      return {
        ...contacto,
        nombre,
        cargo: contacto.cargo?.trim() || null,
        email: contacto.email?.trim().toLowerCase() || null,
        telefonoCodigo: contacto.telefonoNumero?.trim()
          ? contacto.telefonoCodigo?.trim() || null
          : null,
        telefonoNumero: contacto.telefonoNumero?.trim() || null,
      };
    });
    const principalIndex = base.findIndex((contacto) => contacto.principal);
    return base.map((contacto, index) => ({
      ...contacto,
      principal: principalIndex === -1 ? index === 0 : index === principalIndex,
    }));
  }

  private normalizeDirecciones(direcciones: ProveedorDireccionDto[]) {
    if (direcciones.length === 0) return [];
    const base = direcciones.map((direccion, index) => {
      const descripcion = direccion.descripcion.trim();
      const calle = direccion.direccion.trim();
      const ciudad = direccion.ciudad.trim();
      if (!descripcion || !calle || !ciudad) {
        throw new BadRequestException(
          `La dirección ${index + 1} necesita descripción, dirección y ciudad.`,
        );
      }
      return {
        ...direccion,
        descripcion,
        pais: direccion.pais.trim().toUpperCase(),
        codigoPostal: direccion.codigoPostal?.trim() || null,
        direccion: calle,
        numero: direccion.numero?.trim() || null,
        ciudad,
      };
    });
    const principalIndex = base.findIndex((direccion) => direccion.principal);
    return base.map((direccion, index) => ({
      ...direccion,
      principal: principalIndex === -1 ? index === 0 : index === principalIndex,
    }));
  }

  private toResponse(proveedor: ProveedorCompleto) {
    const contactoPrincipal =
      proveedor.contactos.find((contacto) => contacto.principal) ?? null;
    const direccionPrincipal =
      proveedor.direcciones.find((direccion) => direccion.principal) ?? null;
    return {
      id: proveedor.id,
      nombre: proveedor.nombre,
      razonSocial: proveedor.razonSocial ?? '',
      email: proveedor.emailPrincipal,
      telefonoCodigo: proveedor.telefonoCodigo,
      telefonoNumero: proveedor.telefonoNumero,
      pais: proveedor.paisCodigo,
      cuit: proveedor.cuit ?? '',
      condicionIva: proveedor.condicionIva ?? '',
      condicionPagoDias: proveedor.condicionPagoDias,
      cbuAlias: proveedor.cbuAlias ?? '',
      activo: proveedor.activo,
      updatedAt: proveedor.updatedAt.toISOString(),
      datosPagoCompletos: Boolean(
        proveedor.cuit &&
        proveedor.condicionIva &&
        proveedor.condicionPagoDias !== null &&
        proveedor.cbuAlias,
      ),
      contacto: contactoPrincipal?.nombre ?? '',
      ciudad: direccionPrincipal?.ciudad ?? '',
      contactos: proveedor.contactos.map((contacto) => ({
        id: contacto.id,
        nombre: contacto.nombre,
        cargo: contacto.cargo ?? '',
        email: contacto.email ?? '',
        telefonoCodigo: contacto.telefonoCodigo ?? '',
        telefonoNumero: contacto.telefonoNumero ?? '',
        principal: contacto.principal,
      })),
      direcciones: proveedor.direcciones.map((direccion) => ({
        id: direccion.id,
        descripcion: direccion.descripcion,
        pais: direccion.paisCodigo,
        codigoPostal: direccion.codigoPostal ?? '',
        direccion: direccion.direccion,
        numero: direccion.numero ?? '',
        ciudad: direccion.ciudad,
        tipo: this.fromPrismaTipoDireccion(direccion.tipo),
        principal: direccion.principal,
      })),
      eventos: proveedor.eventos.map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        actorNombre: evento.actorNombre ?? 'Sistema',
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  private rethrowUniqueProveedor(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const meta = error.meta?.target;
      const target = Array.isArray(meta)
        ? meta
            .filter((item): item is string => typeof item === 'string')
            .join(' ')
        : typeof meta === 'string'
          ? meta
          : '';
      if (target.includes('cuit')) {
        throw new ConflictException('Ya existe un proveedor con ese CUIT.');
      }
      throw new ConflictException('Ya existe un proveedor con ese nombre.');
    }
    throw error;
  }

  private toPrismaTipoDireccion(tipo: TipoDireccionDto) {
    const mapping: Record<TipoDireccionDto, TipoDireccion> = {
      [TipoDireccionDto.principal]: TipoDireccion.PRINCIPAL,
      [TipoDireccionDto.facturacion]: TipoDireccion.FACTURACION,
      [TipoDireccionDto.entrega]: TipoDireccion.ENTREGA,
    };
    return mapping[tipo];
  }

  private fromPrismaTipoDireccion(tipo: TipoDireccion) {
    const mapping: Record<TipoDireccion, TipoDireccionDto> = {
      [TipoDireccion.PRINCIPAL]: TipoDireccionDto.principal,
      [TipoDireccion.FACTURACION]: TipoDireccionDto.facturacion,
      [TipoDireccion.ENTREGA]: TipoDireccionDto.entrega,
    };
    return mapping[tipo];
  }
}
