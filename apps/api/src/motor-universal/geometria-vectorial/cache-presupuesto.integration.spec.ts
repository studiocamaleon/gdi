import Redis from 'ioredis';
import {
  EntradaGeometriaVectorialCache,
  GeometriaVectorialCacheService,
} from './geometria-vectorial-cache.service';
import { CONFIGURACION_ENCASTRES_DEFAULT } from './segmentacion-encastres';
import {
  CLAVES_CACHE_VECTORIAL,
  PRESUPUESTO_CACHE_VECTORIAL as CUPO,
  serializarEntradaCache,
} from './cache-vectorial-presupuesto';
import { createHash } from 'node:crypto';

const SVG = '<svg viewBox="0 0 10 10"><path d="M0 0H10V10H0Z"/></svg>';

describe('Presupuesto de caché vectorial (Redis desechable)', () => {
  const url = process.env.TEST_QUEUE_REDIS_URL;
  const original = process.env.REDIS_URL;
  let redis: Redis;
  let servicios: GeometriaVectorialCacheService[];
  let base: EntradaGeometriaVectorialCache;
  function servicio() {
    const s = new GeometriaVectorialCacheService();
    servicios.push(s);
    return s;
  }
  async function limpiar() {
    const keys = await redis.keys('grafo:geometry:analysis:*');
    if (keys.length) await redis.del(...keys);
  }
  beforeAll(() => {
    if (
      !url ||
      new URL(url).hostname !== '127.0.0.1' ||
      new URL(url).port !== '16387'
    )
      throw new Error(
        'Requiere Redis desechable exclusivo en 127.0.0.1:16387.',
      );
    process.env.REDIS_URL = url;
    redis = new Redis(url);
  });
  beforeEach(async () => {
    servicios = [];
    await limpiar();
    base = servicio().analizar({
      tenantId: 'empresa-a',
      svg: SVG,
      anchoFinalMm: 10,
      parametros: {
        cantidad: 1,
        anchoPlacaMm: 100,
        altoPlacaMm: 100,
        margenMm: 1,
        separacionMm: 1,
        permitirRotacion: true,
        preservarComposicionOriginalSiEntra: false,
        configuracionEncastres: CONFIGURACION_ENCASTRES_DEFAULT,
      },
    }).entry;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    servicios.forEach((s) => s.onApplicationShutdown());
    await limpiar();
  });
  afterAll(() => {
    redis?.disconnect();
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });
  const entrada = (id: number, tenantId = 'empresa-a') => ({
    ...base,
    tenantId,
    cacheKey: `ficticia-${id}`,
  });

  it('acota a 32 entradas por empresa entre réplicas y conserva la de otra empresa', async () => {
    const a = servicio(),
      b = servicio();
    await a.guardarCompartido(entrada(0, 'empresa-b'));
    for (let i = 0; i < 33; i++)
      await (i % 2 ? a : b).guardarCompartido(entrada(i));
    const lector = servicio();
    expect(
      await lector.obtenerCompartido('empresa-a', 'ficticia-0'),
    ).toBeNull();
    expect(await lector.obtenerCompartido('empresa-a', 'ficticia-32')).toEqual(
      entrada(32),
    );
    expect(await lector.obtenerCompartido('empresa-b', 'ficticia-0')).toEqual(
      entrada(0, 'empresa-b'),
    );
  });

  it('mantiene el cupo global con escrituras simultáneas y después de reiniciar los lectores', async () => {
    const a = servicio(),
      b = servicio();
    await Promise.all(
      Array.from({ length: 150 }, (_, i) =>
        (i % 2 ? a : b).guardarCompartido(entrada(i, `empresa-${i % 8}`)),
      ),
    );
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBe(
      CUPO.compartidoEntradas,
    );
    for (const indice of CLAVES_CACHE_VECTORIAL.slice(1))
      expect(await redis.zcard(indice)).toBe(CUPO.compartidoEntradas);
    a.onApplicationShutdown();
    b.onApplicationShutdown();
    const lector = servicio();
    await lector.guardarCompartido(entrada(151, 'empresa-nueva'));
    expect(
      await lector.obtenerCompartido('empresa-nueva', 'ficticia-151'),
    ).toEqual(entrada(151, 'empresa-nueva'));
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBe(
      CUPO.compartidoEntradas,
    );
  });

  const grande = (id: number, tenantId: string, bytes = 1024 * 1024) => ({
    ...entrada(id, tenantId),
    analisis: {
      ...base.analisis,
      diagnosticos: [
        {
          codigo: 'fixture',
          severidad: 'WARNING' as const,
          mensaje: 'x'.repeat(bytes),
        },
      ],
    },
  });

  async function bytesGuardados(tenantId?: string) {
    const prefijo = tenantId
      ? createHash('sha256').update(tenantId).digest('hex') + ':'
      : '';
    const campos = (await redis.hkeys(CLAVES_CACHE_VECTORIAL[0])).filter((k) =>
      k.startsWith(prefijo),
    );
    let bytes = 0;
    for (const campo of campos)
      bytes += await redis.hstrlen(CLAVES_CACHE_VECTORIAL[0], campo);
    return bytes;
  }

  it('limita bytes por empresa y totales aunque haya menos entradas que el máximo', async () => {
    const s = servicio();
    for (let i = 0; i < 9; i++)
      await s.guardarCompartido(grande(i, 'empresa-a'));
    expect(await bytesGuardados('empresa-a')).toBeLessThanOrEqual(
      CUPO.compartidoEmpresaBytes,
    );
    expect(
      await servicio().obtenerCompartido('empresa-a', 'ficticia-0'),
    ).toBeNull();
    for (let i = 0; i < 29; i++)
      await s.guardarCompartido(grande(i, `otra-${i}`));
    expect(await bytesGuardados()).toBeLessThanOrEqual(CUPO.compartidoBytes);
    expect(await bytesGuardados()).toBeGreaterThan(30 * 1024 * 1024);
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBeLessThan(
      CUPO.compartidoEntradas,
    );
  });

  it('acota también L1 y mantiene una copia independiente de los datos originales', async () => {
    const s = servicio();
    const original = entrada(999, 'empresa-b');
    await s.guardarCompartido(original);
    original.sourceHash = 'modificado-despues';
    expect(
      (await s.obtenerCompartido('empresa-b', original.cacheKey))?.sourceHash,
    ).toBe(base.sourceHash);
    for (let i = 0; i < 5; i++)
      await s.guardarCompartido(grande(i, 'empresa-a'));
    const leerLocal = (id: number) =>
      s.obtenerParaCotizacion({
        tenantId: 'empresa-a',
        cacheKey: `ficticia-${id}`,
        svg: SVG,
        anchoFinalMm: 10,
      });
    expect(leerLocal(0)).toBeNull();
    expect(leerLocal(4)).not.toBeNull();
    // En L2 todavía existe: la expulsión de L1 no borra el trabajo ni la otra copia.
    expect(
      await servicio().obtenerCompartido('empresa-a', 'ficticia-0'),
    ).not.toBeNull();
  });

  it('omite una entrada enorme sin fallar el cálculo ni escribirla en Redis o L1', async () => {
    const s = servicio(),
      enorme = grande(900, 'empresa-a', CUPO.entradaBytes);
    await expect(s.guardarCompartido(enorme)).resolves.toBeUndefined();
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBe(0);
    expect(await s.obtenerCompartido('empresa-a', enorme.cacheKey)).toBeNull();
    expect(enorme.analisis.diagnosticos[0].mensaje).toHaveLength(
      CUPO.entradaBytes,
    );
  });

  it('limita los bytes de L1 sumando empresas distintas', async () => {
    const s = servicio();
    for (let i = 0; i < 18; i++)
      await s.guardarCompartido(grande(i, `empresa-${i}`));
    const leerLocal = (i: number) =>
      s.obtenerParaCotizacion({
        tenantId: `empresa-${i}`,
        cacheKey: `ficticia-${i}`,
        svg: SVG,
        anchoFinalMm: 10,
      });
    expect(leerLocal(0)).toBeNull();
    expect(leerLocal(2)).toBeNull();
    expect(leerLocal(3)).not.toBeNull();
    expect(leerLocal(17)).not.toBeNull();
  });

  it('cuenta Unicode y escapes y conserva exactamente las coordenadas y textos', () => {
    const valor = {
      ...entrada(0),
      texto: 'á🖨️\n"\\',
      coordenadas: [0.000123456789, -4.938401729, 0],
    };
    expect(JSON.parse(serializarEntradaCache(valor)!)).toEqual(valor);
    expect(serializarEntradaCache({ texto: '🖨️'.repeat(350_000) })).toBeNull();
    expect(
      serializarEntradaCache({ texto: '\n'.repeat(CUPO.entradaBytes) }),
    ).toBeNull();
  });

  it('elimina entradas vencidas y conserva las recientes', async () => {
    const s = servicio();
    await s.guardarCompartido({ ...entrada(0), expiresAt: Date.now() + 100 });
    await s.guardarCompartido(entrada(1));
    await new Promise((resolve) => setTimeout(resolve, 140));
    expect(await s.obtenerCompartido('empresa-a', 'ficticia-0')).toBeNull();
    expect(await s.obtenerCompartido('empresa-a', 'ficticia-1')).not.toBeNull();
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBe(1);
  });

  it('una lectura compartida conserva la entrada utilizada al expulsar otra de esa empresa', async () => {
    const s = servicio();
    for (let i = 0; i < 32; i++) await s.guardarCompartido(entrada(i));
    expect(
      await servicio().obtenerCompartido('empresa-a', 'ficticia-0'),
    ).not.toBeNull();
    await s.guardarCompartido(entrada(32));
    const lector = servicio();
    expect(
      await lector.obtenerCompartido('empresa-a', 'ficticia-0'),
    ).not.toBeNull();
    expect(
      await lector.obtenerCompartido('empresa-a', 'ficticia-1'),
    ).toBeNull();
    expect(
      await lector.obtenerCompartido('empresa-b', 'ficticia-0'),
    ).toBeNull();
  });

  it('tolera Redis no disponible: el guardado ya terminado sigue siendo válido', async () => {
    jest
      .spyOn(Redis.prototype, 'eval')
      .mockRejectedValue(new Error('fallo simulado'));
    const s = servicio();
    await expect(s.guardarCompartido(entrada(0))).resolves.toBeUndefined();
    expect(await s.obtenerCompartido('empresa-a', 'ficticia-0')).toEqual(
      entrada(0),
    );
    expect(
      await servicio().obtenerCompartido('empresa-a', 'ficticia-0'),
    ).toBeNull();
  });

  it('retira una escritura incompleta sin índices y no acumula sus bytes fuera del presupuesto', async () => {
    await redis.hset(
      CLAVES_CACHE_VECTORIAL[0],
      'ficticia-incompleta',
      'x'.repeat(1024),
    );
    await redis.zadd(CLAVES_CACHE_VECTORIAL[1], Date.now(), 'indice-huerfano');
    await servicio().guardarCompartido(entrada(0));
    expect(
      await redis.hexists(CLAVES_CACHE_VECTORIAL[0], 'ficticia-incompleta'),
    ).toBe(0);
    expect(
      await redis.zscore(CLAVES_CACHE_VECTORIAL[1], 'indice-huerfano'),
    ).toBeNull();
    expect(await redis.hlen(CLAVES_CACHE_VECTORIAL[0])).toBe(1);
  });
});
