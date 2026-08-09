import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  EstadoIntegracion,
  Prisma,
  ProveedorIntegracion,
} from '@prisma/client';
import QRCode from 'qrcode';

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
} from './wati/wati.client';
import type {
  ConectarWatiDto,
  ProbarEnvioWatiDto,
} from './dto/integraciones.dto';
import { aE164 } from './telefono';
import { cruzar, type EstadoPlantillas } from './wati/plantillas';
import { POR_CODIGO, validar } from './wati/catalogo';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../archivos/storage/storage.driver';

/**
 * `esperaMinutos` sólo viene cuando Wati frenó por cupo: Meta acepta 10
 * plantillas por hora y un catálogo de 15 nunca entra de una. No es un error
 * a reintentar, es una espera — quien llame tiene que dejar de insistir.
 */
export type ResultadoSometer = {
  codigo: string;
  ok: boolean;
  estado: string;
  motivo?: string;
  esperaMinutos?: number;
};

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
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
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
  /**
   * El estado de las plantillas del tenant: las del catálogo de Grafo con su
   * estado real en Meta, y las propias que ya tenía.
   */
  async plantillasWati(): Promise<EstadoPlantillas> {
    const cred = await this.credencialesWati();
    if (!cred) {
      throw new NotFoundException('Wati no está conectada.');
    }
    return cruzar(await this.wati.listarPlantillas(cred));
  }

  /**
   * Deja UNA plantilla del catálogo lista y enviada a revisión de Meta.
   *
   * Son dos pasos contra Wati y hacen falta los dos: el alta crea la
   * plantilla en DRAFT y no la manda a ningún lado; recién
   * `POST /templates/submit/{id}` la somete. Una plantilla en DRAFT parece
   * hecha en el listado y no sirve para notificar a nadie, así que acá se
   * hacen los dos o se informa dónde se cortó.
   *
   * De a una y no las 15 de un saque a propósito: son varias llamadas a un
   * tercero con timeout de 10 s cada una, y meterlas en un solo request HTTP
   * daría una pantalla congelada un minuto que además pierde todo si se
   * corta. Con esto el front muestra el avance y reintenta sólo la que falló.
   *
   * OJO con lo que devuelve Wati en el alta. Verificado contra la cuenta
   * real: contesta **500 "An error occurred" y aun así crea la plantilla**.
   * Confiar en el código de respuesta reportaría un fallo sobre algo que sí
   * se creó, y el reintento chocaría con "template with current name already
   * exists". Por eso el estado real se lee de la lista DESPUÉS de intentar, y
   * esa relectura —no la respuesta del POST— es la que manda.
   */
  async someterPlantillaWati(codigo: string): Promise<ResultadoSometer> {
    const cred = await this.credencialesWati();
    if (!cred) throw new NotFoundException('Wati no está conectada.');

    const canonica = POR_CODIGO.get(codigo);
    if (!canonica) {
      throw new NotFoundException(
        `"${codigo}" no está en el catálogo de Grafo.`,
      );
    }

    // Última red antes de gastar un ciclo de revisión de 24-48 h.
    const errores = validar(canonica);
    if (errores.length) {
      return {
        codigo,
        ok: false,
        estado: 'SIN_SOMETER',
        motivo: errores.join(' '),
      };
    }

    const previa = (await this.wati.listarPlantillas(cred)).find(
      (r) => r.nombre === canonica.codigo,
    );

    // Ya existe pero quedó en borrador —un intento anterior que se cortó, o
    // una creada a mano—: se envía en vez de fallar. Recrearla no se puede,
    // Wati rechaza el duplicado.
    if (previa?.estado === 'DRAFT' && previa.id) {
      return this.enviarBorrador(cred, codigo, previa.id);
    }
    if (previa) {
      return {
        codigo,
        ok: false,
        estado: previa.estado,
        motivo: 'Ya existe en la cuenta de Wati.',
      };
    }

    const alta = await this.wati.crearPlantilla(cred, {
      ...canonica,
      // La muestra del header se sube a R2 recién acá y viaja como URL
      // firmada: alcanzable por Meta desde cualquier lado, sin depender de que
      // la app sea pública (clave para poder aprobar desde dev).
      encabezado: canonica.encabezado
        ? { tipo: 'IMAGE', ejemploUrl: await this.urlMuestraQrRetiro() }
        : undefined,
    });
    const creada = (await this.wati.listarPlantillas(cred)).find(
      (r) => r.nombre === canonica.codigo,
    );
    if (!creada?.id) {
      const motivo = alta.ok
        ? 'Wati respondió que la creó, pero no aparece en la cuenta.'
        : alta.motivo;
      this.logger.warn(`No se pudo crear ${codigo}: ${motivo}`);
      return { codigo, ok: false, estado: 'SIN_SOMETER', motivo };
    }

    return this.enviarBorrador(cred, codigo, creada.id);
  }

  /**
   * Manda el borrador a revisión y devuelve el estado que quedó.
   *
   * Si el envío falla, la plantilla NO se pierde: queda en DRAFT y el próximo
   * intento la retoma desde ahí. Por eso se informa `DRAFT` y no un error a
   * secas — el trabajo hecho sigue estando.
   */
  private async enviarBorrador(
    cred: CredencialesWati,
    codigo: string,
    id: string,
  ): Promise<{ codigo: string; ok: boolean; estado: string; motivo?: string }> {
    const envio = await this.wati.enviarAAprobacion(cred, id);
    if (!envio.ok) {
      this.logger.warn(
        `No se pudo enviar a revisión ${codigo}: ${envio.motivo}`,
      );
      return { codigo, ok: false, estado: 'DRAFT', motivo: envio.motivo };
    }
    const final = (await this.wati.listarPlantillas(cred)).find(
      (r) => r.nombre === codigo,
    );
    return { codigo, ok: true, estado: final?.estado ?? 'PENDING' };
  }

  /**
   * Genera un QR con `contenido`, lo sube a R2 bajo `clave` y devuelve una URL
   * firmada por `ttlSegundos`. Sale por R2 —no por la URL de la app— a
   * propósito: la firma es alcanzable desde afuera aunque la app corra en
   * localhost, que es lo que destraba probar todo esto desde dev.
   */
  private async subirQrYFirmar(
    contenido: string,
    clave: string,
    ttlSegundos: number,
  ): Promise<string> {
    const png = await QRCode.toBuffer(contenido, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      type: 'png',
    });
    // Idempotente: pisar la misma clave no molesta (imagen fija y minúscula).
    await this.storage.subir(clave, png, 'image/png');
    return this.storage.firmarDescarga(clave, {
      disposition: 'inline',
      contentType: 'image/png',
      expiraSegundos: ttlSegundos,
    });
  }

  /**
   * URL de la imagen de MUESTRA del header de la plantilla del QR, la que Meta
   * descarga para revisar.
   *
   * Un QR de ejemplo bajo una clave fija —el mismo para todos los tenants, no
   * es de nadie— con firma de 7 días (el techo de S3), de sobra: Meta baja la
   * muestra una vez y la deja congelada en la plantilla. El QR REAL, por orden,
   * se arma al enviar; esto es sólo el machetazo para que Meta apruebe.
   */
  private urlMuestraQrRetiro(): Promise<string> {
    return this.subirQrYFirmar(
      'OT-0000-0000',
      'sistema/ejemplo-qr-retiro.png',
      7 * 24 * 60 * 60,
    );
  }

  /**
   * QR de retiro de UNA orden, para el header del WhatsApp de "orden lista".
   * Codifica el número (lo mismo que el del mostrador). Firma corta: el envío
   * es inmediato y Wati baja la media al toque. Clave por número: idempotente.
   */
  urlQrRetiroParaEnvio(numero: string): Promise<string> {
    return this.subirQrYFirmar(
      numero,
      `sistema/qr-retiro/${numero}.png`,
      10 * 60,
    );
  }

  /**
   * La URL de la media del header de una plantilla, si lleva header de imagen.
   * Hoy es el QR de retiro, que codifica el número de orden —que ya viene en
   * los params, en `numero_orden`—. `undefined` para las de texto puro, que
   * son casi todas. Lo usan el envío de prueba y el despacho por igual.
   */
  async mediaHeaderDe(
    codigo: string,
    parametros: Record<string, string>,
  ): Promise<string | undefined> {
    const canonica = POR_CODIGO.get(codigo);
    if (canonica?.encabezado?.tipo !== 'IMAGE') return undefined;
    const numero = parametros['numero_orden'];
    return numero ? this.urlQrRetiroParaEnvio(numero) : undefined;
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

    // Si la plantilla lleva header de imagen (el QR de retiro), se arma la
    // media con el número que vino en los params. Es LO que sirve para
    // verificar el envío con imagen sin tocar la cola de clientes: se manda a
    // un número propio y se mira si llega el QR real o la muestra.
    const mediaHeaderUrl = await this.mediaHeaderDe(dto.plantilla, parametros);

    const res = await this.wati.enviarPlantilla(cred, {
      telefono: tel.e164,
      plantilla: plantilla.nombre,
      parametros,
      broadcastName: `grafo_prueba_${plantilla.nombre}`,
      mediaHeaderUrl,
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
