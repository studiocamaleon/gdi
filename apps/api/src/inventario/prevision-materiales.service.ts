import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { regionalDelTenant } from '../common/regional';
import { claveFechaEnZona } from '../common/zona';
import { nombreMaterialCompra } from '../compras/nombre-material-compra';
import { comprasPorNecesidad } from '../compras/cobertura-compra';
import { estimarReposicion, fechaCivil } from '../compras/plazos-compra';
import { reservasPorSaldo } from './stock-reservas';
import { normalizeMaterialUnit } from './material-units';
import type { PrevisionMaterialesDto } from './dto/prevision-materiales.dto';
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const pos = (n: Prisma.Decimal) => Prisma.Decimal.max(0, n);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const equivalentes = (a: string, b: string) =>
  a === b || [a, b].every((u) => ['hoja', 'placa'].includes(u));
type Fuente = {
  tipo:
    | 'compra_confirmada'
    | 'compra_estimada'
    | 'plazo_proveedor'
    | 'sin_fecha';
  cantidad: number;
  fecha: string | null;
  proveedor: string | null;
  compraNumero: number | null;
};
export type MaterialPrevisto = {
  varianteId: string;
  nombre: string;
  unidad: string | null;
  necesario: number | null;
  libre: number;
  faltante: number | null;
  disponibleDesde: string | null;
  revisar: boolean;
  motivo: string | null;
  fuentes: Fuente[];
};
@Injectable()
export class PrevisionMaterialesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}
  /** Simulación comercial de cantidades: no crea demanda, reserva, OC ni consumo.
   * La emisión siempre vuelve a calcular desde su snapshot confiable. */
  async consultar(
    tenantId: string,
    dto: PrevisionMaterialesDto,
    ahora = new Date(),
    db?: Prisma.TransactionClient,
  ) {
    const calcular = async (tx: Prisma.TransactionClient) => {
      const incluida = await this.capacidades.incluida(
        tenantId,
        'prevision_materiales',
        tx,
      );
      const politica = incluida
        ? await tx.politicaReservasMaterial.findUnique({
            where: { tenantId },
          })
        : null;
      const regional = await regionalDelTenant(tx, tenantId);
      const hoy = claveFechaEnZona(ahora, regional.zonaHoraria);
      const base = {
        calculadoEl: ahora.toISOString(),
        fechaPedidoSupuesto: hoy,
        zona: regional.zonaHoraria,
        modoReserva:
          politica?.habilitada &&
          (await this.capacidades.incluida(tenantId, 'reservas', tx))
            ? politica.modo === 'MANUAL'
              ? ('MANUAL' as const)
              : ('AL_EMITIR' as const)
            : null,
      };
      if (!incluida)
        return {
          ...base,
          estado: 'no_incluido' as const,
          disponibleDesde: null,
          materiales: [] as MaterialPrevisto[],
          pendientes: 0,
        };
      // Consultar existencias y reposición no requiere activar las reservas.
      // La política sólo define cómo se compromete stock al emitir una OT.
      const agrupadas = new Map<
        string,
        { cantidad: Prisma.Decimal | null; unidad: string | null }
      >();
      for (const m of dto.materiales.filter(
        (m) => !m.consumible || politica?.incluirConsumibles,
      )) {
        const prev = agrupadas.get(m.varianteId),
          unidad = m.unidad ? normalizeMaterialUnit(m.unidad) : null;
        const valida =
          m.cantidad != null && unidad && (!prev || prev.unidad === unidad);
        agrupadas.set(m.varianteId, {
          unidad: valida ? unidad : null,
          cantidad:
            valida && (!prev || prev.cantidad !== null)
              ? D(m.cantidad!).plus(prev?.cantidad ?? 0)
              : null,
        });
      }
      const ids = [...agrupadas.keys()].filter((id) => uuid.test(id));
      const [variantes, stock, holds, lineas, ofertas] = await Promise.all([
        tx.materiaPrimaVariante.findMany({
          where: { tenantId, id: { in: ids } },
          include: { materiaPrima: true, proveedorReferencia: true },
        }),
        tx.stockMateriaPrimaVariante.findMany({
          where: {
            tenantId,
            varianteId: { in: ids },
            ubicacion: { activo: true, almacen: { activo: true } },
          },
        }),
        reservasPorSaldo(tx, tenantId, ids),
        tx.lineaOrdenCompra.findMany({
          where: {
            tenantId,
            varianteId: { in: ids },
            orden: { tenantId, estado: { in: ['EMITIDA', 'PARCIAL'] } },
          },
          include: {
            orden: true,
            coberturas: { select: { necesidadId: true } },
          },
          orderBy: [
            { fechaConfirmada: 'asc' },
            { fechaEstimada: 'asc' },
            { id: 'asc' },
          ],
        }),
        tx.ofertaCompra.findMany({
          where: {
            tenantId,
            varianteId: { in: ids },
            activo: true,
            proveedor: { activo: true },
            OR: [
              { vigenteHasta: null },
              { vigenteHasta: { gte: fechaCivil(hoy) } },
            ],
          },
          include: { proveedor: true },
        }),
      ]);
      const comprometidas = await comprasPorNecesidad(tx, tenantId, [
        ...new Set(
          lineas.flatMap((l) => l.coberturas.map((c) => c.necesidadId)),
        ),
      ]);
      const demanda = await tx.necesidadMaterialOt.findMany({
        where: { tenantId, id: { in: [...comprometidas.keys()] } },
        select: { id: true, varianteId: true },
      });
      const asignado = new Map<string, Prisma.Decimal>();
      for (const n of demanda)
        for (const c of comprometidas.get(n.id)?.compras ?? []) {
          const k = `${c.ordenId}:${n.varianteId}`;
          asignado.set(k, (asignado.get(k) ?? D(0)).plus(c.cantidad));
        }
      // Asignar los compromisos existentes a las entradas más tempranas deja
      // libre la previsión más conservadora cuando una OC tiene varias fechas.
      const fechaLinea = (l: (typeof lineas)[number]) =>
        (l.fechaConfirmada ?? l.fechaEstimada)?.toISOString().slice(0, 10) ??
        null;
      lineas.sort(
        (a, b) =>
          (fechaLinea(a) ?? '9999').localeCompare(fechaLinea(b) ?? '9999') ||
          a.id.localeCompare(b.id),
      );
      const entradas = lineas.map((l) => {
        const k = `${l.ordenId}:${l.varianteId}`;
        const saldo = pos(l.cantidad.minus(l.recibida).mul(l.factorStock));
        const ocupada = Prisma.Decimal.min(saldo, asignado.get(k) ?? 0);
        asignado.set(k, pos((asignado.get(k) ?? D(0)).minus(ocupada)));
        return {
          linea: l,
          libre: saldo.minus(ocupada),
          fecha: fechaLinea(l),
        };
      });
      const materiales: MaterialPrevisto[] = [];
      for (const [id, solicitud] of agrupadas) {
        const v = variantes.find((v) => v.id === id),
          unidad = v
            ? normalizeMaterialUnit(v.unidadStock ?? v.materiaPrima.unidadStock)
            : null;
        const libre = stock
          .filter((s) => s.varianteId === id)
          .reduce(
            (sum, s) =>
              sum.plus(
                pos(
                  s.cantidadDisponible.minus(
                    holds.get(`${id}:${s.ubicacionId}`) ?? 0,
                  ),
                ),
              ),
            D(0),
          );
        const revisar =
          !v ||
          !v.activo ||
          !v.materiaPrima.activo ||
          solicitud.cantidad === null ||
          !solicitud.unidad ||
          !unidad ||
          !equivalentes(solicitud.unidad, unidad);
        const fila: MaterialPrevisto = {
          varianteId: id,
          nombre: v ? nombreMaterialCompra(v) : 'Material por revisar',
          unidad,
          necesario: solicitud.cantidad?.toNumber() ?? null,
          libre: libre.toNumber(),
          faltante: null,
          disponibleDesde: hoy,
          revisar,
          motivo: null,
          fuentes: [],
        };
        if (revisar) {
          fila.disponibleDesde = null;
          fila.motivo = 'Revisá el material y su cantidad en unidad de stock.';
          materiales.push(fila);
          continue;
        }
        let faltante = pos(solicitud.cantidad!.minus(libre));
        fila.faltante = faltante.toNumber();
        for (const entrada of entradas.filter(
          (e) =>
            e.linea.varianteId === id &&
            equivalentes(normalizeMaterialUnit(e.linea.unidadStock), unidad),
        )) {
          if (faltante.lte(0)) break;
          const cantidad = Prisma.Decimal.min(faltante, entrada.libre);
          if (cantidad.lte(0)) continue;
          const fecha =
            entrada.fecha && entrada.fecha >= hoy ? entrada.fecha : null;
          fila.fuentes.push({
            tipo: fecha
              ? entrada.linea.fechaConfirmada
                ? 'compra_confirmada'
                : 'compra_estimada'
              : 'sin_fecha',
            cantidad: cantidad.toNumber(),
            fecha,
            proveedor: entrada.linea.orden.proveedorNombre,
            compraNumero: entrada.linea.orden.numero,
          });
          faltante = faltante.minus(cantidad);
          if (!fecha)
            fila.motivo =
              'Hay una compra pendiente sin fecha vigente de recepción.';
        }
        if (faltante.gt(0)) {
          const referencia = v.proveedorReferencia?.activo
            ? v.proveedorReferencia
            : null;
          const opciones = ofertas
            .filter((o) => o.varianteId === id)
            .map((o) => ({
              proveedor: o.proveedor,
              dias: o.reposicionDias ?? o.proveedor.reposicionDias,
              tipo:
                o.reposicionDias == null
                  ? o.proveedor.reposicionTipo
                  : (o.reposicionTipo ?? o.proveedor.reposicionTipo),
            }));
          if (
            referencia &&
            !opciones.some((o) => o.proveedor.id === referencia.id)
          )
            opciones.push({
              proveedor: referencia,
              dias: referencia.reposicionDias,
              tipo: referencia.reposicionTipo,
            });
          const candidatos = opciones.map((o) => ({
            ...o,
            fecha:
              estimarReposicion(fechaCivil(hoy), o.dias, o.tipo)
                ?.toISOString()
                .slice(0, 10) ?? null,
          }));
          candidatos.sort(
            (a, b) =>
              Number(b.fecha !== null) - Number(a.fecha !== null) ||
              Number(b.proveedor.id === referencia?.id) -
                Number(a.proveedor.id === referencia?.id) ||
              (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') ||
              a.proveedor.id.localeCompare(b.proveedor.id),
          );
          const sugerido = candidatos[0];
          fila.fuentes.push({
            tipo: sugerido?.fecha ? 'plazo_proveedor' : 'sin_fecha',
            cantidad: faltante.toNumber(),
            fecha: sugerido?.fecha ?? null,
            proveedor: sugerido?.proveedor.nombre ?? null,
            compraNumero: null,
          });
          if (!sugerido?.fecha)
            fila.motivo = 'Falta definir proveedor y plazo de reposición.';
        }
        fila.disponibleDesde = fila.fuentes.some((f) => !f.fecha)
          ? null
          : fila.fuentes.reduce(
              (fecha, f) => (f.fecha! > fecha ? f.fecha! : fecha),
              hoy,
            );
        materiales.push(fila);
      }
      const pendiente =
        dto.pendientes > 0 || materiales.some((m) => !m.disponibleDesde);
      return {
        ...base,
        estado: pendiente
          ? ('por_confirmar' as const)
          : materiales.some((m) => (m.faltante ?? 0) > 0)
            ? ('requiere_compra' as const)
            : ('disponible' as const),
        disponibleDesde: pendiente
          ? null
          : materiales.reduce(
              (fecha, m) =>
                m.disponibleDesde! > fecha ? m.disponibleDesde! : fecha,
              hoy,
            ),
        materiales,
        pendientes: dto.pendientes,
      };
    };
    return db
      ? calcular(db)
      : this.prisma.$transaction(calcular, {
          isolationLevel: 'RepeatableRead',
        });
  }
}
