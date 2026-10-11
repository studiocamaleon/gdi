import { validarMonedaDocumento } from '../../cotizaciones/validar-moneda-documento';
import { resolverIvaCopiado } from '../tarifarios/iva-copiado';
import { CentroCopiadoEmisionService } from './centro-copiado-emision.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type CotizacionItem,
  type CentroCopiadoPedidoCalculo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { regionalDelTenant } from '../../common/regional';
import { CentroCopiadoService } from '../centro-copiado.service';
import { CentroCopiadoCadService } from '../centro-copiado-cad.service';
import { CentroCopiadoPoliticaService } from '../tarifarios/centro-copiado-politica.service';
import { CentroCopiadoAuditoriaService } from '../centro-copiado-auditoria.service';
import { mismaReferenciaPolitica } from '../tarifarios/politica-precios';
import { referenciaComercialMotor } from '../tarifarios/referencia-comercial-motor';
import { DecimalComercial as D } from '../comercial/validaciones';
import {
  calcularPedidoCopiado,
  type LineaPedidoCopiado,
  type ResultadoPedidoCopiado,
} from './calculo-pedido';
import {
  calculoDe,
  canonico,
  esCopiado,
  exigirMismoTrabajo,
  fotoItem,
  huella,
  objeto,
  sinTerminaciones,
  solicitudDesdeSnapshot,
} from './snapshot-pedido';
import { MotorUniversalService } from '../../motor-universal/motor.service';

export interface RevisarPedidoCopiado {
  canalVenta: string;
  clienteId?: string | null;
  tratamientoFiscal: 'FISCAL' | 'SIN_COMPROBANTE';
  items: string[];
  descuentos?: {
    cotizacionItemId: string;
    tipo: 'PORCENTAJE' | 'MONTO';
    valor: number;
  }[];
}
export interface ContextoEmisionCopiado {
  canalVenta: string | null | undefined;
  clienteId: string | null | undefined;
  tratamientoFiscal?: string;
  items: {
    cotizacionItemId: string | null;
    subtotal: number | Prisma.Decimal;
    impuestos?: number | Prisma.Decimal;
    total: number | Prisma.Decimal;
  }[];
}
export type ResultadoGuardado = ResultadoPedidoCopiado & {
  ids: string[];
  origenes: { anteriorId: string; id: string }[];
  lineas: LineaPedidoCopiado[];
  decimales: number;
  nombre: string;
  numero: number;
};
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const firma = (items: CotizacionItem[]) =>
  huella([...items].sort((a, b) => a.id.localeCompare(b.id)).map(fotoItem));

