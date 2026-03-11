import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Cliente,
  ClienteContacto,
  ClienteDireccion,
  Prisma,
  TipoDireccion,
} from '@prisma/client';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ClienteContactoDto } from './dto/contacto.dto';
import { ClienteDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';

type ClienteCompleto = Cliente & {
  contactos: ClienteContacto[];
  direcciones: ClienteDireccion[];
};

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(auth: CurrentAuth) {
    const clientes = await this.prisma.cliente.findMany({
      where: {
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
      orderBy: {
        nombre: 'asc',
      },
    });

    return clientes.map((cliente) => this.toResponse(cliente));
  }

  async findOne(auth: CurrentAuth, id: string) {
    const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
    return this.toResponse(cliente);
  }

  async create(auth: CurrentAuth, payload: UpsertClienteDto) {
    const normalized = this.normalizePayload(payload);

    const cliente = await this.prisma.cliente.create({
      data: {
        tenantId: auth.tenantId,
        nombre: normalized.nombre,
        razonSocial: normalized.razonSocial,
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

  async remove(auth: CurrentAuth, id: string) {
    await this.findClienteOrThrow(auth, id, this.prisma);
    await this.prisma.cliente.delete({
      where: { id },
    });
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
    return {
      ...payload,
      nombre: payload.nombre.trim(),
      razonSocial: payload.razonSocial?.trim() || null,
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
      email: cliente.emailPrincipal,
      telefonoCodigo: cliente.telefonoCodigo,
      telefonoNumero: cliente.telefonoNumero,
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
