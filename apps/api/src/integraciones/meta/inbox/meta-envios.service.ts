import { MetaCargasService } from './meta-cargas.service';
import { FORMATOS_INBOX } from '../../../common/inbox/medios';
import { normalizarPlantilla } from './meta-plantillas';
import { MetaArchivosPlantillaService } from './meta-archivos-plantilla.service';
import type { Archivo } from '@prisma/client';
import {
  componentesPlantilla,
  textoPlantilla,
  validarValoresPlantilla,
  type PlantillaInbox,
} from '../../../common/inbox/plantillas';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import {
  SecretosService,
  type SecretoCifrado,
} from '../../cripto/secretos.service';
import { InboxTiempoRealBus } from '../../../inbox-tiempo-real/inbox-tiempo-real.bus';
import { registrarCambioInbox } from '../../../inbox-tiempo-real/inbox-revision';
import type { CurrentAuth } from '../../../auth/auth.types';
import { exigirAccesoConexionMeta } from '../meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from '../meta-inbox-canal';
import { destinatarioCanalPermitido } from '../meta-prueba.config';
import { MetaCloudClient, type ResultadoMeta } from '../meta-cloud.client';
import {
  enviosInboxHabilitados,
  plantillasInboxHabilitadas,
  presentarEnvio,
  consultarVentanaRespuesta,
} from './meta-envios.config';
import { confirmarEnvioInbox } from './meta-inbox-proyeccion';
import {
  EnviarPlantillaInboxDto,
  CatalogoPlantillasInboxDto,
  EnviarTextoInboxDto,
  EnviarMedioInboxDto,
} from './meta-envios.dto';

@Injectable()
export class MetaEnviosService {
  constructor(
    private readonly db: PrismaService,
    private readonly client: MetaCloudClient,
    private readonly secretos: SecretosService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly bus: InboxTiempoRealBus,
    private readonly archivos: MetaArchivosPlantillaService,
    private readonly cargas: MetaCargasService,
  ) {}

  abrirArchivoPlantilla(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    archivoId: string,
    dto: { canalId: string; version: string },
  ) {
    return this.archivos.abrir(
      auth,
      ip,
      conversacionId,
      dto.canalId,
      archivoId,
      dto.version,
    );
  }
  archivosPlantilla(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: CatalogoPlantillasInboxDto,
  ) {
    return this.archivos.listar(auth, ip, conversacionId, dto.canalId);
  }

