import { PreparacionesRecorridoService } from './preparaciones-recorrido.service';
import { seleccionRecorrido } from './preparaciones-recorrido.controller';

const sourceSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
    <path d="M 0 0 H 200 V 100 H 0 Z" />
  </svg>`;

function itemVectorial() {
  return {
    id: 'item-1',
    codigo: 'POLYFAN',
    nombre: 'Cartel corpóreo',
    cotizacionItem: {
      jobContextJson: {
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: 'cartel.svg',
          svg: sourceSvg,
          anchoFinalMm: 2000,
        },
      },
      trazabilidadJson: {
        pasos: [
          {
            familiaCodigo: 'corte_hilo_caliente',
            nestingResult: {
              algorithm: 'irregular-2d-bottom-left-v1',
              estrategiaDisposicion: 'composicion_original',
              substrates: [{ kind: 'sheet', widthMm: 2100, heightMm: 1100 }],
              placements: [],
              visualConfig: {
                margins: {
                  leftMm: 10,
                  rightMm: 10,
                  topMm: 10,
                  bottomMm: 10,
                },
              },
            },
          },
        ],
      },
    },
  };
}

describe('PreparacionesRecorridoService · plantilla de instalación', () => {
  it('prepara todas las placas y sus repeticiones con la máquina y velocidad cotizadas del componente', async () => {
    const base = itemVectorial();
    const corte = base.cotizacionItem.trazabilidadJson.pasos[0];
    Object.assign(corte, {
      activado: true,
      rutaPasoId: 'corte',
      recorridoCorte: [{ velocidadMmMin: 350 }],
    });
    Object.assign(corte.nestingResult, {
      maquina: { id: 'maquina-cotizada' },
      perfil: { id: 'perfil-cotizado' },
      substrates: [3, 1].map((count) => ({
        kind: 'sheet',
        widthMm: 1200,
        heightMm: 600,
        count,
      })),
      placements: [0, 1].map((substrateIndex) => ({
        substrateIndex,
        pieceId: 'letra',
        meta: {
          contornos: [
            {
              puntos: [
                { x: 10, y: 10 },
                { x: 30, y: 10 },
                { x: 30, y: 30 },
              ],
            },
          ],
        },
      })),
    });
    const maquina = jest.fn().mockResolvedValue({
      nombre: 'Cortadora',
      anchoUtil: 1250,
      largoUtil: 650,
      parametrosTecnicosJson: { postprocesadorRecorrido: 'HOTWIRE_TAP_V1' },
      perfilesOperativos: [
        {
          id: 'perfil-cotizado',
          nombre: 'Polyfan',
          productivityUnit: 'MM_MIN',
          productivityValue: 999,
        },
      ],
    });
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: {
          findFirst: jest.fn().mockResolvedValue({
            ...base,
            cotizacionItem: null,
            trazabilidadSnapshotJson: base.cotizacionItem.trazabilidadJson,
          }),
        },
        maquina: { findFirst: maquina },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    const preparar = jest
      .spyOn(
        service as unknown as {
          asegurarRevision(args: unknown): Promise<{ id: string }>;
        },
        'asegurarRevision',
      )
      .mockResolvedValue({ id: 'revision' });
    const result = await service.asegurarParaItem(
      { tenantId: 'tenant-a' } as never,
      'item-1',
    );
    expect(result.map((r) => r.copias)).toEqual([3, 1]);
    expect(preparar).toHaveBeenCalledTimes(2);
    expect(preparar.mock.calls[1][0]).toMatchObject({
      plateIndex: 1,
      profile: {
        id: 'perfil-cotizado',
        velocidadMmMin: 350,
      },
    });
    const consultas = maquina.mock.calls as unknown[][];
    expect(consultas[0][0]).toMatchObject({
      where: {
        tenantId: 'tenant-a',
        id: 'maquina-cotizada',
      },
      include: {
        perfilesOperativos: {
          where: { activo: true, id: 'perfil-cotizado' },
        },
      },
    });
  });
  it('resuelve el componente dentro de su padre y usa sus datos congelados aunque no tenga cotizacionItem', async () => {
    const base = itemVectorial();
    const hijo = {
      ...base,
      id: 'item-hijo',
      cotizacionItem: null,
      jobContextSnapshotJson: base.cotizacionItem.jobContextJson,
      trazabilidadSnapshotJson: base.cotizacionItem.trazabilidadJson,
    };
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ ...base, id: 'padre' })
      .mockResolvedValueOnce(hijo);
    const service = new PreparacionesRecorridoService(
      { ordenTrabajoItem: { findFirst } } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    const result = await service.plantillaInstalacion(
      { tenantId: 'tenant-a' } as never,
      'padre',
      undefined,
      { rutaComponentes: ['polyfan'] },
    );
    expect(result.anchoDisenoMm).toBe(2000);
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          parentItemId: 'padre',
          componenteCodigo: 'polyfan',
        },
      }),
    );
  });

  it('rechaza un componente que no pertenece al item solicitado', async () => {
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(itemVectorial())
            .mockResolvedValueOnce(null),
        },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    await expect(
      service.plantillaInstalacion(
        { tenantId: 'tenant-a' } as never,
        'item-1',
        undefined,
        { rutaComponentes: ['ajeno'] },
      ),
    ).rejects.toThrow('No se encontró el componente');
  });

  it('no prepara un corte desactivado ni selecciona otro paso por error', async () => {
    const base = itemVectorial();
    const corte = base.cotizacionItem.trazabilidadJson.pasos[0];
    Object.assign(corte, { activado: false, rutaPasoId: 'corte' });
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: { findFirst: jest.fn().mockResolvedValue(base) },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    expect(
      await service.asegurarParaItem(
        { tenantId: 'tenant-a' } as never,
        'item-1',
      ),
    ).toEqual([]);
    Object.assign(corte, { activado: true });
    expect(
      await service.asegurarParaItem(
        { tenantId: 'tenant-a' } as never,
        'item-1',
        false,
        { rutaPasoId: 'otro' },
      ),
    ).toEqual([]);
  });

  it('valida la ruta de componentes recibida por la API', () => {
    expect(
      seleccionRecorrido({
        componentes: '["cartel","polyfan"]',
        paso: 'corte',
        fuente: 'logo',
      }),
    ).toEqual({
      rutaComponentes: ['cartel', 'polyfan'],
      rutaPasoId: 'corte',
      fuenteId: 'logo',
    });
    expect(() => seleccionRecorrido({ componentes: '{"id":"otro"}' })).toThrow(
      'no es válida',
    );
    expect(() => seleccionRecorrido({ componentes: 'no-json' })).toThrow(
      'no es válida',
    );
  });
  it('aísla la búsqueda por tenant y conserva la composición original', async () => {
    const findFirst = jest.fn().mockResolvedValue(itemVectorial());
    const service = new PreparacionesRecorridoService(
      { ordenTrabajoItem: { findFirst } } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );

    const result = await service.plantillaInstalacion(
      { tenantId: 'tenant-a' } as never,
      'item-1',
      { bordeMm: 50, anchoPanelMm: 1200, altoPanelMm: 600, solapeMm: 20 },
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-1', tenantId: 'tenant-a' },
      }),
    );
    expect(result.anchoDisenoMm).toBe(2000);
    expect(result.altoDisenoMm).toBe(1000);
    expect(result.anchoPlantillaMm).toBe(2100);
    expect(result.previewSvg).toContain('VISTA-EXPLICATIVA');
    expect(result.previewSvg).toContain('Panel 1');
  });

  it('no genera la plantilla para un item que no usa hilo caliente', async () => {
    const item = itemVectorial();
    item.cotizacionItem.trazabilidadJson.pasos = [];
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: { findFirst: jest.fn().mockResolvedValue(item) },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );

    await expect(
      service.plantillaInstalacion({ tenantId: 'tenant-a' } as never, 'item-1'),
    ).rejects.toThrow('sólo está disponible');
  });

  it('reutiliza las uniones guardadas en la cotización aunque cambie la máquina', async () => {
    const item = itemVectorial();
    const paso = item.cotizacionItem.trazabilidadJson.pasos[0];
    paso.nestingResult.estrategiaDisposicion = 'nesting_optimizado';
    (paso.nestingResult as Record<string, unknown>).metricasRaw = {
      uniones: [
        {
          id: 'pieza-1-U1',
          piezaOrigenId: 'pieza-1',
          tipoEncastre: 'recta',
          eje: 'vertical',
          posicionMm: 1000,
          largoMm: 1000,
          cantidadEncastres: 0,
          anchoEncastreMm: 0,
          profundidadEncastreMm: 0,
          kerfMm: 0.3,
        },
      ],
    };
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: { findFirst: jest.fn().mockResolvedValue(item) },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );

    const result = await service.plantillaInstalacion(
      { tenantId: 'tenant-a' } as never,
      'item-1',
    );

    expect(result.cantidadUniones).toBe(1);
  });

  it('entrega el plano PDF y el DXF con nombre descargable', async () => {
    const service = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: {
          findFirst: jest.fn().mockResolvedValue(itemVectorial()),
        },
      } as never,
      {} as never,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    const auth = { tenantId: 'tenant-a' } as never;
    const pdf = await service.descargarArchivoInstalacion(
      auth,
      'item-1',
      'plano-pdf',
      null,
    );
    const dxf = await service.descargarArchivoInstalacion(
      auth,
      'item-1',
      'rigida-dxf',
      null,
    );

    expect(pdf.mime).toBe('application/pdf');
    expect(pdf.name.endsWith('-plano-general-acotado.pdf')).toBe(true);
    expect(pdf.bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(dxf.mime).toContain('application/dxf');
    expect(dxf.name.endsWith('-plantilla-rigida.dxf')).toBe(true);
    expect(dxf.bytes.toString('utf8')).toContain('$INSUNITS');
  });
});
