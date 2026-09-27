import {
  enviosInboxHabilitados,
  plantillasInboxHabilitadas,
  presentarEnvio,
  consultarVentanaRespuesta,
} from './inbox/meta-envios.config';
import { adjuntosHabilitados, tiposMedia } from './inbox/meta-adjuntos';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import type { CurrentAuth } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappContextoService } from '../../clientes/whatsapp-contexto.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { exigirAccesoConexionMeta } from './meta-conexion-acceso';
import { canalGeneralInbox, identidadCanalInbox } from './meta-inbox-canal';
import { MetaInboxQueryDto } from './meta-inbox.dto';
import { objeto } from './inbox/meta-inbox-normalizar';

const selectMensaje = {
  adjunto: {
    select: {
      estado: true,
      mediaId: true,
      falloCodigo: true,
      updatedAt: true,
      archivo: {
        select: {
          nombreOriginal: true,
          mimeType: true,
          bytes: true,
          estado: true,
        },
      },
    },
  },
  id: true,
  direccion: true,
  enviadoEl: true,
  tipo: true,
  contenido: true,
  revocadoEl: true,
  edicionEl: true,
  estadoEntrega: true,
  delHistorial: true,
  delCelular: true,
} satisfies Prisma.InboxMensajeSelect;
type Mensaje = Prisma.InboxMensajeGetPayload<{ select: typeof selectMensaje }>;
/** Lista cerrada: jamás URLs remotas, media IDs, crudos ni credenciales. */
function presentar(m: Mensaje, nombre: string | null) {
  const contenido = objeto(m.contenido);
  return {
    id: m.id,
    nombreContacto: nombre,
    tipo: m.revocadoEl ? 'revocado' : (m.tipo ?? 'desconocido'),
    plantilla: !m.revocadoEl && contenido.plantilla === true,
    texto: m.revocadoEl
      ? null
      : typeof contenido.texto === 'string'
        ? contenido.texto
        : null,
    enviadoEl: m.enviadoEl!.toISOString(),
    direccion: m.direccion,
    eliminado: Boolean(m.revocadoEl),
    editado: Boolean(m.edicionEl),
    estadoEntrega: m.estadoEntrega,
    delHistorial: m.delHistorial,
    delCelular: m.delCelular,
    adjunto:
      !m.revocadoEl &&
      (tiposMedia.includes(m.tipo ?? '') || m.tipo === 'media_placeholder')
        ? {
            estado: !adjuntosHabilitados()
              ? 'DESHABILITADO'
              : !contenido.mediaId
                ? 'SIN_ARCHIVO'
                : m.adjunto?.mediaId !== contenido.mediaId
                  ? 'PENDIENTE'
                  : m.adjunto.estado === 'LISTO' &&
                      m.adjunto.archivo?.estado !== 'LISTO'
                    ? 'NO_DISPONIBLE'
                    : m.adjunto.estado,
            nombre:
              m.adjunto?.archivo?.nombreOriginal ??
              (typeof contenido.nombreArchivo === 'string'
                ? contenido.nombreArchivo.slice(0, 160)
                : null),
            mimeType: m.adjunto?.archivo?.mimeType ?? null,
            bytes: m.adjunto?.archivo ? Number(m.adjunto.archivo.bytes) : null,
            version: m.adjunto?.updatedAt.toISOString() ?? '',
            motivo:
              m.adjunto?.falloCodigo === 'CUPO_O_PLAN'
                ? 'ESPACIO_O_PLAN'
                : null,
          }
        : null,
  };
}
type Resumen = {
  id: string;
  contactoWaId: string;
  ultimoMensajeEl: Date;
  nombre: string | null;
};
type CursorLista = {
  id: string;
  fecha: string;
  busqueda: string;
  canal: string;
};
function leerCursor(
  value: string | undefined,
  canal: string,
  busqueda: string,
): CursorLista | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString(),
    );
    const c = objeto(data);
    if (
      typeof c.id !== 'string' ||
      !isUUID(c.id, '4') ||
      typeof c.fecha !== 'string' ||
      !Number.isFinite(Date.parse(c.fecha)) ||
      new Date(c.fecha).toISOString() !== c.fecha ||
      c.canal !== canal ||
      c.busqueda !== busqueda
    )
      throw new Error();
    return c as CursorLista;
  } catch {
    throw new BadRequestException(
      'La página de conversaciones ya no es válida. Actualizá la lista.',
    );
  }
}
@Injectable()
export class MetaInboxGeneralService {
  constructor(
    private readonly db: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
    private readonly clientes: WhatsappContextoService,
  ) {}
  async disponibilidad(auth: CurrentAuth, ip: string) {
    await exigirAccesoConexionMeta(this.db, auth, ip);
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (canal)
      await this.capacidades.exigirIncluida(
        auth.tenantId,
        'whatsapp_automatico',
      );
    return {
      empresaId: auth.tenantId,
      usuarioId: auth.userId,
      disponible: Boolean(canal),
    };
  }
  async consultar(auth: CurrentAuth, query: MetaInboxQueryDto, ip: string) {
    const permisosIniciales = await exigirAccesoConexionMeta(this.db, auth, ip);
    auth = {
      ...auth,
      permisos: new Set(
        [...permisosIniciales].filter((p) => auth.permisos?.has(p)),
      ),
    };
    const canal = await canalGeneralInbox(this.db, auth.tenantId);
    if (!canal) return null;
    await this.capacidades.exigirIncluida(auth.tenantId, 'whatsapp_automatico');
    const canalId = identidadCanalInbox(canal);
    const scope = { tenantId: auth.tenantId, vinculoId: canal.id };
    const destinatarioPrueba =
      canal.tipo === 'PRUEBA' ? canal.pruebaDestinatarioWaId : null;
    const scopeConversaciones = {
      ...scope,
      ...(destinatarioPrueba ? { contactoWaId: destinatarioPrueba } : {}),
    };
    const busqueda = (query.busqueda ?? '').trim().toLocaleLowerCase();
    const cursor = leerCursor(query.listaAntesDe, canalId, busqueda);
    if (
      cursor &&
      !(await this.db.inboxConversacion.findFirst({
        where: { ...scopeConversaciones, id: cursor.id },
        select: { id: true },
      }))
    )
      throw new NotFoundException(
        'La página de conversaciones ya no está disponible.',
      );
    // Fecha congelada en el cursor: una conversación puede moverse al recibir
    // mensajes. Volver a la primera página reconcilia ese movimiento.
    const patron = `%${busqueda.replace(/[\\%_]/g, '\\$&')}%`;
    const numeros = busqueda.replace(/[\s()+.-]/g, '');
    const porNumero = /^\d+$/.test(numeros) ? `%${numeros}%` : null;
    const lista = await this.db.$queryRaw<Resumen[]>`
      SELECT c.id,c."contactoWaId",COALESCE(c."ultimoMensajeEl",c."createdAt") AS "ultimoMensajeEl",CASE WHEN k.eliminado=false THEN k.nombre ELSE NULL END AS nombre
      FROM "InboxConversacion" c LEFT JOIN "InboxContacto" k ON k."tenantId"=c."tenantId" AND k."vinculoId"=c."vinculoId" AND k."waId"=c."contactoWaId"
      WHERE c."tenantId"=${auth.tenantId}::uuid AND c."vinculoId"=${canal.id}::uuid AND (c."ultimoMensajeEl" IS NOT NULL OR ${destinatarioPrueba}::text IS NOT NULL)
      AND (${destinatarioPrueba}::text IS NULL OR c."contactoWaId"=${destinatarioPrueba})
      AND (${busqueda}='' OR (k.eliminado=false AND k.nombre ILIKE ${patron}) OR (${porNumero}::text IS NOT NULL AND c."contactoWaId" LIKE ${porNumero}))
      ${cursor ? Prisma.sql`AND (COALESCE(c."ultimoMensajeEl",c."createdAt"),c.id)<(${new Date(cursor.fecha)},${cursor.id}::uuid)` : Prisma.empty}
      ORDER BY COALESCE(c."ultimoMensajeEl",c."createdAt") DESC,c.id DESC LIMIT 51`;
    const pagina = lista.slice(0, 50);
    const ids = pagina.map((c) => c.id);
    const recientes = await this.db.inboxConversacion.findMany({
      where: { ...scope, id: { in: ids } },
      select: {
        id: true,
        mensajes: {
          where: {
            ...scope,
            enviadoEl: { not: null },
            direccion: { in: ['ENTRANTE', 'SALIENTE'] },
          },
          orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }],
          take: 1,
          select: selectMensaje,
        },
      },
    });
    const seleccion = query.conversacionId ?? pagina[0]?.id;
    const conversacion = seleccion
      ? await this.db.inboxConversacion.findFirst({
          where: { ...scopeConversaciones, id: seleccion },
          select: { id: true, contactoWaId: true, ultimoEntranteNuevoEl: true },
        })
      : null;
    if (seleccion && !conversacion)
      throw new NotFoundException('La conversación ya no está disponible.');
    if ((query.antesDe || query.desdeId) && !query.conversacionId)
      throw new BadRequestException(
        'Elegí la conversación antes de consultar una página.',
      );
    if (query.antesDe && query.desdeId)
      throw new BadRequestException('Elegí una sola dirección de lectura.');
    const scopeMensajes = {
      ...scope,
      conversacionId:
        conversacion?.id ?? '00000000-0000-4000-8000-000000000000',
      enviadoEl: { not: null },
      direccion: { in: ['ENTRANTE', 'SALIENTE'] },
    };
    const anclaId = query.antesDe ?? query.desdeId;
    const ancla = anclaId
      ? await this.db.inboxMensaje.findFirst({
          where: { ...scopeMensajes, id: anclaId },
          select: { id: true, enviadoEl: true },
        })
      : null;
    if (anclaId && !ancla?.enviadoEl)
      throw new NotFoundException(
        'La página de mensajes ya no está disponible.',
      );
    const limite = query.desdeId ? 500 : 50;
    const mensajes = conversacion
      ? await this.db.inboxMensaje.findMany({
          where: {
            ...scopeMensajes,
            ...(ancla?.enviadoEl
              ? {
                  OR: query.antesDe
                    ? [
                        { enviadoEl: { lt: ancla.enviadoEl } },
                        { enviadoEl: ancla.enviadoEl, id: { lt: ancla.id } },
                      ]
                    : [
                        { enviadoEl: { gt: ancla.enviadoEl } },
                        { enviadoEl: ancla.enviadoEl, id: { gte: ancla.id } },
                      ],
                }
              : {}),
          },
          orderBy: [{ enviadoEl: 'desc' }, { id: 'desc' }],
          take: limite + 1,
          select: selectMensaje,
        })
      : [];
    const visibles = mensajes.slice(0, limite);
    const contacto = conversacion
      ? await this.db.inboxContacto.findFirst({
          where: {
            ...scope,
            waId: conversacion.contactoWaId,
            eliminado: false,
          },
          select: { nombre: true },
        })
      : null;
    if (query.clienteId && !auth.permisos?.has('crm.ver'))
      throw new ForbiddenException();
    const contexto =
      conversacion && auth.permisos?.has('crm.ver')
        ? await this.clientes.contexto(auth, {
            telefono: `+${conversacion.contactoWaId}`,
            clienteId: query.clienteId,
          })
        : null;
    const menor = visibles.at(-1);
    const anteriores =
      menor?.enviadoEl && query.desdeId
        ? await this.db.inboxMensaje.findFirst({
            where: {
              ...scopeMensajes,
              OR: [
                { enviadoEl: { lt: menor.enviadoEl } },
                { enviadoEl: menor.enviadoEl, id: { lt: menor.id } },
              ],
            },
            select: { id: true },
          })
        : null;
    const envios = conversacion
      ? await this.db.inboxEnvio.findMany({
          where: {
            ...scope,
            autorizacionId: canal.autorizacionId,
            conversacionId: conversacion.id,
            mensajeId: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];
    const ventana = await consultarVentanaRespuesta(
      this.db,
      canal,
      conversacion,
    );
    // Una revocación o reconexión durante la lectura no entrega el resultado anterior.
    const permisosFinales = await exigirAccesoConexionMeta(this.db, auth, ip);
    if (
      [...permisosIniciales].sort().join('|') !==
      [...permisosFinales].sort().join('|')
    )
      throw new ForbiddenException();
    const actual = await canalGeneralInbox(this.db, auth.tenantId);
    if (!actual || identidadCanalInbox(actual) !== canalId)
      throw new ForbiddenException();
    const ultima = pagina.at(-1);
    return {
      empresaId: auth.tenantId,
      usuarioId: auth.userId,
      canalId,
      origen: 'GENERAL' as const,
      prueba:
        canal.tipo === 'PRUEBA'
          ? { numero: canal.numero, venceEl: canal.tokenVenceEl!.toISOString() }
          : null,
      respuesta: {
        plantillasHabilitadas: plantillasInboxHabilitadas(
          auth.tenantId,
          canal.tipo,
        ),
        habilitado: enviosInboxHabilitados(auth.tenantId, canal.tipo),
        ...ventana,
      },
      envios: envios.reverse().map(presentarEnvio),
      conversacionId: conversacion?.id ?? null,
      contacto: {
        telefono: conversacion ? `+${conversacion.contactoWaId}` : '',
        nombre: contacto?.nombre ?? null,
      },
      conversaciones: pagina.map((c) => ({
        id: c.id,
        telefono: `+${c.contactoWaId}`,
        nombre: c.nombre,
        ultimoMensaje: recientes.find((r) => r.id === c.id)?.mensajes[0]
          ? presentar(
              recientes.find((r) => r.id === c.id)!.mensajes[0],
              c.nombre,
            )
          : null,
      })),
      listaAnterior:
        lista.length > 50 && ultima
          ? Buffer.from(
              JSON.stringify({
                id: ultima.id,
                fecha: ultima.ultimoMensajeEl.toISOString(),
                busqueda,
                canal: canalId,
              } satisfies CursorLista),
            ).toString('base64url')
          : null,
      mensajes: visibles
        .reverse()
        .map((m) => presentar(m, contacto?.nombre ?? null)),
      // DesdeId refresca TODOS los mensajes ya visibles, incluidas ediciones y
      // eliminaciones antiguas. Si la ventana creció demasiado se indica el corte.
      anterior:
        mensajes.length > limite
          ? (visibles[0]?.id ?? null)
          : anteriores
            ? (visibles[0]?.id ?? null)
            : null,
      ventanaAcotada: Boolean(query.desdeId && mensajes.length > limite),
      contexto,
    };
  }
}
