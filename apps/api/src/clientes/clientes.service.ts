import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cliente,
  ClienteContacto,
  ClienteDireccion,
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
  UpsertClienteDto,
} from './dto/upsert-cliente.dto';

type ClienteCompleto = Cliente & {
  contactos: ClienteContacto[];
  direcciones: ClienteDireccion[];
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
      return { cliente: this.toResponse(actualizado), yaExistia: true };
    }

    const telefonoNumero = (payload.telefonoNumero ?? '').trim();
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
      },
      include: { contactos: true, direcciones: true },
    });
    return { cliente: this.toResponse(cliente), yaExistia: false };
  }

  async create(auth: CurrentAuth, payload: UpsertClienteDto) {
    const normalized = this.normalizePayload(payload);

    const cliente = await this.prisma.cliente.create({
      data: {
        tenantId: auth.tenantId,
        nombre: normalized.nombre,
        razonSocial: normalized.razonSocial,
        cuit: normalized.cuit,
        documentoNumero: normalized.documentoNumero,
        condicionFiscal: normalized.condicionFiscal,
        limiteCredito: normalized.limiteCredito,
        emailPrincipal: normalized.email,
        telefonoCodigo: normalized.telefonoCodigo,
        telefonoNumero: normalized.telefonoNumero,
        paisCodigo: normalized.pais,
        contactos: {
          create: normalized.contactos.map((contacto) => ({
            tenantId: auth.tenantId,
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
            tenantId: auth.tenantId,
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
      },
      include: {
        contactos: true,
        direcciones: true,
      },
    });

    return this.toResponse(cliente);
  }

  async update(auth: CurrentAuth, id: string, payload: UpsertClienteDto) {
    const normalized = this.normalizePayload(payload);

    return this.prisma.$transaction(async (tx) => {
      await this.findClienteOrThrow(auth, id, tx);

      await tx.cliente.update({
        where: { id },
        data: {
          nombre: normalized.nombre,
          razonSocial: normalized.razonSocial,
          cuit: normalized.cuit,
          documentoNumero: normalized.documentoNumero,
          condicionFiscal: normalized.condicionFiscal,
          limiteCredito: normalized.limiteCredito,
          emailPrincipal: normalized.email,
          telefonoCodigo: normalized.telefonoCodigo,
          telefonoNumero: normalized.telefonoNumero,
          paisCodigo: normalized.pais,
        },
      });

      await tx.clienteContacto.deleteMany({
        where: { clienteId: id, tenantId: auth.tenantId },
      });

      await tx.clienteDireccion.deleteMany({
        where: { clienteId: id, tenantId: auth.tenantId },
      });

      if (normalized.contactos.length > 0) {
        await tx.clienteContacto.createMany({
          data: normalized.contactos.map((contacto) => ({
            tenantId: auth.tenantId,
            clienteId: id,
            nombre: contacto.nombre,
            cargo: contacto.cargo,
            email: contacto.email,
            telefonoCodigo: contacto.telefonoCodigo,
            telefonoNumero: contacto.telefonoNumero,
            principal: contacto.principal,
          })),
        });
      }

      if (normalized.direcciones.length > 0) {
        await tx.clienteDireccion.createMany({
          data: normalized.direcciones.map((direccion) => ({
            tenantId: auth.tenantId,
            clienteId: id,
            descripcion: direccion.descripcion,
            paisCodigo: direccion.pais,
            codigoPostal: direccion.codigoPostal,
            direccion: direccion.direccion,
            numero: direccion.numero,
            ciudad: direccion.ciudad,
            tipo: this.toPrismaTipoDireccion(direccion.tipo),
            principal: direccion.principal,
          })),
        });
      }

      const cliente = await this.findClienteOrThrow(auth, id, tx);
      return this.toResponse(cliente);
    });
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
    const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
    const rastro = await this.contarRastro(auth.tenantId, id);

    if (rastro.total > 0) {
      throw new BadRequestException(
        `${cliente.nombre} no se puede eliminar porque tiene ${rastro.detalle}. ` +
          'Inhabilitalo: desaparece de las listas y de los buscadores, y su ' +
          'historial queda intacto.',
      );
    }

    await this.prisma.cliente.delete({ where: { id } });
  }

  /** Inhabilitar / volver a habilitar. */
  async alternarActivo(auth: CurrentAuth, id: string) {
    const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
    const actualizado = await this.prisma.cliente.update({
      where: { id },
      data: { activo: !cliente.activo },
      include: {
        contactos: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
        direcciones: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
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
  private async contarRastro(tenantId: string, clienteId: string) {
    const [ordenes, cotizaciones, comprobantes, cobros] = await Promise.all([
      this.prisma.ordenTrabajo.count({ where: { tenantId, clienteId } }),
      this.prisma.cotizacion.count({ where: { tenantId, clienteId } }),
      this.prisma.comprobante.count({ where: { tenantId, clienteId } }),
      this.prisma.cobro.count({ where: { tenantId, clienteId } }),
    ]);

    const partes: string[] = [];
    const sumar = (n: number, singular: string, plural: string) => {
      if (n > 0) partes.push(`${n} ${n === 1 ? singular : plural}`);
    };
    sumar(ordenes, 'orden de trabajo', 'órdenes de trabajo');
    sumar(cotizaciones, 'presupuesto', 'presupuestos');
    sumar(comprobantes, 'comprobante', 'comprobantes');
    sumar(cobros, 'cobro', 'cobros');

    return {
      total: ordenes + cotizaciones + comprobantes + cobros,
      detalle: partes.join(', '),
      ordenes,
      cotizaciones,
      comprobantes,
      cobros,
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
      email: payload.email.trim().toLowerCase(),
      pais: payload.pais.trim().toUpperCase(),
      telefonoCodigo: payload.telefonoCodigo.trim(),
      telefonoNumero: payload.telefonoNumero.trim(),
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
      limiteCredito:
        cliente.limiteCredito === null ? null : Number(cliente.limiteCredito),
      // Sin email es '' y no null: el front lo pone en un <input>, y un null
      // ahí lo volvería no-controlado a mitad de camino.
      email: cliente.emailPrincipal ?? '',
      telefonoCodigo: cliente.telefonoCodigo,
      telefonoNumero: cliente.telefonoNumero,
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
    };
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
