import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CotizacionJobsService } from './cotizacion-jobs.service';

@Injectable()
export class PreparacionesNestingService {
  constructor(
    private readonly db: PrismaService,
    private readonly jobs: CotizacionJobsService,
  ) {}

  private async producto(tenantId: string, productoId: string) {
    const producto = await this.db.producto.findFirst({
      where: { tenantId, id: productoId },
      select: {
        id: true,
        rutasAlternativas: {
          where: { activo: true },
          select: { id: true, esPreferida: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
    if (!producto) throw new NotFoundException('No se encontró el producto.');
    return producto;
  }

  async listar(tenantId: string, productoId: string) {
    await this.producto(tenantId, productoId);
    const pendientes = await this.db.preparacionNestingProducto.findMany({
      where: {
        tenantId,
        productoId,
        estado: { in: ['PENDIENTE', 'PROCESANDO'] },
      },
    });
    for (const fila of pendientes) {
      if (!fila.jobId) continue;
      try {
        const trabajo = await this.jobs.consultar(tenantId, fila.jobId);
        if (trabajo.estado === 'fallido' || trabajo.estado === 'completado') {
          const ok = trabajo.resultado?.exitoso === true;
          await this.actualizar(
            tenantId,
            fila.id,
            fila.jobId,
            ok ? 'PREPARADO' : 'FALLIDO',
            ok
              ? undefined
              : (trabajo.error?.mensaje ??
                  'No se pudo completar la preparación.'),
          );
        }
      } catch (error) {
        if (
          error instanceof NotFoundException &&
          Date.now() - fila.updatedAt.getTime() > 60000
        ) {
          await this.actualizar(
            tenantId,
            fila.id,
            fila.jobId,
            'FALLIDO',
            'El cálculo ya no está disponible. Volvé a preparar esta cantidad.',
          );
        } else if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return this.db.preparacionNestingProducto.findMany({
      where: { tenantId, productoId },
      orderBy: [{ rutaClave: 'asc' }, { cantidad: 'asc' }],
      select: {
        id: true,
        rutaClave: true,
        cantidad: true,
        estado: true,
        error: true,
        duracionMs: true,
        updatedAt: true,
      },
    });
  }

  async preparar(
    tenantId: string,
    productoId: string,
    cantidades: number[],
    rutaAlternativaId?: string,
  ) {
    if (
      !Array.isArray(cantidades) ||
      !cantidades.length ||
      cantidades.length > 20 ||
      cantidades.some((n) => !Number.isInteger(n) || n < 1 || n > 10000)
    ) {
      throw new BadRequestException(
        'Ingresá entre 1 y 20 cantidades enteras, de 1 a 10.000.',
      );
    }
    const producto = await this.producto(tenantId, productoId);
    const ruta = rutaAlternativaId
      ? producto.rutasAlternativas.find((r) => r.id === rutaAlternativaId)
      : (producto.rutasAlternativas.find((r) => r.esPreferida) ??
        producto.rutasAlternativas[0]);
    if (!ruta)
      throw new BadRequestException(
        'El producto necesita un flujo de producción activo.',
      );
    for (const cantidad of [...new Set(cantidades)].sort((a, b) => a - b)) {
      const jobId = `quote-${randomUUID()}`;
      const fila = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${productoId}:${ruta.id}:${cantidad}`}, 0))`;
        const where = {
          tenantId_productoId_rutaClave_cantidad: {
            tenantId,
            productoId,
            rutaClave: ruta.id,
            cantidad,
          },
        };
        const anterior = await tx.preparacionNestingProducto.findUnique({
          where,
        });
        if (
          anterior &&
          ['PENDIENTE', 'PROCESANDO'].includes(anterior.estado) &&
          anterior.jobId
        )
          return null;
        return tx.preparacionNestingProducto.upsert({
          where,
          create: { tenantId, productoId, rutaClave: ruta.id, cantidad, jobId },
          update: { estado: 'PENDIENTE', jobId, error: null, duracionMs: null },
        });
      });
      if (!fila) continue;
      try {
        await this.jobs.crear({
          jobId,
          preparacionNestingId: fila.id,
          cotizacion: {
            tenantId,
            productoId,
            rutaAlternativaId: ruta.id,
            jobContext: { cantidad },
          },
        });
      } catch (error) {
        await this.actualizar(
          tenantId,
          fila.id,
          jobId,
          'FALLIDO',
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar la preparación.',
        );
      }
    }
    return this.listar(tenantId, productoId);
  }

  async actualizar(
    tenantId: string,
    id: string,
    jobId: string,
    estado: string,
    error?: string,
    duracionMs?: number,
  ) {
    await this.db.preparacionNestingProducto.updateMany({
      where: { tenantId, id, jobId },
      data: {
        estado,
        error: error?.slice(0, 1500) ?? null,
        ...(duracionMs !== undefined
          ? { duracionMs: Math.round(duracionMs) }
          : {}),
      },
    });
  }
}
