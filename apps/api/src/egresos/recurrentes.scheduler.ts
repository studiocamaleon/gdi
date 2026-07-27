import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { conLockDeCron } from '../common/cron-lock';
import { PrismaService } from '../prisma/prisma.service';
import { RecurrentesService } from './recurrentes.service';

/**
 * Emisión diaria de los gastos recurrentes.
 *
 * Corre todos los días y no una vez al mes a propósito: los tenants están en
 * zonas distintas, un tenant nuevo puede crear su primera plantilla el día 20,
 * y si el proceso estuvo caído los períodos atrasados se emiten igual (ver
 * `periodosPendientes`). Emitir de más es imposible — el único
 * (gastoRecurrenteId, periodoRecurrente) lo impide—, así que la única
 * consecuencia de correr seguido es un par de queries.
 *
 * Corre SIN contexto de tenant, como los demás schedulers: itera los tenants
 * activos uno por uno.
 */
@Injectable()
export class RecurrentesScheduler {
  private readonly log = new Logger(RecurrentesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recurrentes: RecurrentesService,
  ) {}

  @Cron('15 5 * * *', { name: 'emitir-gastos-recurrentes' })
  async emitir(): Promise<void> {
    await conLockDeCron(
      this.prisma,
      'emitir-gastos-recurrentes',
      600,
      async () => {
        const total = await this.correr();
        if (total > 0) {
          this.log.log(`Gastos recurrentes emitidos: ${total}.`);
        }
      },
    );
  }

  /** Expuesto para correrlo a mano y para los tests. */
  async correr(): Promise<number> {
    // Sólo los tenants que TIENEN plantillas activas: con muchos tenants,
    // recorrerlos todos para no hacer nada es trabajo puro.
    const conPlantillas = await this.prisma.gastoRecurrente.findMany({
      where: { activo: true },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    let total = 0;
    for (const { tenantId } of conPlantillas) {
      try {
        total += await this.recurrentes.generarDeTenant(tenantId);
      } catch (error) {
        // Un tenant que falla no puede dejar sin emitir a los demás.
        this.log.error(
          `No pude emitir los recurrentes de ${tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return total;
  }
}