  async catalogo(
    auth: CurrentAuth,
    ip: string,
    dto: CatalogoPlantillasInboxDto,
  ) {
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal || !plantillasInboxHabilitadas(auth.tenantId, canal.tipo))
      throw new ForbiddenException(
        'Las plantillas todavía no están habilitadas.',
      );
    await exigirAccesoConexionMeta(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    if (identidadCanalInbox(canal) !== dto.canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    const v = await this.db.metaVinculo.findFirstOrThrow({
      where: { id: canal.id, tenantId: auth.tenantId },
    });
    let pagina: Awaited<ReturnType<MetaCloudClient['listarPlantillas']>>;
    try {
      if (!this.secretos.disponible) throw new Error();
      const accessToken = this.secretos.descifrar(
        v.tokenCifrado as SecretoCifrado,
      );
      pagina = await this.client.listarPlantillas({
        accessToken,
        wabaId: canal.wabaId,
        despues: dto.despues,
      });
    } catch {
      throw new ServiceUnavailableException(
        'No pudimos consultar las plantillas. Revisá la conexión y volvé a intentar.',
      );
    }
    await exigirAccesoConexionMeta(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const actual = await canalGeneralInbox(this.db, auth.tenantId);
    if (
      !plantillasInboxHabilitadas(auth.tenantId, canal.tipo) ||
      !actual ||
      identidadCanalInbox(actual) !== dto.canalId
    )
      throw new ForbiddenException();
    return {
      canalId: dto.canalId,
      plantillas: pagina.data.flatMap((r) => {
        const p = normalizarPlantilla(r, dto.despues ?? null);
        return p ? [p] : [];
      }),
      siguiente: pagina.siguiente,
    };
  }

  enviar(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: EnviarTextoInboxDto,
  ) {
    return this.enviarInterno(auth, ip, conversacionId, dto);
  }
  enviarPlantilla(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: EnviarPlantillaInboxDto,
  ) {
    return this.enviarInterno(auth, ip, conversacionId, dto);
  }

  enviarMedio(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: EnviarMedioInboxDto,
  ) {
    return this.enviarInterno(auth, ip, conversacionId, dto);
  }
  private async enviarInterno(
    auth: CurrentAuth,
    ip: string,
    conversacionId: string,
    dto: EnviarTextoInboxDto | EnviarPlantillaInboxDto | EnviarMedioInboxDto,
  ) {
    const esPlantilla = 'plantillaId' in dto;
    const esMedio = !esPlantilla && 'archivoId' in dto;
    const tipoEnvio = esPlantilla ? 'PLANTILLA' : esMedio ? 'MEDIO' : 'TEXTO';
    await exigirAccesoConexionMeta(this.db, auth, ip);
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal || identidadCanalInbox(canal) !== dto.canalId)
      throw new ConflictException('La conexión cambió. Actualizá el Inbox.');
    const habilitado = () =>
      esPlantilla
        ? plantillasInboxHabilitadas(auth.tenantId, canal.tipo)
        : enviosInboxHabilitados(auth.tenantId, canal.tipo);
    if (!habilitado())
      throw new ForbiddenException(
        'Las respuestas todavía no están habilitadas.',
      );
    if (
      !esPlantilla &&
      !esMedio &&
      (!dto.texto?.trim() || (dto.texto?.length ?? 0) > 4096)
    )
      throw new BadRequestException('Escribí entre 1 y 4096 caracteres.');
    if (esPlantilla && dto.consentimientoConfirmado !== true)
      throw new BadRequestException(
        'Confirmá que el cliente autorizó este contacto.',
      );
    const huella = createHash('sha256')
      .update(
        esPlantilla
          ? JSON.stringify([
              'plantilla',
              dto.plantillaId,
              dto.version,
              dto.valores,
              dto.consentimientoConfirmado,
              ...(dto.archivoId || dto.archivoVersion
                ? [dto.archivoId, dto.archivoVersion]
                : []),
            ])
          : esMedio
            ? JSON.stringify([dto.archivoId, dto.texto ?? ''])
            : (dto.texto ?? ''),
      )
      .digest('hex');
    let plantilla: PlantillaInbox | null = null;
    let archivo: Archivo | null = null;
    const existente =
      esPlantilla || esMedio
        ? await this.db.inboxEnvio.findFirst({
            where: { tenantId: auth.tenantId, clave: dto.clave },
            select: { id: true },
          })
        : null;
    // Consultar un intento existente nunca vuelve a preparar ni enviar el archivo.
    if (esPlantilla && !existente) {
      const catalogo = await this.catalogo(auth, ip, {
        canalId: dto.canalId,
        despues: dto.pagina ?? undefined,
      });
      plantilla =
        catalogo.plantillas.find((p) => p.id === dto.plantillaId) ?? null;
      if (!plantilla || plantilla.version !== dto.version)
        throw new ConflictException(
          'La plantilla cambió o ya no está disponible. Actualizá el catálogo.',
        );
      const error = validarValoresPlantilla(plantilla, dto.valores);
      if (error) throw new BadRequestException(error);
      if (plantilla.archivo) {
        if (!dto.archivoId || !dto.archivoVersion)
          throw new BadRequestException(
            'Elegí el archivo que llevará la plantilla.',
          );
        archivo = await this.archivos.validar(
          auth,
          ip,
          conversacionId,
          dto.canalId,
          dto.archivoId,
          dto.archivoVersion,
          plantilla.archivo,
        );
      } else if (dto.archivoId || dto.archivoVersion)
        throw new BadRequestException('Esta plantilla no admite archivos.');
    }
    const carga =
      esMedio && !existente
        ? await this.cargas.validar(
            auth,
            ip,
            conversacionId,
            dto.canalId,
            dto.archivoId,
          )
        : null;
    if (
      esMedio &&
      carga &&
      !['image', 'video', 'document'].includes(
        FORMATOS_INBOX[carga.archivo.mimeType]?.tipo ?? '',
      ) &&
      dto.texto?.trim()
    )
      throw new BadRequestException(
        'Este tipo de archivo no admite un comentario.',
      );
    const texto = esPlantilla
      ? plantilla
        ? textoPlantilla(plantilla, dto.valores)
        : ''
      : esMedio
        ? dto.texto?.trim() ||
          (carga?.voz ? 'Nota de voz' : carga?.archivo.nombreOriginal) ||
          'Adjunto'
        : (dto.texto ?? '');
    const aviso = {
      tenantId: canal.tenantId,
      wabaId: canal.wabaId,
      phoneNumberId: canal.phoneNumberId,
    };
    const reservado = await this.db.$transaction(async (tx) => {
      // Mismo orden que almacenamiento y proyección: empresa, vínculo, intento.
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid AND "tenantId"=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
      await exigirAccesoConexionMeta(tx, auth, ip);
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'whatsapp_automatico',
      ]);
      const actual = await canalGeneralInbox(tx, auth.tenantId);
      if (
        !habilitado() ||
        !actual ||
        identidadCanalInbox(actual) !== dto.canalId
      )
        throw new ForbiddenException();
      const anterior = await tx.inboxEnvio.findFirst({
        where: { tenantId: auth.tenantId, clave: dto.clave },
      });
      if (anterior) {
        if (
          anterior.huella !== huella ||
          anterior.tipo !== tipoEnvio ||
          anterior.conversacionId !== conversacionId ||
          anterior.autorizacionId !== canal.autorizacionId ||
          anterior.vinculoId !== canal.id
        )
          throw new ConflictException(
            'Ese intento corresponde a otro mensaje.',
          );
        return {
          envio: anterior,
          token: null,
          telefono: null,
          contactoWaId: null,
        };
      }
      const v = await tx.metaVinculo.findFirstOrThrow({
        where: { id: canal.id, tenantId: auth.tenantId },
      });
      const c = await tx.inboxConversacion.findFirst({
        where: {
          id: conversacionId,
          tenantId: auth.tenantId,
          vinculoId: canal.id,
        },
      });
      if (!c)
        throw new NotFoundException('La conversación no está disponible.');
      if (!destinatarioCanalPermitido(v, c.contactoWaId))
        throw new ForbiddenException(
          'Ese destinatario no está habilitado para esta prueba.',
        );
      if (!/^[1-9]\d{7,14}$/.test(c.contactoWaId))
        throw new BadRequestException('El destinatario no es válido.');
      if (!esPlantilla && !(await consultarVentanaRespuesta(tx, v, c)).abierta)
        throw new ConflictException(
          'La ventana de atención está cerrada. Hace falta una plantilla aprobada.',
        );
      if (
        (await tx.inboxEnvio.count({
          where: {
            tenantId: auth.tenantId,
            usuarioId: auth.userId,
            createdAt: { gt: new Date(Date.now() - 60000) },
          },
        })) >= 20
      )
        throw new ConflictException(
          'Esperá un momento antes de enviar más mensajes.',
        );
      if (!this.secretos.disponible)
        throw new ServiceUnavailableException('La conexión necesita revisión.');
      let token: string;
      try {
        token = this.secretos.descifrar(v.tokenCifrado as SecretoCifrado);
      } catch {
        throw new ServiceUnavailableException('La conexión necesita revisión.');
      }
      if (esPlantilla && !plantilla)
        throw new ConflictException('Actualizá el catálogo antes de enviar.');
      const envio = await tx.inboxEnvio.create({
        data: {
          tenantId: auth.tenantId,
          vinculoId: canal.id,
          autorizacionId: canal.autorizacionId,
          conversacionId,
          usuarioId: auth.userId,
          clave: dto.clave,
          huella,
          texto,
          tipo: tipoEnvio,
        },
      });
      if (esMedio) {
        const f = await tx.inboxCarga.findFirst({
          where: {
            archivoId: dto.archivoId,
            tenantId: auth.tenantId,
            vinculoId: canal.id,
            autorizacionId: canal.autorizacionId,
            conversacionId,
            usuarioId: auth.userId,
            envioId: null,
          },
          include: { archivo: true },
        });
        if (
          !f ||
          f.archivo.estado !== 'PENDIENTE' ||
          !f.archivo.reservaHasta ||
          f.archivo.reservaHasta <= new Date()
        )
          throw new ConflictException('El archivo ya no está disponible.');
        await tx.inboxCarga.update({
          where: { archivoId: f.archivoId, tenantId: auth.tenantId },
          data: { envioId: envio.id },
        });
      }
      await registrarCambioInbox(tx, aviso);
      return {
        envio,
        token,
        contactoWaId: c.contactoWaId,
        // Sólo el canal de prueba usa un destino acreditado por el operador.
        // La identidad de la conversación y los estados conserva el wa_id.
        telefono:
          v.tipo === 'PRUEBA' ? v.pruebaDestinoE164 : `+${c.contactoWaId}`,
      };
    });
    this.bus.avisar(aviso);
    if (reservado.token && reservado.telefono) {
      let resultado: ResultadoMeta;
      const componentes =
        esPlantilla && plantilla
          ? componentesPlantilla(plantilla, dto.valores)
          : [];
      let preparacionFallida = false;
      let medio: {
        mediaId: string;
        tipo: string;
        nombreArchivo: string;
        voz: boolean;
      } | null = null;
      if (esMedio) {
        try {
          medio = await this.cargas.conContenido(
            auth,
            ip,
            conversacionId,
            dto.canalId,
            dto.archivoId,
            reservado.envio.id,
            async ({ bytes, mime, nombre, voz }) => {
              const mediaId = await this.client.subirArchivo({
                accessToken: reservado.token,
                phoneNumberId: canal.phoneNumberId,
                bytes,
                mime,
                nombre,
              });
              return {
                mediaId,
                tipo: FORMATOS_INBOX[mime].tipo,
                nombreArchivo: nombre,
                mime,
                voz,
                texto: dto.texto?.trim() || '',
              };
            },
          );
          await this.db.inboxEnvio.update({
            where: { id: reservado.envio.id, tenantId: auth.tenantId },
            data: { adjunto: medio },
          });
        } catch {
          preparacionFallida = true;
        }
      }
      if (esPlantilla && plantilla?.archivo && archivo) {
        try {
          const archivoTipo = plantilla.archivo;
          const adjunto = await this.archivos.conContenido(
            archivo,
            async (bytes, nombreArchivo) => {
              // La sesión, permisos, ficha y archivo se revisan también después de leer el storage.
              await this.archivos.validar(
                auth,
                ip,
                conversacionId,
                dto.canalId,
                dto.archivoId!,
                dto.archivoVersion!,
                archivoTipo,
              );
              const mediaId = await this.client.subirArchivo({
                accessToken: reservado.token,
                phoneNumberId: canal.phoneNumberId,
                bytes,
                mime: archivo.mimeType,
                nombre: nombreArchivo,
              });
              return {
                mediaId,
                nombreArchivo,
                mime: archivo.mimeType,
                tipo: archivoTipo,
                plantilla: true,
              };
            },
          );
          await this.archivos.validar(
            auth,
            ip,
            conversacionId,
            dto.canalId,
            dto.archivoId!,
            dto.archivoVersion!,
            archivoTipo,
          );
          // Persistir antes del POST permite reconstruir incluso si el webhook llega primero.
          await this.db.inboxEnvio.update({
            where: { id: reservado.envio.id, tenantId: auth.tenantId },
            data: { adjunto },
          });
          componentes.unshift({
            type: 'header',
            parameters:
              archivoTipo === 'image'
                ? [{ type: 'image', image: { id: adjunto.mediaId } }]
                : [
                    {
                      type: 'document',
                      document: {
                        id: adjunto.mediaId,
                        filename: adjunto.nombreArchivo,
                      },
                    },
                  ],
          });
        } catch {
          preparacionFallida = true;
        }
      }
      let accesoVigente = true;
      try {
        await exigirAccesoConexionMeta(this.db, auth, ip);
        await this.db.$transaction((tx) =>
          this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
            'whatsapp_automatico',
          ]),
        );
        const vigente = await canalGeneralInbox(this.db, auth.tenantId);
        accesoVigente = Boolean(
          habilitado() &&
          vigente &&
          identidadCanalInbox(vigente) === dto.canalId &&
          reservado.contactoWaId &&
          destinatarioCanalPermitido(vigente, reservado.contactoWaId) &&
          (vigente.tipo !== 'PRUEBA' ||
            vigente.pruebaDestinoE164 === reservado.telefono),
        );
        if (accesoVigente && !esPlantilla && vigente) {
          const conversacion = await this.db.inboxConversacion.findFirst({
            where: {
              id: conversacionId,
              tenantId: auth.tenantId,
              vinculoId: vigente.id,
            },
          });
          accesoVigente = (
            await consultarVentanaRespuesta(this.db, vigente, conversacion)
          ).abierta;
        }
      } catch {
        accesoVigente = false;
      }
      try {
        const base = {
          accessToken: reservado.token,
          phoneNumberId: canal.phoneNumberId,
          telefono: reservado.telefono,
          correlacion: `grafo-inbox:${reservado.envio.id}`,
        };
        resultado = preparacionFallida
          ? { estado: 'fallida', codigo: 'ARCHIVO_NO_PREPARADO' }
          : !accesoVigente
            ? { estado: 'fallida', codigo: 'CANAL_NO_VIGENTE' }
            : esPlantilla && plantilla
              ? await this.client.enviarPlantilla({
                  ...base,
                  plantilla: plantilla.nombre,
                  idioma: plantilla.idioma,
                  parametros: [],
                  componentes,
                })
              : esMedio && medio
                ? await this.client.enviarMedio({
                    ...base,
                    ...medio,
                    texto: dto.texto?.trim() || '',
                  })
                : await this.client.enviarTexto({ ...base, texto });
      } catch {
        resultado = { estado: 'incierta' };
      }
      // Se conserva el resultado incluso si se cerró la sesión durante el POST.
      // Ningún proceso reclama o repite estos envíos al reiniciar.
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
        // El worker recibe la copia de Meta. La carga temporal ya no reserva espacio.
        if (esMedio)
          await tx.archivo.updateMany({
            where: {
              id: dto.archivoId,
              tenantId: auth.tenantId,
              estado: 'PENDIENTE',
            },
            data: {
              estado: 'PURGANDO',
              bytesReservados: 0n,
              reservaHasta: new Date(Date.now() + 86400000),
            },
          });
        await tx.$queryRaw`SELECT id FROM "MetaVinculo" WHERE id=${canal.id}::uuid AND "tenantId"=${auth.tenantId}::uuid FOR NO KEY UPDATE`;
        const intento = await tx.inboxEnvio.findFirstOrThrow({
          where: { id: reservado.envio.id, tenantId: auth.tenantId },
        });
        if (intento.estado !== 'ENVIANDO') return; // El webhook pudo confirmar primero.
        const v = await tx.metaVinculo.findFirstOrThrow({
          where: { id: canal.id, tenantId: auth.tenantId },
        });
        if (
          resultado.estado === 'aceptada' &&
          v.autorizacionId === canal.autorizacionId
        ) {
          await confirmarEnvioInbox(tx, v, intento, resultado.wamid);
        } else {
          await tx.inboxEnvio.update({
            where: { id: intento.id },
            data: {
              estado:
                resultado.estado === 'fallida'
                  ? 'RECHAZADO'
                  : resultado.estado === 'aceptada'
                    ? 'ACEPTADO'
                    : 'INCIERTO',
              codigo: resultado.estado === 'fallida' ? resultado.codigo : null,
              ...(resultado.estado === 'aceptada'
                ? { wamid: resultado.wamid, texto: null }
                : {}),
            },
          });
        }
        await registrarCambioInbox(tx, aviso);
      });
      this.bus.avisar(aviso);
    }
    await exigirAccesoConexionMeta(this.db, auth, ip);
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const actual = await canalGeneralInbox(this.db, auth.tenantId);
    if (!habilitado() || !actual || identidadCanalInbox(actual) !== dto.canalId)
      throw new ForbiddenException();
    return presentarEnvio(
      await this.db.inboxEnvio.findFirstOrThrow({
        where: { id: reservado.envio.id, tenantId: auth.tenantId },
      }),
    );
  }
}
