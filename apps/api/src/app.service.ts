import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503 para que el load balancer saque de rotación una réplica con la DB
      // caída (antes devolvía 200 estático aunque Postgres estuviera abajo).
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'gdi-api',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      service: 'gdi-api',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
