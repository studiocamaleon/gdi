import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { regionalDelTenant } from '../common/regional';
import { TipoCambioService } from '../cotizaciones/tipo-cambio.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { loadTarifasHorarias } from '../productos-servicios/costing/load-tarifas';
import { resolverFamilia } from '../productos-servicios/pasos/familias';
import type {
  ImpuestoSnapshot,
  ComisionSnapshot,
} from '../productos-servicios/precio/aplicar-precio.types';
import { calcularTrabajoMedida } from './trabajo-medida.calculo';
import { TrabajoMedidaDto } from './trabajo-medida.dto';
import { exigirTrabajoMedida } from './trabajo-medida.permiso';

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const periodoActual = (zona: string) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${p.find((x) => x.type === 'year')!.value}-${p.find((x) => x.type === 'month')!.value}`;
};

@Injectable()
export class TrabajosMedidaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cambio: TipoCambioService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  async opciones(auth: CurrentAuth) {
    exigirTrabajoMedida(auth);
    await this.capacidades.exigir(auth.tenantId, 'cotizacion');
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const periodo = periodoActual(regional.zonaHoraria);
    const [centros, tarifas, rutas, maquinas] = await Promise.all([
      this.prisma.centroCosto.findMany({
        where: { tenantId: auth.tenantId, activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      loadTarifasHorarias(this.prisma, { tenantId: auth.tenantId, periodo }),
      this.prisma.ruta.findMany({
        where: { tenantId: auth.tenantId, activo: true, sistemaCodigo: null },
        select: {
          id: true,
          nombre: true,
          versionActual: true,
          pasos: {
            where: { activo: true },
            orderBy: { orden: 'asc' },
            select: { version: true, nombreVisible: true, familiaCodigo: true },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.maquina.findMany({
        where: { tenantId: auth.tenantId, activo: true },
        select: { id: true, nombre: true, centroCostoPrincipalId: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    return {
      moneda: regional.moneda,
      periodo,
      centros: centros.map((c) => ({
        ...c,
        tarifaHora: tarifas.has(c.id)
          ? Number(tarifas.get(c.id)!.tarifa)
          : null,
      })),
      maquinas,
      rutas: rutas.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        pasos: r.pasos
          .filter((p) => p.version === r.versionActual)
          .map((p) => ({
            nombre:
              p.nombreVisible ||
              resolverFamilia(p.familiaCodigo)?.nombre ||
              p.familiaCodigo,
            familiaCodigo: p.familiaCodigo,
          })),
      })),
    };
  }

  async obtener(auth: CurrentAuth, id: string) {
    exigirTrabajoMedida(auth);
    const item = await this.prisma.cotizacionItem.findFirst({
      where: { id, tenantId: auth.tenantId, origen: 'TRABAJO_MEDIDA' },
      select: { jobContextJson: true },
    });
    if (!item)
      throw new NotFoundException('No se encontró el trabajo a medida.');
    return (item.jobContextJson as { trabajoMedida: unknown }).trabajoMedida;
  }

  async calcular(auth: CurrentAuth, dto: TrabajoMedidaDto) {
    exigirTrabajoMedida(auth);
    await this.capacidades.exigir(auth.tenantId, 'cotizacion');
    const tenantId = auth.tenantId;
    if (!dto.nombre.trim())
      throw new BadRequestException('Ingresá el nombre del trabajo.');
    if (dto.produccion && !dto.operaciones.length)
      throw new BadRequestException(
        'Agregá al menos un paso para hacer seguimiento de producción.',
      );
    const regional = await regionalDelTenant(this.prisma, tenantId);
    const periodo = dto.periodo ?? periodoActual(regional.zonaHoraria);
    const ids = [
      ...new Set(
        dto.operaciones.flatMap((o) =>
          o.centroCostoId ? [o.centroCostoId] : [],
        ),
      ),
    ];
    const maquinasIds = [
      ...new Set(
        dto.operaciones.flatMap((o) => (o.maquinaId ? [o.maquinaId] : [])),
      ),
    ];
    const [
      centros,
      tarifasRaw,
      maquinas,
      impuestosDb,
      comisionesDb,
      fiscal,
      cambio,
    ] = await Promise.all([
      this.prisma.centroCosto.findMany({
        where: { tenantId, activo: true, id: { in: ids } },
        select: { id: true, nombre: true },
      }),
      loadTarifasHorarias(this.prisma, {
        tenantId,
        periodo,
        centroCostoIds: ids,
      }),
      this.prisma.maquina.findMany({
        where: { tenantId, activo: true, id: { in: maquinasIds } },
        select: { id: true, centroCostoPrincipalId: true },
      }),
      this.prisma.productoImpuestoCatalogo.findMany({
        where: { tenantId, activo: true },
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.productoComisionCatalogo.findMany({
        where: { tenantId, activo: true, alcance: 'TENANT' },
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.configuracionFiscal.findUnique({
        where: { tenantId },
        select: { condicionFiscal: true },
      }),
      dto.tipoCambioId
        ? this.cambio.obtenerParaCotizar(tenantId, dto.tipoCambioId)
        : this.cambio.crear(tenantId, auth.userId),
    ]);
    if (centros.length !== ids.length || maquinas.length !== maquinasIds.length)
      throw new BadRequestException(
        'Algún recurso no existe, está inactivo o no pertenece a esta empresa.',
      );
    if (
      dto.rutaOrigenId &&
      !(await this.prisma.ruta.findFirst({
        where: {
          id: dto.rutaOrigenId,
          tenantId,
          activo: true,
          sistemaCodigo: null,
        },
        select: { id: true },
      }))
    )
      throw new BadRequestException(
        'La ruta no está disponible en esta empresa.',
      );
    if (
      dto.anteriorItemId &&
      !(await this.prisma.cotizacionItem.findFirst({
        where: { id: dto.anteriorItemId, tenantId, origen: 'TRABAJO_MEDIDA' },
        select: { id: true },
      }))
    )
      throw new NotFoundException(
        'No se encontró la versión anterior del trabajo.',
      );
    if (
      dto.clienteId &&
      !(await this.prisma.cliente.findFirst({
        where: { id: dto.clienteId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('No se encontró el cliente.');
    for (const o of dto.operaciones) {
      if (!o.nombre.trim())
        throw new BadRequestException('Ingresá el nombre de cada operación.');
      if (!resolverFamilia(o.familiaCodigo))
        throw new BadRequestException(
          `La operación «${o.nombre}» tiene una familia desconocida.`,
        );
      if (
        o.maquinaId &&
        maquinas.find((m) => m.id === o.maquinaId)?.centroCostoPrincipalId !==
          o.centroCostoId
      )
        throw new BadRequestException(
          `La máquina de «${o.nombre}» debe pertenecer al centro elegido.`,
        );
    }
    const cobraIva =
      fiscal?.condicionFiscal !== 'monotributo' &&
      fiscal?.condicionFiscal !== 'exento';
    const iva =
      cobraIva && dto.categoriaFiscal !== 'exento'
        ? impuestosDb.filter(
            (i) =>
              i.alcance === 'PRODUCTO' &&
              i.traslado === 'POR_FUERA' &&
              (i.categoriaFiscal ?? 'general') === dto.categoriaFiscal,
          )
        : [];
    if (cobraIva && dto.categoriaFiscal !== 'exento' && iva.length !== 1)
      throw new BadRequestException(
        'Configurá una única alícuota activa para la categoría fiscal elegida.',
      );
    const impuestos: ImpuestoSnapshot[] = [
      ...iva,
      ...impuestosDb.filter((i) => i.alcance === 'TENANT'),
    ].map((i, orden) => ({
      catalogoId: i.id,
      codigo: i.codigo,
      nombre: i.nombre,
      porcentaje: i.porcentaje,
      orden,
      baseCalculo: i.baseCalculo === 'BRUTO_COBRADO' ? 'BRUTO_COBRADO' : 'NETO',
      traslado: i.traslado === 'POR_FUERA' ? 'POR_FUERA' : 'POR_DENTRO',
    }));
    const comisiones: ComisionSnapshot[] = comisionesDb.map((c, orden) => ({
      catalogoId: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      porcentaje: c.porcentaje,
      orden,
      baseCalculo: c.baseCalculo === 'BRUTO_COBRADO' ? 'BRUTO_COBRADO' : 'NETO',
    }));
    const tarifas = new Map(
      [...tarifasRaw].map(([id, t]) => [id, Number(t.tarifa)]),
    );
    const decimales =
      regional.redondeoPrecio === 'entero' ? 0 : regional.moneda.decimales;
    const c = calcularTrabajoMedida(
      dto,
      tarifas,
      impuestos,
      comisiones,
      decimales,
    );
    const cantidad = dto.cantidad;
    // Los importes y las tarifas son económicos; no generan materiales de inventario.
    const trabajoMedida = {
      ...dto,
      cotizacionId: undefined,
      huellaCalculo: undefined,
      clienteId: undefined,
      periodo,
      tipoCambioId: cambio.id,
      nombre: dto.nombre.trim(),
    };
    const costos = {
      materialesTotal: c.materiales,
      tiempoTotal: c.horas,
      cargosDirectosTotal: c.otros,
      tercerizadoTotal: 0,
      total: c.costo,
      unitario: c.costo / cantidad,
    };
    const pasos = c.operaciones.map((o, i) => ({
      rutaPasoId: o.clave,
      rutaPasoOrden: i,
      familiaCodigo: o.familiaCodigo,
      nombreVisible: o.nombre.trim(),
      activado: true,
      soloCosto: !dto.produccion,
      recursoManual:
        o.horas == null
          ? {
              centroCostoId: o.centroCostoId ?? null,
              centroCostoNombre:
                centros.find((x) => x.id === o.centroCostoId)?.nombre ?? null,
              maquinaId: o.maquinaId ?? null,
            }
          : undefined,
      tiempo:
        o.horas != null
          ? {
              totalMin: o.horas * 60,
              runMin: o.horas * 60,
              setupMin: 0,
              cleanupMin: 0,
              tarifaHora: o.tarifaHora,
              costo: o.costo,
              centroCostoId: o.centroCostoId ?? null,
              centroCostoNombre:
                centros.find((x) => x.id === o.centroCostoId)?.nombre ?? null,
              maquinaId: o.maquinaId ?? null,
              origenTiempo: 'manual_comercial',
            }
          : undefined,
      materiales: [],
      cargosDirectosPaso: [],
      costoTotal: o.costo,
    }));
    const desglosePrecio = {
      precioConfig: {
        metodoCalculo: 'precio_fijo',
        detalle: { price: c.total / cantidad, trabajoMedida: true },
      },
      impuestos,
      comisiones,
      precioEspecialCliente: null,
      precioBase: (c.neto - c.internos - c.comision) / cantidad,
      totalImpuestos: (c.iva + c.internos) / cantidad,
      totalComisiones: c.comision / cantidad,
      margenEfectivoPct: c.neto > 0 ? (c.margen / c.neto) * 100 : 0,
      precioNetoUnitario: c.neto / cantidad,
      precioBrutoUnitario: c.total / cantidad,
      precioNetoTotal: c.neto,
      precioBrutoTotal: c.total,
      descuento: {
        aplicado: c.descuento > 0,
        montoUnitario: c.descuento / cantidad,
        montoTotal: c.descuento,
        netoListaUnitario: c.netoLista / cantidad,
        netoListaTotal: c.netoLista,
      },
    };
    const cotizacion = {
      trabajoMedida,
      tipoCambio: cambio,
      productoId: '',
      productoNombre: dto.nombre.trim(),
      rutaNombre: dto.produccion
        ? 'Ruta del trabajo a medida'
        : 'Sin seguimiento de producción',
      cantidadEfectiva: cantidad,
      cantidadPedida: cantidad,
      cantidadComercialReal: cantidad,
      cantidadComercialPricing: cantidad,
      unidadComercialPricing: dto.unidad,
      periodoTarifario: periodo,
      costos,
      pasos,
      cargosDirectosCotizacion: [],
      componentesFabricados: [],
      desglosePrecio,
    };
    const huellaCalculo = createHash('sha256')
      .update(JSON.stringify({ cotizacion, costosVariables: c.variables }))
      .digest('hex');
    return {
      result: { exitoso: true as const, errores: [], cotizacion },
      huellaCalculo,
      resumen: {
        decimales,
        costoTotal: c.costo,
        costosVariables: c.variables,
        margen: c.margen,
        estimacionParcial: dto.operaciones.some((o) => o.horas == null),
        contribucion: c.contribucion,
        neto: c.neto,
        impuestos: c.iva,
        total: c.total,
      },
    };
  }

  async guardar(auth: CurrentAuth, dto: TrabajoMedidaDto) {
    const calculo = await this.calcular(auth, dto);
    if (!dto.huellaCalculo || dto.huellaCalculo !== calculo.huellaCalculo)
      throw new ConflictException(
        'Los datos, tarifas o impuestos cambiaron. Volvé a revisar el cálculo antes de guardar.',
      );
    const c = calculo.result.cotizacion;
    const precio = c.desglosePrecio;
    const snapshot = {
      origen: 'TRABAJO_MEDIDA',
      trabajoMedida: c.trabajoMedida,
      tipoCambio: c.tipoCambio,
      autoria: {
        usuarioId: auth.userId,
        anteriorItemId: dto.anteriorItemId ?? null,
        creadoEl: new Date().toISOString(),
      },
      producto: {
        id: null,
        codigo: 'A-MEDIDA',
        nombre: c.productoNombre,
        unidadComercial: dto.unidad,
      },
      ruta: { id: dto.rutaOrigenId ?? null, nombre: c.rutaNombre },
      ejecucion: {
        cantidadEfectiva: dto.cantidad,
        cantidadPedida: dto.cantidad,
        cantidadComercialReal: dto.cantidad,
        cantidadComercialPricing: dto.cantidad,
        unidadComercialPricing: dto.unidad,
        costos: c.costos,
      },
    };
    const resultado = await this.prisma.$transaction(async (tx) => {
      let cotizacionId = dto.cotizacionId;
      if (cotizacionId) {
        const lock = await tx.cotizacion.updateMany({
          where: {
            id: cotizacionId,
            tenantId: auth.tenantId,
            estado: 'borrador',
            numero: null,
            OR: [{ tipoCambioId: null }, { tipoCambioId: c.tipoCambio.id }],
          },
          data: { tipoCambioId: c.tipoCambio.id, updatedAt: new Date() },
        });
        if (lock.count !== 1)
          throw new ConflictException(
            'La cotización no está disponible para agregar ítems o tiene otro tipo de cambio.',
          );
      } else {
        const nueva = await tx.cotizacion.create({
          data: {
            tenantId: auth.tenantId,
            clienteId: dto.clienteId ?? null,
            tipoCambioId: c.tipoCambio.id,
            estado: 'borrador',
          },
        });
        cotizacionId = nueva.id;
      }
      const item = await tx.cotizacionItem.create({
        data: {
          tenantId: auth.tenantId,
          cotizacionId,
          productoId: null,
          origen: 'TRABAJO_MEDIDA',
          cantidad: dto.cantidad,
          jobContextJson: json({
            cantidad: dto.cantidad,
            notasProduccion: dto.descripcion,
            trabajoMedida: c.trabajoMedida,
          }),
          snapshotJson: json(snapshot),
          costoTotal: c.costos.total,
          costoUnitario: c.costos.unitario,
          precioNetoTotal: precio.precioNetoTotal,
          precioNetoUnitario: precio.precioNetoUnitario,
          precioTotal: precio.precioBrutoTotal,
          precioUnitario: precio.precioBrutoUnitario,
          impuestosPorFueraTotal: calculo.resumen.impuestos,
          descuentoTipo: dto.descuento?.tipo ?? null,
          descuentoValor: dto.descuento?.valor ?? null,
          descuentoMonto: precio.descuento.montoTotal,
          impuestosSnapshotJson: json(precio.impuestos),
          comisionesSnapshotJson: json(precio.comisiones),
          precioConfigSnapshotJson: json(precio.precioConfig),
          trazabilidadJson: json({
            pasos: c.pasos,
            cargosDirectosCotizacion: [],
            trabajoMedida: {
              costoTotal: c.costos.total,
              costosVariables: calculo.resumen.costosVariables,
              costoDirecto:
                c.costos.materialesTotal + c.costos.cargosDirectosTotal,
              costoInterno: c.costos.tiempoTotal,
              decimales: calculo.resumen.decimales,
              estimacionParcial: calculo.resumen.estimacionParcial,
            },
          }),
        },
        select: { id: true },
      });
      return { cotizacionId, cotizacionItemId: item.id };
    });
    return { ...calculo, ...resultado };
  }
}