@Injectable()
export class CentroCopiadoPedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly politica: CentroCopiadoPoliticaService,
    private readonly copiado: CentroCopiadoService,
    private readonly cad: CentroCopiadoCadService,
    private readonly auditoria: CentroCopiadoAuditoriaService,
    private readonly motor: MotorUniversalService,
    private readonly emision: CentroCopiadoEmisionService,
  ) {}

  async revisar(auth: CurrentAuth, dto: RevisarPedidoCopiado) {
    const seleccion = await this.politica.resolverActiva(
      auth.tenantId,
      dto.canalVenta,
    );
    if (seleccion.estado === 'PENDIENTE')
      throw new ConflictException(
        'El canal no tiene un tarifario vigente disponible. Revisá Configuración.',
      );
    const descuentos = new Map(
      (dto.descuentos ?? []).map((d) => [d.cotizacionItemId, d]),
    );
    if (
      descuentos.size !== (dto.descuentos?.length ?? 0) ||
      [...descuentos.values()].some(
        (d) =>
          !dto.items.includes(d.cotizacionItemId) ||
          (d.tipo === 'PORCENTAJE' && d.valor > 100),
      )
    )
      throw new BadRequestException(
        'Revisá el alcance y el porcentaje de los descuentos.',
      );
    const originales = await this.prisma.cotizacionItem.findMany({
      where: { tenantId: auth.tenantId, id: { in: dto.items } },
    });
    if (
      originales.length !== dto.items.length ||
      new Set(dto.items).size !== dto.items.length
    )
      throw new NotFoundException(
        'Algún trabajo no existe o no pertenece a esta empresa.',
      );
    if (
      dto.clienteId &&
      !(await this.prisma.cliente.count({
        where: { tenantId: auth.tenantId, id: dto.clienteId, activo: true },
      }))
    )
      throw new NotFoundException('No se encontró el cliente.');
    if (seleccion.estado === 'MOTOR') {
      if (originales.some(calculoDe))
        throw new ConflictException(
          'El canal utiliza el motor. Volvé a cotizar la carga de copiado para reemplazar los precios del tarifario anterior.',
        );
      return { modalidad: 'MOTOR' as const };
    }
    validarMonedaDocumento(originales);
    const copiados = originales
      .filter(esCopiado)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!copiados.length) return { modalidad: 'MOTOR' as const };
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const decimales =
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
    const lineas: LineaPedidoCopiado[] = [];
    const firmaOriginal = firma(originales);
    const referenciasMotor = new Map<
      string,
      {
        impuestos: unknown;
        comisiones: unknown;
        acuerdo: unknown;
        configuracion: unknown;
      }
    >();
    // Cada carga conserva el cambio ya revisado; nunca mezclar monedas o FX.
    const cambios = [
      ...new Set(
        copiados.map(
          (i) => objeto(objeto(i.snapshotJson).tipoCambio).id ?? null,
        ),
      ),
    ];
    if (cambios.length > 1)
      throw new BadRequestException(
        'Actualizá el tipo de cambio de todos los trabajos antes de revisar los precios.',
      );
    for (const item of copiados) {
      const solicitud = solicitudDesdeSnapshot(item, dto.clienteId ?? null);
      const construir = async () => {
        const completo = (
          await this.copiado.construirItems(auth.tenantId, solicitud)
        ).items[0];
        if (!completo || completo.error || !completo.cotizacion)
          throw new BadRequestException(
            completo?.error ?? 'No se pudo verificar el trabajo.',
          );
        exigirMismoTrabajo(item, completo);
        const tieneTerminaciones =
          solicitud.documentos.some((d) => d.terminaciones?.length) ||
          solicitud.grupos?.some((g) => g.terminaciones?.length);
        const base = tieneTerminaciones
          ? (
              await this.copiado.construirItems(
                auth.tenantId,
                sinTerminaciones(solicitud),
              )
            ).items[0]
          : completo;
        if (base?.error || !base?.cotizacion)
          throw new BadRequestException(
            base?.error ??
              'No se pudo separar la impresión de las terminaciones.',
          );
        const d = base.cotizacion.desglosePrecio;
        if (!d)
          throw new BadRequestException('Falta el desglose fiscal del motor.');
        const iva = await resolverIvaCopiado(
          this.prisma,
          auth.tenantId,
          completo.productoId,
        );
        const referencia = referenciaComercialMotor([base.cotizacion], iva);
        referenciasMotor.set(item.id, {
          impuestos: d.impuestos,
          comisiones: d.comisiones,
          acuerdo: d.precioEspecialCliente,
          configuracion: d.precioConfig,
        });
        const documentos: LineaPedidoCopiado['documentos'] = [];
        let costo: InstanceType<typeof D> | null = new D(0);
        let anterior = '';
        for (const doc of solicitud.documentos) {
          const sinGrupo = {
            ...doc,
            grupoId: undefined,
            terminaciones: [],
            gramaje: doc.gramaje ?? null,
          };
          if (doc.modo === 'CAD') {
            const perfil = (
              await this.cad.opciones(auth.tenantId)
            ).perfiles.find((p) => p.id === doc.cad?.cotizacion?.id);
            if (!perfil)
              throw new BadRequestException(
                'Actualizá la configuración del plano CAD.',
              );
            documentos.push({
              ...sinGrupo,
              modo: 'CAD',
              rolloProduccion: perfil.rollo,
            });
            const simulacion = await this.cad.construir(
              auth.tenantId,
              sinGrupo,
              item.id,
              null,
              dto.clienteId ?? undefined,
              true,
            );
            costo =
              costo === null || simulacion.error || !simulacion.cotizacion
                ? null
                : costo.plus(simulacion.cotizacion.costos.total);
          } else {
            documentos.push({ ...sinGrupo, modo: 'HOJAS' });
            const clave = canonico([
              doc.papelMateriaPrimaId,
              doc.gramaje,
              doc.tamano,
              doc.color,
              doc.faz,
            ]);
            try {
              const partes = await this.copiado.simularCostoHojas(
                auth.tenantId,
                sinGrupo,
                {
                  clienteId: dto.clienteId ?? undefined,
                  tipoCambioId: solicitud.tipoCambioId,
                  preparar: !doc.grupoId || clave !== anterior,
                },
              );
              for (const parte of partes)
                costo =
                  costo === null
                    ? null
                    : costo.plus(parte.cotizacion!.costos.total);
            } catch {
              costo = null;
            }
            anterior = clave;
          }
        }
        if (costo && (!costo.isFinite() || costo.lt(0))) costo = null;
        const costoTerminaciones = new D(
          completo.cotizacion.costos.total,
        ).minus(base.cotizacion.costos.total);
        const terminacionesNeto = new D(completo.subtotal).minus(base.subtotal);
        if (
          !costoTerminaciones.isFinite() ||
          !terminacionesNeto.isFinite() ||
          costoTerminaciones.lt(0) ||
          terminacionesNeto.lt(0)
        )
          throw new BadRequestException(
            'El motor no pudo separar el importe de las terminaciones. Revisá su configuración.',
          );
        const descuentoPedido = descuentos.get(item.id);
        lineas.push({
          id: item.id,
          documentos,
          ivaPorcentaje: iva,
          costoImpresion: costo?.toFixed(decimales) ?? null,
          costoTerminaciones: costoTerminaciones.toFixed(decimales),
          terminacionesNeto: terminacionesNeto.toFixed(decimales),
          acuerdoImpresionNeto: d.precioEspecialCliente
            ? String(base.subtotal)
            : null,
          cargas: referencia.cargas,
          descuento: descuentoPedido
            ? {
                tipo: descuentoPedido.tipo,
                valor: String(descuentoPedido.valor),
              }
            : item.descuentoTipo === 'PORCENTAJE' ||
                item.descuentoTipo === 'MONTO'
              ? {
                  tipo: item.descuentoTipo,
                  valor: item.descuentoValor?.toString() ?? '0',
                }
              : null,
        });
      };
      if (this.motor.usaTipoCambio && solicitud.tipoCambioId)
        await this.motor.conTipoCambio(
          auth.tenantId,
          solicitud.tipoCambioId,
          construir,
        );
      else await construir();
    }
    const calculado = calcularPedidoCopiado({
      referencia: seleccion.referencia,
      contenido: seleccion.version.contenido,
      lineas,
      decimales,
      tratamientoFiscal: dto.tratamientoFiscal,
    });
    if (calculado.estado === 'PRECIO_PENDIENTE')
      return this.publicar(auth, {
        modalidad: 'TARIFARIO',
        nombre: seleccion.version.nombre,
        numero: seleccion.version.numero,
        calculado,
        id: null,
        huella: null,
        cotizacionId: null,
        items: [],
      });
    return this.prisma.$transaction(
      async (tx) => {
        await this.politica.bloquear(tx, auth.tenantId);
        const vigente = await this.politica.resolverActiva(
          auth.tenantId,
          dto.canalVenta,
          tx,
        );
        if (
          vigente.estado !== 'TARIFARIO' ||
          !mismaReferenciaPolitica(seleccion.referencia, vigente.referencia)
        )
          throw new ConflictException(
            'Los precios cambiaron durante la revisión. Actualizalos nuevamente.',
          );
        // Recotizar un item bloquea su contenedor. Tomar los mismos locks antes de copiar.
        for (const id of [
          ...new Set(originales.map((i) => i.cotizacionId)),
        ].sort())
          await tx.$queryRaw`SELECT "id" FROM "Cotizacion" WHERE "tenantId" = ${auth.tenantId}::uuid AND "id" = ${id}::uuid FOR UPDATE`;
        const actuales = await tx.cotizacionItem.findMany({
          where: { tenantId: auth.tenantId, id: { in: dto.items } },
        });
        if (firma(actuales) !== firmaOriginal)
          throw new ConflictException(
            'Un trabajo cambió durante la revisión. Actualizá los precios nuevamente.',
          );
        const contenedor = await tx.cotizacion.create({
          data: {
            tenantId: auth.tenantId,
            clienteId: dto.clienteId,
            canalVenta: dto.canalVenta,
            tipoCambioId: cambios[0] as string | null,
          },
        });
        const id = randomUUID();
        const clones: CotizacionItem[] = [];
        const origenes: ResultadoGuardado['origenes'] = [];
        for (const original of originales) {
          const precio = calculado.precios.find(
            (p) => p.id === original.id,
          )?.precio;
          const linea = lineas.find((l) => l.id === original.id);
          const motor = referenciasMotor.get(original.id);
          const { id: _id, createdAt: _c, updatedAt: _u, ...datos } = original;
          void _id;
          void _c;
          void _u;
          const cantidad = new D(original.cantidad.toString());
          const costo =
            linea?.costoImpresion != null && linea.costoTerminaciones != null
              ? new D(linea.costoImpresion).plus(linea.costoTerminaciones)
              : null;
          const copia = await tx.cotizacionItem.create({
            data: {
              ...datos,
              cotizacionId: contenedor.id,
              ...(precio
                ? {
                    precioNetoTotal: precio.neto,
                    impuestosPorFueraTotal: precio.iva,
                    precioTotal: precio.total,
                    precioNetoUnitario: new D(precio.neto)
                      .div(cantidad)
                      .toFixed(decimales),
                    precioUnitario: new D(precio.total)
                      .div(cantidad)
                      .toFixed(decimales),
                    descuentoMonto: precio.descuentoMonto,
                    descuentoTipo: linea?.descuento?.tipo ?? null,
                    descuentoValor: linea?.descuento?.valor ?? null,
                    costoTotal: costo?.toFixed(decimales) ?? null,
                    costoUnitario:
                      costo?.div(cantidad).toFixed(decimales) ?? null,
                  }
                : {}),
              jobContextJson: json(datos.jobContextJson),
              snapshotJson: precio
                ? json({
                    ...objeto(original.snapshotJson),
                    ejecucion: {
                      ...objeto(objeto(original.snapshotJson).ejecucion),
                      cantidadComercialPricing: cantidad.toNumber(),
                      minimoComercialAplicado: null,
                    },
                    copiadoComercial: {
                      calculoId: id,
                      nombre: seleccion.version.nombre,
                      numero: seleccion.version.numero,
                      versionId: seleccion.version.id,
                      costoImpresion: linea?.costoImpresion,
                      costoTerminaciones: linea?.costoTerminaciones,
                      // La ejecución original se conserva como referencia productiva.
                      // El costo comercial exacto incluye la última hoja con una cara.
                      costoTotal: costo?.toFixed(decimales) ?? null,
                    },
                  })
                : json(datos.snapshotJson),
              trazabilidadJson:
                datos.trazabilidadJson === null
                  ? Prisma.DbNull
                  : json(datos.trazabilidadJson),
              precioConfigSnapshotJson:
                (motor
                  ? motor.configuracion
                  : datos.precioConfigSnapshotJson) == null
                  ? Prisma.DbNull
                  : json(
                      motor
                        ? motor.configuracion
                        : datos.precioConfigSnapshotJson,
                    ),
              impuestosSnapshotJson:
                (motor ? motor.impuestos : datos.impuestosSnapshotJson) == null
                  ? Prisma.DbNull
                  : json(motor ? motor.impuestos : datos.impuestosSnapshotJson),
              comisionesSnapshotJson:
                (motor ? motor.comisiones : datos.comisionesSnapshotJson) ==
                null
                  ? Prisma.DbNull
                  : json(
                      motor ? motor.comisiones : datos.comisionesSnapshotJson,
                    ),
              precioEspecialClienteSnapshotJson:
                (motor
                  ? motor.acuerdo
                  : datos.precioEspecialClienteSnapshotJson) == null
                  ? Prisma.DbNull
                  : json(
                      motor
                        ? motor.acuerdo
                        : datos.precioEspecialClienteSnapshotJson,
                    ),
            },
          });
          clones.push(copia);
          origenes.push({ anteriorId: original.id, id: copia.id });
        }
        const mapa = new Map(origenes.map((o) => [o.anteriorId, o.id]));
        const resultado: ResultadoGuardado = {
          ...calculado,
          ids: clones.filter(esCopiado).map((i) => i.id),
          origenes,
          lineas: lineas.map((l) => ({ ...l, id: mapa.get(l.id)! })),
          decimales,
          nombre: seleccion.version.nombre,
          numero: seleccion.version.numero,
          precios: calculado.precios.map((p) => ({
            ...p,
            id: mapa.get(p.id)!,
          })),
          terminaciones: calculado.terminaciones.map((p) => ({
            ...p,
            id: mapa.get(p.id)!,
          })),
        };
        const guardado = await tx.centroCopiadoPedidoCalculo.create({
          data: {
            id,
            tenantId: auth.tenantId,
            cotizacionId: contenedor.id,
            clienteId: dto.clienteId,
            canalVenta: dto.canalVenta,
            tratamientoFiscal: dto.tratamientoFiscal,
            referenciaJson: json(seleccion.referencia),
            resultadoJson: json(resultado),
            huella: firma(clones.filter(esCopiado)),
            creadoPorId: auth.userId,
          },
        });
        await this.auditoria.registrar(tx, {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          tipo: 'PEDIDO_PRECIOS_REVISADOS',
          descripcion: 'Precios de copiado revisados para el pedido completo.',
          datos: {
            calculoId: id,
            cotizacionId: contenedor.id,
            versionId: seleccion.version.id,
            estado: calculado.control.estado,
          },
        });
        return this.respuesta(auth, guardado, clones);
      },
      { timeout: 15000 },
    );
  }

  private publicar(auth: CurrentAuth, respuesta: Record<string, unknown>) {
    if (auth.permisos?.has('finanzas.ver_margenes')) return respuesta;
    const c = respuesta.calculado as ResultadoPedidoCopiado;
    return {
      ...respuesta,
      calculado: {
        estado: c.estado,
        grupos: c.grupos,
        composicion: c.composicion,
        precios: c.precios,
        control: { estado: c.control.estado },
        terminaciones: c.terminaciones.map((t) => ({
          id: t.id,
          control: { estado: t.control.estado },
        })),
      },
    };
  }
  private respuesta(
    auth: CurrentAuth,
    c: CentroCopiadoPedidoCalculo,
    items: CotizacionItem[],
  ) {
    const r = c.resultadoJson as unknown as ResultadoGuardado;
    // No devolver las líneas internas (costos, comisiones, documentos) al navegador.
    const { lineas: _l, ...calculado } = r;
    void _l;
    return this.publicar(auth, {
      modalidad: 'TARIFARIO',
      id: c.id,
      huella: c.huella,
      cotizacionId: c.cotizacionId,
      nombre: r.nombre,
      numero: r.numero,
      autorizado: c.autorizadoEl
        ? {
            nombre: c.autorizadoNombre,
            motivo: c.autorizacionMotivo,
            fecha: c.autorizadoEl,
          }
        : null,
      calculado,
      items: r.origenes.map((o) => {
        const i = items.find((i) => i.id === o.id)!;
        return {
          ...o,
          subtotal: Number(i.precioNetoTotal),
          iva: Number(i.impuestosPorFueraTotal),
          total: Number(i.precioTotal),
          descuentoMonto: Number(i.descuentoMonto ?? 0),
          ...(auth.permisos?.has('finanzas.ver_margenes')
            ? {
                finanzas: {
                  costoTotal:
                    i.costoTotal == null ? null : Number(i.costoTotal),
                  cargas: r.lineas.find((l) => l.id === i.id)?.cargas ?? null,
                },
              }
            : {}),
        };
      }),
    });
  }

  async estado(auth: CurrentAuth, dto: RevisarPedidoCopiado) {
    return this.prisma.$transaction(async (tx) => {
      const actuales = await tx.cotizacionItem.findMany({
        where: { tenantId: auth.tenantId, id: { in: dto.items } },
      });
      if (actuales.length !== dto.items.length)
        throw new NotFoundException(
          'No se encontró un trabajo de esta empresa.',
        );
      const ids = [...new Set(actuales.filter(esCopiado).map(calculoDe))];
      if (ids.length !== 1 || !ids[0]) return null;
      const c = await tx.centroCopiadoPedidoCalculo.findFirst({
        where: { tenantId: auth.tenantId, id: ids[0] },
      });
      if (!c) return null;
      await this.politica.bloquear(tx, auth.tenantId);
      let vigente = true;
      try {
        await this.emision.verificar(
          tx,
          auth.tenantId,
          c,
          actuales.filter(esCopiado),
          {
            ...dto,
            clienteId: dto.clienteId ?? null,
            items: actuales.map((i) => ({
              cotizacionItemId: i.id,
              subtotal: i.precioNetoTotal!,
              total: i.precioTotal!,
            })),
          },
        );
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        vigente = false;
      }
      const todos = await tx.cotizacionItem.findMany({
        where: { tenantId: auth.tenantId, cotizacionId: c.cotizacionId },
      });
      return { revision: this.respuesta(auth, c, todos), vigente };
    });
  }

  async autorizar(
    auth: CurrentAuth,
    id: string,
    motivo: string,
    firmaEsperada: string,
  ) {
    if (
      !auth.permisos?.has('comercial.aprobar_descuento') ||
      !auth.permisos?.has('finanzas.ver_margenes')
    )
      throw new ForbiddenException(
        'Necesitás permiso para autorizar márgenes y consultar costos. El permiso de cotizar no alcanza.',
      );
    if (motivo.trim().length < 10 || motivo.trim().length > 1000)
      throw new BadRequestException(
        'Explicá el motivo de la autorización (entre 10 y 1.000 caracteres).',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.politica.bloquear(tx, auth.tenantId);
      const c = await tx.centroCopiadoPedidoCalculo.findFirst({
        where: { id, tenantId: auth.tenantId },
      });
      if (!c) throw new NotFoundException('No se encontró el cálculo.');
      const r = c.resultadoJson as unknown as ResultadoGuardado;
      const items = await tx.cotizacionItem.findMany({
        where: { tenantId: auth.tenantId, cotizacionId: c.cotizacionId },
      });
      if (c.huella !== firmaEsperada)
        throw new ConflictException(
          'El cálculo cambió. Revisalo antes de autorizar.',
        );
      await this.emision.verificar(
        tx,
        auth.tenantId,
        c,
        items.filter(esCopiado),
        {
          canalVenta: c.canalVenta,
          clienteId: c.clienteId,
          tratamientoFiscal: c.tratamientoFiscal,
          items: items.map((i) => ({
            cotizacionItemId: i.id,
            subtotal: i.precioNetoTotal!,
            total: i.precioTotal!,
          })),
        },
      );
      const controles = [r.control, ...r.terminaciones.map((t) => t.control)];
      if (
        controles.some(
          (c) => c.estado === 'BLOQUEADO' || c.estado === 'NO_VERIFICABLE',
        ) ||
        !controles.some((c) => c.estado === 'REQUIERE_AUTORIZACION')
      )
        throw new BadRequestException(
          'Este cálculo no admite una autorización de excepción. Revisá precios y costos.',
        );
      const actor = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { nombreCompleto: true },
      });
      const actualizado = await tx.centroCopiadoPedidoCalculo.update({
        where: { id: c.id },
        data: {
          autorizadoPorId: auth.userId,
          autorizadoNombre:
            auth.impersonacion?.actorNombre ??
            actor?.nombreCompleto ??
            'Responsable autorizado',
          autorizacionMotivo: motivo.trim(),
          autorizadoEl: new Date(),
        },
      });
      await this.auditoria.registrar(tx, {
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        tipo: 'PEDIDO_MARGEN_AUTORIZADO',
        descripcion:
          'Excepción de margen autorizada para un cálculo exacto de copiado.',
        datos: { calculoId: c.id, huella: c.huella, motivo: motivo.trim() },
      });
      return this.respuesta(auth, actualizado, items);
    });
  }
}
