import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CentroCopiadoDb = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CentroCopiadoAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    db: CentroCopiadoDb,
    args: {
      tenantId: string;
      actorUserId?: string | null;
      tipo: string;
      descripcion: string;
      datos?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const actor = args.actorUserId
      ? await db.user.findUnique({
          where: { id: args.actorUserId },
          select: { nombreCompleto: true, email: true },
        })
      : null;
    await db.centroCopiadoEvento.create({
      data: {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId ?? null,
        actorNombre: actor?.nombreCompleto ?? actor?.email ?? 'Sistema',
        tipo: args.tipo,
        descripcion: args.descripcion,
        datosJson: args.datos ?? Prisma.DbNull,
      },
    });
  }

  async listar(tenantId: string, limite = 20) {
    return this.prisma.centroCopiadoEvento.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limite, 1), 100),
      select: {
        id: true,
        tipo: true,
        actorNombre: true,
        descripcion: true,
        datosJson: true,
        createdAt: true,
      },
    });
  }
}
