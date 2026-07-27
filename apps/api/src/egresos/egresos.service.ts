import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NaturalezaEgreso, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { ArchivosService } from '../archivos/archivos.service';
import {
  OrdenPagoPdfService,
  type OrdenPagoDoc,
} from './orden-pago-pdf.service';
import { REGIMEN_RETENCION_LABELS } from './egresos.types';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { regionalDelTenant } from '../common/regional';
import {
  calcularAging,
  totalAging,
  vencidoGrave,
  type ComprobanteAging,
} from '../administracion/aging';
import {
  CATEGORIAS_SEMILLA,
  estadoPorPagado,
  incideEnResultado,
} from './egresos.types';
import type {
  AnularDto,
  CrearCategoriaEgresoDto,
  CrearEgresoDto,
  EditarCategoriaEgresoDto,
  EditarEgresoDto,
  RegistrarPagoDto,
} from './dto/egreso.dto';

const r2 = (n: number) => Math.round(n * 100) / 100;
const dec = (v: Prisma.Decimal | null | undefined) => (v ? Number(v) : 0);

/**
 * Fecha calendaria (sin hora) desde un ISO 'YYYY-MM-DD'.
 *
 * Se parsea a mano y NO con `new Date(iso)` + getUTC*: un ISO con hora se
 * corre de día según el offset, y acá el día importa porque la COMPETENCIA
 * define el mes del gasto. Ver src/lib/fecha.ts del front y
 * docs/multi-moneda-zona-horaria.
 */
