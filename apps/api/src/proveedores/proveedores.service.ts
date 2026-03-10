import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Proveedor,
  ProveedorContacto,
  ProveedorDireccion,
  Prisma,
  TipoDireccion,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProveedorContactoDto } from './dto/contacto.dto';
import { ProveedorDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { UpsertProveedorDto } from './dto/upsert-proveedor.dto';

type ProveedorCompleto = Proveedor & {
  contactos: ProveedorContacto[];
  direcciones: ProveedorDireccion[];
};

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const proveedores = await this.prisma.proveedor.findMany({
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

    return proveedores.map((proveedor) => this.toResponse(proveedor));
  }

  async findOne(id: string) {
    const proveedor = await this.findProveedorOrThrow(id, this.prisma);
    return this.toResponse(proveedor);
  }

  async create(payload: UpsertProveedorDto) {
    const normalized = this.normalizePayload(payload);

    const proveedor = await this.prisma.proveedor.create({
      data: {
        nombre: normalized.nombre,
        razonSocial: normalized.razonSocial,
        emailPrincipal: normalized.email,
        telefonoCodigo: normalized.telefonoCodigo,
        telefonoNumero: normalized.telefonoNumero,
        paisCodigo: normalized.pais,
        contactos: {
          create: normalized.contactos.map((contacto) => ({
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

    return this.toResponse(proveedor);
  }

  async update(id: string, payload: UpsertProveedorDto) {
    const normalized = this.normalizePayload(payload);

    return this.prisma.$transaction(async (tx) => {
      await this.findProveedorOrThrow(id, tx);

      await tx.proveedor.update({
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

      await tx.proveedorContacto.deleteMany({
        where: { proveedorId: id },
      });

      await tx.proveedorDireccion.deleteMany({
        where: { proveedorId: id },
      });

      if (normalized.contactos.length > 0) {
        await tx.proveedorContacto.createMany({
          data: normalized.contactos.map((contacto) => ({
            proveedorId: id,
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
        await tx.proveedorDireccion.createMany({
          data: normalized.direcciones.map((direccion) => ({
            proveedorId: id,
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

      const proveedor = await this.findProveedorOrThrow(id, tx);
      return this.toResponse(proveedor);
    });
  }

  async remove(id: string) {
    await this.findProveedorOrThrow(id, this.prisma);
    await this.prisma.proveedor.delete({
      where: { id },
    });
  }

  private async findProveedorOrThrow(
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const proveedor = await db.proveedor.findUnique({
      where: { id },
      include: {
        contactos: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
        direcciones: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!proveedor) {
      throw new NotFoundException(`No existe el proveedor ${id}`);
    }

    return proveedor;
  }

  private normalizePayload(payload: UpsertProveedorDto) {
    return {
      ...payload,
      razonSocial: payload.razonSocial?.trim() || null,
      email: payload.email.trim().toLowerCase(),
      pais: payload.pais.trim().toUpperCase(),
      telefonoCodigo: payload.telefonoCodigo.trim(),
      telefonoNumero: payload.telefonoNumero.trim(),
      contactos: this.normalizeContactos(payload.contactos),
      direcciones: this.normalizeDirecciones(payload.direcciones),
    };
  }

  private normalizeContactos(contactos: ProveedorContactoDto[]) {
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

  private normalizeDirecciones(direcciones: ProveedorDireccionDto[]) {
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
