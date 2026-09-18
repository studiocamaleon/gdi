import { perfilPrueba } from './perfiles-impresion.fixture';
import type { PerfilesImpresionService } from './perfiles-impresion.service';
import { PDFDocument, degrees } from 'pdf-lib';
import { orientacionPaginaPdf } from '../common/orientacion-pdf';
import { DocumentosOrdenService } from './documentos-orden.service';
import { planDocumento, siguienteEstado } from './documentos-orden.domain';
import { calcularHojas } from '../centro-copiado/adaptador';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArchivosService } from '../archivos/archivos.service';
import type { ImpresionService } from './impresion.service';
import type { CurrentAuth } from '../auth/auth.types';

const auth = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  email: 'operario@test.local',
} as CurrentAuth;
const meta = {
  nombre: 'Documento',
  paginas: 3,
  copias: 2,
  tamano: 'A4',
  color: 'BN',
  faz: 2,
  hojas: 4,
  papelMateriaPrimaId: 'papel',
  gramaje: 75,
};
const job = (value: object = meta) => ({ _centroCopiado: value });

describe('plan de impresión cotizado', () => {
  it('no convierte un CAD incompleto en un envío A4', () => {
    expect(planDocumento(job({ ...meta, modo: 'CAD' }))?.motivo).toBe(
      'Faltan las medidas o el perfil CAD cotizado. Volvé a cotizar el plano.',
    );
  });
  it('resume las páginas seleccionadas y conserva la orientación de cada original', () => {
    const orientacionesPaginas = ['vertical', 'horizontal', 'horizontal'];
    expect(planDocumento(job())?.orientacion).toBeNull();
    expect(
      planDocumento(job({ ...meta, orientacionesPaginas }))?.orientacion,
    ).toBe('mixto');
    expect(
      planDocumento(
        job({
          ...meta,
          orientacionesPaginas,
          paginas: 1,
          paginasOriginales: 3,
          rangoPaginas: '2',
          archivoNombre: 'original.pdf',
          hojas: 2,
        }),
      ),
    ).toMatchObject({
      orientacion: 'horizontal',
      motivo: null,
      segmentos: [{ orientacionesPaginas }],
    });
    expect(
      planDocumento(job({ ...meta, orientacionesPaginas: ['vertical'] }))
        ?.motivo,
    ).toContain('orientación');
  });
  it('cada copia impar comienza en un frente, tanto al cotizar como al imprimir', () => {
    expect(calcularHojas(3, 2, 2)).toEqual({ carillas: 6, hojas: 4 });
    expect(calcularHojas(3, 3, 2)).toEqual({ carillas: 9, hojas: 6 });
    expect(calcularHojas(3, 2, 1)).toEqual({ carillas: 6, hojas: 6 });
    expect(planDocumento(job())).toMatchObject({
      copias: 2,
      faz: 2,
      hojas: 4,
      motivo: null,
    });
    expect(planDocumento(job({ ...meta, hojas: 3 }))?.motivo).toMatch(
      /Volvé a cotizar/,
    );
  });
  it.each([
    { color: 'DESCONOCIDO' },
    { tamano: 'A3' },
    { copias: 0 },
    { paginas: 0 },
    { copias: 1.5 },
  ])('excluye documentos incompatibles: %o', (cambios) => {
    expect(planDocumento(job({ ...meta, ...cambios }))?.motivo).toBeTruthy();
  });
  it.each(['BN', 'COLOR'])(
    'admite documentos y tomos uniformes en %s',
    (color) => {
      expect(planDocumento(job({ ...meta, color }))).toMatchObject({
        motivo: null,
        configuracion: { color },
      });
      expect(
        planDocumento(
          job({
            esTomo: true,
            juegos: 2,
            hojas: 8,
            segmentos: [
              { ...meta, color },
              { ...meta, color },
            ],
          }),
        ),
      ).toMatchObject({ motivo: null, configuracion: { color } });
    },
  );
  it.each([
    ['BN', 'COLOR'],
    ['COLOR', 'BN'],
  ])(
    'no envía un tomo con segmentos %s y %s bajo un solo modo',
    (primero, segundo) => {
      expect(
        planDocumento(
          job({
            esTomo: true,
            juegos: 2,
            hojas: 8,
            segmentos: [
              { ...meta, color: primero },
              { ...meta, color: segundo },
            ],
          }),
        )?.motivo,
      ).toContain('color');
    },
  );
  it('no degrada finales con ACK ni DELETED tardíos', () => {
    expect(siguienteEstado('COMPLETE', 'DELETED')).toBe('COMPLETE');
    expect(siguienteEstado('PRINTING', 'ENVIADO')).toBe('PRINTING');
    expect(siguienteEstado('PREPARADO', 'SIN_CONFIRMAR')).toBe('SIN_CONFIRMAR');
    expect(siguienteEstado('ENVIADO', 'DELETED')).toBe('DELETED');
  });
});

