import { validate } from 'class-validator';
import {
  FiltroIncidentesDto,
  IncidentesController,
} from '../incidentes.controller';
import { IncidentesService, proyectarIncidente } from '../incidentes.service';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { SIN_TENANT_KEY } from '../../common/sin-tenant.decorator';

const filtro = {
  entorno: 'production',
  periodo: '24h',
  estado: 'abiertos',
  pruebas: 'no',
} as const;
const fila = {
  id: '123',
  shortId: 'GRAFOPRINT-API-1',
  project: { slug: 'grafoprint-api' },
  title: 'Error privado de cliente@ejemplo.invalid',
  assignedTo: { email: 'privado@ejemplo.invalid' },
  count: '900',
  filtered: { count: '3', lastSeen: '2026-10-03T10:00:00Z' },
  permalink: 'https://sitio-ajeno.invalid/clave',
  status: 'unresolved',
  priority: 'high',
};
const entornoAnterior = { ...process.env };
const fetchOriginal = global.fetch;
afterEach(() => {
  process.env = { ...entornoAnterior };
  global.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

describe('Incidentes de Plataforma', () => {
  it('mantiene separados los permisos del tenant y exige administrador para pruebas', () => {
    expect(Reflect.getMetadata('__guards__', IncidentesController)).toContain(
      PlataformaGuard,
    );
    expect(Reflect.getMetadata(SIN_TENANT_KEY, IncidentesController)).toBe(
      true,
    );
    expect(
      Reflect.getMetadata(
        '__guards__',
        Object.getOwnPropertyDescriptor(
          IncidentesController.prototype,
          'probar',
        )!.value as object,
      ),
    ).toContain(PlataformaAdminGuard);
  });
  it('rechaza filtros arbitrarios antes de construir consultas externas', async () => {
    const dto = Object.assign(new FiltroIncidentesDto(), {
      entorno: 'http://otro.invalid',
      periodo: '999d',
      estado: 'is:unresolved OR',
      pruebas: 'yes',
    });
    expect(await validate(dto)).toHaveLength(4);
    expect(await validate(new FiltroIncidentesDto())).toHaveLength(0);
  });
  it('elimina contenido privado y usa recuentos del período, nunca el histórico', () => {
    const resultado = proyectarIncidente(fila, 'grafoprint');
    expect(resultado).toMatchObject({
      titulo: 'Fallo de aplicación',
      repeticiones: 3,
      enlace: 'https://grafoprint.sentry.io/issues/123/',
      prioridad: 'alta',
    });
    expect(JSON.stringify(resultado)).not.toMatch(
      /privado|cliente@|sitio-ajeno|900/,
    );
    expect(
      proyectarIncidente({ ...fila, filtered: null }, 'grafoprint')
        ?.repeticiones,
    ).toBeNull();
    expect(
      proyectarIncidente(
        { ...fila, project: { slug: 'otro-proyecto' } },
        'grafoprint',
      ),
    ).toBeNull();
    expect(
      proyectarIncidente({ ...fila, id: '../otro' }, 'grafoprint'),
    ).toBeNull();
  });
  it('sin credencial informa falta de conexión, no simula una consulta vacía correcta', async () => {
    delete process.env.SENTRY_READ_TOKEN;
    const mock = jest.fn();
    global.fetch = mock;
    expect(await new IncidentesService().listar(filtro)).toMatchObject({
      conexion: 'sin_configurar',
      actualizadoEl: null,
    });
    expect(mock).not.toHaveBeenCalled();
  });
  it('limita el destino, evita redirecciones y comparte consultas simultáneas', async () => {
    process.env.SENTRY_READ_TOKEN = 'clave-ficticia';
    process.env.SENTRY_ORG = 'grafoprint';
    const mock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([fila]), {
        headers: {
          link: '<https://us.sentry.io/x>; rel="next"; results="true"',
        },
      }),
    );
    global.fetch = mock;
    const service = new IncidentesService();
    const [a, b] = await Promise.all([
      service.listar(filtro),
      service.listar(filtro),
    ]);
    expect(a).toEqual(b);
    expect(a.hayMas).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe('https://us.sentry.io');
    expect(url.searchParams.getAll('project')).toEqual([
      'grafoprint-web',
      'grafoprint-api',
    ]);
    expect(url.searchParams.get('query')).toBe(
      'is:unresolved !operacion:prueba',
    );
    expect(url.searchParams.get('environment')).toBe('production');
    expect(init.redirect).toBe('error');
    expect(JSON.stringify(a)).not.toContain('clave-ficticia');
  });
  it('conserva los últimos datos ante un fallo e informa que están desactualizados', async () => {
    process.env.SENTRY_READ_TOKEN = 'clave-ficticia';
    process.env.SENTRY_ORG = 'grafoprint';
    const mock = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([fila])))
      .mockResolvedValueOnce(new Response('detalle secreto', { status: 403 }));
    global.fetch = mock;
    const service = new IncidentesService();
    const primero = await service.listar(filtro);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    const segundo = await service.listar(filtro);
    expect(segundo).toMatchObject({
      conexion: 'no_disponible',
      actualizadoEl: primero.actualizadoEl,
      incidentes: primero.incidentes,
    });
    expect(JSON.stringify(segundo)).not.toContain('secreto');
  });
  it('no mezcla los resultados de staging y producción ni pruebas con incidentes reales', async () => {
    process.env.SENTRY_READ_TOKEN = 'clave-ficticia';
    const mock = jest.fn().mockResolvedValue(new Response('[]'));
    global.fetch = mock;
    const service = new IncidentesService();
    await service.listar(filtro);
    mock.mockResolvedValue(new Response('[]'));
    await service.listar({
      ...filtro,
      entorno: 'staging',
      pruebas: 'si',
      estado: 'todos',
    });
    expect(mock).toHaveBeenCalledTimes(2);
    const llamadas = mock.mock.calls as unknown as [URL, RequestInit][];
    expect(llamadas[1][0].searchParams.get('query')).toBe('');
  });
});
