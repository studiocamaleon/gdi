import { Injectable } from '@nestjs/common';
import { RolSistema, type Prisma } from '@prisma/client';

import type { CurrentAuth } from '../auth/auth.types';
import { expandir, ROLES_PREDEFINIDOS } from '../auth/permisos';
import { claveFechaEnZona, sumarDiasAClave } from '../common/zona';
import { regionalDelTenant } from '../common/regional';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import { PrismaService } from '../prisma/prisma.service';

type KpiFormato = 'cantidad' | 'moneda';
type Tono = 'neutro' | 'ok' | 'atencion' | 'critico';
type Severidad = 'critico' | 'atencion' | 'info';
type Dominio = 'comercial' | 'produccion' | 'administracion';

export type VistaPanelGeneral =
  | 'actual'
  | 'jefe_produccion'
  | 'vendedor'
  | 'administrativo'
  | 'operario';

const VISTAS_PANEL: Array<{
  id: VistaPanelGeneral;
  etiqueta: string;
  descripcion: string;
}> = [
  {
    id: 'actual',
    etiqueta: 'Mi vista · Administrador',
    descripcion: 'Tus permisos efectivos',
  },
  {
    id: 'jefe_produccion',
    etiqueta: 'Jefe de producción',
    descripcion: 'Taller, entregas y carga',
  },
  {
    id: 'vendedor',
    etiqueta: 'Vendedor',
    descripcion: 'Sus presupuestos y órdenes',
  },
  {
    id: 'administrativo',
    etiqueta: 'Administrativo',
    descripcion: 'Cobros, facturación y egresos',
  },
  {
    id: 'operario',
    etiqueta: 'Operario',
    descripcion: 'Su mesa y bloqueos propios',
  },
];

const VISTAS_VALIDAS = new Set<VistaPanelGeneral>(
  VISTAS_PANEL.map((vista) => vista.id),
);

export type PanelKpi = {
  id: string;
  etiqueta: string;
  valor: number;
  formato: KpiFormato;
  tono: Tono;
  detalle: string;
  href: string;
};

export type PanelAtencion = {
  id: string;
  dominio: Dominio;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  cantidad: number;
  href: string;
};

type EntregaPanel = {
  id: string;
  numero: string;
  cliente: string | null;
  producto: string;
  fechaEntrega: string;
  progresoPct: number;
  riesgo: 'atrasada' | 'hoy' | 'proxima';
  pasoActual: string | null;
  estacionActual: string | null;
  href: string;
};

type TareaPersonal = {
  pasoId: string;
  ordenId: string;
  ordenNumero: string;
  itemNombre: string;
  pasoNombre: string;
  estado: string;
  motivoBloqueo: string | null;
  activa: boolean;
  href: string;
};

type AccionRapida = {
  id: string;
  etiqueta: string;
  href: string;
  icono:
    | 'orden'
    | 'presupuesto'
    | 'produccion'
    | 'estaciones'
    | 'cobro'
    | 'egreso'
    | 'facturacion';
};

type Tablero = Awaited<ReturnType<OrdenesTrabajoService['tablero']>>;
type TableroItem = Tablero['items'][number];

type ResumenProduccion = {
  entregasHoy: number;
  atrasadas: number;
  enProduccion: number;
  bloqueados: number;
  listosRetiro: number;
};

type ResumenAdministracion = {
  deudaVencidaCantidad: number;
  deudaVencidaMonto: number;
  facturacionPendienteCantidad: number;
  facturacionPendienteMonto: number;
  egresosVencidosCantidad: number;
  egresosVencidosMonto: number;
  egresosProximosCantidad: number;
  acreditacionesPendientes: number;
  acreditacionesProblematicas: number;
};

const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  critico: 0,
  atencion: 1,
  info: 2,
};

const fechaDb = (clave: string) => new Date(`${clave}T00:00:00.000Z`);
const dinero = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

