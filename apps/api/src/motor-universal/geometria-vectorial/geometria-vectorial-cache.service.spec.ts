import {
  adjuntarCacheVectorial,
  GeometriaVectorialCacheService,
  marcarNestingVectorialReutilizado,
  nestingVectorialFueReutilizado,
} from './geometria-vectorial-cache.service';
import { CONFIGURACION_ENCASTRES_DEFAULT } from './segmentacion-encastres';

const SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" />
  </svg>`;

function input(tenantId = 'tenant-a') {
  return {
    tenantId,
    svg: SVG,
    anchoFinalMm: 100,
    parametros: {
      cantidad: 1,
      anchoPlacaMm: 500,
      altoPlacaMm: 500,
      margenMm: 10,
      separacionMm: 5,
      permitirRotacion: true,
      preservarComposicionOriginalSiEntra: false,
      configuracionEncastres: CONFIGURACION_ENCASTRES_DEFAULT,
    },
  };
}

describe('GeometriaVectorialCacheService', () => {
  afterEach(() => {
    delete process.env.GRAFONEST_CACHE_TTL_SECONDS;
    jest.restoreAllMocks();
  });

  it('reutiliza un análisis idéntico y valida nuevamente el hash del SVG', () => {
    const service = new GeometriaVectorialCacheService();
    const first = service.analizar(input());
    const second = service.analizar(input());

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.entry).toBe(first.entry);
    expect(
      service.obtenerParaCotizacion({
        tenantId: 'tenant-a',
        cacheKey: first.entry.cacheKey,
        svg: SVG,
        anchoFinalMm: 100,
      }),
    ).toBe(first.entry);
    expect(
      service.obtenerParaCotizacion({
        tenantId: 'tenant-a',
        cacheKey: first.entry.cacheKey,
        svg: `${SVG}<!-- fuente modificada -->`,
        anchoFinalMm: 100,
      }),
    ).toBeNull();
  });

  it('aísla las entradas por tenant', () => {
    const service = new GeometriaVectorialCacheService();
    const { entry } = service.analizar(input('tenant-a'));

    expect(
      service.obtenerParaCotizacion({
        tenantId: 'tenant-b',
        cacheKey: entry.cacheKey,
        svg: SVG,
        anchoFinalMm: 100,
      }),
    ).toBeNull();
  });

  it('invalida la entrada al vencer el TTL', () => {
    const now = 1_000_000;
    process.env.GRAFONEST_CACHE_TTL_SECONDS = '900';
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const service = new GeometriaVectorialCacheService();
    const { entry } = service.analizar(input());
    jest.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1);

    expect(
      service.obtenerParaCotizacion({
        tenantId: 'tenant-a',
        cacheKey: entry.cacheKey,
        svg: SVG,
        anchoFinalMm: 100,
      }),
    ).toBeNull();
  });

  it('genera otra entrada cuando cambia un parámetro del nesting', () => {
    const service = new GeometriaVectorialCacheService();
    const first = service.analizar(input());
    const changed = service.analizar({
      ...input(),
      parametros: { ...input().parametros, cantidad: 2 },
    });

    expect(changed.cacheHit).toBe(false);
    expect(changed.entry.cacheKey).not.toBe(first.entry.cacheKey);
    expect(changed.entry.nesting.placements).toHaveLength(2);
  });

  it('invalida el nesting cacheado cuando cambia la política de composición', () => {
    const service = new GeometriaVectorialCacheService();
    const first = service.analizar(input());
    const changed = service.analizar({
      ...input(),
      parametros: {
        ...input().parametros,
        preservarComposicionOriginalSiEntra: true,
      },
    });

    expect(changed.cacheHit).toBe(false);
    expect(changed.entry.cacheKey).not.toBe(first.entry.cacheKey);
    expect(changed.entry.nesting.estrategiaDisposicion).toBe(
      'composicion_original',
    );
  });

  it('invalida el nesting cacheado cuando cambia la política de encastres', () => {
    const service = new GeometriaVectorialCacheService();
    const first = service.analizar(input());
    const changed = service.analizar({
      ...input(),
      parametros: {
        ...input().parametros,
        configuracionEncastres: {
          ...CONFIGURACION_ENCASTRES_DEFAULT,
          tipoUnion: 'recta' as const,
        },
      },
    });

    expect(changed.cacheHit).toBe(false);
    expect(changed.entry.cacheKey).not.toBe(first.entry.cacheKey);
  });

  it('incluye la configuración de niveles en la clave', () => {
    const service = new GeometriaVectorialCacheService();
    const config = {
      schemaVersion: 1 as const,
      niveles: [{ id: 'nivel-1', nombre: 'Base', orden: 1, colorVisual: 1 }],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'nivel-1', modo: 'pieza' as const },
      ],
    };
    const first = service.analizar({ ...input(), configuracionCapas: config });
    const changed = service.analizar({
      ...input(),
      configuracionCapas: {
        ...config,
        niveles: [{ ...config.niveles[0], nombre: 'Frente' }],
      },
    });

    expect(changed.cacheHit).toBe(false);
    expect(changed.entry.cacheKey).not.toBe(first.entry.cacheKey);
  });

  it('registra el hit solamente cuando el dispatcher reutiliza el nesting', () => {
    const service = new GeometriaVectorialCacheService();
    const { entry } = service.analizar(input());
    const jobContext = { cantidad: 1 };

    adjuntarCacheVectorial(jobContext, entry);
    expect(nestingVectorialFueReutilizado(jobContext)).toBe(false);
    marcarNestingVectorialReutilizado(jobContext);
    expect(nestingVectorialFueReutilizado(jobContext)).toBe(true);
    expect(JSON.stringify(jobContext)).toBe('{"cantidad":1}');
  });
});
