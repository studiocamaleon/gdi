/**
 * A.4 — Smoke test de ReglaDeSeleccion.
 *
 * Valida que la entidad está correctamente declarada en Prisma y que se puede
 * crear, leer y borrar una regla de ejemplo. No hay consumidores productivos
 * al 2026-04-17.
 */
import { PrismaService } from '../../prisma/prisma.service';

const TENANT_ID = '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8';

describe('ReglaDeSeleccion (A.4)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('crea, lee y borra una regla del dominio MATERIAL (ejemplo anillado)', async () => {
    // Ejemplo: según páginas del cuaderno → tipo de espiral
    const regla = await prisma.reglaDeSeleccion.create({
      data: {
        tenantId: TENANT_ID,
        nombre: 'Seleccion automatica de espiral por paginas',
        descripcion: 'En encuadernado anillado, elige el diametro del espiral segun cantidad de paginas.',
        dominio: 'MATERIAL',
        targetRef: 'paso:encuadernado:anillado',
        inputs: ['paginas_por_cuaderno'],
        casos: [
          { condicion: { '<=': [{ var: 'paginas_por_cuaderno' }, 30] }, decision: { materialVarianteId: 'espiral_6mm' } },
          { condicion: { '<=': [{ var: 'paginas_por_cuaderno' }, 60] }, decision: { materialVarianteId: 'espiral_10mm' } },
          { condicion: { '<=': [{ var: 'paginas_por_cuaderno' }, 120] }, decision: { materialVarianteId: 'espiral_16mm' } },
        ],
        defaultDecision: { rechazar: true, mensaje: 'Fuera de capacidad (maximo 120 paginas)' },
      },
    });

    expect(regla.id).toBeDefined();
    expect(regla.dominio).toBe('MATERIAL');
    expect(regla.activa).toBe(true);
    expect(Array.isArray(regla.casos)).toBe(true);
    expect((regla.casos as unknown[]).length).toBe(3);

    const leida = await prisma.reglaDeSeleccion.findUnique({ where: { id: regla.id } });
    expect(leida).not.toBeNull();
    expect(leida?.nombre).toBe('Seleccion automatica de espiral por paginas');

    await prisma.reglaDeSeleccion.delete({ where: { id: regla.id } });
    const borrada = await prisma.reglaDeSeleccion.findUnique({ where: { id: regla.id } });
    expect(borrada).toBeNull();
  });

  it('permite filtrar por dominio e inactiva', async () => {
    const activa = await prisma.reglaDeSeleccion.create({
      data: {
        tenantId: TENANT_ID,
        nombre: 'Regla test activa',
        dominio: 'CENTRO_COSTO',
        inputs: ['cantidad'],
        casos: [{ condicion: { '>': [{ var: 'cantidad' }, 500] }, decision: { centroCostoId: 'offset' } }],
        activa: true,
      },
    });
    const inactiva = await prisma.reglaDeSeleccion.create({
      data: {
        tenantId: TENANT_ID,
        nombre: 'Regla test inactiva',
        dominio: 'CENTRO_COSTO',
        inputs: ['cantidad'],
        casos: [],
        activa: false,
      },
    });

    const activas = await prisma.reglaDeSeleccion.findMany({
      where: { tenantId: TENANT_ID, dominio: 'CENTRO_COSTO', activa: true },
    });
    expect(activas.map((r) => r.id)).toContain(activa.id);
    expect(activas.map((r) => r.id)).not.toContain(inactiva.id);

    // cleanup
    await prisma.reglaDeSeleccion.delete({ where: { id: activa.id } });
    await prisma.reglaDeSeleccion.delete({ where: { id: inactiva.id } });
  });
});
