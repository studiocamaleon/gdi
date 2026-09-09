import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './tenant-guard.extension';
import {
  prepararDatosSnapshot,
  snapshotsExtension,
} from './snapshots.extension';

// Métodos que deben resolverse SIEMPRE contra el cliente base: el cliente
// extendido de Prisma no los expone (conexión / lifecycle).
const SOLO_BASE = new Set<string>([
  '$connect',
  '$disconnect',
  '$on',
  '$use',
  'onModuleInit',
  'onModuleDestroy',
  'prepararSnapshot',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();

    // El cliente extendido inyecta tenantId en modelos y en las queries dentro
    // de $transaction. Ruteamos los accesos de modelo / $transaction / $queryRaw
    // a él, y dejamos $connect/$disconnect/lifecycle en el cliente base.
    // La lectura de snapshots no depende del kill-switch del tenant guard.
    // Son adaptadores de consultas, no agregan métodos al contrato público.
    // Evitar propagar los tipos recursivos de dos extensiones Prisma al build.
    const snapshots = this.$extends(
      snapshotsExtension,
    ) as unknown as PrismaClient;
    const extended =
      process.env.TENANT_GUARD === 'off'
        ? snapshots
        : (snapshots.$extends(tenantGuardExtension) as unknown as PrismaClient);
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && SOLO_BASE.has(prop)) {
          const value = Reflect.get(target, prop, target) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        }
        if (typeof prop === 'string' && prop in (extended as object)) {
          const value = (extended as unknown as Record<string, unknown>)[prop];
          return typeof value === 'function' ? value.bind(extended) : value;
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  /** Permite preparar JSON pesado ANTES de abrir una transacción atómica. */
  prepararSnapshot<T>(modelo: string, datos: T): T {
    return prepararDatosSnapshot(modelo, datos);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
