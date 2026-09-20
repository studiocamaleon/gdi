import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservasMaterialService } from '../inventario/reservas-material.service';
import { leerMaterialesOrden } from './materiales-orden.consulta';

@Injectable()
export class MaterialesOrdenService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly reservas?: ReservasMaterialService,
  ) {}

  async consultar(tenantId: string, ordenId: string) {
    if (this.reservas) return this.reservas.consultar(tenantId, ordenId);
    const { materiales } = await this.prisma.$transaction(
      (tx) => leerMaterialesOrden(tx, tenantId, ordenId),
      { isolationLevel: 'RepeatableRead' },
    );
    return materiales;
  }
}
