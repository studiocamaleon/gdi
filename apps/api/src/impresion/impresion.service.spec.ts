import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, verify, X509Certificate } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ImpresionService } from './impresion.service';
import {
  PrepararEtiquetaDto,
  PruebaDocumentoDto,
} from './impresion.controller';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArchivosService } from '../archivos/archivos.service';
import type { CurrentAuth } from '../auth/auth.types';
import { etiquetaTspl, renderizarEtiquetas } from './etiqueta-ot';
import sharp from 'sharp';

const auth = { tenantId: 'tenant-a' } as CurrentAuth;
const orden = {
  numero: 'OT-2026-0060',
  estado: 'finalizada',
  fechaEntrega: new Date('2026-09-23'),
  tenant: { nombre: 'Gráfica & Co' },
  cliente: { nombre: 'María Gómez' },
  items: [{ nombre: 'Vinilo impreso', cantidad: 1.2, cantidadUnidad: 'm²' }],
};
type Consulta = {
  where: { id: string; tenantId: string };
  select: { items: { where: { parentItemId: null } } };
};
const findFirst = jest.fn<Promise<typeof orden | null>, [Consulta]>();
const logoDataUri = jest.fn().mockResolvedValue(null);
const service = (config: Record<string, string> = {}) =>
  new ImpresionService(
    { ordenTrabajo: { findFirst } } as unknown as PrismaService,
    { logoDataUri } as unknown as ArchivosService,
    { get: (key: string) => config[key] } as ConfigService,
  );

beforeEach(() => {
  jest.clearAllMocks();
  findFirst.mockResolvedValue(orden);
});