@Injectable()
export class PanelGeneralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenesTrabajo: OrdenesTrabajoService,
  ) {}

  async obtener(auth: CurrentAuth, vistaSolicitada?: VistaPanelGeneral) {
    const permisosReales = auth.permisos ?? new Set<string>();
    const puedePrevisualizar =
      auth.role === RolSistema.ADMINISTRADOR &&
      permisosReales.has('configuracion.gestionar');
    const vistaActual =
      puedePrevisualizar &&
      vistaSolicitada &&
      VISTAS_VALIDAS.has(vistaSolicitada)
        ? vistaSolicitada
        : 'actual';
    const rolPrevisualizado =
      vistaActual === 'actual'
        ? null
        : ROLES_PREDEFINIDOS.find((rol) => rol.codigo === vistaActual);
    const permisos = rolPrevisualizado
      ? expandir(rolPrevisualizado.permisos)
      : permisosReales;
    const authDeVista: CurrentAuth = { ...auth, permisos };
    const veComercial = permisos.has('comercial.ver');
    const gestionaComercial = permisos.has('comercial.gestionar');
    const veProduccion = permisos.has('produccion.ver');
    const gestionaProduccion = permisos.has('produccion.gestionar');
    const gestionaAdministracion = permisos.has('administracion.gestionar');
    const cobra = permisos.has('administracion.cobrar');
    const aprueba = permisos.has('comercial.aprobar_descuento');
    const perfilSoloProductivo =
      veProduccion &&
      (gestionaProduccion || permisos.has('produccion.ejecutar')) &&
      !veComercial &&
      !gestionaAdministracion;
    const comercialSoloPropio =
      gestionaComercial &&
      !gestionaAdministracion &&
      !gestionaProduccion &&
      !permisos.has('reportes.ver_resumen');

    const { zonaHoraria } = await regionalDelTenant(this.prisma, auth.tenantId);
    const ahora = new Date();
    const hoy = claveFechaEnZona(ahora, zonaHoraria);
    const enTres = sumarDiasAClave(hoy, 3);
    const enSiete = sumarDiasAClave(hoy, 7);

    const empleado = comercialSoloPropio
      ? await this.prisma.empleado.findFirst({
          where: { tenantId: auth.tenantId, userId: auth.userId, activo: true },
          select: { id: true },
        })
      : null;
    const vendedorSinVinculo = comercialSoloPropio && !empleado;
    const filtroVendedor = comercialSoloPropio
      ? empleado
        ? { vendedorEmpleadoId: empleado.id }
        : { vendedorEmpleadoId: '__sin_empleado__' }
      : {};

    const tableroPromise = veProduccion
      ? this.ordenesTrabajo.tablero(authDeVista)
      : Promise.resolve<Tablero>({
          items: [],
          alcance: 'completo',
          puedeGestionar: false,
          estacionIdsEjecutables: null,
          vendedorSinVinculo: false,
        });

    const [tablero, ordenesProximas, comerciales, administracion, cuello] =
      await Promise.all([
        tableroPromise,
        perfilSoloProductivo || (!veProduccion && !veComercial)
          ? Promise.resolve([])
          : this.ordenesProximas(auth.tenantId, hoy, enSiete, filtroVendedor),
        veComercial && !vendedorSinVinculo
          ? this.resumenComercial(auth.tenantId, hoy, enTres, filtroVendedor)
          : Promise.resolve({ pendientesAprobacion: 0, porVencer: 0 }),
        gestionaAdministracion
          ? this.resumenAdministracion(auth.tenantId, hoy, enSiete)
          : Promise.resolve<ResumenAdministracion | null>(null),
        veProduccion && !perfilSoloProductivo && !comercialSoloPropio
          ? this.cuelloBotella(auth.tenantId, hoy)
          : Promise.resolve(null),
      ]);

    const prod = veProduccion
      ? await this.resumenProduccion(
          auth.tenantId,
          hoy,
          filtroVendedor,
          tablero,
          perfilSoloProductivo,
        )
      : {
          entregasHoy: 0,
          atrasadas: 0,
          enProduccion: 0,
          bloqueados: 0,
          listosRetiro: 0,
        };
    const atencion = this.armarAtencion({
      prod,
      comerciales,
      administracion,
      vendedorSinVinculo,
      aprueba,
      veComercial,
      veProduccion,
    });
    const trabajoPersonal = this.trabajoPersonal(tablero);

    return {
      generadoEl: ahora.toISOString(),
      fechaLocal: hoy,
      vistaActual,
      previsualizando: vistaActual !== 'actual',
      vistasDisponibles: puedePrevisualizar
        ? VISTAS_PANEL
        : VISTAS_PANEL.slice(0, 1),
      kpis: this.armarKpis(prod, administracion, veProduccion),
      atencion: atencion.slice(0, 8),
      atencionTotal: atencion.length,
      proximasEntregas: ordenesProximas.slice(0, 6),
      proximasEntregasTotal: ordenesProximas.length,
      trabajoPersonal,
      taller:
        veProduccion && !perfilSoloProductivo && !comercialSoloPropio
          ? {
              itemsActivos: tablero.items.length,
              pasosEnCurso: this.pasos(tablero).filter(
                (p) => p.estado === 'en_curso',
              ).length,
              pasosBloqueados: prod.bloqueados,
              cuelloBotella: cuello,
            }
          : null,
      administracion: administracion
        ? {
            cobrosVencidos: administracion.deudaVencidaCantidad,
            porFacturar: administracion.facturacionPendienteCantidad,
            pagosVencidos: administracion.egresosVencidosCantidad,
            acreditacionesPendientes: administracion.acreditacionesPendientes,
          }
        : null,
      vendedorSinVinculo,
      accionesRapidas: this.accionesRapidas({
        gestionaComercial,
        veProduccion,
        gestionaProduccion,
        gestionaAdministracion,
        cobra,
        perfilSoloProductivo,
      }),
    };
  }

  private pasos(tablero: Tablero) {
    return tablero.items.flatMap((item) => item.pasos);
  }

  private progreso(item: TableroItem) {
    if (item.sinRuta) return 100;
    if (item.pasos.length === 0) return 0;
    const hechos = item.pasos.filter((p) => p.estado === 'hecho').length;
    return Math.round((hechos / item.pasos.length) * 100);
  }

  private pasoActual(item: TableroItem) {
    return (
      item.pasos.find((p) =>
        ['en_curso', 'pausado', 'bloqueado'].includes(p.estado),
      ) ?? item.pasos.find((p) => p.estado !== 'hecho')
    );
  }

  private async resumenProduccion(
    tenantId: string,
    hoy: string,
    filtroVendedor: Prisma.OrdenTrabajoWhereInput,
    tablero: Tablero,
    soloPersonal: boolean,
  ): Promise<ResumenProduccion> {
    if (soloPersonal) {
      const propios = tablero.items.filter((item) =>
        item.pasos.some((p) => p.mesaEsMia || p.tramoAbierto?.esMio),
      );
      return {
        entregasHoy: 0,
        atrasadas: 0,
        enProduccion: new Set(propios.map((i) => i.ordenId)).size,
        bloqueados: propios
          .flatMap((i) => i.pasos)
          .filter((p) => p.estado === 'bloqueado').length,
        listosRetiro: 0,
      };
    }

    const [entregasHoy, atrasadas, listosRetiro, enProduccion, bloqueados] =
      await Promise.all([
        this.prisma.ordenTrabajo.count({
          where: {
            tenantId,
            ...filtroVendedor,
            estado: { in: ['pendiente', 'produccion', 'finalizada'] },
            fechaEntrega: fechaDb(hoy),
          },
        }),
        this.prisma.ordenTrabajo.count({
          where: {
            tenantId,
            ...filtroVendedor,
            estado: { in: ['pendiente', 'produccion', 'finalizada'] },
            fechaEntrega: { lt: fechaDb(hoy) },
          },
        }),
        this.prisma.ordenTrabajoItem.count({
          where: {
            tenantId,
            entregadoEl: null,
            orden: { ...filtroVendedor, estado: 'finalizada' },
          },
        }),
        this.prisma.ordenTrabajo.count({
          where: { tenantId, ...filtroVendedor, estado: 'produccion' },
        }),
        this.prisma.ordenTrabajoItemPaso.count({
          where: {
            tenantId,
            estado: 'bloqueado',
            orden: {
              ...filtroVendedor,
              estado: { in: ['pendiente', 'produccion'] },
            },
          },
        }),
      ]);
    return {
      entregasHoy,
      atrasadas,
      enProduccion,
      bloqueados,
      listosRetiro,
    };
  }

  private async ordenesProximas(
    tenantId: string,
    hoy: string,
    enSiete: string,
    filtroVendedor: Prisma.OrdenTrabajoWhereInput,
  ): Promise<EntregaPanel[]> {
    const filas = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId,
        ...filtroVendedor,
        estado: { in: ['pendiente', 'produccion', 'finalizada'] },
        fechaEntrega: { lte: fechaDb(enSiete) },
      },
      orderBy: [{ fechaEntrega: 'asc' }, { createdAt: 'asc' }],
      include: {
        cliente: { select: { nombre: true } },
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: {
            nombre: true,
            pasos: {
              orderBy: { indice: 'asc' },
              select: {
                estado: true,
                nombre: true,
                centroCostoNombre: true,
              },
            },
          },
        },
      },
    });
    return filas.map((orden) => {
      const pasos = orden.items.flatMap((i) => i.pasos);
      const hechos = pasos.filter((p) => p.estado === 'hecho').length;
      const actual =
        pasos.find((p) =>
          ['en_curso', 'pausado', 'bloqueado'].includes(p.estado),
        ) ?? pasos.find((p) => p.estado !== 'hecho');
      const fecha = orden.fechaEntrega!.toISOString().slice(0, 10);
      return {
        id: orden.id,
        numero: orden.numero,
        cliente: orden.cliente?.nombre ?? 'Sin cliente',
        producto:
          orden.items.length === 1
            ? (orden.items[0]?.nombre ?? 'Sin productos')
            : `${orden.items.length} productos`,
        fechaEntrega: fecha,
        progresoPct:
          orden.estado === 'finalizada'
            ? 100
            : pasos.length > 0
              ? Math.round((hechos / pasos.length) * 100)
              : 0,
        riesgo: fecha < hoy ? 'atrasada' : fecha === hoy ? 'hoy' : 'proxima',
        pasoActual: actual?.nombre ?? null,
        estacionActual: actual?.centroCostoNombre ?? null,
        href: `/produccion/ordenes/${orden.id}`,
      };
    });
  }

  private async resumenComercial(
    tenantId: string,
    hoy: string,
    enTres: string,
    filtroVendedor: Prisma.CotizacionWhereInput,
  ) {
    const [pendientesAprobacion, porVencer] = await Promise.all([
      this.prisma.cotizacion.count({
        where: {
          tenantId,
          ...filtroVendedor,
          numero: { not: null },
          estado: 'pendiente_aprobacion',
        },
      }),
      this.prisma.cotizacion.count({
        where: {
          tenantId,
          ...filtroVendedor,
          numero: { not: null },
          estado: 'enviado',
          fechaValidez: { gte: fechaDb(hoy), lte: fechaDb(enTres) },
        },
      }),
    ]);
    return { pendientesAprobacion, porVencer };
  }

  private async resumenAdministracion(
    tenantId: string,
    hoy: string,
    enSiete: string,
  ): Promise<ResumenAdministracion> {
    const [
      ordenes,
      egresos,
      acreditacionesPendientes,
      acreditacionesProblematicas,
    ] = await Promise.all([
      this.prisma.ordenTrabajo.findMany({
        where: { tenantId, estado: { in: ['finalizada', 'entregada'] } },
        select: {
          total: true,
          cobradoTotal: true,
          facturadoTotal: true,
          fechaVencimientoComercial: true,
          tratamientoFiscal: true,
        },
      }),
      this.prisma.egreso.findMany({
        where: {
          tenantId,
          estado: { in: ['pendiente', 'parcial'] },
          fechaVencimiento: { not: null, lte: fechaDb(enSiete) },
        },
        select: {
          total: true,
          pagadoTotal: true,
          fechaVencimiento: true,
        },
      }),
      this.prisma.cobro.count({
        where: {
          tenantId,
          anuladoEl: null,
          estadoAcreditacion: 'pendiente',
        },
      }),
      this.prisma.cobro.count({
        where: {
          tenantId,
          anuladoEl: null,
          estadoAcreditacion: { in: ['rechazado', 'anulado'] },
        },
      }),
    ]);
    let deudaVencidaCantidad = 0;
    let deudaVencidaMonto = 0;
    let facturacionPendienteCantidad = 0;
    let facturacionPendienteMonto = 0;
    for (const orden of ordenes) {
      const total = Number(orden.total ?? 0);
      const deuda = Math.max(0, total - Number(orden.cobradoTotal));
      if (
        deuda > 0.01 &&
        orden.fechaVencimientoComercial &&
        orden.fechaVencimientoComercial < fechaDb(hoy)
      ) {
        deudaVencidaCantidad += 1;
        deudaVencidaMonto += deuda;
      }
      const sinFacturar = Math.max(0, total - Number(orden.facturadoTotal));
      if (orden.tratamientoFiscal === 'FISCAL' && sinFacturar > 0.01) {
        facturacionPendienteCantidad += 1;
        facturacionPendienteMonto += sinFacturar;
      }
    }
    let egresosVencidosCantidad = 0;
    let egresosVencidosMonto = 0;
    let egresosProximosCantidad = 0;
    for (const egreso of egresos) {
      const saldo = Math.max(
        0,
        Number(egreso.total) - Number(egreso.pagadoTotal),
      );
      if (egreso.fechaVencimiento && egreso.fechaVencimiento < fechaDb(hoy)) {
        egresosVencidosCantidad += 1;
        egresosVencidosMonto += saldo;
      } else {
        egresosProximosCantidad += 1;
      }
    }
    return {
      deudaVencidaCantidad,
      deudaVencidaMonto,
      facturacionPendienteCantidad,
      facturacionPendienteMonto,
      egresosVencidosCantidad,
      egresosVencidosMonto,
      egresosProximosCantidad,
      acreditacionesPendientes,
      acreditacionesProblematicas,
    };
  }

  private async cuelloBotella(tenantId: string, hoy: string) {
    const fila = await this.prisma.etaSnapshotEstacion.findFirst({
      where: { tenantId, fecha: fechaDb(hoy), pasosEnPlan: { gt: 0 } },
      orderBy: [{ utilizacion5dPct: 'desc' }, { colaMin: 'desc' }],
      select: {
        estacionNombre: true,
        colaMin: true,
        utilizacion5dPct: true,
        pasosEnPlan: true,
      },
    });
    return fila
      ? {
          estacion: fila.estacionNombre,
          colaMin: fila.colaMin,
          utilizacionPct: Number(fila.utilizacion5dPct),
          pasos: fila.pasosEnPlan,
        }
      : null;
  }

  private armarKpis(
    prod: ResumenProduccion,
    admin: ResumenAdministracion | null,
    veProduccion: boolean,
  ): PanelKpi[] {
    const kpis: PanelKpi[] = [];
    if (veProduccion) {
      kpis.push(
        {
          id: 'entregas-hoy',
          etiqueta: 'Entregas de hoy',
          valor: prod.entregasHoy,
          formato: 'cantidad',
          tono: prod.entregasHoy ? 'atencion' : 'ok',
          detalle: 'Órdenes comprometidas para hoy',
          href: '/produccion/ordenes',
        },
        {
          id: 'atrasadas',
          etiqueta: 'Atrasadas',
          valor: prod.atrasadas,
          formato: 'cantidad',
          tono: prod.atrasadas ? 'critico' : 'ok',
          detalle: 'Órdenes activas fuera de fecha',
          href: '/produccion/ordenes?urgencia=atrasadas',
        },
        {
          id: 'en-produccion',
          etiqueta: 'En producción',
          valor: prod.enProduccion,
          formato: 'cantidad',
          tono: 'neutro',
          detalle: 'Órdenes actualmente en proceso',
          href: '/produccion/tablero',
        },
        {
          id: 'bloqueados',
          etiqueta: 'Bloqueos',
          valor: prod.bloqueados,
          formato: 'cantidad',
          tono: prod.bloqueados ? 'critico' : 'ok',
          detalle: 'Pasos que requieren intervención',
          href: '/produccion/tablero',
        },
        {
          id: 'listos-retiro',
          etiqueta: 'Listos para retirar',
          valor: prod.listosRetiro,
          formato: 'cantidad',
          tono: prod.listosRetiro ? 'atencion' : 'ok',
          detalle: 'Productos terminados sin entregar',
          href: '/produccion/ordenes?estado=finalizada',
        },
      );
      return kpis.slice(0, 5);
    }
    if (admin) {
      kpis.push(
        {
          id: 'deuda-vencida',
          etiqueta: 'Cobros vencidos',
          valor: admin.deudaVencidaCantidad,
          formato: 'cantidad',
          tono: admin.deudaVencidaCantidad ? 'critico' : 'ok',
          detalle: dinero(admin.deudaVencidaMonto),
          href: '/administracion/deudores',
        },
        {
          id: 'facturar',
          etiqueta: 'Por facturar',
          valor: admin.facturacionPendienteCantidad,
          formato: 'cantidad',
          tono: admin.facturacionPendienteCantidad ? 'atencion' : 'ok',
          detalle: dinero(admin.facturacionPendienteMonto),
          href: '/administracion/facturacion',
        },
        {
          id: 'egresos-vencidos',
          etiqueta: 'Pagos vencidos',
          valor: admin.egresosVencidosCantidad,
          formato: 'cantidad',
          tono: admin.egresosVencidosCantidad ? 'critico' : 'ok',
          detalle: dinero(admin.egresosVencidosMonto),
          href: '/administracion/cuentas-por-pagar',
        },
        {
          id: 'egresos-proximos',
          etiqueta: 'Vencen en 7 días',
          valor: admin.egresosProximosCantidad,
          formato: 'cantidad',
          tono: admin.egresosProximosCantidad ? 'atencion' : 'ok',
          detalle: 'Obligaciones próximas',
          href: '/administracion/cuentas-por-pagar',
        },
        {
          id: 'acreditaciones',
          etiqueta: 'Acreditaciones',
          valor: admin.acreditacionesPendientes,
          formato: 'cantidad',
          tono: admin.acreditacionesProblematicas
            ? 'critico'
            : admin.acreditacionesPendientes
              ? 'atencion'
              : 'ok',
          detalle: admin.acreditacionesProblematicas
            ? `${admin.acreditacionesProblematicas} con problemas`
            : 'Pendientes de acreditar',
          href: '/administracion/tesoreria/acreditaciones',
        },
      );
    }
    return kpis.slice(0, 5);
  }

  private armarAtencion(input: {
    prod: ResumenProduccion;
    comerciales: { pendientesAprobacion: number; porVencer: number };
    administracion: ResumenAdministracion | null;
    vendedorSinVinculo: boolean;
    aprueba: boolean;
    veComercial: boolean;
    veProduccion: boolean;
  }): PanelAtencion[] {
    const a: PanelAtencion[] = [];
    const agregar = (alerta: PanelAtencion | null) => {
      if (alerta && alerta.cantidad > 0) a.push(alerta);
    };
    if (input.vendedorSinVinculo) {
      a.push({
        id: 'vendedor-sin-vinculo',
        dominio: 'comercial',
        severidad: 'atencion',
        titulo: 'Tu usuario no está vinculado a un vendedor',
        detalle:
          'Vinculalo a un legajo para ver únicamente tus presupuestos y órdenes.',
        cantidad: 1,
        href: '/configuracion/usuarios',
      });
    }
    if (input.veProduccion) {
      agregar(
        input.prod.atrasadas
          ? {
              id: 'ordenes-atrasadas',
              dominio: 'produccion',
              severidad: 'critico',
              titulo: 'Órdenes atrasadas',
              detalle: 'La fecha prometida ya venció y la orden sigue abierta.',
              cantidad: input.prod.atrasadas,
              href: '/produccion/ordenes?urgencia=atrasadas',
            }
          : null,
      );
      agregar(
        input.prod.bloqueados
          ? {
              id: 'pasos-bloqueados',
              dominio: 'produccion',
              severidad: 'critico',
              titulo: 'Pasos bloqueados',
              detalle:
                'Necesitan intervención para que el taller pueda continuar.',
              cantidad: input.prod.bloqueados,
              href: '/produccion/tablero',
            }
          : null,
      );
      agregar(
        input.prod.entregasHoy
          ? {
              id: 'entregas-hoy',
              dominio: 'produccion',
              severidad: 'atencion',
              titulo: 'Entregas comprometidas para hoy',
              detalle: 'Revisá el avance antes del horario de despacho.',
              cantidad: input.prod.entregasHoy,
              href: '/produccion/ordenes',
            }
          : null,
      );
      agregar(
        input.prod.listosRetiro
          ? {
              id: 'listos-retiro',
              dominio: 'produccion',
              severidad: 'info',
              titulo: 'Trabajos listos para retirar',
              detalle: 'Están terminados y todavía no fueron entregados.',
              cantidad: input.prod.listosRetiro,
              href: '/produccion/ordenes?estado=finalizada',
            }
          : null,
      );
    }
    if (input.veComercial) {
      agregar(
        input.comerciales.pendientesAprobacion
          ? {
              id: 'presupuestos-aprobacion',
              dominio: 'comercial',
              severidad: input.aprueba ? 'atencion' : 'info',
              titulo: input.aprueba
                ? 'Presupuestos para aprobar'
                : 'Presupuestos esperando aprobación',
              detalle: input.aprueba
                ? 'Requieren una decisión interna antes de enviarse.'
                : 'Un supervisor debe resolverlos antes del envío.',
              cantidad: input.comerciales.pendientesAprobacion,
              href: '/comercial/presupuestos?estado=pendiente_aprobacion',
            }
          : null,
      );
      agregar(
        input.comerciales.porVencer
          ? {
              id: 'presupuestos-vencen',
              dominio: 'comercial',
              severidad: 'atencion',
              titulo: 'Presupuestos por vencer',
              detalle: 'Vencen dentro de los próximos tres días.',
              cantidad: input.comerciales.porVencer,
              href: '/comercial/presupuestos?estado=enviado',
            }
          : null,
      );
    }
    const ad = input.administracion;
    if (ad) {
      agregar(
        ad.deudaVencidaCantidad
          ? {
              id: 'deuda-vencida',
              dominio: 'administracion',
              severidad: 'critico',
              titulo: 'Cobros vencidos',
              detalle: `${dinero(ad.deudaVencidaMonto)} pendientes de clientes.`,
              cantidad: ad.deudaVencidaCantidad,
              href: '/administracion/deudores',
            }
          : null,
      );
      agregar(
        ad.egresosVencidosCantidad
          ? {
              id: 'egresos-vencidos',
              dominio: 'administracion',
              severidad: 'critico',
              titulo: 'Pagos vencidos',
              detalle: `${dinero(ad.egresosVencidosMonto)} pendientes de pago.`,
              cantidad: ad.egresosVencidosCantidad,
              href: '/administracion/cuentas-por-pagar',
            }
          : null,
      );
      agregar(
        ad.acreditacionesProblematicas
          ? {
              id: 'acreditaciones-problema',
              dominio: 'administracion',
              severidad: 'critico',
              titulo: 'Acreditaciones con problemas',
              detalle: 'Revisá cobros rechazados o anulados.',
              cantidad: ad.acreditacionesProblematicas,
              href: '/administracion/tesoreria/acreditaciones',
            }
          : null,
      );
      agregar(
        ad.facturacionPendienteCantidad
          ? {
              id: 'facturacion-pendiente',
              dominio: 'administracion',
              severidad: 'atencion',
              titulo: 'Órdenes por facturar',
              detalle: `${dinero(ad.facturacionPendienteMonto)} todavía sin comprobante.`,
              cantidad: ad.facturacionPendienteCantidad,
              href: '/administracion/facturacion',
            }
          : null,
      );
      agregar(
        ad.egresosProximosCantidad
          ? {
              id: 'egresos-proximos',
              dominio: 'administracion',
              severidad: 'atencion',
              titulo: 'Pagos próximos',
              detalle: 'Vencen dentro de los próximos siete días.',
              cantidad: ad.egresosProximosCantidad,
              href: '/administracion/cuentas-por-pagar',
            }
          : null,
      );
      agregar(
        ad.acreditacionesPendientes
          ? {
              id: 'acreditaciones-pendientes',
              dominio: 'administracion',
              severidad: 'info',
              titulo: 'Cobros por acreditar',
              detalle: 'Todavía no impactaron en fondos disponibles.',
              cantidad: ad.acreditacionesPendientes,
              href: '/administracion/tesoreria/acreditaciones',
            }
          : null,
      );
    }
    return a.sort(
      (x, y) =>
        ORDEN_SEVERIDAD[x.severidad] - ORDEN_SEVERIDAD[y.severidad] ||
        x.id.localeCompare(y.id),
    );
  }

  private trabajoPersonal(tablero: Tablero) {
    const tareas: TareaPersonal[] = [];
    for (const item of tablero.items) {
      for (const paso of item.pasos) {
        const mio = paso.mesaEsMia || paso.tramoAbierto?.esMio;
        if (!mio || paso.estado === 'hecho') continue;
        tareas.push({
          pasoId: paso.id,
          ordenId: item.ordenId,
          ordenNumero: item.ordenNumero,
          itemNombre: item.nombre,
          pasoNombre: paso.nombre,
          estado: paso.estado,
          motivoBloqueo: paso.motivoBloqueo,
          activa: Boolean(paso.tramoAbierto?.esMio),
          href: `/produccion/tablero`,
        });
      }
    }
    tareas.sort(
      (a, b) =>
        Number(b.activa) - Number(a.activa) ||
        a.ordenNumero.localeCompare(b.ordenNumero),
    );
    return { tareas: tareas.slice(0, 8), total: tareas.length };
  }

  private accionesRapidas(p: {
    gestionaComercial: boolean;
    veProduccion: boolean;
    gestionaProduccion: boolean;
    gestionaAdministracion: boolean;
    cobra: boolean;
    perfilSoloProductivo: boolean;
  }): AccionRapida[] {
    const acciones: AccionRapida[] = [];
    const agregar = (a: AccionRapida) => {
      if (!acciones.some((x) => x.href === a.href)) acciones.push(a);
    };
    if (p.perfilSoloProductivo) {
      agregar({
        id: 'mi-mesa',
        etiqueta: 'Abrir mi mesa',
        href: '/produccion/tablero',
        icono: 'produccion',
      });
      return acciones;
    }
    if (p.gestionaAdministracion && p.gestionaComercial && p.veProduccion) {
      agregar({
        id: 'crear-orden',
        etiqueta: 'Crear orden',
        href: '/comercial/crear-propuesta',
        icono: 'orden',
      });
      agregar({
        id: 'tablero',
        etiqueta: 'Abrir producción',
        href: '/produccion/tablero',
        icono: 'produccion',
      });
      agregar({
        id: 'cobro',
        etiqueta: 'Registrar cobro',
        href: '/administracion/cobros/nuevo',
        icono: 'cobro',
      });
      agregar({
        id: 'egreso',
        etiqueta: 'Registrar egreso',
        href: '/administracion/egresos?accion=nuevo',
        icono: 'egreso',
      });
      return acciones;
    }
    if (p.gestionaComercial) {
      agregar({
        id: 'crear-orden',
        etiqueta: 'Crear orden',
        href: '/comercial/crear-propuesta',
        icono: 'orden',
      });
      agregar({
        id: 'presupuestos',
        etiqueta: 'Ver presupuestos',
        href: '/comercial/presupuestos',
        icono: 'presupuesto',
      });
    }
    if (p.veProduccion)
      agregar({
        id: 'tablero',
        etiqueta: 'Abrir producción',
        href: '/produccion/tablero',
        icono: 'produccion',
      });
    if (p.gestionaProduccion)
      agregar({
        id: 'estaciones',
        etiqueta: 'Ver estaciones',
        href: '/produccion/estaciones',
        icono: 'estaciones',
      });
    if (p.cobra || p.gestionaAdministracion)
      agregar({
        id: 'cobro',
        etiqueta: 'Registrar cobro',
        href: '/administracion/cobros/nuevo',
        icono: 'cobro',
      });
    if (p.gestionaAdministracion) {
      agregar({
        id: 'egreso',
        etiqueta: 'Registrar egreso',
        href: '/administracion/egresos?accion=nuevo',
        icono: 'egreso',
      });
      agregar({
        id: 'facturacion',
        etiqueta: 'Facturación',
        href: '/administracion/facturacion',
        icono: 'facturacion',
      });
    }
    return acciones.slice(0, 4);
  }
}
