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

  /**
   * Lo que consumen el PDF del presupuesto, el del recibo, la factura y el
   * seguimiento público. Se testea acá porque los cuatro dependen del mismo
   * formateo: si esto se corre, se corren los cuatro documentos juntos.
   */
  describe('paraDocumentos', () => {
    it('sin datos cargados devuelve todo en null y no explota', async () => {
      const otro = await prisma.tenant.create({
        data: { nombre: 'Pelado', slug: `test-pelado-${randomUUID()}` },
        select: { id: true },
      });
      const d = await service.paraDocumentos(otro.id);
      expect(d.telefono).toBeNull();
      expect(d.domicilio).toBeNull();
      await prisma.tenant.delete({ where: { id: otro.id } });
    });

    it('arma el domicilio con calle, localidad y provincia', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        domicilioComercial: 'Mendoza 3450',
        localidad: 'Rosario',
        provincia: 'Santa Fe',
      });
      expect((await service.paraDocumentos(tenantId)).domicilio).toBe(
        'Mendoza 3450, Rosario, Santa Fe',
      );
    });

    /** Con media dirección cargada no puede quedar una coma colgando. */
    it('omite las partes que faltan sin dejar comas sueltas', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        domicilioComercial: 'Mendoza 3450',
      });
      expect((await service.paraDocumentos(tenantId)).domicilio).toBe(
        'Mendoza 3450',
      );
    });

    it('el teléfono: legible para imprimir, internacional para llamar', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        paisCodigo: 'AR',
        telefonoCodigo: '54',
        telefonoNumero: '3415551840',
      });
      const d = await service.paraDocumentos(tenantId);
      expect(d.telefono).toBe('+54 3415551840');
      expect(d.telefonoLink).toBe('+543415551840');
      // WhatsApp SÍ lleva el 9 del móvil argentino; el `tel:` no.
      expect(d.whatsapp).toBe('5493415551840');
    });

    /** El caso normal: la imprenta usa el mismo número para todo. */
    it('el WhatsApp cae al teléfono cuando no hay uno propio', async () => {
      const d = await service.paraDocumentos(tenantId);
      expect(d.whatsapp).toBe('5493415551840');
    });

    it('con WhatsApp propio, gana el propio', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        paisCodigo: 'AR',
        telefonoCodigo: '54',
        telefonoNumero: '3415551840',
        whatsappCodigo: '54',
        whatsappNumero: '3417778888',
      });
      const d = await service.paraDocumentos(tenantId);
      expect(d.whatsapp).toBe('5493417778888');
    });

    /**
     * Un `tel:` roto es peor que no ofrecer el botón: el cliente marca y le
     * da número equivocado.
     */
    it('un teléfono que no se puede interpretar no genera link de WhatsApp', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        paisCodigo: 'AR',
        telefonoCodigo: '54',
        telefonoNumero: '12',
      });
      const d = await service.paraDocumentos(tenantId);
      expect(d.telefono).toBe('+54 12');
      expect(d.whatsapp).toBeNull();
    });

    /** En papel el esquema es ruido; en un href es obligatorio. */
    it('la web sale con esquema para el link y sin él para imprimir', async () => {
      await service.guardar(auth, {
        nombre: 'Corporearte',
        sitioWeb: 'www.corporearte.com.ar/',
      });
      const d = await service.paraDocumentos(tenantId);
      expect(d.sitioWeb).toBe('https://www.corporearte.com.ar/');
      expect(d.sitioWebLegible).toBe('corporearte.com.ar');
    });
  });
});
