import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PlanesComparacionService } from '../planes/planes-comparacion.service';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../planes/catalogo-planes';
import {
  CompararPlanesDto,
  PlanesBorradoresController,
} from '../planes/planes-borradores.controller';
import { PlataformaGuard } from '../plataforma.guard';

const db = new PrismaClient();
const capacidades = new CapacidadesEmpresaService(
  db as unknown as PrismaService,
);
const service = new PlanesComparacionService(
  db as unknown as PrismaService,
  capacidades,
);
const planes = PROPUESTA_PLANES.map((p) => p.contenido);
let empresa: string, otra: string, planId: string;
const usuarios: string[] = [];
beforeAll(async () => {
  planId = (
    await db.plan.create({
      data: {
        codigo: `comparacion-${randomUUID()}`,
        nombre: 'Founder de prueba',
        precioMensual: 0,
        featuresJson: { todo: true, impresionDirecta: true },
      },
    })
  ).id;
  empresa = (
    await db.tenant.create({
      data: {
        slug: randomUUID(),
        nombre: 'Comparar una empresa',
        suscripcion: { create: { planId } },
      },
    })
  ).id;
  otra = (
    await db.tenant.create({
      data: { slug: randomUUID(), nombre: 'Otra empresa', activo: false },
    })
  ).id;
  for (let i = 0; i < 5; i++) {
    const u = await db.user.create({
      data: { email: `comparacion-${randomUUID()}@test.invalid` },
    });
    usuarios.push(u.id);
    await db.membership.create({
      data: {
        tenantId: empresa,
        userId: u.id,
        rol: 'ADMINISTRADOR',
        activa: i < 4,
      },
    });
  }
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [empresa, otra] } } });
  await db.user.deleteMany({ where: { id: { in: usuarios } } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});
it('compara usuarios, funciones y pilotos sin modificar condiciones ni borradores', async () => {
  const antes = await db.suscripcion.findUnique({
    where: { tenantId: empresa },
  });
  const borradores = await db.planBorrador.findMany({ orderBy: { id: 'asc' } });
  const r = await service.comparar(empresa, VERSION_CATALOGO_PLANES, planes);
  expect(r.usuariosOcupados).toBe(4);
  expect(r.propuestas.map((p) => p.usuariosSobreIncluidos)).toEqual([1, 0, 0]);
  expect(r.propuestas[0].diferencias).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        clave: 'reservas',
        actual: true,
        propuesta: false,
      }),
      expect.objectContaining({
        clave: 'impresion_directa',
        actual: true,
        propuesta: false,
      }),
    ]),
  );
  expect(
    await db.suscripcion.findUnique({ where: { tenantId: empresa } }),
  ).toEqual(antes);
  expect(await db.planBorrador.findMany({ orderBy: { id: 'asc' } })).toEqual(
    borradores,
  );
  expect(
    (await capacidades.actual(empresa)).contrato.funciones.impresion_directa,
  ).toBe(true);
});
it('aísla empresas y conserva el diagnóstico de cuenta bloqueada', async () => {
  const r = await service.comparar(otra, VERSION_CATALOGO_PLANES, planes);
  expect(r.usuariosOcupados).toBe(0);
  expect(r.accesoActual.modo).toBe('bloqueado');
  expect(
    r.propuestas.every((p) =>
      p.advertencias.some((a) => a.includes('no levanta')),
    ),
  ).toBe(true);
  await expect(
    service.comparar(randomUUID(), VERSION_CATALOGO_PLANES, planes),
  ).rejects.toMatchObject({ status: 404 });
});
it('validación de versión y DTO no habilita funciones enviadas por el cliente', async () => {
  await expect(service.comparar(empresa, 999, planes)).rejects.toMatchObject({
    status: 400,
  });
  const invalida = structuredClone(planes[0]);
  invalida.funciones.impresion_directa = true;
  await expect(
    service.comparar(empresa, VERSION_CATALOGO_PLANES, [invalida]),
  ).rejects.toMatchObject({ status: 400 });
  const dto = plainToInstance(CompararPlanesDto, {
    tenantId: empresa,
    catalogoVersion: 1,
    planes: [],
    asignar: true,
  });
  const errores = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  expect(errores.map((e) => e.property)).toEqual(
    expect.arrayContaining(['planes', 'asignar']),
  );
  expect(
    Reflect.getMetadata('__guards__', PlanesBorradoresController),
  ).toContain(PlataformaGuard);
});

