import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { MaterialesOrdenService } from '../materiales-orden.service';

describe('Lectura de materiales de la OT: aislamiento y persistencia', () => {
  const prisma = new PrismaClient();
  const service = new MaterialesOrdenService(prisma as never);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  let ordenId: string;

  beforeAll(async () => {
    for (const id of [tenantId, otherTenantId])
      await prisma.tenant.create({
        data: { id, nombre: 'Materiales OT test', slug: `materiales-ot-${id}` },
      });
    const orden = await prisma.ordenTrabajo.create({
      data: {
        tenantId,
        numero: 'OT-TEST-C0',
        estado: 'pendiente',
        items: {
          create: {
            tenantId,
            codigo: 'DOC',
            nombre: 'Documento doble faz',
            familia: 'Documentos',
            cantidad: 2,
            cantidadUnidad: 'copias',
            subtotal: 100,
            impuestos: 21,
            total: 121,
            trazabilidadSnapshotJson: {
              pasos: [
                {
                  rutaPasoId: 'impresion',
                  activado: true,
                  materiales: [
                    {
                      materialVarianteId: 'papel-test',
                      materialDisplayName: 'Obra A4',
                      tipoLineaCosto: 'MATERIAL',
                      cantidad: 6,
                      unidad: 'hoja',
                      contextoUnidadesSnapshot: {
                        unidadStock: 'HOJA',
                        unidadCompra: 'RESMA',
                      },
                      precioUnitario: 10,
                      costoTotal: 60,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    });
    ordenId = orden.id;
  });

  afterAll(async () => {
    await prisma.ordenTrabajoItem.deleteMany({ where: { tenantId } });
    await prisma.ordenTrabajo.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantId, otherTenantId] } },
    });
    await prisma.$disconnect();
  });

  it('proyecta los materiales sin materializar pasos ni modificar la OT o el cálculo', async () => {
    const before = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      include: { items: true },
    });
    const result = await service.consultar(tenantId, ordenId);
    expect(result.necesidades[0]).toMatchObject({
      cantidad: 6,
      unidad: 'hoja',
      estado: 'calculada',
    });
    const after = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id: ordenId },
      include: { items: true },
    });
    expect(after).toEqual(before);
    expect(
      await prisma.ordenTrabajoItemPaso.count({ where: { ordenId } }),
    ).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(
      /precioUnitario|costoTotal|subtotal/,
    );
  });

  it('no revela órdenes de otro tenant ni diferencia su existencia', async () => {
    await expect(
      service.consultar(otherTenantId, ordenId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.consultar(tenantId, randomUUID()),
    ).rejects.toMatchObject({ status: 404 });
  });
});
