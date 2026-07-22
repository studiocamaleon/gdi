import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EstadoIntegracion,
  Prisma,
  ProveedorIntegracion,
} from '@prisma/client';

import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecretosService,
  type SecretoCifrado,
} from './cripto/secretos.service';
import {
  exigirHttps,
  WatiClient,
  type CredencialesWati,
  type PlantillaRemota,
} from './wati/wati.client';
import type {
  ConectarWatiDto,
  ProbarEnvioWatiDto,
} from './dto/integraciones.dto';
import { aE164 } from './telefono';

/**
 * Conexiones del tenant con proveedores externos.
 *
 * El servicio es genérico sobre el proveedor a propósito: AFIP y Mercado Pago
 * van a guardar secretos con las mismas exigencias, y lo único específico de
 * cada uno es cómo se prueba la conexión.
 *
 * Ver docs/integraciones-wati-diseno.md
 */

/** Lo que la UI puede ver. Nunca incluye el secreto. */
export type IntegracionDto = {
  proveedor: ProveedorIntegracion;
  estado: EstadoIntegracion;
  /** Últimos caracteres del token. Alcanza para saber cuál está cargado. */
  pista: string | null;
  metadata: Record<string, unknown> | null;
  ultimoChequeoEl: string | null;
  ultimoErrorTexto: string | null;
  conectadaEl: string | null;
};

@Injectable()
export class IntegracionesService {
  private readonly logger = new Logger(IntegracionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretos: SecretosService,
    private readonly wati: WatiClient,
  ) {}

  /** ¿Se pueden guardar credenciales en este entorno? */
  get cifradoDisponible(): boolean {
    return this.secretos.disponible;
  }

  async listar(): Promise<IntegracionDto[]> {
    const filas = await this.prisma.integracionTenant.findMany({
      orderBy: { proveedor: 'asc' },
    });
    return filas.map((f) => this.aDto(f));
  }