describe('etiquetas por tenant', () => {
  it('consulta sólo la OT del tenant y productos principales, sin precios', async () => {
    const vista = await service().vistaPrevia(auth, 'ot-a');
    expect(findFirst.mock.calls[0][0].where).toEqual({
      id: 'ot-a',
      tenantId: 'tenant-a',
    });
    expect(findFirst.mock.calls[0][0].select.items.where).toEqual({
      parentItemId: null,
    });
    expect(vista.paginas).toHaveLength(1);
    expect(vista.numero).toBe('OT-2026-0060');
    expect(logoDataUri).toHaveBeenCalledWith('tenant-a');
  });
  it('rechaza OT ajena/inexistente sin pedir su logo', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service().vistaPrevia(auth, 'otra')).rejects.toThrow(
      'Orden no encontrada',
    );
    expect(logoDataUri).not.toHaveBeenCalled();
  });
  it.each(['borrador', 'cancelada'])(
    'no etiqueta una OT %s',
    async (estado) => {
      findFirst.mockResolvedValue({ ...orden, estado });
      await expect(service().vistaPrevia(auth, 'ot')).rejects.toThrow(
        'órdenes emitidas',
      );
    },
  );
  it('sin certificado informa la indisponibilidad, nunca firma', () => {
    expect(service().configuracion(auth).firmaDisponible).toBe(false);
    expect(() => service().buscarImpresoras()).toThrow('certificado');
  });
  it.each([0, -1, 1.5, 21])('rechaza %s copias en el DTO', async (copias) => {
    const dto = Object.assign(new PrepararEtiquetaDto(), {
      impresora: 'Xprinter XP-410B',
      copias,
      pagina: 0,
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('raster TSPL 100 × 150', () => {
  it('mantiene todos los productos paginados y el mismo QR interno', async () => {
    const imagenes = await renderizarEtiquetas({
      numero: orden.numero,
      empresa: 'Gráfica',
      cliente: 'María',
      fechaEntrega: orden.fechaEntrega,
      logo: null,
      productos: Array.from({ length: 11 }, (_, i) => ({
        nombre: `Producto ${i}`,
        cantidad: i + 1,
        unidad: 'u',
      })),
    });
    expect(imagenes).toHaveLength(3);
    for (const imagen of imagenes) {
      const meta = await sharp(imagen).metadata();
      expect([meta.width, meta.height]).toEqual([800, 1200]);
    }
    const comandos = await etiquetaTspl(imagenes[0], 2);
    const header =
      'SIZE 100 mm,150 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,100,1200,0,';
    expect(comandos.subarray(0, header.length).toString()).toBe(header);
    expect(comandos.subarray(-13).toString()).toBe('\r\nPRINT 1,2\r\n');
    const { data } = await sharp(imagenes[0])
      .greyscale()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const packed = comandos.subarray(header.length, header.length + 120000);
    // Manual TSPL: 0 es negro y 1 blanco; verifica todos los puntos del raster.
    for (let i = 0; i < data.length; i++) {
      if (((packed[i >> 3] >> (7 - (i & 7))) & 1) !== (data[i] >= 128 ? 1 : 0))
        throw new Error(`Punto ${i} invertido`);
    }
  });
});

describe('firma de mensajes canónicos QZ', () => {
  let directorio: string;
  let servicio: ImpresionService;
  let certificado: X509Certificate;
  beforeAll(() => {
    directorio = mkdtempSync(join(tmpdir(), 'grafo-qz-test-'));
    const clave = join(directorio, 'key.pem');
    const cert = join(directorio, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        clave,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=Grafo Test',
      ],
      { stdio: 'ignore' },
    );
    certificado = new X509Certificate(readFileSync(cert));
    servicio = service({
      QZ_SIGNING_CERTIFICATE_PATH: cert,
      QZ_SIGNING_PRIVATE_KEY_PATH: clave,
    });
  });
  afterAll(() => rmSync(directorio, { recursive: true, force: true }));
  it('firma el SHA256 hexadecimal del mensaje con RSA SHA512 y nunca devuelve la clave', () => {
    const resultado = servicio.buscarImpresoras();
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          call: 'printers.find',
          params: {},
          timestamp: resultado.timestamp,
        }),
      )
      .digest('hex');
    expect(resultado.hash).toBe(hash);
    expect(
      verify(
        'RSA-SHA512',
        Buffer.from(hash),
        certificado.publicKey,
        Buffer.from(resultado.firma, 'base64'),
      ),
    ).toBe(true);
    expect(JSON.stringify(servicio.configuracion(auth))).not.toContain(
      'PRIVATE KEY',
    );
  });
  it('firma sólo la etiqueta de la OT autorizada, con las copias en TSPL', async () => {
    const trabajo = await servicio.preparar(
      auth,
      'ot-a',
      'Xprinter XP-410B',
      3,
      0,
    );
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          call: 'print',
          params: trabajo.params,
          timestamp: trabajo.timestamp,
        }),
      )
      .digest('hex');
    expect(
      verify(
        'RSA-SHA512',
        Buffer.from(hash),
        certificado.publicKey,
        Buffer.from(trabajo.firma, 'base64'),
      ),
    ).toBe(true);
    const alterado = { ...trabajo.params, printer: { name: 'Otra impresora' } };
    const hashAlterado = createHash('sha256')
      .update(
        JSON.stringify({
          call: 'print',
          params: alterado,
          timestamp: trabajo.timestamp,
        }),
      )
      .digest('hex');
    expect(
      verify(
        'RSA-SHA512',
        Buffer.from(hashAlterado),
        certificado.publicKey,
        Buffer.from(trabajo.firma, 'base64'),
      ),
    ).toBe(false);
    expect(
      Buffer.from(trabajo.params.data[0].data, 'base64')
        .subarray(-13)
        .toString(),
    ).toBe('\r\nPRINT 1,3\r\n');
  });
  it('firma únicamente la escucha de una cola sin acceso a sus archivos', () => {
    const timestamp = Date.now();
    const r = servicio.escucharImpresora('Ricoh', timestamp);
    expect(r.params).toEqual({ printerNames: ['Ricoh'] });
    expect(r.timestamp).toBe(timestamp);
    expect(r.hash).toBe(
      createHash('sha256')
        .update(
          JSON.stringify({
            call: 'printers.startListening',
            params: r.params,
            timestamp,
          }),
        )
        .digest('hex'),
    );
    expect(
      verify(
        'RSA-SHA512',
        Buffer.from(r.hash),
        certificado.publicKey,
        Buffer.from(r.firma, 'base64'),
      ),
    ).toBe(true);
    expect(() =>
      servicio.escucharImpresora('Ricoh', timestamp - 120000),
    ).toThrow('venció');
    expect(() =>
      servicio.escucharImpresora('Ricoh', timestamp + 120000),
    ).toThrow('venció');
  });
  it('firma sólo printers.detail sin params, igual al SDK, y rechaza timestamps vencidos', () => {
    const timestamp = Date.now();
    const r = servicio.detallesImpresoras(timestamp);
    const hash = createHash('sha256')
      .update(JSON.stringify({ call: 'printers.detail', timestamp }))
      .digest('hex');
    expect(r.hash).toBe(hash);
    expect(r.params).toBeUndefined();
    expect(
      verify(
        'RSA-SHA512',
        Buffer.from(hash),
        certificado.publicKey,
        Buffer.from(r.firma, 'base64'),
      ),
    ).toBe(true);
    for (const invalido of [timestamp - 120000, timestamp + 120000, NaN, 1.5])
      expect(() => servicio.detallesImpresoras(invalido)).toThrow('venció');
  });
  it.each([true, false])(
    'prepara un PDF fijo A4 con dos páginas, dos copias y doble faz %s',
    (dobleFaz) => {
      const r = servicio.prepararPruebaDocumento('Ricoh', 2, dobleFaz);
      expect(r.params.options).toMatchObject({
        copies: 2,
        size: { width: 210, height: 297 },
        colorType: 'grayscale',
        duplex: dobleFaz ? 'long-edge' : 'one-sided',
      });
      expect(r.params.data[0]).toMatchObject({
        type: 'pixel',
        format: 'pdf',
        flavor: 'base64',
      });
      const pdf = Buffer.from(r.params.data[0].data, 'base64').toString(
        'latin1',
      );
      expect(pdf).toMatch(/^%PDF/);
      expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
      expect(
        verify(
          'RSA-SHA512',
          Buffer.from(r.hash),
          certificado.publicKey,
          Buffer.from(r.firma, 'base64'),
        ),
      ).toBe(true);
      expect(findFirst).not.toHaveBeenCalled();
    },
  );
  it.each([0, 4, 1.5])(
    'limita la prueba a un máximo de tres copias: %s inválido',
    async (copias) => {
      expect(
        await validate(
          Object.assign(new PruebaDocumentoDto(), {
            impresora: 'Ricoh',
            copias,
            dobleFaz: true,
          }),
        ),
      ).not.toHaveLength(0);
    },
  );
  it('rechaza una página inexistente', async () => {
    await expect(
      servicio.preparar(auth, 'ot-a', 'Xprinter', 1, 1),
    ).rejects.toThrow('Página de etiqueta inválida');
  });
});
