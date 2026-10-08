import { idsClientesPorNombre } from '../busqueda-clientes';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientesService } from '../clientes.service';
import { ClientesQueryDto } from '../dto/clientes-query.dto';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Búsqueda de clientes sin acentos y paginada (PostgreSQL)', () => {
  const db = new PrismaService();
  const tenantId = randomUUID();
  const ajeno = randomUUID();
  const service = new ClientesService(db);
  const auth = { tenantId } as CurrentAuth;
  const buscar = (q: string, extra = {}) =>
    service.findAll(
      auth,
      Object.assign(new ClientesQueryDto(), { q, limit: 1, ...extra }),
    );
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !url.pathname.endsWith('_test') ||
      !['localhost', '127.0.0.1'].includes(url.hostname)
    )
      throw new Error('Sólo base local de pruebas');
    await db.tenant.createMany({
      data: [tenantId, ajeno].map((id) => ({
        id,
        slug: `busqueda-${id}`,
        nombre: 'Empresa ficticia',
      })),
    });
    await db.cliente.createMany({
      data: [
        ...Array.from({ length: 40 }, (_, i) => ({
          tenantId,
          nombre: `A cliente ${i}`,
        })),
        { tenantId, nombre: 'María Núñez', razonSocial: 'Diseño Ágil' },
        { tenantId, nombre: 'María Zeta' },
        { tenantId, nombre: 'Andres ficticio' },
        { tenantId, nombre: 'María inactiva', activo: false },
        { tenantId: ajeno, nombre: 'María ajena' },
        { tenantId, nombre: 'Oferta 100%_real' },
      ].map((c) => ({
        ...c,
        telefonoCodigo: '+1',
        telefonoNumero: '2025550142',
        paisCodigo: 'AR',
      })),
    });
    await db.cliente.create({
      data: {
        tenantId,
        nombre: 'Contacto con tilde',
        telefonoCodigo: '+1',
        telefonoNumero: '2025550142',
        paisCodigo: 'AR',
        contactos: {
          create: { tenantId, nombre: 'José ficticio', principal: true },
        },
        direcciones: {
          create: {
            tenantId,
            descripcion: 'Fiscal',
            paisCodigo: 'AR',
            tipo: 'FACTURACION',
            ciudad: 'Córdoba',
            direccion: 'Calle ficticia 123',
          },
        },
      },
    });
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, ajeno] } } });
    await db.$disconnect();
  });
  it('los listados comerciales encuentran nombre o razón social sin mezclar empresas', async () => {
    for (const texto of ['maria', 'MARÍA', 'María']) {
      const ids = await idsClientesPorNombre(db, tenantId, texto);
      const clientes = await db.cliente.findMany({
        where: { id: { in: ids } },
      });
      expect(clientes.map((c) => c.nombre).sort()).toEqual(
        ['María Núñez', 'María Zeta', 'María inactiva'].sort(),
      );
    }
    expect(
      await idsClientesPorNombre(db, tenantId, 'diseno agil'),
    ).toHaveLength(1);
    expect(await idsClientesPorNombre(db, ajeno, 'diseno agil')).toHaveLength(
      0,
    );
    expect(await idsClientesPorNombre(db, tenantId, '%_')).toHaveLength(1);
  });
  it('busca antes del límite y pagina sin perder coincidencias', async () => {
    const primera = await buscar('maria');
    const segunda = await buscar('MARÍA', { page: 2 });
    expect(primera.total).toBe(2);
    expect(segunda.total).toBe(2);
    expect(primera.data[0].nombre).toBe('María Núñez');
    expect(segunda.data[0].nombre).toBe('María Zeta');
    expect((await buscar('maria', { page: 3 })).data).toEqual([]);
  });
  it.each([
    ['nunez', 'María Núñez'],
    ['diseno agil', 'María Núñez'],
    ['Andrés', 'Andres ficticio'],
    ['jose', 'Contacto con tilde'],
    ['cordoba', 'Contacto con tilde'],
    ['%', 'Oferta 100%_real'],
    ['_', 'Oferta 100%_real'],
  ])('encuentra %s en nombres y datos relacionados', async (q, nombre) => {
    expect((await buscar(q)).data.map((c) => c.nombre)).toEqual([nombre]);
  });
  it('incluye inactivos sólo si se solicitan y nunca mezcla empresas', async () => {
    const r = await buscar('maria', { incluirInactivos: 'true', limit: 100 });
    expect(r.total).toBe(3);
    expect(r.data.some((c) => c.nombre.includes('ajena'))).toBe(false);
  });
});