  async obtener(
    proveedor: ProveedorIntegracion,
  ): Promise<IntegracionDto | null> {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: { proveedor },
    });
    return fila ? this.aDto(fila) : null;
  }

  // ── Wati ─────────────────────────────────────────────────────────────

  /**
   * Guarda las credenciales de Wati. Se PRUEBAN antes de guardar: dejar
   * guardada una conexión rota es peor que no dejar guardar nada, porque el
   * error aparece recién cuando alguien espera un mensaje que nunca sale.
   */
  async conectarWati(
    auth: CurrentAuth,
    dto: ConectarWatiDto,
  ): Promise<IntegracionDto> {
    const cred: CredencialesWati = {
      endpoint: dto.endpoint.trim(),
      tenantId: dto.tenantId.trim(),
      token: dto.token.trim(),
    };

    const inseguro = exigirHttps(cred.endpoint);
    if (inseguro) {
      return this.guardarError(auth, ProveedorIntegracion.WATI, inseguro);
    }

    const prueba = await this.wati.probar(cred);
    if (!prueba.ok) {
      return this.guardarError(auth, ProveedorIntegracion.WATI, prueba.motivo);
    }

    const fila = await this.prisma.integracionTenant.upsert({
      where: {
        tenantId_proveedor: {
          tenantId: auth.tenantId,
          proveedor: ProveedorIntegracion.WATI,
        },
      },
      create: {
        tenantId: auth.tenantId,
        proveedor: ProveedorIntegracion.WATI,
        estado: EstadoIntegracion.CONECTADA,
        credencialesCifradas: this.cifrarCredenciales(cred),
        pista: this.secretos.pista(cred.token),
        metadataJson: { endpoint: cred.endpoint, tenantId: cred.tenantId },
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: null,
        conectadaEl: new Date(),
        conectadaPorId: auth.userId,
      },
      update: {
        estado: EstadoIntegracion.CONECTADA,
        credencialesCifradas: this.cifrarCredenciales(cred),
        pista: this.secretos.pista(cred.token),
        metadataJson: { endpoint: cred.endpoint, tenantId: cred.tenantId },
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: null,
        conectadaEl: new Date(),
        conectadaPorId: auth.userId,
      },
    });
    return this.aDto(fila);
  }

  /** Vuelve a probar la conexión guardada y actualiza el estado. */
  async probar(
    auth: CurrentAuth,
    proveedor: ProveedorIntegracion,
  ): Promise<IntegracionDto> {
    const fila = await this.exigir(proveedor);
    if (proveedor !== ProveedorIntegracion.WATI) {
      throw new NotFoundException(
        `Todavía no se puede probar la conexión con ${proveedor}.`,
      );
    }

    const cred = this.descifrarWati(fila.credencialesCifradas);
    const prueba = await this.wati.probar(cred);

    const actualizada = await this.prisma.integracionTenant.update({
      where: { id: fila.id },
      data: {
        estado: prueba.ok
          ? EstadoIntegracion.CONECTADA
          : EstadoIntegracion.ERROR,
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: prueba.ok ? null : prueba.motivo,
      },
    });
    return this.aDto(actualizada);
  }

  /**
   * Desconecta y BORRA las credenciales.
   *
   * No se hace borrado lógico: un token que sigue en la base después de que
   * el usuario apretó "desconectar" es exactamente lo que no esperaba que
   * pasara. La fila se conserva sólo para recordar que estuvo conectada.
   */
  async desconectar(proveedor: ProveedorIntegracion): Promise<void> {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: { proveedor },
    });
    if (!fila) return;

    await this.prisma.integracionTenant.update({
      where: { id: fila.id },
      data: {
        estado: EstadoIntegracion.DESCONECTADA,
        credencialesCifradas: Prisma.DbNull,
        pista: null,
        ultimoErrorTexto: null,
        conectadaEl: null,
      },
    });
  }

  /**
   * Las plantillas que existen HOY en la cuenta del tenant, tal como las
   * devuelve Wati. Es sólo lectura y sin efectos: sirve para ver qué hay
   * antes de que F2 empiece a crear las suyas.
   */
  async plantillasWati(): Promise<PlantillaRemota[]> {
    const cred = await this.credencialesWati();
    if (!cred) {
      throw new NotFoundException('Wati no está conectada.');
    }
    return this.wati.listarPlantillas(cred);
  }

  /**
   * Envío de prueba a un número del propio admin.
   *
   * Hace tres cosas que el envío real también va a hacer, y por eso sirve
   * como prueba: normaliza el teléfono a E.164, busca la plantilla en la
   * cuenta del tenant para saber **con qué nombre viaja cada posición**, y
   * recién ahí envía. Los valores llegan por posición porque es como los
   * piensa el sistema ({{1}} = nombre del cliente); Wati los quiere por
   * nombre. Traducir eso acá es exactamente lo que evita que al cliente le
   * llegue el número de orden donde va el nombre.
   */
  async probarEnvioWati(dto: ProbarEnvioWatiDto): Promise<{
    ok: boolean;
    telefono?: string;
    motivo?: string;
    parametros?: Record<string, string>;
  }> {
    const cred = await this.credencialesWati();
    if (!cred) throw new NotFoundException('Wati no está conectada.');

    const tel = aE164({ telefonoNumero: dto.telefono });
    if (!tel.ok) return { ok: false, motivo: tel.motivo };

    const plantillas = await this.wati.listarPlantillas(cred);
    const plantilla = plantillas.find((p) => p.nombre === dto.plantilla);
    if (!plantilla) {
      return {
        ok: false,
        motivo: `No existe la plantilla "${dto.plantilla}" en la cuenta de Wati.`,
      };
    }
    if (plantilla.estado !== 'APPROVED') {
      return {
        ok: false,
        motivo: `La plantilla está ${plantilla.estado}: Meta sólo entrega las aprobadas.`,
      };
    }
    if (plantilla.parametros.length !== dto.parametros.length) {
      return {
        ok: false,
        motivo: `La plantilla espera ${plantilla.parametros.length} parámetros y recibí ${dto.parametros.length}.`,
      };
    }

    const parametros = Object.fromEntries(
      plantilla.parametros.map((nombre, i) => [nombre, dto.parametros[i]]),
    );

    const res = await this.wati.enviarPlantilla(cred, {
      telefono: tel.e164,
      plantilla: plantilla.nombre,
      parametros,
      broadcastName: `grafo_prueba_${plantilla.nombre}`,
    });

    return res.ok
      ? { ok: true, telefono: tel.e164, parametros }
      : { ok: false, telefono: tel.e164, motivo: res.motivo, parametros };
  }

  /**
   * Credenciales listas para usar. Sólo para el SERVIDOR — nunca sale de
   * acá hacia un controller.
   */
  async credencialesWati(): Promise<CredencialesWati | null> {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: {
        proveedor: ProveedorIntegracion.WATI,
        estado: EstadoIntegracion.CONECTADA,
      },
    });
    if (!fila?.credencialesCifradas) return null;
    return this.descifrarWati(fila.credencialesCifradas);
  }

  // ── Interno ──────────────────────────────────────────────────────────

  /**
   * Guarda el intento fallido para que la UI pueda decir POR QUÉ no conectó,
   * pero NO guarda las credenciales: si no sirven, no hay razón para
   * conservar un token en la base.
   */
  private async guardarError(
    auth: CurrentAuth,
    proveedor: ProveedorIntegracion,
    motivo: string,
  ): Promise<IntegracionDto> {
    const fila = await this.prisma.integracionTenant.upsert({
      where: { tenantId_proveedor: { tenantId: auth.tenantId, proveedor } },
      create: {
        tenantId: auth.tenantId,
        proveedor,
        estado: EstadoIntegracion.ERROR,
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: motivo,
      },
      update: {
        estado: EstadoIntegracion.ERROR,
        ultimoChequeoEl: new Date(),
        ultimoErrorTexto: motivo,
      },
    });
    return this.aDto(fila);
  }

  private cifrarCredenciales(cred: CredencialesWati): Prisma.InputJsonValue {
    // Se cifra el objeto entero y no sólo el token: el endpoint y el tenant
    // id no son secretos, pero juntos con el token forman la credencial
    // completa, y separarlos sólo complicaría el descifrado.
    return this.secretos.cifrar(
      JSON.stringify(cred),
    ) as unknown as Prisma.InputJsonValue;
  }

  private descifrarWati(cifrado: Prisma.JsonValue | null): CredencialesWati {
    if (!cifrado) {
      throw new NotFoundException('La integración no tiene credenciales.');
    }
    const texto = this.secretos.descifrar(cifrado as unknown as SecretoCifrado);
    return JSON.parse(texto) as CredencialesWati;
  }

  private async exigir(proveedor: ProveedorIntegracion) {
    const fila = await this.prisma.integracionTenant.findFirst({
      where: { proveedor },
    });
    if (!fila) {
      throw new NotFoundException(`${proveedor} no está conectada.`);
    }
    return fila;
  }

  private aDto(fila: {
    proveedor: ProveedorIntegracion;
    estado: EstadoIntegracion;
    pista: string | null;
    metadataJson: Prisma.JsonValue;
    ultimoChequeoEl: Date | null;
    ultimoErrorTexto: string | null;
    conectadaEl: Date | null;
  }): IntegracionDto {
    return {
      proveedor: fila.proveedor,
      estado: fila.estado,
      pista: fila.pista,
      metadata: (fila.metadataJson as Record<string, unknown> | null) ?? null,
      ultimoChequeoEl: fila.ultimoChequeoEl?.toISOString() ?? null,
      ultimoErrorTexto: fila.ultimoErrorTexto,
      conectadaEl: fila.conectadaEl?.toISOString() ?? null,
    };
  }
}