it('usa la ocupación real con invitaciones, adicionales, cargas vigentes y ajustes sin escribir', async () => {
  const id = (
    await db.tenant.create({
      data: {
        slug: randomUUID(),
        nombre: 'Diagnóstico de cupos',
        bytesArchivos: 1024n ** 3n,
        cuotaBytesArchivos: 2n * 1024n ** 3n,
        suscripcion: { create: { planId, usuariosAdicionales: 1 } },
      },
    })
  ).id;
  try {
    const membership = {
      tenantId: id,
      userId: usuarios[0],
      rol: 'ADMINISTRADOR' as const,
    };
    await db.membership.create({ data: membership });
    const email = (
      await db.user.findUniqueOrThrow({ where: { id: usuarios[0] } })
    ).email;
    await db.invitation.createMany({
      data: [email, 'pendiente@test.invalid'].map((email) => ({
        tenantId: id,
        email,
        rol: 'ADMINISTRADOR',
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 3600_000),
      })),
    });
    await db.archivo.createMany({
      data: [3600_000, -3600_000].map((ms) => ({
        tenantId: id,
        scope: 'TENANT_BRANDING',
        key: randomUUID(),
        nombreOriginal: 'prueba.pdf',
        mimeType: 'application/pdf',
        bytesReservados: 2n * 1024n ** 3n,
        reservaHasta: new Date(Date.now() + ms),
      })),
    });
    const antes = await db.tenant.findUnique({ where: { id } });
    const archivosAntes = await db.archivo.findMany({
      where: { tenantId: id },
      orderBy: { id: 'asc' },
    });
    const r = await service.comparar(id, VERSION_CATALOGO_PLANES, planes);
    expect(r.usuariosOcupados).toBe(2);
    expect(r.uso).toEqual({
      usuarios: {
        activos: 1,
        invitacionesPendientes: 1,
        adicionalesVigentes: 1,
      },
      archivos: {
        guardadosBytes: String(1024n ** 3n),
        reservadosBytes: String(2n * 1024n ** 3n),
        cargasPendientes: 1,
      },
    });
    expect(r.propuestas[0].diagnostico).toMatchObject({
      usuariosCupoResultante: 4,
      usuariosExcedidos: 0,
      almacenamientoCupoBytes: String(2n * 1024n ** 3n),
      almacenamientoExcedidoBytes: String(1024n ** 3n),
    });
    expect(await db.tenant.findUnique({ where: { id } })).toEqual(antes);
    expect(
      await db.archivo.findMany({
        where: { tenantId: id },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(archivosAntes);
  } finally {
    await db.tenant.delete({ where: { id } });
  }
});

it('cuenta sólo compras abiertas propias y pide continuidad sólo al retirar la función', async () => {
  const id = (
    await db.tenant.create({
      data: {
        slug: randomUUID(),
        nombre: 'Diagnóstico de compras',
        suscripcion: { create: { planId } },
      },
    })
  ).id;
  try {
    const proveedor = await db.proveedor.create({
      data: {
        tenantId: id,
        nombre: 'Proveedor de prueba',
        emailPrincipal: 'proveedor@test.invalid',
        telefonoCodigo: '54',
        telefonoNumero: '123456',
        paisCodigo: 'AR',
      },
    });
    const almacen = await db.almacenMateriaPrima.create({
      data: { tenantId: id, codigo: 'principal', nombre: 'Principal' },
    });
    const ubicacion = await db.almacenMateriaPrimaUbicacion.create({
      data: {
        tenantId: id,
        almacenId: almacen.id,
        codigo: 'principal',
        nombre: 'Principal',
      },
    });
    await db.ordenCompra.createMany({
      data: ['EMITIDA', 'PARCIAL', 'RECIBIDA', 'CANCELADA'].map(
        (estado, numero) => ({
          tenantId: id,
          numero: numero + 1,
          proveedorId: proveedor.id,
          proveedorNombre: proveedor.nombre,
          ubicacionId: ubicacion.id,
          estado,
          fechaPedido: new Date(),
          moneda: 'ARS',
          monedaStock: 'ARS',
          tipoCambio: 1,
          creadoPor: 'QA',
        }),
      ),
    });
    const r = await service.comparar(id, VERSION_CATALOGO_PLANES, planes);
    expect(r.propuestas[0].diagnostico.hallazgos).toContainEqual(
      expect.objectContaining({ codigo: 'compras_abiertas', cantidad: 2 }),
    );
    expect(
      r.propuestas[1].diagnostico.hallazgos.map((h) => h.codigo),
    ).not.toContain('compras_abiertas');
    const externa = await service.comparar(
      empresa,
      VERSION_CATALOGO_PLANES,
      planes,
    );
    expect(
      externa.propuestas[0].diagnostico.hallazgos.map((h) => h.codigo),
    ).not.toContain('compras_abiertas');
    expect(
      await db.ordenCompra.count({
        where: { tenantId: id, estado: 'EMITIDA' },
      }),
    ).toBe(1);
  } finally {
    await db.ordenCompra.deleteMany({ where: { tenantId: id } });
    await db.tenant.delete({ where: { id } });
  }
});
