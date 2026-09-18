import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { prepararPaginaCad } from './pdf-cad';
import { esConfiguracionCad } from './cad.domain';
import { resolverRangoPaginas } from '../common/rangos-paginas';
import {
  orientacionPaginaPdf,
  resumirOrientaciones,
  type OrientacionPagina,
} from '../common/orientacion-pdf';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import { ImpresionService } from './impresion.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import { resolverPerfil, revisionPerfil } from './perfiles-impresion.domain';
import {
  disponibilidadCola,
  pasoColaSelect,
} from '../produccion/colas/colas.service';
import { leerAprobacionesPendientes } from '../produccion/aprobaciones-pendientes';
import {
  objeto,
  planDocumento,
  siguienteEstado,
  type EstadoImpresion,
} from './documentos-orden.domain';

const TIPO = 'impresion_documento';
const COLA = 'cola_impresion';
const MAX_BYTES = 25 * 1024 * 1024;

@Injectable()
export class DocumentosOrdenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly archivos: ArchivosService,
    private readonly impresion: ImpresionService,
    private readonly perfiles: PerfilesImpresionService,
  ) {}

  private esTrabajo(datos: unknown, itemId: string, pagina = 0) {
    const d = objeto(datos);
    return d.itemId === itemId && Number(d.pagina ?? 0) === pagina;
  }
  private filtroTrabajo(
    itemId: string,
    pagina = 0,
  ): Prisma.OrdenTrabajoEventoWhereInput[] {
    return [
      { datosJson: { path: ['itemId'], equals: itemId } },
      ...(pagina ? [{ datosJson: { path: ['pagina'], equals: pagina } }] : []),
    ];
  }

  private async orden(
    auth: CurrentAuth,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const orden = await db.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        estado: true,
        updatedAt: true,
        items: {
          where: { parentItemId: null },
          orderBy: { ordenIndice: 'asc' },
          select: {
            id: true,
            nombre: true,
            contieneLotesEntrega: true,
            jobContextSnapshotJson: true,
            cotizacionItem: { select: { jobContextJson: true } },
            pasos: { select: pasoColaSelect },
            archivos: {
              where: {
                tenantId: auth.tenantId,
                estado: 'LISTO',
                eliminadoEl: null,
                autogeneradoPor: 'centro-copiado',
              },
              select: {
                id: true,
                nombreOriginal: true,
                mimeType: true,
                bytes: true,
                key: true,
              },
            },
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada.');
    return orden;
  }

  private documentos(
    orden: Awaited<ReturnType<DocumentosOrdenService['orden']>>,
  ) {
    return orden.items.flatMap((item) => {
      const plan = planDocumento(
        item.jobContextSnapshotJson ?? item.cotizacionItem?.jobContextJson,
      );
      if (!plan) return [];
      let motivo = plan.motivo;
      const archivos = plan.segmentos.map((s) => {
        const coincidencias = item.archivos.filter(
          (a) => a.nombreOriginal === s.nombre,
        );
        // Un documento suelto puede tener un nombre comercial distinto al PDF.
        return coincidencias.length === 1
          ? coincidencias[0]
          : plan.segmentos.length === 1 && item.archivos.length === 1
            ? item.archivos[0]
            : null;
      });
      if (
        !motivo &&
        (archivos.some((a) => !a || a.mimeType !== 'application/pdf') ||
          new Set(archivos.map((a) => a?.id)).size !== archivos.length)
      )
        motivo =
          'Falta un PDF confirmado o no se puede identificar cada original. Revisá los archivos del centro de copiado.';
      if (
        !motivo &&
        archivos.reduce((sum, a) => sum + Number(a?.bytes ?? 0), 0) > MAX_BYTES
      )
        motivo =
          'La impresión directa admite hasta 25 MB por documento o tomo.';
      if (!motivo && item.contieneLotesEntrega)
        motivo =
          'Este producto está distribuido en entregas; requiere impresión manual por lote.';
      const paginas = plan.paginasCad?.length ? plan.paginasCad : [null];
      return paginas.map((paginaCad) => ({
        ...plan,
        paginaCad,
        trabajoId: `${item.id}:${paginaCad?.pagina ?? 0}`,
        ...(paginaCad
          ? {
              nombre: `${plan.nombre} · Pág. ${paginaCad.pagina}`,
              copias: paginaCad.copias,
              paginas: 1,
              hojas: paginaCad.copias,
            }
          : {}),
        itemId: item.id,
        motivo,
        archivos,
        pasos: item.pasos.filter((p) =>
          p.familiaCodigo?.startsWith('impresion_'),
        ),
      }));
    });
  }

  private async rutear(
    auth: CurrentAuth,
    orden: Awaited<ReturnType<DocumentosOrdenService['orden']>>,
    db: Prisma.TransactionClient = this.prisma,
    reimpresiones: string[] = [],
  ) {
    const documentos = this.documentos(orden);
    const [perfiles, maquinas, papeles, aprobaciones, liberaciones] =
      await Promise.all([
        this.perfiles.perfiles(auth.tenantId, db),
        db.maquina.findMany({
          where: { tenantId: auth.tenantId },
          select: {
            id: true,
            activo: true,
            estado: true,
            estacion: { select: { activo: true } },
          },
        }),
        db.materiaPrima.findMany({
          where: {
            tenantId: auth.tenantId,
            id: {
              in: documentos
                .map((d) => d.configuracion.papelMateriaPrimaId)
                .filter(Boolean),
            },
          },
          select: { id: true, nombre: true, activo: true },
        }),
        leerAprobacionesPendientes(
          db,
          auth.tenantId,
          documentos.flatMap((d) => d.pasos),
        ),
        db.ordenTrabajoEvento.findMany({
          where: { tenantId: auth.tenantId, ordenId: orden.id, tipo: COLA },
          select: { datosJson: true },
        }),
      ]);
    return documentos.map((doc) => {
      const papel = papeles.find(
        (p) => p.id === doc.configuracion.papelMateriaPrimaId,
      );
      const configuracion = {
        ...doc.configuracion,
        papelNombre: papel?.nombre ?? doc.configuracion.papelNombre,
      };
      const ruta = resolverPerfil(
        configuracion,
        perfiles,
        doc.pasos.flatMap((p) => (p.maquinaId ? [p.maquinaId] : [])),
      );
      const liberacion = liberaciones.find(
        (e) => objeto(e.datosJson).trabajoId === doc.trabajoId,
      );
      const autorizado = objeto(objeto(liberacion?.datosJson).preparacion);
      if (
        ruta.estado === 'PREPARACION' &&
        ruta.perfil &&
        autorizado.revision === revisionPerfil(ruta.perfil) &&
        autorizado.perfilId === ruta.perfil.id
      ) {
        ruta.estado = 'LISTO';
        ruta.motivo = null;
      }
      let motivo = doc.motivo;
      if (!motivo && !papel?.activo)
        motivo = 'El papel necesita revisión en el inventario.';
      if (!motivo && doc.pasos.length !== 1)
        motivo =
          'No se pudo identificar un único paso de impresión para este documento.';
      const paso = doc.pasos[0];
      if (!motivo && paso) {
        const maquina = maquinas.find((m) => m.id === paso.maquinaId);
        const disponibilidad = disponibilidadCola(
          paso,
          aprobaciones.get(paso.id) ?? [],
          !!maquina?.activo &&
            maquina.estado === 'ACTIVA' &&
            !!maquina.estacion?.activo,
        );
        if (paso.tipoEjecucion !== 'interno')
          motivo = 'La impresión de este trabajo está tercerizada.';
        else if (disponibilidad.motivos.length)
          motivo = disponibilidad.motivos.join(' ');
        else if (
          !['listos', 'en_curso'].includes(disponibilidad.estadoCola) &&
          !(reimpresiones.includes(doc.itemId) && paso.estado === 'hecho')
        )
          motivo =
            'El paso de impresión todavía no está disponible para ejecutar.';
      }
      return {
        ...doc,
        configuracion,
        ruta: motivo ? { ...ruta, estado: 'REVISAR' as const, motivo } : ruta,
        motivo: motivo ?? ruta.motivo,
      };
    });
  }

  async vista(auth: CurrentAuth, id: string) {
    const orden = await this.orden(auth, id);
    const historial = await this.prisma.ordenTrabajoEvento.findMany({
      where: { tenantId: auth.tenantId, ordenId: id, tipo: TIPO },
      orderBy: { fecha: 'desc' },
      take: 100,
      select: { id: true, fecha: true, usuarioNombre: true, datosJson: true },
    });
    // Aunque el historial sea largo, ningún documento ya enviado debe aparecer
    // como nuevo por haber quedado fuera de la ventana de los últimos 100.
    if (historial.length === 100) {
      const faltantes = this.documentos(orden).filter(
        (d) =>
          !historial.some((e) =>
            this.esTrabajo(e.datosJson, d.itemId, d.paginaCad?.pagina),
          ),
      );
      const ultimos = await Promise.all(
        faltantes.map((d) =>
          this.prisma.ordenTrabajoEvento.findFirst({
            where: {
              tenantId: auth.tenantId,
              ordenId: id,
              tipo: TIPO,
              AND: this.filtroTrabajo(d.itemId, d.paginaCad?.pagina),
            },
            orderBy: { fecha: 'desc' },
            select: {
              id: true,
              fecha: true,
              usuarioNombre: true,
              datosJson: true,
            },
          }),
        ),
      );
      for (const ultimo of ultimos) if (ultimo) historial.push(ultimo);
    }
    const documentos = await this.rutear(
      auth,
      orden,
      this.prisma,
      historial.map((e) => String(objeto(e.datosJson).itemId)),
    );
    return {
      ordenId: id,
      numero: orden.numero,
      estado: orden.estado,
      documentos: documentos.map(
        ({ archivos, segmentos, pasos, paginasCad: _paginasCad, ...doc }) => ({
          ...doc,
          pasoId: pasos[0]?.id ?? null,
          fechaEntrega:
            (
              pasos[0]?.item.fechaEntrega ?? pasos[0]?.orden?.fechaEntrega
            )?.toISOString() ?? null,
          archivos: archivos.filter((a) => a !== null).map((a) => a.id),
          documentos: segmentos.length,
          seleccionPaginas: segmentos
            .filter((s) => s.rangoPaginas)
            .map((s) => ({
              nombre: s.nombre,
              rango: s.rangoPaginas!,
              paginasOriginales: s.paginasOriginales!,
            })),
        }),
      ),
      historial: historial.map((e) => ({
        ...objeto(e.datosJson),
        id: e.id,
        fecha: e.fecha.toISOString(),
        usuario: e.usuarioNombre,
      })),
    };
  }

  async preparar(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    intentoId: string,
    impresora: string,
    host: string,
    reimpresionDe?: string,
    perfilId?: string,
    perfilRevision?: string,
    pagina = 0,
  ) {
    const orden = await this.orden(auth, ordenId);
    if (['borrador', 'cancelada'].includes(orden.estado))
      throw new BadRequestException('Primero emití la orden.');
    const doc = (
      await this.rutear(auth, orden, this.prisma, reimpresionDe ? [itemId] : [])
    ).find((d) => d.itemId === itemId && (d.paginaCad?.pagina ?? 0) === pagina);
    if (!doc || doc.motivo)
      throw new BadRequestException(doc?.motivo ?? 'Documento no imprimible.');
    const perfil = doc.ruta.perfil;
    if (
      !perfil ||
      doc.ruta.estado !== 'LISTO' ||
      perfil.id !== perfilId ||
      revisionPerfil(perfil) !== perfilRevision
    )
      throw new ConflictException(
        'El perfil o la preparación cambió. Actualizá el resumen antes de imprimir.',
      );
    if (
      perfil.bandeja.destino.host !== host ||
      perfil.bandeja.destino.impresora !== impresora
    )
      throw new BadRequestException(
        'El destino no coincide con el perfil de impresión.',
      );

    let salidaCad: Awaited<ReturnType<typeof prepararPaginaCad>> | null = null;
    const unido = await PDFDocument.create();
    const extraerPaginas =
      doc.archivos.length > 1 || doc.segmentos.some((s) => !!s.rangoPaginas);
    let originalBytes: Buffer | null = null;
    const orientacionesPaginas: OrientacionPagina[] = [];
    for (const [i, archivo] of doc.archivos.entries()) {
      if (!archivo) throw new BadRequestException('Falta el archivo original.');
      const bytes = await this.archivos.leerContenido(archivo.key);
      if (!bytes || bytes.length !== Number(archivo.bytes))
        throw new BadRequestException('El PDF no está disponible.');
      if (doc.archivos.length === 1) originalBytes = bytes;
      let pdf: PDFDocument;
      try {
        pdf = await PDFDocument.load(bytes);
      } catch {
        throw new BadRequestException(
          'No se pudo leer el PDF. Revisá que sea válido y no tenga contraseña.',
        );
      }
      const segmento = doc.segmentos[i];
      if (
        pdf.getPageCount() !== (segmento.paginasOriginales ?? segmento.paginas)
      )
        throw new BadRequestException(
          `Las páginas de ${archivo.nombreOriginal} no coinciden con las cotizadas. Volvé a cotizar el documento.`,
        );
      if (doc.paginaCad) {
        if (!esConfiguracionCad(perfil.bandeja.destino.cad))
          throw new BadRequestException('Revisá la configuración CAD.');
        try {
          salidaCad = await prepararPaginaCad(
            pdf,
            doc.paginaCad.pagina,
            doc.paginaCad,
            perfil.bandeja.destino.cad,
          );
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error
              ? error.message
              : 'No se pudo preparar el plano.',
          );
        }
        continue;
      }
      const seleccion = resolverRangoPaginas(
        segmento.rangoPaginas ?? '',
        pdf.getPageCount(),
      );
      if (seleccion.error || seleccion.paginas !== segmento.paginas)
        throw new BadRequestException(
          'El rango no coincide con las páginas cotizadas. Volvé a cotizar el documento.',
        );
      const indices = seleccion.intervalos.flatMap(([desde, hasta]) =>
        Array.from({ length: hasta - desde + 1 }, (_, n) => desde - 1 + n),
      );
      // Se verifica el PDF real incluso en órdenes históricas sin orientación.
      const orientaciones = indices.map((indice) =>
        orientacionPaginaPdf(pdf.getPage(indice)),
      );
      orientacionesPaginas.push(...orientaciones);
      if (extraerPaginas) {
        const paginas = await unido.copyPages(pdf, indices);
        paginas.forEach((p) => unido.addPage(p));
        // Cada original empieza en un frente y cada juego mantiene su orden.
        if (doc.archivos.length > 1 && doc.faz === 2 && seleccion.paginas % 2)
          unido.addPage(
            orientaciones.at(-1) === 'horizontal'
              ? [841.89, 595.276]
              : [595.276, 841.89],
          );
      }
    }
    const contenido = salidaCad
      ? salidaCad.pdf
      : extraerPaginas
        ? Buffer.from(await unido.save())
        : originalBytes;
    if (!contenido) throw new BadRequestException('El PDF no está disponible.');
    const jobName = `Grafo ${orden.numero} ${intentoId}`;
    const params = {
      printer: { name: impresora },
      options: {
        copies: doc.copias,
        jobName,
        units: 'mm',
        size: salidaCad
          ? {
              width: salidaCad.plan.anchoSalidaMm,
              height: salidaCad.plan.largoSalidaMm,
              custom: true,
            }
          : { width: 210, height: 297 },
        colorType: doc.configuracion.color === 'COLOR' ? 'color' : 'grayscale',
        duplex: doc.faz === 2 ? 'long-edge' : 'one-sided',
        ...(salidaCad && esConfiguracionCad(perfil.bandeja.destino.cad)
          ? perfil.bandeja.destino.cad.usarOrigenPredeterminado
            ? {}
            : { printerTray: perfil.bandeja.destino.cad.origenPapel }
          : { printerTray: perfil.bandeja.codigo }),
        // QZ orienta cada página según su CropBox y /Rotate. Un único envío
        // conserva el orden y los frentes/dorsos incluso en archivos mixtos.
        orientation: salidaCad ? 'portrait' : null,
        scaleContent: !salidaCad,
        ...(salidaCad ? { margins: 0, rotation: 0 } : {}),
        rasterize: false,
      },
      data: [
        {
          type: 'pixel',
          format: 'pdf',
          flavor: 'base64',
          data: contenido.toString('base64'),
        },
      ],
    };
    // Validar la firma antes de reservar; una configuración rota no crea un envío.
    const firma = this.impresion.firmarDocumento(params);
    const datos = {
      itemId,
      trabajoId: doc.trabajoId,
      pagina,
      ...(salidaCad ? { planCad: salidaCad.plan } : {}),
      nombre: doc.nombre,
      copias: doc.copias,
      paginas: doc.paginas,
      hojas: doc.hojas,
      faz: doc.faz,
      orientacion: resumirOrientaciones(orientacionesPaginas),
      orientacionesPaginas,
      archivos: doc.archivos.map((a) => a!.id),
      seleccionPaginas: doc.segmentos
        .filter((s) => s.rangoPaginas)
        .map((s) => ({
          nombre: s.nombre,
          rango: s.rangoPaginas!,
          paginasOriginales: s.paginasOriginales!,
        })),
      host,
      impresora,
      pasoId: doc.pasos[0].id,
      perfilSnapshot: JSON.parse(
        JSON.stringify(perfil),
      ) as Prisma.InputJsonValue,
      configuracion: doc.configuracion,
      jobName,
      estado: 'PREPARADO',
      actualizadoEl: new Date().toISOString(),
      reimpresionDe: reimpresionDe ?? null,
      eventos: [] as Array<{ estado: string; fecha: string; detalle: string }>,
    };
    await this.prisma.$transaction(async (tx) => {
      // Serializa envíos de una misma OT incluso desde dos pestañas/usuarios.
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const actual = await tx.ordenTrabajo.findFirst({
        where: { id: ordenId, tenantId: auth.tenantId },
        select: { estado: true, updatedAt: true },
      });
      if (!actual || ['borrador', 'cancelada'].includes(actual.estado))
        throw new ConflictException(
          'La orden ya no está disponible para imprimir.',
        );
      if (actual.updatedAt.getTime() !== orden.updatedAt.getTime())
        throw new ConflictException(
          'La orden cambió mientras preparábamos el PDF. Actualizá el panel.',
        );
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${perfil.bandeja.destino.id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const documentoActual = (
        await this.rutear(
          auth,
          await this.orden(auth, ordenId, tx),
          tx,
          reimpresionDe ? [itemId] : [],
        )
      ).find(
        (d) => d.itemId === itemId && (d.paginaCad?.pagina ?? 0) === pagina,
      );
      const vigente = documentoActual?.ruta.perfil;
      if (
        !vigente ||
        vigente.id !== perfil.id ||
        revisionPerfil(vigente) !== perfilRevision ||
        documentoActual?.ruta.estado !== 'LISTO'
      )
        throw new ConflictException(
          'La configuración o la carga de papel cambió. Actualizá antes de enviar.',
        );
      await this.validarTurno(
        auth,
        tx,
        doc.trabajoId,
        perfil.bandeja.destino.maquinaId,
        !!reimpresionDe,
      );
      const previo = await tx.ordenTrabajoEvento.findFirst({
        where: {
          ordenId,
          tenantId: auth.tenantId,
          tipo: TIPO,
          AND: this.filtroTrabajo(itemId, pagina),
        },
        orderBy: { fecha: 'desc' },
        select: { id: true },
      });
      const repetido = await tx.ordenTrabajoEvento.findFirst({
        where: { id: intentoId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (repetido || (previo?.id ?? null) !== (reimpresionDe ?? null))
        throw new ConflictException(
          'Este documento ya tiene un envío. Actualizá el panel y revisá la cola antes de reimprimir.',
        );
      await tx.ordenTrabajoEvento.create({
        data: {
          id: intentoId,
          tenantId: auth.tenantId,
          ordenId,
          tipo: TIPO,
          descripcion: `${reimpresionDe ? 'Reimpresión' : 'Impresión'} de ${doc.nombre} · ${doc.copias} copia(s) · ${impresora}`,
          usuarioId: auth.userId,
          usuarioNombre: auth.impersonacion?.actorNombre ?? auth.email,
          datosJson: datos as Prisma.InputJsonValue,
        },
      });
      await this.actualizarCola(auth, tx, ordenId, doc.trabajoId, {
        estado: 'PREPARADO',
        intentoId,
      });
    });
    return {
      ...firma,
      params,
      totalPaginas: doc.paginas,
      intento: {
        ...datos,
        id: intentoId,
        fecha: new Date().toISOString(),
        usuario: auth.email,
      },
    };
  }

  /** Intenciones pequeñas y durables; los PDF permanecen en almacenamiento de archivos. */
  async solicitar(auth: CurrentAuth, ordenId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const orden = await this.orden(auth, ordenId, tx);
      if (['borrador', 'cancelada'].includes(orden.estado))
        throw new BadRequestException('Primero emití la orden.');
      const docs = this.documentos(orden);
      const actuales = await tx.ordenTrabajoEvento.findMany({
        where: { tenantId: auth.tenantId, ordenId, tipo: COLA },
        select: { datosJson: true },
      });
      const faltantes = docs.filter(
        (d) =>
          !actuales.some((e) => objeto(e.datosJson).trabajoId === d.trabajoId),
      );
      const envios = await tx.ordenTrabajoEvento.findMany({
        where: { tenantId: auth.tenantId, ordenId, tipo: TIPO },
        orderBy: { fecha: 'desc' },
        select: { id: true, datosJson: true },
      });
      if (faltantes.length)
        await tx.ordenTrabajoEvento.createMany({
          data: faltantes.map((d) => {
            const previo = envios.find((e) =>
              this.esTrabajo(e.datosJson, d.itemId, d.paginaCad?.pagina),
            );
            const datos = objeto(previo?.datosJson);
            return {
              tenantId: auth.tenantId,
              ordenId,
              tipo: COLA,
              descripcion: `En cola de impresión: ${d.nombre}`,
              usuarioId: auth.userId,
              usuarioNombre: auth.email,
              datosJson: {
                trabajoId: d.trabajoId,
                itemId: d.itemId,
                pagina: d.paginaCad?.pagina ?? 0,
                maquinaId: d.pasos[0]?.maquinaId ?? null,
                pasoId: d.pasos[0]?.id ?? d.itemId,
                fechaEntrega:
                  (
                    d.pasos[0]?.item.fechaEntrega ??
                    d.pasos[0]?.orden?.fechaEntrega
                  )?.toISOString() ?? '9999',
                numero: orden.numero,
                estado: datos.confirmacion
                  ? 'VERIFICADO'
                  : String(datos.estado ?? 'PENDIENTE'),
                intentoId: previo?.id ?? null,
              },
            };
          }),
        });
    });
    return this.vista(auth, ordenId);
  }

  async cola(auth: CurrentAuth, desde = 0) {
    const where: Prisma.OrdenTrabajoEventoWhereInput = {
      tenantId: auth.tenantId,
      tipo: COLA,
      NOT: { datosJson: { path: ['estado'], equals: 'VERIFICADO' } },
      orden: { estado: { notIn: ['borrador', 'cancelada'] } },
    };
    const [eventos, total] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ ordenId: string; datosJson: Prisma.JsonValue }>
      >`
        SELECT e."ordenId", e."datosJson" FROM "OrdenTrabajoEvento" e
        JOIN "OrdenTrabajo" o ON o.id = e."ordenId" AND o."tenantId" = e."tenantId"
        LEFT JOIN "OrdenTrabajoItem" i ON i.id::text = e."datosJson"->>'itemId' AND i."tenantId" = e."tenantId"
        WHERE e."tenantId" = ${auth.tenantId}::uuid AND e.tipo = 'cola_impresion'
          AND e."datosJson"->>'estado' <> 'VERIFICADO' AND o.estado NOT IN ('borrador', 'cancelada')
        ORDER BY COALESCE(i."fechaEntrega", o."fechaEntrega") ASC NULLS LAST, o.numero,
          e."datosJson"->>'pasoId', (e."datosJson"->>'pagina')::integer, e.id
        LIMIT 100 OFFSET ${desde}`,

      this.prisma.ordenTrabajoEvento.count({ where }),
    ]);
    const vistas = [] as Awaited<ReturnType<DocumentosOrdenService['vista']>>[];
    // Carga secuencial acotada: no cientos de consultas/PDF en paralelo.
    for (const id of [...new Set(eventos.map((e) => e.ordenId))]) {
      const v = await this.vista(auth, id);
      const claves = new Set(
        eventos
          .filter((e) => e.ordenId === id)
          .map((e) => String(objeto(e.datosJson).trabajoId)),
      );
      vistas.push({
        ...v,
        documentos: v.documentos.filter((d) => claves.has(d.trabajoId)),
      });
    }
    return {
      vistas,
      total,
      siguiente: desde + eventos.length < total ? desde + eventos.length : null,
    };
  }

  private async actualizarCola(
    auth: CurrentAuth,
    tx: Prisma.TransactionClient,
    ordenId: string,
    trabajoId: string,
    cambio: Record<string, unknown>,
    intentoId?: string,
  ) {
    const fila = await tx.ordenTrabajoEvento.findFirst({
      where: {
        tenantId: auth.tenantId,
        ordenId,
        tipo: COLA,
        datosJson: { path: ['trabajoId'], equals: trabajoId },
      },
    });
    if (!fila) return; // Compatibilidad con envíos anteriores a la cola persistente.
    const datos = objeto(fila.datosJson);
    if (datos.trabajoId !== trabajoId) return;
    if (intentoId && datos.intentoId !== intentoId) return; // Evento tardío de una reimpresión anterior.
    await tx.ordenTrabajoEvento.update({
      where: { id: fila.id },
      data: { datosJson: { ...datos, ...cambio } as Prisma.InputJsonValue },
    });
  }

  private async validarTurno(
    auth: CurrentAuth,
    tx: Prisma.TransactionClient,
    trabajoId: string,
    maquinaId: string,
    reimpresion: boolean,
  ) {
    const filas = await tx.ordenTrabajoEvento.findMany({
      where: {
        tenantId: auth.tenantId,
        tipo: COLA,
        AND: [
          { datosJson: { path: ['maquinaId'], equals: maquinaId } },
          {
            OR: [
              'PENDIENTE',
              'PREPARADO',
              'SIN_CONFIRMAR',
              'ERROR',
              'PAUSED',
              'ABORTED',
              'CANCELED',
              'DELETED',
            ].map((estado) => ({
              datosJson: { path: ['estado'], equals: estado },
            })),
          },
        ],
        orden: { estado: { notIn: ['borrador', 'cancelada'] } },
      },
      select: {
        datosJson: true,
        orden: {
          select: {
            fechaEntrega: true,
            items: { select: { id: true, fechaEntrega: true } },
          },
        },
      },
    });
    const pendientes = filas
      .map((e) => {
        const d = objeto(e.datosJson);
        return {
          ...d,
          fechaEntrega:
            (
              e.orden.items.find((i) => i.id === d.itemId)?.fechaEntrega ??
              e.orden.fechaEntrega
            )?.toISOString() ?? '9999',
        } as Record<string, unknown>;
      })
      .sort(
        (a, b) =>
          String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)) ||
          String(a.numero).localeCompare(String(b.numero)) ||
          String(a.pasoId ?? a.itemId).localeCompare(
            String(b.pasoId ?? b.itemId),
          ) ||
          Number(a.pagina) - Number(b.pagina),
      );
    const incierto = pendientes.find(
      (d) => d.trabajoId !== trabajoId && d.estado !== 'PENDIENTE',
    );
    if (incierto)
      throw new ConflictException(
        'Esta máquina tiene un envío por revisar. Verificá su cola antes de continuar.',
      );
    if (!reimpresion && pendientes[0] && pendientes[0].trabajoId !== trabajoId)
      throw new ConflictException(
        'Hay un trabajo anterior en esta máquina. Preparalo o revisalo antes de continuar.',
      );
  }

  async liberar(
    auth: CurrentAuth,
    ordenId: string,
    trabajos: string[],
    perfilId: string,
    revision: string,
  ) {
    return this.liberarLote(auth, [{ ordenId, trabajos }], perfilId, revision);
  }

  async liberarLote(
    auth: CurrentAuth,
    grupos: { ordenId: string; trabajos: string[] }[],
    perfilId: string,
    revision: string,
  ) {
    const ids = [...new Set(grupos.map((g) => g.ordenId))].sort();
    for (const id of ids) await this.solicitar(auth, id);
    return this.prisma.$transaction(async (tx) => {
      // Mismo orden de bloqueo que reserva/confirmación, también entre varias OT.
      for (const id of ids)
        await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const perfil = (await this.perfiles.perfiles(auth.tenantId, tx)).find(
        (p) => p.id === perfilId,
      );
      if (!perfil || revisionPerfil(perfil) !== revision)
        throw new ConflictException('El perfil cambió. Actualizá la cola.');
      await tx.$queryRaw`SELECT id FROM "ImpresionDestino" WHERE id = ${perfil.bandeja.destino.id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      for (const grupo of grupos) {
        const docs = await this.rutear(
          auth,
          await this.orden(auth, grupo.ordenId, tx),
          tx,
        );
        const elegidos = docs.filter((d) =>
          grupo.trabajos.includes(d.trabajoId),
        );
        if (
          !elegidos.length ||
          elegidos.length !== grupo.trabajos.length ||
          elegidos.some(
            (d) =>
              d.ruta.perfil?.id !== perfilId ||
              d.ruta.estado === 'REVISAR' ||
              revisionPerfil(d.ruta.perfil) !== revision,
          )
        )
          throw new ConflictException(
            'Revisá los trabajos seleccionados y su disponibilidad.',
          );
        const filas = await tx.ordenTrabajoEvento.findMany({
          where: {
            tenantId: auth.tenantId,
            ordenId: grupo.ordenId,
            tipo: COLA,
          },
          select: { datosJson: true },
        });
        if (
          filas.some(
            (e) =>
              grupo.trabajos.includes(String(objeto(e.datosJson).trabajoId)) &&
              objeto(e.datosJson).intentoId,
          )
        )
          throw new ConflictException(
            'Un trabajo seleccionado ya tiene un envío. Revisá su impresión.',
          );
      }
      const bandeja = await tx.impresionBandeja.update({
        where: { id: perfil.bandeja.id },
        data: {
          papelPreparadoId: perfil.papelMateriaPrimaId,
          gramajePreparado: perfil.gramaje,
          preparadoPor: auth.email,
          preparadoEl: new Date(),
          version: { increment: 1 },
        },
      });
      const preparacion = {
        perfilId,
        revision: `${perfil.version}:${bandeja.version}:${perfil.bandeja.destino.version}`,
        usuarioId: auth.userId,
        fecha: new Date().toISOString(),
      };
      for (const grupo of grupos)
        for (const trabajoId of grupo.trabajos)
          await this.actualizarCola(auth, tx, grupo.ordenId, trabajoId, {
            preparacion,
          });
      return { ok: true };
    });
  }

  async confirmar(auth: CurrentAuth, ordenId: string, envioIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // Comparte el bloqueo con preparar: no confirma una versión anterior si
      // otra pestaña acaba de reimprimir o de modificar los documentos de la OT.
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const orden = await this.orden(auth, ordenId, tx);
      if (['borrador', 'cancelada'].includes(orden.estado))
        throw new ConflictException(
          'La orden no está disponible para confirmar.',
        );
      const documentos = this.documentos(orden);
      const ultimos = await Promise.all(
        documentos.map((doc) =>
          tx.ordenTrabajoEvento.findFirst({
            where: {
              tenantId: auth.tenantId,
              ordenId,
              tipo: TIPO,
              AND: this.filtroTrabajo(doc.itemId, doc.paginaCad?.pagina),
            },
            orderBy: { fecha: 'desc' },
            select: { id: true },
          }),
        ),
      );
      const vigentes = ultimos.filter((e) => e !== null).map((e) => e.id);
      const ids = [...new Set(envioIds)];
      if (
        !ids.length ||
        ids.length !== envioIds.length ||
        ids.some((id) => !vigentes.includes(id))
      )
        throw new ConflictException(
          'Los envíos cambiaron. Actualizá el panel y revisá la impresión antes de confirmar.',
        );
      const confirmacion = {
        fecha: new Date().toISOString(),
        usuario: auth.impersonacion?.actorNombre ?? auth.email,
        usuarioId: auth.userId,
      };
      let nuevos = 0;
      for (const id of ids.sort()) {
        // Los eventos de Windows usan el mismo bloqueo: conservamos su estado
        // y guardamos la verificación humana por separado, sin perder mensajes.
        await tx.$queryRaw`SELECT id FROM "OrdenTrabajoEvento" WHERE id = ${id}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
        const envio = await tx.ordenTrabajoEvento.findFirst({
          where: { id, ordenId, tenantId: auth.tenantId, tipo: TIPO },
        });
        if (!envio) throw new NotFoundException('Envío no encontrado.');
        const datos = objeto(envio.datosJson);
        if (datos.confirmacion) continue;
        await tx.ordenTrabajoEvento.update({
          where: { id, tenantId: auth.tenantId },
          data: {
            datosJson: { ...datos, confirmacion } as Prisma.InputJsonValue,
          },
        });
        await this.actualizarCola(
          auth,
          tx,
          ordenId,
          String(datos.trabajoId ?? `${datos.itemId}:0`),
          { estado: 'VERIFICADO' },
        );
        nuevos++;
      }
      if (nuevos)
        await tx.ordenTrabajoEvento.create({
          data: {
            tenantId: auth.tenantId,
            ordenId,
            tipo: 'impresion_confirmada',
            descripcion: `Impresión de documentos verificada: ${ids.length} documento(s) impresos correctamente.`,
            usuarioId: auth.userId,
            usuarioNombre: confirmacion.usuario,
            datosJson: { envioIds: ids, ...confirmacion },
          },
        });
      return { ok: true };
    });
  }

  async estado(
    auth: CurrentAuth,
    ordenId: string,
    intentoId: string,
    estado: EstadoImpresion,
    detalle: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajo" WHERE id = ${ordenId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "OrdenTrabajoEvento" WHERE id = ${intentoId}::uuid AND "tenantId" = ${auth.tenantId}::uuid FOR UPDATE`;
      const evento = await tx.ordenTrabajoEvento.findFirst({
        where: {
          id: intentoId,
          ordenId,
          tenantId: auth.tenantId,
          tipo: TIPO,
        },
      });
      if (!evento)
        throw new NotFoundException('Envío no encontrado para esta sesión.');
      const datos = objeto(evento.datosJson);
      const actualizadoEl = new Date().toISOString();
      const eventos: unknown[] = Array.isArray(datos.eventos)
        ? datos.eventos.slice(-39)
        : [];
      datos.estado = siguienteEstado(datos.estado as EstadoImpresion, estado);
      datos.actualizadoEl = actualizadoEl;
      datos.eventos = [...eventos, { estado, detalle, fecha: actualizadoEl }];
      await tx.ordenTrabajoEvento.update({
        where: { id: intentoId, tenantId: auth.tenantId },
        data: { datosJson: datos as Prisma.InputJsonValue },
      });
      await this.actualizarCola(
        auth,
        tx,
        ordenId,
        String(datos.trabajoId ?? `${datos.itemId}:0`),
        { estado: datos.confirmacion ? 'VERIFICADO' : datos.estado },
        intentoId,
      );
      return {
        ...datos,
        id: intentoId,
        fecha: evento.fecha.toISOString(),
        usuario: evento.usuarioNombre,
      };
    });
  }
}