function soloFecha(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * Hoy EN LA ZONA DEL TENANT, como 'YYYY-MM-DD'.
 *
 * Sin esto, un gasto cargado a las 21:30 en Argentina (UTC-3) nacía con
 * competencia del día siguiente, y el 31 de mes caía en el mes que viene: el
 * error más silencioso posible en un registro cuyo sentido es el período.
 */
function hoyEnZona(zonaHoraria: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Injectable()
export class EgresosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresa: DatosEmpresaService,
    private readonly archivos: ArchivosService,
    private readonly ordenPagoPdf: OrdenPagoPdfService,
  ) {}

  /** "Grafica Corporearte" → "GC". El fallback del logo, igual que el recibo. */
  private iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '?';
    if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }

  /**
   * La orden de pago en PDF, generada al vuelo.
   *
   * A diferencia del recibo NO se persiste en el storage: el recibo se
   * comparte por link público y tiene que ser estable, mientras que ésta se
   * descarga y se manda a mano. Regenerarla es barato y evita pagar storage
   * por un documento que nadie va a volver a pedir por URL.
   */
  async ordenDePagoPdf(auth: CurrentAuth, pagoId: string): Promise<Buffer> {
    const pago = await this.prisma.pago.findFirst({
      where: { id: pagoId, tenantId: auth.tenantId },
      include: {
        metodoPago: { select: { nombre: true } },
        cuentaOrigen: { select: { nombre: true, banco: true, cbuAlias: true } },
        proveedor: { select: { nombre: true, cuit: true } },
        retenciones: true,
        valor: { select: { numero: true, banco: true, fechaPago: true } },
        imputaciones: {
          include: {
            egreso: {
              select: {
                numero: true,
                descripcion: true,
                tipoComprobante: true,
                puntoVenta: true,
                numeroComprobante: true,
                fechaVencimiento: true,
                beneficiarioNombre: true,
              },
            },
          },
        },
      },
    });
    if (!pago) throw new NotFoundException('No encontramos ese pago.');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { nombre: true },
    });
    const negocio = tenant?.nombre ?? 'Mi imprenta';
    const empresa = await this.empresa.paraDocumentos(auth.tenantId);
    const cuentaTexto =
      [pago.cuentaOrigen.banco ?? pago.cuentaOrigen.nombre]
        .filter(Boolean)
        .join(' · ') || null;

    const doc: OrdenPagoDoc = {
      numero: pago.numero,
      negocio,
      empresa,
      iniciales: this.iniciales(negocio),
      logoDataUri: await this.archivos.logoDataUri(auth.tenantId),
      proveedorNombre:
        pago.proveedor?.nombre ??
        pago.imputaciones[0]?.egreso.beneficiarioNombre ??
        'Sin proveedor',
      proveedorCuit: pago.proveedor?.cuit ?? null,
      fecha: pago.fecha.toISOString().slice(0, 10),
      registradoPor: pago.registradoPorNombre,
      metodoNombre: pago.metodoPago.nombre,
      cuentaTexto,
      referencia: pago.referencia,
      cheque: pago.valor
        ? {
            numero: pago.valor.numero,
            banco: pago.valor.banco,
            fechaPago: pago.valor.fechaPago
              ? pago.valor.fechaPago.toISOString().slice(0, 10)
              : null,
          }
        : null,
      egresos: pago.imputaciones.map((i) => ({
        numero: i.egreso.numero,
        descripcion: i.egreso.descripcion,
        comprobante:
          i.egreso.tipoComprobante && i.egreso.numeroComprobante
            ? `${i.egreso.tipoComprobante} ${i.egreso.puntoVenta ?? ''}-${i.egreso.numeroComprobante}`.replace(
                ' -',
                ' ',
              )
            : null,
        vencimiento: i.egreso.fechaVencimiento
          ? i.egreso.fechaVencimiento.toISOString().slice(0, 10)
          : null,
        monto: dec(i.monto),
      })),
      retenciones: pago.retenciones.map((r) => ({
        regimen: REGIMEN_RETENCION_LABELS[r.regimen] ?? r.regimen,
        monto: dec(r.monto),
      })),
      montoBruto: dec(pago.montoBruto),
      retencionesTotal: dec(pago.retencionesTotal),
      montoNeto: dec(pago.montoNeto),
    };

    return this.ordenPagoPdf.generar(doc);
  }

  /**
   * Nombre que se congela como autor. Pasa por `firmaActor` para que una
   * sesión de soporte quede firmada como soporte y no camuflada como un
   * empleado del taller (ver docs/control-plane-diseno.md etapa C).
   */
  private async nombreActor(auth: CurrentAuth): Promise<string> {
    const actor = await this.prisma.empleado.findFirst({
      where: { tenantId: auth.tenantId, userId: auth.userId },
      select: { nombreCompleto: true },
    });
    return firmaActor(auth, actor?.nombreCompleto ?? auth.email);
  }

  // ── Categorías ─────────────────────────────────────────────────────────

  /**
   * Siembra perezosa del árbol curado.
   *
   * Va acá y no en `crearTenant` porque los tenants existentes también lo
   * necesitan —si no, el módulo les nace inutilizable— y porque crearTenant
   * hoy no siembra nada de nada (ni métodos de pago ni cuentas). Un solo
   * camino cubre los nuevos y los viejos.
   *
   * Idempotente por el único `(tenantId, codigo)` + `skipDuplicates`: dos
   * lecturas simultáneas no duplican nada.
   */
  async asegurarCategorias(tenantId: string): Promise<void> {
    const cuantas = await this.prisma.categoriaEgreso.count({
      where: { tenantId },
    });
    if (cuantas > 0) return;
    await this.prisma.categoriaEgreso.createMany({
      data: CATEGORIAS_SEMILLA.map((c, i) => ({
        tenantId,
        codigo: c.codigo,
        nombre: c.nombre,
        naturaleza: c.naturaleza,
        esSistema: true,
        orden: i,
      })),
      skipDuplicates: true,
    });
  }

  async categorias(auth: CurrentAuth) {
    await this.asegurarCategorias(auth.tenantId);
    const filas = await this.prisma.categoriaEgreso.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ naturaleza: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      naturaleza: c.naturaleza,
      esSistema: c.esSistema,
      activo: c.activo,
      orden: c.orden,
      incideEnResultado: incideEnResultado(c.naturaleza),
    }));
  }

  async crearCategoria(auth: CurrentAuth, dto: CrearCategoriaEgresoDto) {
    await this.asegurarCategorias(auth.tenantId);
    // Código derivado del nombre: el nombre se puede editar después, el código
    // es la identidad y no se toca.
    const base = dto.nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    let codigo = base || 'categoria';
    let intento = 1;
    while (
      await this.prisma.categoriaEgreso.findUnique({
        where: { tenantId_codigo: { tenantId: auth.tenantId, codigo } },
        select: { id: true },
      })
    ) {
      intento += 1;
      codigo = `${base}_${intento}`;
    }
    const max = await this.prisma.categoriaEgreso.aggregate({
      where: { tenantId: auth.tenantId },
      _max: { orden: true },
    });
    return this.prisma.categoriaEgreso.create({
      data: {
        tenantId: auth.tenantId,
        codigo,
        nombre: dto.nombre.trim(),
        naturaleza: dto.naturaleza,
        esSistema: false,
        orden: (max._max.orden ?? 0) + 1,
      },
    });
  }

  async editarCategoria(
    auth: CurrentAuth,
    id: string,
    dto: EditarCategoriaEgresoDto,
  ) {
    const actual = await this.prisma.categoriaEgreso.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!actual) throw new NotFoundException('No encontramos esa categoría.');
    return this.prisma.categoriaEgreso.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
      },
    });
  }

  /**
   * Borrar una categoría es la excepción, no la regla: si es del sistema o
   * tiene egresos, se desactiva. Borrar con historia colgada dejaría egresos
   * sin clasificación y reportes que no cierran.
   */
  async borrarCategoria(auth: CurrentAuth, id: string) {
    const cat = await this.prisma.categoriaEgreso.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, esSistema: true, _count: { select: { egresos: true } } },
    });
    if (!cat) throw new NotFoundException('No encontramos esa categoría.');
    if (cat.esSistema) {
      throw new ConflictException(
        'Las categorías del sistema no se borran: desactivala y deja de aparecer en el selector.',
      );
    }
    if (cat._count.egresos > 0) {
      throw new ConflictException(
        `Esa categoría tiene ${cat._count.egresos} egreso(s) cargados. Desactivala en vez de borrarla.`,
      );
    }
    await this.prisma.categoriaEgreso.delete({ where: { id } });
    return { ok: true };
  }

  // ── Numeración ─────────────────────────────────────────────────────────

  private async numerarEgreso(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fecha: Date,
  ): Promise<string> {
    const anio = fecha.getUTCFullYear();
    const c = await tx.egresoContador.upsert({
      where: { tenantId_anio: { tenantId, anio } },
      create: { tenantId, anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    return `EGR-${anio}-${String(c.ultimo).padStart(4, '0')}`;
  }

  private async numerarPago(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fecha: Date,
  ): Promise<string> {
    const anio = fecha.getUTCFullYear();
    const c = await tx.pagoContador.upsert({
      where: { tenantId_anio: { tenantId, anio } },
      create: { tenantId, anio, ultimo: 1 },
      update: { ultimo: { increment: 1 } },
    });
    return `OP-${anio}-${String(c.ultimo).padStart(4, '0')}`;
  }

  // ── Egresos ────────────────────────────────────────────────────────────

  async listar(
    auth: CurrentAuth,
    q: {
      estado?: string;
      categoriaId?: string;
      proveedorId?: string;
      desde?: string;
      hasta?: string;
      /** 'competencia' (default) | 'vencimiento' — sobre qué fecha filtra. */
      eje?: string;
      /** true = sólo lo que entra en Cuentas por pagar. */
      soloPendientes?: string;
      texto?: string;
    },
  ) {
    const where: Prisma.EgresoWhereInput = { tenantId: auth.tenantId };
    if (q.estado) where.estado = q.estado;
    if (q.categoriaId) where.categoriaEgresoId = q.categoriaId;
    if (q.proveedorId) where.proveedorId = q.proveedorId;
    if (q.texto?.trim()) {
      const t = q.texto.trim();
      where.OR = [
        { descripcion: { contains: t, mode: 'insensitive' } },
        { beneficiarioNombre: { contains: t, mode: 'insensitive' } },
        { numero: { contains: t, mode: 'insensitive' } },
        { numeroComprobante: { contains: t, mode: 'insensitive' } },
      ];
    }
    // Cuentas por pagar: los que vencen y todavía se deben.
    if (q.soloPendientes === 'true') {
      where.fechaVencimiento = { not: null };
      where.estado = { in: ['pendiente', 'parcial'] };
    }
    // El rango se aplica sobre COMPETENCIA por default y sobre VENCIMIENTO si
    // lo piden: son dos preguntas distintas. "Los gastos de julio" es
    // competencia (la luz de julio pagada en agosto va en julio); "qué vence
    // esta semana" es vencimiento.
    if (q.desde || q.hasta) {
      const rango: Prisma.DateTimeNullableFilter = {};
      if (q.desde) rango.gte = soloFecha(q.desde);
      if (q.hasta) rango.lte = soloFecha(q.hasta);
      if (q.eje === 'vencimiento') {
        // Preserva el `not: null` que puso el filtro de pendientes.
        where.fechaVencimiento = { not: null, ...rango };
      } else {
        where.fechaCompetencia = rango as Prisma.DateTimeFilter;
      }
    }

    const filas = await this.prisma.egreso.findMany({
      where,
      /*
        Los dos tabs ordenan por VENCIMIENTO, que es la fecha que manda en un
        egreso: cuándo hay que tener la plata.

        · "Por pagar" ascendente — lo que vence primero, primero.
        · "Todos" descendente — es un histórico y se lee de lo último a lo
          primero. Lo de contado (sin vencimiento) va al final: no tiene una
          fecha que compita, y mezclarlo arriba correría lo que sí importa.
      */
      orderBy:
        q.soloPendientes === 'true'
          ? [{ fechaVencimiento: 'asc' }]
          : [
              { fechaVencimiento: { sort: 'desc', nulls: 'last' } },
              { fechaCompetencia: 'desc' },
              { createdAt: 'desc' },
            ],
      take: 300,
      include: {
        categoria: { select: { nombre: true, naturaleza: true } },
        proveedor: { select: { nombre: true } },
      },
    });
    return { egresos: filas.map((e) => this.proyectar(e)) };
  }

  private proyectar(e: {
    id: string;
    numero: string;
    descripcion: string;
    beneficiarioNombre: string;
    proveedorId: string | null;
    categoriaEgresoId: string;
    fechaCompetencia: Date;
    fechaVencimiento: Date | null;
    moneda: string;
    neto: Prisma.Decimal;
    iva: Prisma.Decimal;
    otrosImpuestos: Prisma.Decimal;
    total: Prisma.Decimal;
    pagadoTotal: Prisma.Decimal;
    tipoComprobante: string | null;
    puntoVenta: string | null;
    numeroComprobante: string | null;
    estado: string;
    origen: string;
    anuladoEl: Date | null;
    motivoAnulacion: string | null;
    registradoPorNombre: string | null;
    notas: string | null;
    categoria?: { nombre: string; naturaleza: NaturalezaEgreso };
    proveedor?: { nombre: string } | null;
  }) {
    const total = dec(e.total);
    const pagado = dec(e.pagadoTotal);
    return {
      id: e.id,
      numero: e.numero,
      descripcion: e.descripcion,
      beneficiarioNombre: e.beneficiarioNombre,
      proveedorId: e.proveedorId,
      proveedorNombre: e.proveedor?.nombre ?? null,
      categoriaEgresoId: e.categoriaEgresoId,
      categoriaNombre: e.categoria?.nombre ?? '',
      naturaleza: e.categoria?.naturaleza ?? null,
      fechaCompetencia: e.fechaCompetencia.toISOString().slice(0, 10),
      fechaVencimiento: e.fechaVencimiento
        ? e.fechaVencimiento.toISOString().slice(0, 10)
        : null,
      moneda: e.moneda,
      neto: dec(e.neto),
      iva: dec(e.iva),
      otrosImpuestos: dec(e.otrosImpuestos),
      total,
      pagadoTotal: pagado,
      saldo: r2(total - pagado),
      tipoComprobante: e.tipoComprobante,
      puntoVenta: e.puntoVenta,
      numeroComprobante: e.numeroComprobante,
      estado: e.estado,
      origen: e.origen,
      anuladoEl: e.anuladoEl ? e.anuladoEl.toISOString() : null,
      motivoAnulacion: e.motivoAnulacion,
      registradoPorNombre: e.registradoPorNombre,
      notas: e.notas,
    };
  }

  /**
   * Registra un egreso, y su pago si viene en el mismo gesto.
   *
   * `fechaVencimiento` ausente significa CONTADO, y entonces el pago es
   * obligatorio: un egreso de contado sin pago sería una deuda sin vencimiento,
   * o sea algo que nadie va a cobrar nunca y que ensucia el saldo para siempre.
   */
  async crear(auth: CurrentAuth, dto: CrearEgresoDto) {
    await this.asegurarCategorias(auth.tenantId);

    const categoria = await this.prisma.categoriaEgreso.findFirst({
      where: { id: dto.categoriaEgresoId, tenantId: auth.tenantId },
      select: { id: true, activo: true },
    });
    if (!categoria) throw new NotFoundException('Esa categoría no existe.');
    if (!categoria.activo) {
      throw new BadRequestException('Esa categoría está desactivada.');
    }

    const cuotas = dto.cuotas ?? 1;
    if (cuotas > 1 && !dto.fechaVencimiento) {
      throw new BadRequestException(
        'Una compra en cuotas necesita la fecha de la primera cuota.',
      );
    }
    if (cuotas > 1 && dto.pago) {
      throw new BadRequestException(
        'Si son cuotas, el egreso no puede nacer pagado: se paga cuota por cuota.',
      );
    }
    const esContado = !dto.fechaVencimiento;
    if (esContado && !dto.pago) {
      throw new BadRequestException(
        'Un egreso de contado necesita la cuenta de la que salió la plata. Si todavía no se pagó, indicá la fecha de vencimiento.',
      );
    }

    let beneficiario = dto.beneficiarioNombre?.trim() ?? '';
    if (dto.proveedorId) {
      const prov = await this.prisma.proveedor.findFirst({
        where: { id: dto.proveedorId, tenantId: auth.tenantId },
        select: { nombre: true },
      });
      if (!prov) throw new NotFoundException('Ese proveedor no existe.');
      // El nombre se CONGELA: el proveedor puede cambiar de nombre y el
      // historial de pagos no puede mutar por eso.
      beneficiario = beneficiario || prov.nombre;
    }
    if (!beneficiario) {
      throw new BadRequestException(
        'Indicá a quién se le paga: elegí un proveedor o escribí el nombre.',
      );
    }

    const neto = r2(dto.neto);
    const iva = r2(dto.iva ?? 0);
    const otros = r2(dto.otrosImpuestos ?? 0);
    const total = r2(neto + iva + otros);
    if (total === 0) {
      throw new BadRequestException('El importe no puede ser cero.');
    }

    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const fechaCompetencia = soloFecha(
      dto.fechaCompetencia ?? hoyEnZona(zonaHoraria),
    );
    const fechaVencimiento = dto.fechaVencimiento
      ? soloFecha(dto.fechaVencimiento)
      : null;
    const registradoPor = await this.nombreActor(auth);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (cuotas > 1) {
          // El resto de la división va en la PRIMERA cuota, no en la última:
          // así el total siempre cierra y la diferencia se paga antes, no
          // después. Cada cuota es un egreso propio y hermanado por el
          // documento (comparten proveedor y número de factura, así que el
          // antiduplicado se desactiva agregándole el índice de cuota).
          const netoBase = Math.floor((neto / cuotas) * 100) / 100;
          const ivaBase = Math.floor((iva / cuotas) * 100) / 100;
          const otrosBase = Math.floor((otros / cuotas) * 100) / 100;
          const creados: Array<{ id: string; numero: string }> = [];
          for (let i = 0; i < cuotas; i += 1) {
            const esPrimera = i === 0;
            const netoCuota = esPrimera
              ? r2(neto - netoBase * (cuotas - 1))
              : netoBase;
            const ivaCuota = esPrimera ? r2(iva - ivaBase * (cuotas - 1)) : ivaBase;
            const otrosCuota = esPrimera
              ? r2(otros - otrosBase * (cuotas - 1))
              : otrosBase;
            const vence = new Date(fechaVencimiento!);
            vence.setUTCMonth(vence.getUTCMonth() + i);
            const numeroCuota = await this.numerarEgreso(
              tx,
              auth.tenantId,
              fechaCompetencia,
            );
            const cuota = await tx.egreso.create({
              data: {
                tenantId: auth.tenantId,
                numero: numeroCuota,
                descripcion: `${dto.descripcion.trim()} (cuota ${i + 1}/${cuotas})`,
                categoriaEgresoId: dto.categoriaEgresoId,
                proveedorId: dto.proveedorId ?? null,
                beneficiarioNombre: beneficiario,
                fechaCompetencia,
                fechaVencimiento: vence,
                moneda: dto.moneda ?? 'ARS',
                neto: netoCuota,
                iva: ivaCuota,
                otrosImpuestos: otrosCuota,
                total: r2(netoCuota + ivaCuota + otrosCuota),
                tipoComprobante: dto.tipoComprobante ?? null,
                puntoVenta: dto.puntoVenta?.trim() || null,
                numeroComprobante: dto.numeroComprobante?.trim()
                  ? `${dto.numeroComprobante.trim()}/${i + 1}`
                  : null,
                estado: 'pendiente',
                origen: 'manual',
                centroCostoId: dto.centroCostoId ?? null,
                gastoFijoEstructuraId: dto.gastoFijoEstructuraId ?? null,
                empleadoId: dto.empleadoId ?? null,
                registradoPorNombre: registradoPor,
                notas: dto.notas?.trim() || null,
              },
            });
            creados.push({ id: cuota.id, numero: cuota.numero });
          }
          return { id: creados[0].id, numero: creados[0].numero, cuotas };
        }

        const numero = await this.numerarEgreso(
          tx,
          auth.tenantId,
          fechaCompetencia,
        );
        const egreso = await tx.egreso.create({
          data: {
            tenantId: auth.tenantId,
            numero,
            descripcion: dto.descripcion.trim(),
            categoriaEgresoId: dto.categoriaEgresoId,
            proveedorId: dto.proveedorId ?? null,
            beneficiarioNombre: beneficiario,
            fechaCompetencia,
            fechaVencimiento,
            moneda: dto.moneda ?? 'ARS',
            neto,
            iva,
            otrosImpuestos: otros,
            total,
            tipoComprobante: dto.tipoComprobante ?? null,
            puntoVenta: dto.puntoVenta?.trim() || null,
            numeroComprobante: dto.numeroComprobante?.trim() || null,
            estado: 'pendiente',
            origen: 'manual',
            centroCostoId: dto.centroCostoId ?? null,
            gastoFijoEstructuraId: dto.gastoFijoEstructuraId ?? null,
            empleadoId: dto.empleadoId ?? null,
            registradoPorNombre: registradoPor,
            notas: dto.notas?.trim() || null,
          },
        });

        if (dto.pago) {
          await this.registrarPagoEnTx(
            tx,
            auth,
            {
              metodoPagoId: dto.pago.metodoPagoId,
              cuentaOrigenId: dto.pago.cuentaOrigenId,
              fecha: dto.pago.fecha,
              referencia: dto.pago.referencia,
              imputaciones: [{ egresoId: egreso.id, monto: total }],
            },
            registradoPor,
          );
        }

        return { id: egreso.id, numero: egreso.numero };
      });
    } catch (e) {
      // El único de documento es el antiduplicado: la misma factura del mismo
      // proveedor no se carga dos veces.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const yaEsta = await this.prisma.egreso.findFirst({
          where: {
            tenantId: auth.tenantId,
            proveedorId: dto.proveedorId ?? null,
            tipoComprobante: dto.tipoComprobante ?? null,
            puntoVenta: dto.puntoVenta?.trim() || null,
            numeroComprobante: dto.numeroComprobante?.trim() || null,
          },
          select: { numero: true, total: true, fechaCompetencia: true },
        });
        throw new ConflictException(
          yaEsta
            ? `Esa factura ya está cargada como ${yaEsta.numero} por $${dec(yaEsta.total)}.`
            : 'Esa factura ya está cargada.',
        );
      }
      throw e;
    }
  }

  /**
   * Corrige un egreso.
   *
   * Lo que bloquea el pago son los IMPORTES, no la clasificación. Reclasificar
   * (poner la nafta en Vehículo en vez de Materiales) o corregir el mes de
   * competencia no mueve un peso, y es justamente lo que uno descubre DESPUÉS
   * de pagar, cuando mira el reporte. Bloquearlo obligaba a anular el pago
   * —con su contramovimiento— sólo para arreglar una etiqueta.
   *
   * Los importes sí: bajar el total por debajo de lo ya pagado rompería la
   * invariante `pagadoTotal <= total` y dejaría el saldo del proveedor en
   * negativo sin nada que lo explique.
   */
  async editar(auth: CurrentAuth, id: string, dto: EditarEgresoDto) {
    const egreso = await this.prisma.egreso.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, estado: true, pagadoTotal: true },
    });
    if (!egreso) throw new NotFoundException('No encontramos ese egreso.');
    if (egreso.estado === 'anulado') {
      throw new ConflictException('Un egreso anulado no se edita.');
    }
    const tienePagos = dec(egreso.pagadoTotal) > 0;
    const tocaImportes =
      dto.neto !== undefined ||
      dto.iva !== undefined ||
      dto.otrosImpuestos !== undefined;
    if (tienePagos && tocaImportes) {
      throw new ConflictException(
        'Ese egreso ya tiene pagos: para cambiarle el importe hay que anular el pago primero. La categoría y las fechas sí se pueden corregir.',
      );
    }
    const data: Prisma.EgresoUpdateInput = {};
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion.trim();
    if (dto.categoriaEgresoId !== undefined) {
      data.categoria = { connect: { id: dto.categoriaEgresoId } };
    }
    if (dto.fechaCompetencia !== undefined) {
      data.fechaCompetencia = soloFecha(dto.fechaCompetencia);
    }
    if (dto.fechaVencimiento !== undefined) {
      data.fechaVencimiento = soloFecha(dto.fechaVencimiento);
    }
    if (dto.centroCostoId !== undefined) {
      data.centroCosto = { connect: { id: dto.centroCostoId } };
    }
    if (dto.notas !== undefined) data.notas = dto.notas.trim() || null;
    if (tocaImportes) {
      const actual = await this.prisma.egreso.findUniqueOrThrow({
        where: { id },
        select: { neto: true, iva: true, otrosImpuestos: true },
      });
      const neto = r2(dto.neto ?? dec(actual.neto));
      const iva = r2(dto.iva ?? dec(actual.iva));
      const otros = r2(dto.otrosImpuestos ?? dec(actual.otrosImpuestos));
      data.neto = neto;
      data.iva = iva;
      data.otrosImpuestos = otros;
      data.total = r2(neto + iva + otros);
    }
    await this.prisma.egreso.update({ where: { id }, data });
    return { ok: true };
  }

  /**
   * Anula el egreso. No se borra: `anuladoEl` + motivo, patrón Cobro/Comprobante.
   * Con pagos vivos no se puede: primero se anula el pago, porque anular el
   * egreso dejaría un movimiento de fondos sin nada que lo explique.
   */
  async anular(auth: CurrentAuth, id: string, dto: AnularDto) {
    const egreso = await this.prisma.egreso.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, estado: true, pagadoTotal: true },
    });
    if (!egreso) throw new NotFoundException('No encontramos ese egreso.');
    if (egreso.estado === 'anulado') {
      throw new ConflictException('Ese egreso ya está anulado.');
    }
    if (dec(egreso.pagadoTotal) > 0) {
      throw new ConflictException(
        'Ese egreso tiene pagos registrados: anulá primero el pago.',
      );
    }
    await this.prisma.egreso.update({
      where: { id },
      data: {
        estado: 'anulado',
        anuladoEl: new Date(),
        motivoAnulacion: dto.motivo.trim(),
      },
    });
    return { ok: true };
  }

  // ── Pagos ──────────────────────────────────────────────────────────────

  async registrarPago(auth: CurrentAuth, dto: RegistrarPagoDto) {
    if (dto.imputaciones.length === 0) {
      throw new BadRequestException('Indicá qué egresos estás pagando.');
    }
    const registradoPor = await this.nombreActor(auth);
    return this.prisma.$transaction((tx) =>
      this.registrarPagoEnTx(tx, auth, dto, registradoPor),
    );
  }

  /**
   * El acto de pagar, dentro de una transacción para que pueda compartirse con
   * la creación del egreso de contado (el "ya está pagado" del formulario).
   */
  private async registrarPagoEnTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    dto: RegistrarPagoDto,
    registradoPor: string,
  ) {
    const metodo = await tx.metodoPago.findFirst({
      where: { id: dto.metodoPagoId, tenantId: auth.tenantId },
      select: { id: true, nombre: true, tipo: true },
    });
    if (!metodo) throw new NotFoundException('Ese método de pago no existe.');
    // Con cheque la factura queda saldada pero la plata NO sale todavía: el
    // valor va a cartera y recién impacta la cuenta cuando se debita. Es el
    // mismo criterio que usa Cobros con los cheques de terceros.
    const esCheque = metodo.tipo === 'cheque_echeq';
    if (esCheque && !dto.cheque && !dto.valorId) {
      throw new BadRequestException(
        'Pagando con cheque hay que emitir uno propio o endosar uno de la cartera.',
      );
    }
    if (dto.cheque && dto.valorId) {
      throw new BadRequestException(
        'Es un cheque propio o uno endosado, no las dos cosas.',
      );
    }
    if (!esCheque && (dto.cheque || dto.valorId)) {
      throw new BadRequestException(
        'Los datos del cheque sólo aplican a un método de tipo cheque.',
      );
    }
    const cuenta = await tx.cuentaFondos.findFirst({
      where: { id: dto.cuentaOrigenId, tenantId: auth.tenantId },
      select: { id: true, nombre: true, moneda: true },
    });
    if (!cuenta) throw new NotFoundException('Esa cuenta no existe.');

    const egresos = await tx.egreso.findMany({
      where: {
        id: { in: dto.imputaciones.map((i) => i.egresoId) },
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        numero: true,
        total: true,
        pagadoTotal: true,
        estado: true,
        moneda: true,
        proveedorId: true,
        beneficiarioNombre: true,
      },
    });
    if (egresos.length !== dto.imputaciones.length) {
      throw new NotFoundException('Alguno de los egresos no existe.');
    }
    const porId = new Map(egresos.map((e) => [e.id, e]));

    for (const imp of dto.imputaciones) {
      const e = porId.get(imp.egresoId)!;
      if (e.estado === 'anulado') {
        throw new ConflictException(`${e.numero} está anulado.`);
      }
      const saldo = r2(dec(e.total) - dec(e.pagadoTotal));
      // Pagar de más no es un detalle: dejaría `pagadoTotal > total` y el saldo
      // del proveedor en negativo sin que nada lo explique.
      if (r2(imp.monto) > saldo + 0.005) {
        throw new BadRequestException(
          `${e.numero} debe $${saldo.toLocaleString('es-AR')} y estás imputando $${r2(imp.monto).toLocaleString('es-AR')}.`,
        );
      }
      if (e.moneda !== cuenta.moneda) {
        throw new BadRequestException(
          `${e.numero} está en ${e.moneda} y la cuenta en ${cuenta.moneda}. Pagá desde una cuenta en ${e.moneda}.`,
        );
      }
    }

    const proveedorIds = new Set(
      egresos.map((e) => e.proveedorId).filter((p): p is string => Boolean(p)),
    );
    if (proveedorIds.size > 1) {
      throw new BadRequestException(
        'Un pago es de un solo proveedor: una orden de pago se le manda a alguien.',
      );
    }

    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const montoBruto = r2(
      dto.imputaciones.reduce((acc, i) => acc + i.monto, 0),
    );
    // La retención SALDA la factura pero no sale de la cuenta: se la quedamos
    // nosotros para depositarla al fisco. Por eso reduce el neto y no el
    // imputado — confundir las dos cosas deja al proveedor debiendo plata que
    // en realidad ya se le retuvo.
    const retenciones = dto.retenciones ?? [];
    const retencionesTotal = r2(
      retenciones.reduce((acc, r) => acc + r.monto, 0),
    );
    if (retencionesTotal > montoBruto) {
      throw new BadRequestException(
        'Las retenciones no pueden superar el monto del pago.',
      );
    }
    const montoNeto = r2(montoBruto - retencionesTotal);
    const numero = await this.numerarPago(tx, auth.tenantId, fecha);

    const pago = await tx.pago.create({
      data: {
        tenantId: auth.tenantId,
        numero,
        fecha,
        metodoPagoId: metodo.id,
        cuentaOrigenId: cuenta.id,
        montoBruto,
        retencionesTotal,
        montoNeto,
        moneda: cuenta.moneda,
        proveedorId: [...proveedorIds][0] ?? null,
        referencia: dto.referencia?.trim() || null,
        registradoPorNombre: registradoPor,
        notas: dto.notas?.trim() || null,
        retenciones: {
          create: retenciones.map((r) => ({
            tenantId: auth.tenantId,
            direccion: 'practicada',
            regimen: r.regimen,
            jurisdiccion: r.jurisdiccion ?? null,
            base: r.base,
            alicuota: r.alicuota,
            monto: r.monto,
            nroComprobante: r.nroComprobante ?? null,
            periodoFiscal: fecha.toISOString().slice(0, 7),
          })),
        },
      },
    });

    for (const imp of dto.imputaciones) {
      const e = porId.get(imp.egresoId)!;
      const monto = r2(imp.monto);
      await tx.pagoImputacion.create({
        data: {
          tenantId: auth.tenantId,
          pagoId: pago.id,
          egresoId: e.id,
          monto,
        },
      });
      const pagado = r2(dec(e.pagadoTotal) + monto);
      await tx.egreso.update({
        where: { id: e.id },
        data: {
          pagadoTotal: pagado,
          estado: estadoPorPagado(dec(e.total), pagado),
        },
      });
    }

    const concepto =
      egresos.length === 1
        ? `Pago ${numero} · ${egresos[0].beneficiarioNombre} (${egresos[0].numero})`
        : `Pago ${numero} · ${egresos[0].beneficiarioNombre} (${egresos.length} egresos)`;

    if (esCheque && dto.cheque) {
      // El cheque va a CARTERA: la factura queda saldada pero la cuenta no se
      // toca hasta que el banco lo debite. Registrar la salida acá haría ver
      // un saldo que todavía existe como menor de lo que es.
      const valor = await tx.valor.create({
        data: {
          tenantId: auth.tenantId,
          origen: 'propio',
          formato: dto.cheque.formato,
          modalidad: dto.cheque.fechaPago ? 'diferido' : 'comun',
          numero: dto.cheque.numero.trim(),
          banco: dto.cheque.banco.trim(),
          importe: montoNeto,
          moneda: cuenta.moneda,
          fechaEmision: dto.cheque.fechaEmision
            ? new Date(dto.cheque.fechaEmision)
            : fecha,
          fechaPago: dto.cheque.fechaPago
            ? new Date(dto.cheque.fechaPago)
            : null,
          estado: 'cartera',
          proveedorId: [...proveedorIds][0] ?? null,
        },
      });
      // El vínculo va en los dos sentidos: sin esto, anular el pago no sabría
      // qué cheque tiene que dar de baja.
      await tx.pago.update({
        where: { id: pago.id },
        data: { valorId: valor.id },
      });
    } else if (esCheque && dto.valorId) {
      /*
        ENDOSO: el cheque que entró por un cobro se le pasa al proveedor.

        Tampoco toca la cuenta, y por una razón distinta a la del cheque
        propio: esta plata NUNCA estuvo en una cuenta. El cobro con cheque no
        genera movimiento —acredita recién cuando el valor se deposita—, así
        que el cheque va de la cartera a manos del proveedor sin pasar por el
        banco. Un movimiento acá inventaría una salida de algo que nunca entró.
      */
      const valor = await tx.valor.findFirst({
        where: { id: dto.valorId, tenantId: auth.tenantId },
      });
      if (!valor) throw new NotFoundException('Ese cheque no existe.');
      if (valor.origen !== 'tercero') {
        throw new BadRequestException(
          'Sólo se endosan cheques de terceros. Los propios se emiten.',
        );
      }
      if (valor.estado !== 'cartera') {
        throw new ConflictException(
          `Ese cheque ya no está en cartera (${valor.estado}).`,
        );
      }
      /*
        Un cheque no se parte: se endosa entero. Si no coincide con lo que se
        paga habría que manejar vuelto o saldo a favor, que hoy no existe —y
        dejarlo pasar escondería una diferencia en la cuenta del proveedor.
      */
      if (r2(dec(valor.importe)) !== montoNeto) {
        throw new BadRequestException(
          `El cheque es de ${dec(valor.importe)} y estás pagando ${montoNeto}. Un cheque se endosa por su importe exacto.`,
        );
      }
      if (valor.moneda !== cuenta.moneda) {
        throw new BadRequestException(
          `El cheque está en ${valor.moneda} y el pago en ${cuenta.moneda}.`,
        );
      }

      await tx.valor.update({
        where: { id: valor.id },
        data: {
          estado: 'endosado',
          // A quién se lo endosamos: sin esto la cartera no sabe dónde fue.
          proveedorId: [...proveedorIds][0] ?? null,
        },
      });
      await tx.pago.update({
        where: { id: pago.id },
        data: { valorId: valor.id },
      });
    } else {
      // La plata sale YA, y sale el NETO: lo retenido no se le paga al
      // proveedor, se deposita al fisco.
      const cuentaAct = await tx.cuentaFondos.update({
        where: { id: cuenta.id },
        data: { saldo: { decrement: montoNeto } },
      });
      await tx.movimientoFondos.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          fecha,
          tipo: 'salida',
          monto: montoNeto,
          concepto:
            retencionesTotal > 0
              ? `${concepto} · neto de retenciones`
              : concepto,
          origenTipo: 'pago',
          pagoId: pago.id,
          saldoPosterior: Number(cuentaAct.saldo),
        },
      });
    }

    return {
      id: pago.id,
      numero: pago.numero,
      montoBruto,
      retencionesTotal,
      montoNeto,
      /**
       * El pago no movió ninguna cuenta. Vale para los dos caminos del cheque
       * y por razones distintas: el propio ENTRA a cartera y se debita
       * después; el endosado SALE de cartera y esa plata nunca estuvo en el
       * banco. Lo que comparten —y es lo único que el front necesita saber—
       * es que el saldo no cambió.
       */
      enCartera: esCheque,
    };
  }

  /**
   * Anula un pago: los egresos vuelven a deber y el movimiento se REVIERTE con
   * un contramovimiento, nunca se borra. El pago rechazado queda en el
   * historial — se intentó y falló, y eso es información.
   */
  async anularPago(auth: CurrentAuth, id: string, dto: AnularDto) {
    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { imputaciones: true },
      });
      if (!pago) throw new NotFoundException('No encontramos ese pago.');
      if (pago.anuladoEl) {
        throw new ConflictException('Ese pago ya está anulado.');
      }

      for (const imp of pago.imputaciones) {
        const e = await tx.egreso.findUniqueOrThrow({
          where: { id: imp.egresoId },
          select: { total: true, pagadoTotal: true },
        });
        const pagado = Math.max(0, r2(dec(e.pagadoTotal) - dec(imp.monto)));
        await tx.egreso.update({
          where: { id: imp.egresoId },
          data: {
            pagadoTotal: pagado,
            estado: estadoPorPagado(dec(e.total), pagado),
          },
        });
      }

      // Se devuelve el NETO, que es lo que efectivamente salió: con
      // retenciones, el bruto nunca tocó la cuenta.
      const monto = dec(pago.montoNeto);
      const salioDeLaCuenta = await tx.movimientoFondos.count({
        where: { tenantId: auth.tenantId, pagoId: pago.id, tipo: 'salida' },
      });
      if (salioDeLaCuenta > 0) {
        const cuentaAct = await tx.cuentaFondos.update({
          where: { id: pago.cuentaOrigenId },
          data: { saldo: { increment: monto } },
        });
        await tx.movimientoFondos.create({
          data: {
            tenantId: auth.tenantId,
            cuentaId: pago.cuentaOrigenId,
            fecha: new Date(),
            tipo: 'entrada',
            monto,
            concepto: `Anulación del pago ${pago.numero}: ${dto.motivo.trim()}`,
            origenTipo: 'pago',
            pagoId: pago.id,
            saldoPosterior: Number(cuentaAct.saldo),
          },
        });
      }
      // Si se pagó con cheque, la plata nunca salió: lo que hay que deshacer
      // es el valor en cartera, no un movimiento que no existe. Un cheque ya
      // debitado NO se puede anular así — la plata ya se fue del banco.
      if (pago.valorId) {
        const valor = await tx.valor.findUnique({
          where: { id: pago.valorId },
          select: { estado: true, origen: true },
        });
        /*
          Deshacer el pago con cheque NO es lo mismo según de quién sea:

          · PROPIO — lo emitimos nosotros para este pago. Si el pago se cae, el
            cheque no tiene por qué existir: queda rechazado.
          · ENDOSADO — es de un tercero y entró por un cobro. El pago se cae
            pero el cheque sigue siendo nuestro: VUELVE A CARTERA para poder
            usarlo en otra cosa. Marcarlo rechazado lo haría desaparecer de la
            cartera y perderíamos plata cobrada.
        */
        const enJuego = valor?.origen === 'tercero' ? 'endosado' : 'cartera';
        if (valor && valor.estado !== enJuego) {
          throw new ConflictException(
            valor.origen === 'tercero'
              ? `Ese cheque ya no está endosado (${valor.estado}): revisá el valor antes de anular.`
              : 'Ese cheque ya fue debitado: no se puede anular el pago sin revertir el valor primero.',
          );
        }
        await tx.valor.update({
          where: { id: pago.valorId },
          data:
            valor?.origen === 'tercero'
              ? { estado: 'cartera', proveedorId: null }
              : { estado: 'rechazado', motivoRechazo: dto.motivo.trim() },
        });
      }

      await tx.pago.update({
        where: { id },
        data: { anuladoEl: new Date(), motivoAnulacion: dto.motivo.trim() },
      });
      return { ok: true };
    });
  }

  async pagosDeEgreso(auth: CurrentAuth, egresoId: string) {
    const imputaciones = await this.prisma.pagoImputacion.findMany({
      where: { tenantId: auth.tenantId, egresoId },
      include: {
        pago: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            referencia: true,
            anuladoEl: true,
            motivoAnulacion: true,
            registradoPorNombre: true,
            metodoPago: { select: { nombre: true } },
            cuentaOrigen: { select: { nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      pagos: imputaciones.map((i) => ({
        id: i.pago.id,
        numero: i.pago.numero,
        fecha: i.pago.fecha.toISOString(),
        monto: dec(i.monto),
        metodoNombre: i.pago.metodoPago.nombre,
        cuentaNombre: i.pago.cuentaOrigen.nombre,
        referencia: i.pago.referencia,
        anuladoEl: i.pago.anuladoEl ? i.pago.anuladoEl.toISOString() : null,
        motivoAnulacion: i.pago.motivoAnulacion,
        registradoPorNombre: i.pago.registradoPorNombre,
      })),
    };
  }

  // ── Reporte ────────────────────────────────────────────────────────────

  /**
   * "¿En qué se me va la plata?" — por categoría y por naturaleza.
   *
   * Se agrupa por COMPETENCIA y no por fecha de pago: la luz de julio pagada
   * en agosto es gasto de julio. Es la misma razón por la que el contador pide
   * el período devengado y no el extracto bancario.
   *
   * Y separa lo que INCIDE EN RESULTADO de lo que sólo mueve caja: una
   * guillotina de $3.500.000 haría ver un julio catastrófico si se sumara al
   * gasto, un retiro de socios no es un gasto, y un adelanto de sueldo es
   * plata que el empleado debe. Los tres salen de la caja igual, así que se
   * informan aparte en vez de esconderse.
   */
  async reporte(auth: CurrentAuth, q: { desde?: string; hasta?: string }) {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoy = hoyEnZona(zonaHoraria);
    // Default: el mes en curso, que es lo que uno mira sin pensar.
    const desde = q.desde ?? `${hoy.slice(0, 7)}-01`;
    const hasta = q.hasta ?? hoy;

    const filas = await this.prisma.egreso.findMany({
      where: {
        tenantId: auth.tenantId,
        // Un anulado no es un gasto: no puede aparecer en ningún total.
        estado: { not: 'anulado' },
        fechaCompetencia: { gte: soloFecha(desde), lte: soloFecha(hasta) },
      },
      select: {
        total: true,
        categoriaEgresoId: true,
        categoria: { select: { nombre: true, naturaleza: true } },
      },
    });

    const porCategoria = new Map<
      string,
      {
        categoriaId: string;
        nombre: string;
        naturaleza: NaturalezaEgreso;
        monto: number;
        egresos: number;
      }
    >();
    const porNaturaleza = new Map<NaturalezaEgreso, number>();
    let totalSalida = 0;
    let totalResultado = 0;

    for (const f of filas) {
      const monto = dec(f.total);
      const naturaleza = f.categoria.naturaleza;
      totalSalida += monto;
      if (incideEnResultado(naturaleza)) totalResultado += monto;
      porNaturaleza.set(
        naturaleza,
        (porNaturaleza.get(naturaleza) ?? 0) + monto,
      );
      const actual = porCategoria.get(f.categoriaEgresoId) ?? {
        categoriaId: f.categoriaEgresoId,
        nombre: f.categoria.nombre,
        naturaleza,
        monto: 0,
        egresos: 0,
      };
      actual.monto += monto;
      actual.egresos += 1;
      porCategoria.set(f.categoriaEgresoId, actual);
    }

    return {
      desde,
      hasta,
      /** Todo lo que salió de la caja en el período. */
      totalSalida: r2(totalSalida),
      /** Sólo lo que es gasto: costo de producción + estructura. */
      totalResultado: r2(totalResultado),
      egresos: filas.length,
      naturalezas: [...porNaturaleza.entries()]
        .map(([naturaleza, monto]) => ({
          naturaleza,
          monto: r2(monto),
          // El % se calcula sobre la SALIDA total y no sobre el resultado: si
          // no, las naturalezas que no son gasto sumarían más de 100%.
          pct: totalSalida > 0 ? r2((monto / totalSalida) * 100) : 0,
          incideEnResultado: incideEnResultado(naturaleza),
        }))
        .sort((a, b) => b.monto - a.monto),
      categorias: [...porCategoria.values()]
        .map((c) => ({
          ...c,
          monto: r2(c.monto),
          pct: totalSalida > 0 ? r2((c.monto / totalSalida) * 100) : 0,
        }))
        .sort((a, b) => b.monto - a.monto),
    };
  }

  /**
   * Saldo por proveedor con antigüedad (journey E2) — el espejo de la matriz
   * de deudores, del otro lado del mostrador.
   *
   * Reusa el `aging` de Cuentas por cobrar, pero acá el tramo "a vencer" SÍ se
   * llena: del lado de compras hay vencimientos reales, mientras que en CxC la
   * deuda nace de la orden terminada y todo lo finalizado es exigible.
   *
   * Los egresos sin proveedor se agrupan en una fila propia: son deuda igual
   * (el flete sin factura, la multa) y esconderlos haría que la suma no cierre
   * contra el total a pagar.
   */
  /**
   * Los cheques de terceros disponibles para endosar.
   *
   * Salen de los cobros con cheque: el cliente paga con uno, queda en cartera,
   * y desde acá se le puede endosar a un proveedor. Los propios NO entran
   * —ésos se emiten, no se endosan— ni los que ya salieron de la cartera.
   */
  async valoresEnCartera(auth: CurrentAuth) {
    const valores = await this.prisma.valor.findMany({
      where: { tenantId: auth.tenantId, origen: 'tercero', estado: 'cartera' },
      include: { cliente: { select: { nombre: true } } },
      // Por fecha de pago: el diferido que vence antes conviene usarlo antes.
      orderBy: [{ fechaPago: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    return {
      valores: valores.map((v) => ({
        id: v.id,
        numero: v.numero,
        banco: v.banco,
        importe: dec(v.importe),
        moneda: v.moneda,
        formato: v.formato,
        modalidad: v.modalidad,
        fechaPago: v.fechaPago ? v.fechaPago.toISOString().slice(0, 10) : null,
        /** De quién lo recibimos: es lo que lo identifica al elegirlo. */
        clienteNombre: v.cliente?.nombre ?? null,
      })),
    };
  }

  async saldosPorProveedor(auth: CurrentAuth) {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoy = soloFecha(hoyEnZona(zonaHoraria));

    const filas = await this.prisma.egreso.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { not: null },
      },
      select: {
        proveedorId: true,
        beneficiarioNombre: true,
        fechaVencimiento: true,
        total: true,
        pagadoTotal: true,
        proveedor: { select: { nombre: true, cuit: true } },
      },
    });

    const porProveedor = new Map<
      string,
      {
        proveedorId: string | null;
        nombre: string;
        cuit: string | null;
        comps: ComprobanteAging[];
        egresos: number;
      }
    >();
    for (const f of filas) {
      const saldo = r2(dec(f.total) - dec(f.pagadoTotal));
      if (saldo <= 0) continue;
      const clave = f.proveedorId ?? 'sin-proveedor';
      const actual = porProveedor.get(clave) ?? {
        proveedorId: f.proveedorId,
        nombre: f.proveedorId
          ? (f.proveedor?.nombre ?? f.beneficiarioNombre)
          : 'Sin proveedor',
        cuit: f.proveedorId ? (f.proveedor?.cuit ?? null) : null,
        comps: [],
        egresos: 0,
      };
      actual.comps.push({ vencimiento: f.fechaVencimiento, saldo });
      actual.egresos += 1;
      porProveedor.set(clave, actual);
    }

    const proveedores = [...porProveedor.values()]
      .map((p) => {
        const aging = calcularAging(p.comps, hoy);
        return {
          proveedorId: p.proveedorId,
          nombre: p.nombre,
          cuit: p.cuit,
          egresos: p.egresos,
          aging,
          total: totalAging(aging),
          vencidoGrave: vencidoGrave(aging),
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      proveedores,
      total: r2(proveedores.reduce((acc, p) => acc + p.total, 0)),
    };
  }

  // ── Resumen ────────────────────────────────────────────────────────────

  /**
   * Los números de la cabecera. `aPagar` y `vencido` son la pregunta real del
   * lunes a la mañana: qué hay que pagar y qué ya se pasó.
   */
  async resumen(auth: CurrentAuth) {
    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const hoy = soloFecha(hoyEnZona(zonaHoraria));
    const en7 = new Date(hoy);
    en7.setUTCDate(en7.getUTCDate() + 7);

    const pendientes = await this.prisma.egreso.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { not: null },
      },
      select: { total: true, pagadoTotal: true, fechaVencimiento: true },
    });

    let aPagar = 0;
    let vencido = 0;
    let estaSemana = 0;
    for (const e of pendientes) {
      const saldo = r2(dec(e.total) - dec(e.pagadoTotal));
      aPagar += saldo;
      if (e.fechaVencimiento && e.fechaVencimiento < hoy) vencido += saldo;
      else if (e.fechaVencimiento && e.fechaVencimiento <= en7) {
        estaSemana += saldo;
      }
    }

    const saldos = await this.prisma.cuentaFondos.aggregate({
      where: { tenantId: auth.tenantId, activo: true },
      _sum: { saldo: true },
    });

    return {
      aPagar: r2(aPagar),
      vencido: r2(vencido),
      estaSemana: r2(estaSemana),
      cuentas: dec(saldos._sum.saldo),
      egresosPendientes: pendientes.length,
    };
  }
}
