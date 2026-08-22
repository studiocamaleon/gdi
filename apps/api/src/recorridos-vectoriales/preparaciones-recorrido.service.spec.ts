import { PreparacionesRecorridoService } from './preparaciones-recorrido.service';

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
  it('aísla la búsqueda por tenant y conserva la composición original', async () => {
    const findFirst = jest.fn().mockResolvedValue(itemVectorial());
    const service = new PreparacionesRecorridoService(
      { ordenTrabajoItem: { findFirst } } as never,
      {} as never,
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
