import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cliente,
  ClienteContacto,
  ClienteDireccion,
  ClienteEvento,
  Prisma,
  TipoDireccion,
} from '@prisma/client';
import { CurrentAuth } from '../auth/auth.types';
import { paginatedResponse } from '../common/dto/pagination.dto';
import { cuitValido } from '../common/cuit';
import { PrismaService } from '../prisma/prisma.service';
import { ClienteContactoDto } from './dto/contacto.dto';
import { ClienteDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { ClientesQueryDto } from './dto/clientes-query.dto';
import {
  AltaPorDocumentoDto,
  UpdateClienteDto,
  UpsertClienteDto,
} from './dto/upsert-cliente.dto';

type ClienteCompleto = Cliente & {
  contactos: ClienteContacto[];
  direcciones: ClienteDireccion[];
  eventos?: ClienteEvento[];
};

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth, pagination: ClientesQueryDto) {
    const query = pagination.q?.trim();
    const where: Prisma.ClienteWhereInput = {
      tenantId: auth.tenantId,
      // Los inhabilitados quedan afuera salvo que los pidan: es lo que hace
      // que "inhabilitar" signifique algo en el resto del sistema.
      ...(pagination.incluirInactivos === 'true' ? {} : { activo: true }),
      ...(query
        ? {
            OR: [
              { nombre: { contains: query, mode: 'insensitive' } },
              { razonSocial: { contains: query, mode: 'insensitive' } },
              { emailPrincipal: { contains: query, mode: 'insensitive' } },
              { telefonoNumero: { contains: query, mode: 'insensitive' } },
              { documentoNumero: { contains: query, mode: 'insensitive' } },
              { cuit: { contains: query, mode: 'insensitive' } },
              {
                contactos: {
                  some: {
                    OR: [
                      { nombre: { contains: query, mode: 'insensitive' } },
                      { email: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                direcciones: {
                  some: { ciudad: { contains: query, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    const [clientes, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        include: {
          contactos: {
            orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
          },
          direcciones: {
            orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
          },
        },
        orderBy: { nombre: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return paginatedResponse(
      clientes.map((cliente) => this.toResponse(cliente)),
      total,
      pagination,
    );
  }

  async findOne(auth: CurrentAuth, id: string) {
    const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
    return this.toResponse(cliente);
  }

  /**
   * ¿Ya tenemos a esta persona? Se consulta ANTES de ofrecer el alta, para
   * que el operador vea de entrada que el cliente existe en vez de
   * enterarse después de completar un formulario al pedo.
   */
  async buscarPorDocumento(auth: CurrentAuth, documento: string) {
    const numero = documento.replace(/\D/g, '');
    if (numero.length < 7) return { cliente: null };
    const cliente = await this.prisma.cliente.findFirst({
      where: { tenantId: auth.tenantId, documentoNumero: numero },
      include: { contactos: true, direcciones: true },
    });
    return { cliente: cliente ? this.toResponse(cliente) : null };
  }

  /**
   * Alta desde el DNI escaneado en el mostrador.
   *
   * Existe para que un pedido de mostrador deje de cargarse como "Mostrador":
   * con el documento en la mano hay nombre y número, así que el cliente queda
   * identificado sin tipear ni frenar la atención. Se marca `origenAlta =
   * 'mostrador'` para poder listarlos después y completarles los datos.
   *
   * Si ese documento ya existe en el tenant devuelve el cliente que hay, sin
   * tocarlo: el que vuelve al mostrador es el mismo cliente, no uno nuevo, y
   * pisarle los datos con los del documento borraría lo que alguien completó
   * a mano después.
   */
  async altaPorDocumento(auth: CurrentAuth, payload: AltaPorDocumentoDto) {
    const documento = payload.documento.replace(/\D/g, '');
    const existente = await this.prisma.cliente.findFirst({
      where: { tenantId: auth.tenantId, documentoNumero: documento },
      include: { contactos: true, direcciones: true },
    });
    if (existente) {
      if (!existente.activo) {
        throw new ConflictException(
          `${existente.nombre} está inhabilitado. Habilitalo desde Registros > Clientes antes de usarlo.`,
        );
      }
      // Rellena huecos, NUNCA pisa. Si el que ya está no tiene teléfono y el
      // operador lo tiene enfrente, aprovechamos; si ya tenía uno, el que
      // manda es el cargado —puede ser el bueno y el del mostrador un
      // celular prestado—.
      const telefonoNuevo = (payload.telefonoNumero ?? '').trim();
      const completa =
        telefonoNuevo && !existente.telefonoNumero.trim()
          ? {
              telefonoCodigo: (payload.telefonoCodigo ?? '+54').trim(),
              telefonoNumero: telefonoNuevo,
            }
          : null;
      if (!completa) {
        return { cliente: this.toResponse(existente), yaExistia: true };
      }
      const actualizado = await this.prisma.cliente.update({
        where: { id: existente.id },
        data: completa,
        include: { contactos: true, direcciones: true },
      });
      await this.prisma.clienteEvento.create({
        data: {
          tenantId: auth.tenantId,
          clienteId: actualizado.id,
          tipo: 'editado',
          actorId: auth.userId,
          actorNombre: auth.email,
          detalle: { origen: 'alta_por_documento', campo: 'telefono' },
        },
      });
      return { cliente: this.toResponse(actualizado), yaExistia: true };
    }

    const telefonoNumero = (payload.telefonoNumero ?? '').trim();
    try {
      const cliente = await this.prisma.cliente.create({
        data: {
          tenantId: auth.tenantId,
          nombre: payload.nombre.trim(),
          documentoNumero: documento,
          cuit: payload.cuit ?? null,
          origenAlta: 'mostrador',
          // Consumidor final: es lo que corresponde a una persona identificada
          // con DNI, y define la letra del comprobante.
          condicionFiscal: 'consumidor_final',
          emailPrincipal: null,
          telefonoCodigo: telefonoNumero
            ? (payload.telefonoCodigo ?? '+54').trim()
            : '',
          telefonoNumero,
          paisCodigo: 'AR',
          eventos: {
            create: {
              tenantId: auth.tenantId,
              tipo: 'creado',
              actorId: auth.userId,
              actorNombre: auth.email,
              detalle: { origen: 'alta_por_documento' },
            },
          },
        },
        include: { contactos: true, direcciones: true },
      });
      return { cliente: this.toResponse(cliente), yaExistia: false };
    } catch (error) {
      this.rethrowUniqueCliente(error);
    }
  }

  async create(auth: CurrentAuth, payload: UpsertClienteDto) {
    const normalized = this.normalizePayload(payload);
    try {
      const cliente = await this.createNormalized(
        this.prisma,
        auth.tenantId,
        normalized,
        auth.userId,
        auth.email,
      );
      return this.toResponse(cliente);
    } catch (error) {
      this.rethrowUniqueCliente(error);
    }
  }

  async importar(auth: CurrentAuth, payloads: UpsertClienteDto[]) {
    if (payloads.length === 0) return { data: [], total: 0 };
    const normalized = payloads.map((payload) =>
      this.normalizePayload(payload),
    );

    try {
      const creados = await this.prisma.$transaction(
        async (tx) => {
          const resultado: ClienteCompleto[] = [];
          for (const cliente of normalized) {
            resultado.push(
              await this.createNormalized(
                tx,
                auth.tenantId,
                cliente,
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
        data: creados.map((cliente) => this.toResponse(cliente)),
        total: creados.length,
      };
    } catch (error) {
      this.rethrowUniqueCliente(error);
    }
  }

  private createNormalized(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    normalized: ReturnType<ClientesService['normalizePayload']>,
    actorId: string,
    actorNombre: string,
  ) {
    return db.cliente.create({
      data: {
        tenantId,
        nombre: normalized.nombre,
        razonSocial: normalized.razonSocial,
        cuit: normalized.cuit,
        documentoNumero: normalized.documentoNumero,
        condicionFiscal: normalized.condicionFiscal,
        limiteCredito: normalized.limiteCredito,
        plazoCuentaCorrienteDias: normalized.plazoCuentaCorrienteDias,
        emailPrincipal: normalized.email,
        telefonoCodigo: normalized.telefonoCodigo,
        telefonoNumero: normalized.telefonoNumero,
        paisCodigo: normalized.pais,
        aceptaWhatsapp: normalized.aceptaWhatsapp,
        aceptaWhatsappEl:
          normalized.aceptaWhatsapp === null ? null : new Date(),
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
          create: {
            tenantId,
            tipo: 'creado',
            actorId,
            actorNombre,
          },
        },
      },
      include: {
        contactos: true,
        direcciones: true,
        eventos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  async update(auth: CurrentAuth, id: string, payload: UpdateClienteDto) {
    const normalized = this.normalizePayload(payload);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await this.findClienteOrThrow(auth, id, tx);
        const version = new Date(payload.updatedAt);
        const aceptaWhatsapp =
          payload.aceptaWhatsapp === undefined
            ? actual.aceptaWhatsapp
            : normalized.aceptaWhatsapp;
        const consentimientoCambio = aceptaWhatsapp !== actual.aceptaWhatsapp;
        const actualizado = await tx.cliente.updateMany({
          where: { id, tenantId: auth.tenantId, updatedAt: version },
          data: {
            nombre: normalized.nombre,
            razonSocial: normalized.razonSocial,
            cuit: normalized.cuit,
            documentoNumero: normalized.documentoNumero,
            condicionFiscal: normalized.condicionFiscal,
            limiteCredito: normalized.limiteCredito,
            plazoCuentaCorrienteDias: normalized.plazoCuentaCorrienteDias,
            emailPrincipal: normalized.email,
            telefonoCodigo: normalized.telefonoCodigo,
            telefonoNumero: normalized.telefonoNumero,
            paisCodigo: normalized.pais,
            aceptaWhatsapp,
            ...(consentimientoCambio
              ? {
                  aceptaWhatsappEl: aceptaWhatsapp === null ? null : new Date(),
                }
              : {}),
          },
        });
        if (actualizado.count !== 1) {
          throw new ConflictException(
            'Este cliente fue modificado por otra persona. Recargá la ficha antes de volver a guardar.',
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
        await tx.clienteEvento.create({
          data: {
            tenantId: auth.tenantId,
            clienteId: id,
            tipo: 'editado',
            actorId: auth.userId,
            actorNombre: auth.email,
          },
        });

        const cliente = await this.findClienteOrThrow(auth, id, tx);
        return this.toResponse(cliente);
      });
    } catch (error) {
      this.rethrowUniqueCliente(error);
    }
  }

  private async sincronizarContactos(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clienteId: string,
    actuales: ClienteContacto[],
    entrantes: ReturnType<ClientesService['normalizeContactos']>,
  ) {
    const idsActuales = new Set(actuales.map((contacto) => contacto.id));
    const idsConservar = entrantes
      .map((contacto) => contacto.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.clienteContacto.deleteMany({
      where: {
        tenantId,
        clienteId,
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
        await tx.clienteContacto.update({ where: { id: contacto.id }, data });
      } else {
        await tx.clienteContacto.create({
          data: {
            ...(contacto.id ? { id: contacto.id } : {}),
            tenantId,
            clienteId,
            ...data,
          },
        });
      }
    }
  }

  private async sincronizarDirecciones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clienteId: string,
    actuales: ClienteDireccion[],
    entrantes: ReturnType<ClientesService['normalizeDirecciones']>,
  ) {
    const idsActuales = new Set(actuales.map((direccion) => direccion.id));
    const idsConservar = entrantes
      .map((direccion) => direccion.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.clienteDireccion.deleteMany({
      where: {
        tenantId,
        clienteId,
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
        await tx.clienteDireccion.update({ where: { id: direccion.id }, data });
      } else {
        await tx.clienteDireccion.create({
          data: {
            ...(direccion.id ? { id: direccion.id } : {}),
            tenantId,
            clienteId,
            ...data,
          },
        });
      }
    }
  }

  /**
   * Borra al cliente SÓLO si no dejó rastro. Si operó, se inhabilita.
   *
   * Antes borraba siempre, y como las relaciones a Cliente son opcionales,
   * Postgres dejaba las órdenes con `clienteId = null` sin decir nada: la orden
   * seguía ahí, con su plata y su producción, y sin saber de quién era. Los
   * comprobantes zafaban de casualidad porque congelan el receptor al emitir.
   */
  async remove(auth: CurrentAuth, id: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const cliente = await this.findClienteOrThrow(auth, id, tx);
          const rastro = await this.contarRastro(tx, auth.tenantId, id);
          if (rastro.total > 0) {
            throw new BadRequestException(
              `${cliente.nombre} no se puede eliminar porque tiene ${rastro.detalle}. ` +
                'Inhabilitalo: desaparece de las listas y de los buscadores, y su ' +
                'historial queda intacto.',
            );
          }
          await tx.cliente.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'El cliente recibió actividad mientras se intentaba eliminar. Inhabilitalo para conservar el historial.',
        );
      }
      throw error;
    }
  }

  /** Fija el estado pedido; repetir la misma solicitud es idempotente. */
  async fijarActivo(auth: CurrentAuth, id: string, activo: boolean) {
    const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
    if (cliente.activo === activo) return this.toResponse(cliente);
    const actualizado = await this.prisma.cliente.update({
      where: { id },
      data: { activo },
      include: {
        contactos: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
        direcciones: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
      },
    });
    await this.prisma.clienteEvento.create({
      data: {
        tenantId: auth.tenantId,
        clienteId: id,
        tipo: activo ? 'habilitado' : 'inhabilitado',
        actorId: auth.userId,
        actorNombre: auth.email,
      },
    });
    return this.toResponse(actualizado);
  }

  /**
   * Qué dejaría huérfano borrarlo. Se cuenta todo lo que lo referencia con una
   * relación OPCIONAL —las que Postgres pone en null sin avisar—; las que
   * cascadean (contactos, direcciones) no cuentan: se van con él, que es lo
   * que corresponde.
   */
  private async contarRastro(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    clienteId: string,
  ) {
    const [
      ordenes,
      cotizaciones,
      comprobantes,
      cobros,
      valores,
      precios,
      archivos,
    ] = await Promise.all([
      db.ordenTrabajo.count({ where: { tenantId, clienteId } }),
      db.cotizacion.count({ where: { tenantId, clienteId } }),
      db.comprobante.count({ where: { tenantId, clienteId } }),
      db.cobro.count({ where: { tenantId, clienteId } }),
      db.valor.count({ where: { tenantId, clienteId } }),
      db.productoPrecioEspecialClienteV2.count({
        where: { tenantId, clienteId },
      }),
      db.archivo.count({ where: { tenantId, clienteId } }),
    ]);

    const partes: string[] = [];
    const sumar = (n: number, singular: string, plural: string) => {
      if (n > 0) partes.push(`${n} ${n === 1 ? singular : plural}`);
    };
    sumar(ordenes, 'orden de trabajo', 'órdenes de trabajo');
    sumar(cotizaciones, 'presupuesto', 'presupuestos');
    sumar(comprobantes, 'comprobante', 'comprobantes');
    sumar(cobros, 'cobro', 'cobros');
    sumar(valores, 'valor', 'valores');
    sumar(precios, 'precio especial', 'precios especiales');
    sumar(archivos, 'archivo', 'archivos');

    return {
      total:
        ordenes +
        cotizaciones +
        comprobantes +
        cobros +
        valores +
        precios +
        archivos,
      detalle: partes.join(', '),
      ordenes,
      cotizaciones,
      comprobantes,
      cobros,
      valores,
      precios,
      archivos,
    };
  }

  private async findClienteOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const cliente = await db.cliente.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        contactos: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
        direcciones: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
        eventos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`No existe el cliente ${id}`);
    }

    return cliente;
  }

  private normalizePayload(payload: UpsertClienteDto) {
    const cuit = payload.cuit?.replace(/\D/g, '') || null;
    if (cuit && !cuitValido(cuit)) {
      throw new BadRequestException(
        'El CUIT no es válido (revisá los 11 dígitos y el verificador).',
      );
    }
    const condicionFiscal = payload.condicionFiscal ?? 'consumidor_final';
    // Factura A exige CUIT del receptor: sin él, ARCA rechaza la emisión.
    if (condicionFiscal === 'RI' && !cuit) {
      throw new BadRequestException(
        'Un Responsable Inscripto necesita CUIT para poder facturarle.',
      );
    }

    return {
      ...payload,
      nombre: payload.nombre.trim(),
      razonSocial: payload.razonSocial?.trim() || null,
      cuit,
      documentoNumero: payload.documentoNumero?.replace(/\D/g, '') || null,
      condicionFiscal,
      limiteCredito:
        payload.limiteCredito === undefined || payload.limiteCredito === null
          ? null
          : payload.limiteCredito,
      plazoCuentaCorrienteDias:
        payload.plazoCuentaCorrienteDias === undefined ||
        payload.plazoCuentaCorrienteDias === null
          ? null
          : Math.trunc(payload.plazoCuentaCorrienteDias),
      email: payload.email?.trim().toLowerCase() || null,
      pais: payload.pais.trim().toUpperCase(),
      telefonoCodigo: payload.telefonoCodigo?.trim() || '',
      telefonoNumero: payload.telefonoNumero?.trim() || '',
      aceptaWhatsapp: payload.aceptaWhatsapp ?? null,
      contactos: this.normalizeContactos(payload.contactos),
      direcciones: this.normalizeDirecciones(payload.direcciones),
    };
  }

  private normalizeContactos(contactos: ClienteContactoDto[]) {
    if (contactos.length === 0) {
      return [];
    }

    const base = contactos.map((contacto) => ({
      ...contacto,
      nombre: contacto.nombre.trim(),
      cargo: contacto.cargo?.trim() || null,
      email: contacto.email?.trim().toLowerCase() || null,
      telefonoCodigo: contacto.telefonoCodigo?.trim() || null,
      telefonoNumero: contacto.telefonoNumero?.trim() || null,
      principal: contacto.principal,
    }));

    const principalIndex = base.findIndex((contacto) => contacto.principal);

    return base.map((contacto, index) => ({
      ...contacto,
      principal: principalIndex === -1 ? index === 0 : index === principalIndex,
    }));
  }

  private normalizeDirecciones(direcciones: ClienteDireccionDto[]) {
    if (direcciones.length === 0) {
      return [];
    }

    const base = direcciones.map((direccion) => ({
      ...direccion,
      descripcion: direccion.descripcion.trim(),
      pais: direccion.pais.trim().toUpperCase(),
      codigoPostal: direccion.codigoPostal?.trim() || null,
      direccion: direccion.direccion.trim(),
      numero: direccion.numero?.trim() || null,
      ciudad: direccion.ciudad.trim(),
      principal: direccion.principal,
    }));

    const principalIndex = base.findIndex((direccion) => direccion.principal);

    return base.map((direccion, index) => ({
      ...direccion,
      principal: principalIndex === -1 ? index === 0 : index === principalIndex,
    }));
  }

  private toResponse(cliente: ClienteCompleto) {
    const contactoPrincipal =
      cliente.contactos.find((contacto) => contacto.principal) ?? null;
    const direccionPrincipal =
      cliente.direcciones.find((direccion) => direccion.principal) ?? null;

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      razonSocial: cliente.razonSocial ?? '',
      cuit: cliente.cuit ?? '',
      condicionFiscal: cliente.condicionFiscal,
      activo: cliente.activo,
      updatedAt: cliente.updatedAt.toISOString(),
      limiteCredito:
        cliente.limiteCredito === null ? null : Number(cliente.limiteCredito),
      plazoCuentaCorrienteDias: cliente.plazoCuentaCorrienteDias,
      // Sin email es '' y no null: el front lo pone en un <input>, y un null
      // ahí lo volvería no-controlado a mitad de camino.
      email: cliente.emailPrincipal ?? '',
      telefonoCodigo: cliente.telefonoCodigo,
      telefonoNumero: cliente.telefonoNumero,
      aceptaWhatsapp: cliente.aceptaWhatsapp,
      aceptaWhatsappEl: cliente.aceptaWhatsappEl?.toISOString() ?? null,
      documentoNumero: cliente.documentoNumero,
      /** 'mostrador' = alta rápida por DNI, puede tener datos incompletos. */
      origenAlta: cliente.origenAlta,
      pais: cliente.paisCodigo,
      contacto: contactoPrincipal?.nombre ?? '',
      ciudad: direccionPrincipal?.ciudad ?? '',
      contactos: cliente.contactos.map((contacto) => ({
        id: contacto.id,
        nombre: contacto.nombre,
        cargo: contacto.cargo ?? '',
        email: contacto.email ?? '',
        telefonoCodigo: contacto.telefonoCodigo ?? '',
        telefonoNumero: contacto.telefonoNumero ?? '',
        principal: contacto.principal,
      })),
      direcciones: cliente.direcciones.map((direccion) => ({
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
      eventos: (cliente.eventos ?? []).map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        actorNombre: evento.actorNombre ?? 'Sistema',
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  private rethrowUniqueCliente(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const targetMeta = error.meta?.target;
      const target = Array.isArray(targetMeta)
        ? targetMeta
            .filter((value): value is string => typeof value === 'string')
            .join(' ')
        : typeof targetMeta === 'string'
          ? targetMeta
          : '';
      if (target.includes('documentoNumero')) {
        throw new ConflictException('Ya existe un cliente con ese DNI.');
      }
      if (target.includes('cuit')) {
        throw new ConflictException('Ya existe un cliente con ese CUIT/CUIL.');
      }
      throw new ConflictException('Ya existe un cliente con ese nombre.');
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
