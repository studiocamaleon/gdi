import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DatosEmpresaService } from '../datos-empresa.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Los datos comerciales, contra la base real.
 *
 * Lo que se defiende acá no es el CRUD —eso lo hace Prisma— sino las dos
 * decisiones que tomó el servicio: que el nombre comercial siga viviendo en
 * `Tenant.nombre` (y se guarde junto con el resto, en una transacción), y que
 * los links salgan con esquema. Un `sitioWeb` sin `https://` en un `href` el
 * navegador lo resuelve como ruta relativa y el cliente termina en una página
 * que no existe.
 */

const prisma = new PrismaClient();

describe('DatosEmpresaService', () => {
  const service = new DatosEmpresaService(prisma as unknown as PrismaService);
  let tenantId: string;
  let auth: CurrentAuth;

  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: { nombre: 'Antes', slug: `test-empresa-${randomUUID()}` },
      select: { id: true },
    });
    tenantId = t.id;
    auth = { tenantId } as CurrentAuth;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('sin nada cargado devuelve el nombre del tenant y el resto vacío', async () => {
    const d = await service.leer(auth);
    expect(d.nombre).toBe('Antes');
    expect(d.sitioWeb).toBeNull();
    expect(d.urlResenas).toBeNull();
  });

  it('el nombre comercial se escribe en el tenant, no en DatosEmpresa', async () => {
    await service.guardar(auth, { nombre: 'Gráfica Corporearte' });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true },
    });
    expect(tenant?.nombre).toBe('Gráfica Corporearte');
    expect(await service.leer(auth)).toMatchObject({
      nombre: 'Gráfica Corporearte',
    });
  });

  it('le pone https:// al link que no lo trae', async () => {
    const d = await service.guardar(auth, {
      nombre: 'Gráfica Corporearte',
      sitioWeb: 'grafo.ar',
      urlResenas: 'g.page/r/ejemplo/review',
    });
    expect(d.sitioWeb).toBe('https://grafo.ar');
    expect(d.urlResenas).toBe('https://g.page/r/ejemplo/review');
  });

  it('respeta el esquema que ya venía, incluido http', async () => {
    const d = await service.guardar(auth, {
      nombre: 'Gráfica Corporearte',
      sitioWeb: 'http://viejo.com.ar',
    });
    expect(d.sitioWeb).toBe('http://viejo.com.ar');
  });

  /** Un campo que se borra tiene que quedar null, no "" ni "   ". */
  it('lo vacío se guarda como null', async () => {
    const d = await service.guardar(auth, {
      nombre: 'Gráfica Corporearte',
      sitioWeb: '   ',
      localidad: '',
    });
    expect(d.sitioWeb).toBeNull();
    expect(d.localidad).toBeNull();
  });

  /** Guardar dos veces no puede crear dos filas: es 1-1 con el tenant. */
  it('guardar de nuevo actualiza la misma fila', async () => {
    await service.guardar(auth, {
      nombre: 'Gráfica Corporearte',
      localidad: 'Rosario',
    });
    await service.guardar(auth, {
      nombre: 'Gráfica Corporearte',
      localidad: 'Funes',
    });

    const filas = await prisma.datosEmpresa.findMany({ where: { tenantId } });
    expect(filas).toHaveLength(1);
    expect(filas[0].localidad).toBe('Funes');
  });

  it('el nombre se guarda sin espacios de más', async () => {
    const d = await service.guardar(auth, { nombre: '  Corporearte  ' });
    expect(d.nombre).toBe('Corporearte');
  });
});
