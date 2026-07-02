import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension } from './tenant-guard.extension';

// Métodos que deben resolverse SIEMPRE contra el cliente base: el cliente
// extendido de Prisma no los expone (conexión / lifecycle).
const SOLO_BASE = new Set<string>([
  '$connect',
  '$disconnect',
  '$on',
  '$use',
  'onModuleInit',
  'onModuleDestroy',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();

    // Kill-switch: TENANT_GUARD=off desactiva la inyección automática.
    if (process.env.TENANT_GUARD === 'off') {
      return;
    }

    // El cliente extendido inyecta tenantId en modelos y en las queries dentro
    // de $transaction. Ruteamos los accesos de modelo / $transaction / $queryRaw
    // a él, y dejamos $connect/$disconnect/lifecycle en el cliente base.
    const extended = this.$extends(tenantGuardExtension);
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && SOLO_BASE.has(prop)) {
          const value = Reflect.get(target, prop, target) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        }
        if (typeof prop === 'string' && prop in (extended as object)) {
          const value = (extended as Record<string, unknown>)[prop];
          return typeof value === 'function' ? value.bind(extended) : value;
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