describe('envíos de documentos de una OT', () => {
  async function fixture() {
    const pdf = await PDFDocument.create();
    for (let n = 0; n < 3; n++) pdf.addPage([595.276, 841.89]);
    const bytes = Buffer.from(await pdf.save());
    const orden = {
      id: 'orden',
      numero: 'OT-TEST',
      estado: 'pendiente',
      updatedAt: new Date('2026-09-18'),
      items: [
        {
          id: 'item',
          pasos: [
            {
              id: 'paso',
              itemId: 'item',
              ordenId: 'orden',
              familiaCodigo: 'impresion_digital',
              maquinaId: 'maquina',
              tipoEjecucion: 'interno',
              estado: 'pendiente',
              indice: 1,
              nodoClave: null,
              motivoBloqueo: null,
              gatesOperativos: [],
              dependenciasEntrantes: [],
              item: {
                parentItemId: null,
                pasos: [
                  {
                    id: 'paso',
                    indice: 1,
                    estado: 'pendiente',
                    nodoClave: null,
                  },
                ],
              },
            },
          ],
          contieneLotesEntrega: false,
          jobContextSnapshotJson: job(),
          cotizacionItem: null,
          archivos: [
            {
              id: 'archivo',
              nombreOriginal: 'original.pdf',
              mimeType: 'application/pdf',
              bytes: BigInt(bytes.length),
              key: 'tenant-a/original.pdf',
            },
          ],
        },
      ],
    };
    const crear = jest.fn().mockResolvedValue({});
    const buscarEvento = jest.fn().mockResolvedValue(null);
    const actualizarEvento = jest.fn().mockResolvedValue({});
    const buscarOrden = jest.fn().mockResolvedValue(orden);
    const perfiles = {
      perfiles: jest.fn().mockResolvedValue([structuredClone(perfilPrueba)]),
    };
    const tx = {
      maquina: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'maquina',
            activo: true,
            estado: 'ACTIVA',
            estacion: { activo: true },
          },
        ]),
      },
      materiaPrima: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'papel', nombre: 'Obra', activo: true }]),
      },
      gateProduccionDocumento: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'orden' }]),
      ordenTrabajo: { findFirst: buscarOrden },
      ordenTrabajoEvento: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: buscarEvento,
        create: crear,
        update: actualizarEvento,
      },
    };
    const prisma = {
      ...tx,
      ordenTrabajoEvento: {
        ...tx.ordenTrabajoEvento,
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: async (fn: (client: typeof tx) => unknown) => await fn(tx),
    };
    const leer = jest.fn().mockResolvedValue(bytes);
    const firmar = jest
      .fn()
      .mockReturnValue({ hash: 'hash', firma: 'firma', timestamp: 1 });
    const servicio = new DocumentosOrdenService(
      prisma as unknown as PrismaService,
      { leerContenido: leer } as unknown as ArchivosService,
      { firmarDocumento: firmar } as unknown as ImpresionService,
      perfiles as unknown as PerfilesImpresionService,
    );
    const preparar = (anterior?: string) =>
      servicio.preparar(
        auth,
        'orden',
        'item',
        'intento',
        'RICOH',
        'localhost',
        anterior,
        'perfil',
        '1:1:1',
      );
    return {
      servicio,
      perfiles,
      preparar,
      orden,
      crear,
      buscarEvento,
      actualizarEvento,
      buscarOrden,
      leer,
      firmar,
      tx,
      bytes,
    };
  }
  it('bloquea perfiles obsoletos y documentos cuyo paso está bloqueado', async () => {
    const f = await fixture();
    f.perfiles.perfiles.mockResolvedValue([{ ...perfilPrueba, version: 2 }]);
    await expect(f.preparar()).rejects.toThrow();
    expect(f.leer).not.toHaveBeenCalled();
    f.perfiles.perfiles.mockResolvedValue([perfilPrueba]);
    f.orden.items[0].pasos[0].estado = 'bloqueado';
    await expect(f.preparar()).rejects.toThrow('bloqueado');
    expect(f.crear).not.toHaveBeenCalled();
  });
  it('revalida la preparación bajo bloqueo antes de reservar el envío', async () => {
    const f = await fixture();
    f.perfiles.perfiles
      .mockResolvedValueOnce([perfilPrueba])
      .mockResolvedValue([
        {
          ...perfilPrueba,
          bandeja: {
            ...perfilPrueba.bandeja,
            version: 2,
            papelPreparadoId: null,
          },
        },
      ]);
    await expect(f.preparar()).rejects.toThrow();
    expect(f.crear).not.toHaveBeenCalled();
  });
  it('deriva el PDF, copias y faz del snapshot, con reserva auditable antes de responder', async () => {
    const f = await fixture();
    const r = await f.preparar();
    expect(r.params.options).toMatchObject({
      copies: 2,
      duplex: 'long-edge',
      colorType: 'grayscale',
    });
    expect(r.params.data[0].data).toBe(f.bytes.toString('base64'));
    const creacion = (f.crear.mock.calls as unknown[][])[0][0] as {
      data: Record<string, unknown>;
    };
    expect(creacion.data).toMatchObject({
      tenantId: auth.tenantId,
      ordenId: 'orden',
      usuarioId: auth.userId,
      datosJson: { archivos: ['archivo'], estado: 'PREPARADO' },
    });
    const consulta = (f.buscarOrden.mock.calls as unknown[][])[0][0] as {
      where: Record<string, unknown>;
    };
    expect(consulta.where).toEqual({ id: 'orden', tenantId: auth.tenantId });
    expect(f.leer).toHaveBeenCalledTimes(1);
  });
  it.each([1, 2])(
    'envía color cotizado en faz %s, conserva el PDF y registra el modo firmado',
    async (faz) => {
      const f = await fixture();
      f.orden.items[0].jobContextSnapshotJson = job({
        ...meta,
        color: 'COLOR',
        faz,
        hojas: faz === 2 ? 4 : 6,
      });
      f.perfiles.perfiles.mockResolvedValue([
        { ...perfilPrueba, color: 'COLOR', faz },
      ]);
      const r = await f.preparar();
      expect(r.params.options).toMatchObject({
        colorType: 'color',
        copies: 2,
        printerTray: perfilPrueba.bandeja.codigo,
        duplex: faz === 2 ? 'long-edge' : 'one-sided',
      });
      expect(r.params.data[0].data).toBe(f.bytes.toString('base64'));
      expect(f.firmar).toHaveBeenCalledWith(r.params);
      const creacion = (f.crear.mock.calls as unknown[][])[0][0] as {
        data: Record<string, unknown>;
      };
      expect(creacion.data).toMatchObject({
        datosJson: {
          configuracion: { color: 'COLOR' },
          perfilSnapshot: { color: 'COLOR' },
        },
      });
    },
  );
  it('rechaza color sin perfil compatible antes de leer archivos o reservar un envío', async () => {
    const f = await fixture();
    f.orden.items[0].jobContextSnapshotJson = job({ ...meta, color: 'COLOR' });
    await expect(f.preparar()).rejects.toThrow('perfil compatible');
    expect(f.leer).not.toHaveBeenCalled();
    expect(f.firmar).not.toHaveBeenCalled();
    expect(f.crear).not.toHaveBeenCalled();
  });
  it.each(['vertical', 'horizontal', 'mixto', 'rotado'])(
    'imprime un PDF %s con orientación automática y audita la lectura real, también en OT históricas',
    async (tipo) => {
      const f = await fixture();
      const pdf = await PDFDocument.create();
      for (let i = 0; i < 3; i++) {
        const horizontal =
          tipo === 'horizontal' || (tipo === 'mixto' && i === 1);
        const pagina = pdf.addPage(horizontal ? [842, 595] : [595, 842]);
        if (tipo === 'rotado') pagina.setRotation(degrees(90));
      }
      const bytes = Buffer.from(await pdf.save());
      f.leer.mockResolvedValue(bytes);
      f.orden.items[0].archivos[0].bytes = BigInt(bytes.length);
      const r = await f.preparar();
      expect(r.params.options).toMatchObject({
        orientation: null,
        copies: 2,
        duplex: 'long-edge',
      });
      expect(r.params.data[0].data).toBe(bytes.toString('base64'));
      expect(r.intento.orientacion).toBe(
        tipo === 'rotado' ? 'horizontal' : tipo,
      );
      expect(r.intento.orientacionesPaginas).toEqual(
        pdf.getPages().map(orientacionPaginaPdf),
      );
    },
  );
  it('conserva /Rotate y toma la orientación del rango enviado, sin usar a ciegas la metadata', async () => {
    const f = await fixture();
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    pdf.addPage([842, 595]);
    pdf.addPage([595, 842]).setRotation(degrees(270));
    const bytes = Buffer.from(await pdf.save());
    f.leer.mockResolvedValue(bytes);
    f.orden.items[0].archivos[0].bytes = BigInt(bytes.length);
    f.orden.items[0].jobContextSnapshotJson = job({
      ...meta,
      paginas: 2,
      paginasOriginales: 3,
      rangoPaginas: '2-3',
      archivoNombre: 'original.pdf',
      hojas: 2,
      orientacionesPaginas: ['vertical', 'vertical', 'vertical'],
    });
    const r = await f.preparar();
    const enviado = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(enviado.getPageCount()).toBe(2);
    expect(enviado.getPage(1).getRotation().angle).toBe(270);
    expect(enviado.getPages().map(orientacionPaginaPdf)).toEqual([
      'horizontal',
      'horizontal',
    ]);
    expect(r.intento.orientacion).toBe('horizontal');
    expect(r.params.options.orientation).toBeNull();
  });
  it('mantiene el orden, las copias y el dorso en blanco de un tomo con originales de distinta orientación', async () => {
    const f = await fixture();
    const horizontal = await PDFDocument.create();
    for (let i = 0; i < 3; i++) horizontal.addPage([842, 595]);
    const bytes = Buffer.from(await horizontal.save());
    const item = f.orden.items[0];
    item.archivos.push({
      ...item.archivos[0],
      id: 'archivo-2',
      nombreOriginal: 'segundo.pdf',
      key: 'tenant-a/segundo.pdf',
    });
    item.archivos[0].bytes = BigInt(bytes.length);
    f.leer.mockResolvedValueOnce(bytes).mockResolvedValueOnce(f.bytes);
    item.jobContextSnapshotJson = job({
      esTomo: true,
      tomoNombre: 'Tomo mixto',
      juegos: 2,
      hojas: 8,
      segmentos: [
        { ...meta, archivoNombre: 'original.pdf' },
        { ...meta, archivoNombre: 'segundo.pdf' },
      ],
    });
    const r = await f.preparar();
    const enviado = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(enviado.getPages().map(orientacionPaginaPdf)).toEqual([
      'horizontal',
      'horizontal',
      'horizontal',
      'horizontal',
      'vertical',
      'vertical',
      'vertical',
      'vertical',
    ]);
    expect(r.params.options).toMatchObject({
      orientation: null,
      copies: 2,
      duplex: 'long-edge',
    });
    expect(r.intento.orientacion).toBe('mixto');
    expect(r.intento.orientacionesPaginas).toHaveLength(6);
    expect(r.intento.hojas).toBe(8);
  });
  it.each(['borrador', 'cancelada'])(
    'rechaza una OT %s sin leer sus archivos',
    async (estado) => {
      const f = await fixture();
      f.orden.estado = estado;
      await expect(f.preparar()).rejects.toThrow('emití');
      expect(f.leer).not.toHaveBeenCalled();
    },
  );
  it('extrae únicamente los rangos cotizados y conserva orden, copias y auditoría', async () => {
    const f = await fixture();
    const original = await PDFDocument.create();
    // Anchos distintos permiten verificar la identidad de cada página extraída.
    for (let n = 1; n <= 20; n++) original.addPage([500 + n, 842]);
    const bytes = Buffer.from(await original.save());
    f.leer.mockResolvedValue(bytes);
    f.orden.items[0].archivos[0].bytes = BigInt(bytes.length);
    f.orden.items[0].jobContextSnapshotJson = job({
      ...meta,
      paginas: 13,
      paginasOriginales: 20,
      rangoPaginas: '1-7,9,12-16',
      archivoNombre: 'original.pdf',
      hojas: 14,
    });
    const r = await f.preparar();
    const resultado = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(resultado.getPages().map((p) => p.getWidth() - 500)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 14, 15, 16,
    ]);
    expect(r.params.options).toMatchObject({ copies: 2, duplex: 'long-edge' });
    expect(r.intento).toMatchObject({
      paginas: 13,
      hojas: 14,
      seleccionPaginas: [
        { nombre: 'original.pdf', rango: '1-7,9,12-16', paginasOriginales: 20 },
      ],
    });
  });
  it('separa los segmentos impares de un tomo después de aplicar sus rangos', async () => {
    const f = await fixture();
    const item = f.orden.items[0];
    item.archivos.push({
      ...item.archivos[0],
      id: 'archivo-2',
      nombreOriginal: 'segundo.pdf',
      key: 'tenant-a/segundo.pdf',
    });
    item.jobContextSnapshotJson = job({
      esTomo: true,
      tomoNombre: 'Tomo',
      juegos: 2,
      hojas: 6,
      segmentos: [
        { ...meta, archivoNombre: 'original.pdf' },
        {
          ...meta,
          archivoNombre: 'segundo.pdf',
          paginas: 1,
          paginasOriginales: 3,
          rangoPaginas: '2',
        },
      ],
    });
    const r = await f.preparar();
    const resultado = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(resultado.getPageCount()).toBe(6); // 3+blanco, 1+blanco, por juego
    expect(r.params.options.copies).toBe(2);
    expect(r.intento.hojas).toBe(6);
  });
  it.each([
    { paginas: 2, paginasOriginales: 3, rangoPaginas: '1-3' },
    { paginas: 2, paginasOriginales: 3, rangoPaginas: '1,4' },
    { paginas: 2, paginasOriginales: undefined, rangoPaginas: '1,3' },
    { paginas: 3, paginasOriginales: 3, rangoPaginas: [1, 3] },
  ])(
    'no firma ni lee archivos cuando el rango guardado es inconsistente: %o',
    async (seleccion) => {
      const f = await fixture();
      f.orden.items[0].jobContextSnapshotJson = job({
        ...meta,
        ...seleccion,
        archivoNombre: 'original.pdf',
        hojas: 2,
      });
      await expect(f.preparar()).rejects.toThrow();
      expect(f.leer).not.toHaveBeenCalled();
      expect(f.firmar).not.toHaveBeenCalled();
    },
  );
  it('rechaza un tenant ajeno antes de leer/firmar', async () => {
    const f = await fixture();
    f.buscarOrden.mockResolvedValue(null);
    await expect(f.preparar()).rejects.toThrow('no encontrada');
    expect(f.firmar).not.toHaveBeenCalled();
  });
  it('requiere reimpresión explícita de la última versión; no entrega otra firma ante repetición', async () => {
    const f = await fixture();
    f.buscarEvento
      .mockResolvedValueOnce({ id: 'previo' })
      .mockResolvedValueOnce(null);
    await expect(f.preparar()).rejects.toThrow('ya tiene un envío');
    expect(f.crear).not.toHaveBeenCalled();
    f.buscarEvento
      .mockResolvedValueOnce({ id: 'previo' })
      .mockResolvedValueOnce(null);
    await expect(f.preparar('previo')).resolves.toHaveProperty(
      'intento.id',
      'intento',
    );
    f.buscarEvento.mockResolvedValue({ id: 'intento' });
    await expect(f.preparar('intento')).rejects.toThrow('ya tiene un envío');
    expect(f.crear).toHaveBeenCalledTimes(1);
  });
  it('no firma si las páginas reales no coinciden, el archivo falta o es inválido', async () => {
    const f = await fixture();
    f.orden.items[0].jobContextSnapshotJson = job({ ...meta, paginas: 4 });
    await expect(f.preparar()).rejects.toThrow('páginas');
    f.leer.mockResolvedValue(null);
    await expect(f.preparar()).rejects.toThrow('disponible');
    expect(f.firmar).not.toHaveBeenCalled();
  });
  it('el rechazo de una firma no reserva un envío', async () => {
    const f = await fixture();
    f.firmar.mockImplementation(() => {
      throw new Error('certificado');
    });
    await expect(f.preparar()).rejects.toThrow('certificado');
    expect(f.crear).not.toHaveBeenCalled();
  });
  it('conserva el orden de los originales de un tomo y separa los impares a doble faz', async () => {
    const f = await fixture();
    const item = f.orden.items[0];
    item.archivos.push({
      ...item.archivos[0],
      id: 'archivo-2',
      nombreOriginal: 'segundo.pdf',
      key: 'tenant-a/segundo.pdf',
    });
    item.jobContextSnapshotJson = job({
      esTomo: true,
      tomoNombre: 'Tomo',
      juegos: 2,
      hojas: 8,
      segmentos: [
        { ...meta, archivoNombre: 'original.pdf' },
        { ...meta, archivoNombre: 'segundo.pdf' },
      ],
    });
    const r = await f.preparar();
    const pdf = await PDFDocument.load(
      Buffer.from(r.params.data[0].data, 'base64'),
    );
    expect(pdf.getPageCount()).toBe(8);
    expect(r.params.options).toMatchObject({ copies: 2, duplex: 'long-edge' });
    expect(r.intento.archivos).toEqual(['archivo', 'archivo-2']);
    expect(f.leer.mock.calls).toEqual([
      ['tenant-a/original.pdf'],
      ['tenant-a/segundo.pdf'],
    ]);
  });
  it('permite seguimiento compartido dentro del tenant sin modificar producción', async () => {
    const f = await fixture();
    f.buscarEvento.mockResolvedValue({
      id: 'intento',
      datosJson: {
        estado: 'COMPLETE',
        eventos: [],
        confirmacion: { usuario: 'Comercial', fecha: '2026-09-18' },
      },
      fecha: new Date(),
      usuarioNombre: 'Operario',
    });
    const r = await f.servicio.estado(
      auth,
      'orden',
      'intento',
      'DELETED',
      'Retirado',
    );
    expect((r as Record<string, unknown>).estado).toBe('COMPLETE');
    expect((r as Record<string, unknown>).confirmacion).toEqual({
      usuario: 'Comercial',
      fecha: '2026-09-18',
    });
    const consulta = (f.buscarEvento.mock.calls as unknown[][])[0][0] as {
      where: Record<string, unknown>;
    };
    expect(consulta.where).toMatchObject({
      tenantId: auth.tenantId,
      ordenId: 'orden',
    });
  });

  it('registra la verificación humana sin alterar el estado de Windows ni producción', async () => {
    const f = await fixture();
    f.buscarEvento.mockResolvedValue({
      id: 'envio',
      datosJson: { itemId: 'item', estado: 'SIN_CONFIRMAR', eventos: [] },
    });
    await f.servicio.confirmar(auth, 'orden', ['envio']);
    const actualizacion = (f.actualizarEvento.mock.calls as unknown[][])[0][0];
    expect(actualizacion).toMatchObject({
      where: { id: 'envio', tenantId: auth.tenantId },
      data: {
        datosJson: {
          estado: 'SIN_CONFIRMAR',
          confirmacion: {
            usuarioId: auth.userId,
            usuario: auth.email,
          },
        },
      },
    });
    const creacion = (f.crear.mock.calls as unknown[][])[0][0];
    expect(creacion).toMatchObject({
      data: {
        tipo: 'impresion_confirmada',
        tenantId: auth.tenantId,
        ordenId: 'orden',
        usuarioId: auth.userId,
        datosJson: { envioIds: ['envio'] },
      },
    });
    const consulta = (f.buscarEvento.mock.calls as unknown[][])[0][0];
    expect(consulta).toMatchObject({
      where: {
        tenantId: auth.tenantId,
        ordenId: 'orden',
        tipo: 'impresion_documento',
      },
    });
    expect(f.firmar).not.toHaveBeenCalled();
  });

  it('no duplica el registro si se repite una confirmación ya guardada', async () => {
    const f = await fixture();
    f.buscarEvento.mockResolvedValue({
      id: 'envio',
      datosJson: {
        confirmacion: { usuarioId: 'otro-operario', fecha: '2026-09-18' },
      },
    });
    await expect(
      f.servicio.confirmar(auth, 'orden', ['envio']),
    ).resolves.toEqual({ ok: true });
    expect(f.actualizarEvento).not.toHaveBeenCalled();
    expect(f.crear).not.toHaveBeenCalled();
  });

  it('permite verificar sólo lo enviado y conservar documentos pendientes', async () => {
    const f = await fixture();
    f.orden.items.push({ ...f.orden.items[0], id: 'otro-item' });
    f.buscarEvento
      .mockResolvedValueOnce({ id: 'envio' })
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'envio', datosJson: { estado: 'COMPLETE' } });
    await expect(
      f.servicio.confirmar(auth, 'orden', ['envio']),
    ).resolves.toEqual({ ok: true });
    expect(f.actualizarEvento).toHaveBeenCalledTimes(1);
  });

  it.each([['envio-anterior'], ['envio', 'extra'], []])(
    'rechaza una vista de envíos obsoleta: %j',
    async (...ids: string[]) => {
      const f = await fixture();
      f.buscarEvento.mockResolvedValue({ id: 'envio' });
      await expect(f.servicio.confirmar(auth, 'orden', ids)).rejects.toThrow(
        'envíos cambiaron',
      );
      expect(f.actualizarEvento).not.toHaveBeenCalled();
    },
  );

  it('no confirma órdenes de otra empresa ni órdenes canceladas', async () => {
    const f = await fixture();
    f.buscarOrden.mockResolvedValueOnce(null);
    await expect(
      f.servicio.confirmar(auth, 'orden', ['envio']),
    ).rejects.toThrow('no encontrada');
    f.orden.estado = 'cancelada';
    await expect(
      f.servicio.confirmar(auth, 'orden', ['envio']),
    ).rejects.toThrow('no está disponible');
    expect(f.buscarOrden).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'orden', tenantId: auth.tenantId },
      }),
    );
    expect(f.actualizarEvento).not.toHaveBeenCalled();
    expect(f.crear).not.toHaveBeenCalled();
  });
});
