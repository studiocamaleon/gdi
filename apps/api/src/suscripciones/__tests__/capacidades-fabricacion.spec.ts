import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoCompatible } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { capacidadesJobGeometria } from '../capacidades-geometria';
import { CapacidadGuard } from '../capacidad.guard';
import { MotorUniversalController } from '../../motor-universal/motor.controller';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { GeometriasProductoController } from '../../productos-servicios/geometrias/geometrias-producto.controller';
import { ExportarFabricacionController } from '../../productos-servicios/geometrias/exportar-fabricacion.controller';
import { ProductosService } from '../../productos-servicios/productos.service';
import {
  GeometriaJobsService,
  idTrabajo,
} from '../../workers/geometria/geometria-jobs.service';
import { AnalisisVectorialAsyncService } from '../../motor-universal/geometria-vectorial/analisis-vectorial-async.service';
import { CotizacionJobsService } from '../../workers/cotizacion/cotizacion-jobs.service';
import { PreparacionesNestingService } from '../../workers/cotizacion/preparaciones-nesting.service';
import { GeometriaWorker } from '../../workers/geometria/geometria.worker';
import { CotizacionWorker } from '../../workers/cotizacion/cotizacion.worker';
import { PreparacionesRecorridoService } from '../../recorridos-vectoriales/preparaciones-recorrido.service';
import { AuthGuard } from '../../auth/auth.guard';
import { CredencialesMcpService } from '../../mcp/credenciales-mcp.service';
import type { CurrentAuth } from '../../auth/auth.types';

const auth = {
  tenantId: 'empresa',
  userId: 'usuario',
  membershipId: 'miembro',
} as CurrentAuth;
function capacidades(funciones: Record<string, boolean>) {
  const service = new CapacidadesEmpresaService({} as never);
  const contrato = contratoCompatible({ featuresJson: { todo: true } });
  Object.assign(contrato.funciones, funciones);
  jest.spyOn(service, 'actual').mockResolvedValue({
    empresa: { id: auth.tenantId, nombre: 'Prueba' },
    contrato,
    acceso: resolverAccesoEmpresa(true, null),
    almacenamientoAjustadoBytes: null,
  });
  return service;
}

describe('Geometría y fabricación: capacidad resuelta antes de ejecutar', () => {
  it.each(['inspeccionar', 'guardar', 'guardarLote'] as const)(
    '%s rechaza antes de leer archivos o generar geometría',
    async (metodo) => {
      const leer = jest.fn();
      const c = new GeometriasProductoController(
        {} as never,
        { leer } as never,
        capacidades({ geometrias: false }),
      );
      await expect(
        c[metodo](auth, 'producto', { archivoId: 'archivo' } as never),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'geometrias' },
      });
      expect(leer).not.toHaveBeenCalled();
    },
  );

  it.each(['capas', 'exportar'] as const)(
    '%s de fabricación no accede al almacenamiento sin capacidad',
    async (metodo) => {
      const leer = jest.fn();
      const c = new ExportarFabricacionController(
        {} as never,
        { leer } as never,
        capacidades({ exportacion_fabricacion: false }),
      );
      await expect(c[metodo](auth, {} as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(leer).not.toHaveBeenCalled();
    },
  );

  it.each([
    'normalizarFuente',
    'medirSvg',
    'prepararSvg',
    'analizarSvg',
    'analizarSvgAsincrono',
  ] as const)(
    'protege la ruta HTTP %s, incluso con funciones falsificadas en el body',
    async (metodo) => {
      const ctx = {
        getClass: () => MotorUniversalController,
        getHandler: () => MotorUniversalController.prototype[metodo],
        switchToHttp: () => ({
          getRequest: () => ({
            auth,
            body: { funciones: { analisis_vectorial: true } },
          }),
        }),
      } as unknown as ExecutionContext;
      await expect(
        new CapacidadGuard(
          new Reflector(),
          capacidades({ analisis_vectorial: false }),
        ).canActivate(ctx),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('la API general del catálogo tampoco permite configurar geometrías por fuera del editor', async () => {
    const dto = {
      atributosComercialesJson: {
        geometriasComerciales: {
          version: 1,
          modo: 'VECTORIAL',
          fuentes: [{ id: 'diseno', nombre: 'Diseño', requerida: true }],
        },
      },
    };
    const db = {
      producto: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'producto', atributosComercialesJson: {} }),
      },
    };
    const s = new ProductosService(
      db as never,
      capacidades({ geometrias: false }),
    );
    await expect(
      s.crearProducto(auth.tenantId, dto as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      s.actualizarProducto(auth.tenantId, 'producto', dto),
    ).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    'disenoVectorialFuente',
    'disenosVectoriales',
    'coleccionesVectoriales',
    'disenoVectorialCacheKey',
    'geometriaVectorial',
    'geometriasVectoriales',
  ])(
    'exige capacidad para una fuente %s, incluso si ya tiene cache',
    async (clave) => {
      const jobContext = { [clave]: { guardada: true } };
      expect(capacidadesJobGeometria(jobContext)).toEqual([
        'analisis_vectorial',
        'aprovechamiento_cotizacion',
        'nesting_irregular',
      ]);
      const con = capacidades({ aprovechamiento_cotizacion: false });
      const motor = new MotorUniversalService(
        {} as never,
        {} as never,
        {} as never,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        con,
      );
      for (const metodo of ['cotizar', 'cotizarYGuardar'] as const) {
        await expect(
          motor[metodo]({ tenantId: auth.tenantId, jobContext } as never),
        ).rejects.toMatchObject({ status: 403 });
      }
      const jobs = new CotizacionJobsService(con);
      await expect(
        jobs.crear({
          cotizacion: { tenantId: auth.tenantId, jobContext } as never,
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it.each([
    {
      componentesOverrides: {
        frente: { geometriasVectoriales: { frente: { svg: '<svg/>' } } },
      },
    },
    {
      ocurrencias: [
        { jobContext: { disenoVectorialFuente: { svg: '<svg/>' } } },
      ],
    },
    {
      componentes: {
        frente: {
          pieza: {
            tipo: 'REFERENCIA_GEOMETRIA',
            procedencia: { geometriaId: 'guardada' },
          },
        },
      },
    },
  ])(
    'no permite introducir fuentes mediante overrides anidados: %j',
    async (jobContext) => {
      expect(capacidadesJobGeometria(jobContext)).toEqual([
        'analisis_vectorial',
        'aprovechamiento_cotizacion',
        'nesting_irregular',
      ]);
      await expect(
        new CotizacionJobsService(
          capacidades({ analisis_vectorial: false }),
        ).crear({
          cotizacion: { tenantId: auth.tenantId, jobContext } as never,
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('las cantidades, medidas, placas y fuentes vacías no activan herramientas vectoriales', () => {
    expect(
      capacidadesJobGeometria({
        cantidad: 100,
        ancho: 50,
        alto: 20,
        placas: 2,
        metrosCorte: 4,
        disenosVectoriales: {},
        coleccionesVectoriales: [],
        disenoVectorialFuente: null,
      }),
    ).toEqual([]);
  });

  it('no encola ni devuelve caché de un análisis nuevo sin capacidad', async () => {
    const con = capacidades({ analisis_vectorial: false });
    const service = new GeometriaJobsService({} as never, {} as never, con);
    await expect(
      service.crear({ tenantId: auth.tenantId, dto: {} as never }),
    ).rejects.toMatchObject({ status: 403 });
    const asyncService = new AnalisisVectorialAsyncService(
      {} as never,
      {} as never,
      con,
    );
    await expect(
      asyncService.iniciar({ tenantId: auth.tenantId, dto: {} as never }),
    ).rejects.toMatchObject({ status: 403 });
    const preparaciones = new PreparacionesNestingService(
      {} as never,
      {} as never,
      con,
    );
    await expect(
      preparaciones.preparar(auth.tenantId, 'producto', {} as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      new CotizacionJobsService(con).crear({
        cotizacion: { tenantId: auth.tenantId, jobContext: {} } as never,
        preparacionNestingId: 'preparacion',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('no confunde una tarea avanzada con el cálculo interno al deduplicar', () => {
    const data = { tenantId: auth.tenantId, piezas: [], placa: {} };
    expect(idTrabajo(auth.tenantId, 'misma-solicitud', data as never)).not.toBe(
      idTrabajo(auth.tenantId, 'misma-solicitud', {
        ...data,
        calculoCotizacion: true,
      } as never),
    );
  });

  it('el worker rechaza un análisis si se retira la capacidad mientras espera, pero admite el cálculo interno', async () => {
    const adquirir = jest.fn().mockResolvedValue(null);
    const cancelar = jest.fn().mockResolvedValue(undefined);
    const resolver = jest.fn();
    const con = capacidades({ analisis_vectorial: false });
    const worker = new GeometriaWorker(
      { resolver } as never,
      { leerCancelacion: jest.fn().mockResolvedValue(false) } as never,
      { adquirir } as never,
      { cancelar } as never,
      con,
    );
    const ejecutar = (data: unknown) =>
      (
        worker as unknown as {
          procesarOpenNest(job: unknown): Promise<unknown>;
        }
      ).procesarOpenNest({ id: 'trabajo', data });
    await expect(ejecutar({ tenantId: auth.tenantId })).rejects.toMatchObject({
      status: 403,
    });
    expect(adquirir).not.toHaveBeenCalled();
    expect(cancelar).toHaveBeenCalledWith('trabajo');
    expect(resolver).not.toHaveBeenCalled();
    await expect(
      ejecutar({ tenantId: auth.tenantId, calculoCotizacion: true }),
    ).rejects.toThrow('token para reprogramarse');
    expect(adquirir).toHaveBeenCalledTimes(1);
  });

  it('una preparación en espera queda fallida y libera el turno si cambia el plan', async () => {
    const liberar = jest.fn().mockResolvedValue(undefined);
    const actualizar = jest.fn().mockResolvedValue(undefined);
    const cotizar = jest.fn();
    const worker = new CotizacionWorker(
      { cotizar } as never,
      {
        adquirir: jest.fn().mockResolvedValue({ duracionMs: 60000 }),
        liberar,
      } as never,
      capacidades({ aprovechamiento_cotizacion: false }),
      { actualizar } as never,
    );
    await expect(
      (
        worker as unknown as { procesar(job: unknown): Promise<unknown> }
      ).procesar({
        id: 'trabajo',
        data: {
          input: { tenantId: auth.tenantId },
          preparacionNestingId: 'preparacion',
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(cotizar).not.toHaveBeenCalled();
    expect(actualizar).toHaveBeenCalledWith(
      auth.tenantId,
      'preparacion',
      'trabajo',
      'FALLIDO',
      expect.any(String),
      expect.any(Number),
    );
    expect(liberar).toHaveBeenCalledTimes(1);
  });

  it('conserva la consulta y descarga histórica; rechaza regenerar y crear plantillas', async () => {
    const revision = {
      id: 'rev',
      placaIndice: 0,
      estado: 'APROBADA',
      nombreArchivo: 'placa.svg',
      tap: 'TAP guardado',
      linkedSvg: '<svg/>',
      routeJson: {},
      reportJson: {},
      metricsJson: {},
      machineProfileJson: {},
    };
    const findMany = jest.fn().mockResolvedValue([revision]);
    const findFirst = jest.fn().mockResolvedValue(revision);
    const generar = jest.fn();
    const s = new PreparacionesRecorridoService(
      {
        ordenTrabajoItem: {
          findFirst: jest.fn().mockResolvedValue({ id: 'item' }),
        },
        recorridoVectorialRevision: { findMany, findFirst },
      } as never,
      { generar } as never,
      capacidades({ recorridos_fabricacion: false }),
    );
    await expect(s.asegurarParaItem(auth, 'item')).resolves.toEqual([
      expect.objectContaining({ id: 'rev' }),
    ]);
    const [consulta] = findMany.mock.calls[0] as unknown[];
    expect(consulta).toMatchObject({
      where: { tenantId: auth.tenantId, ordenTrabajoItemId: 'item' },
    });
    await expect(s.descargar(auth, 'rev', 'tap')).resolves.toMatchObject({
      bytes: Buffer.from('TAP guardado'),
    });
    await expect(s.asegurarParaItem(auth, 'item', true)).rejects.toMatchObject({
      status: 403,
    });
    await expect(s.plantillaInstalacion(auth, 'item')).rejects.toMatchObject({
      status: 403,
    });
    expect(generar).not.toHaveBeenCalled();
  });
});

describe('MCP: plan vigente también en credenciales cacheadas', () => {
  const credencial = {
    id: 'credencial',
    tenantId: auth.tenantId,
    membershipId: auth.membershipId,
    nombre: 'Prueba',
    scopes: ['comercial.ver', 'finanzas.ver_margenes'],
    ultimoUsoEl: new Date(),
    membership: {
      activa: true,
      tenantId: auth.tenantId,
      userId: auth.userId,
      rol: 'administrador',
      ipsPermitidas: [],
      rolDelTenant: { permisos: ['comercial.ver', 'finanzas.ver_margenes'] },
      user: { activo: true, email: 'test@example.invalid' },
      tenant: { activo: true },
    },
  };
  it.each([false, true])(
    'corta una credencial válida con cache=%s cuando se excluye MCP',
    async (cacheada) => {
      const request = {
        headers: {
          authorization: 'Bearer grafo_mcp_solo_fixture_sin_valor_real',
        },
        auth: undefined,
      };
      const cache = {
        get: jest
          .fn()
          .mockReturnValue(
            cacheada
              ? { ...auth, mcp: { credencialId: 'credencial' } }
              : undefined,
          ),
        set: jest.fn(),
      };
      const guard = new AuthGuard(
        new Reflector(),
        {} as never,
        {
          credencialMcp: {
            findUnique: jest.fn().mockResolvedValue(credencial),
          },
        } as never,
        cache as never,
        capacidades({ mcp: false }),
      );
      const ctx = {
        getClass: () => class TenantController {},
        getHandler: () => function ruta() {},
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'mcp' },
      });
      expect(request.auth).toBeUndefined();
      expect(cache.set).not.toHaveBeenCalled();
    },
  );

  it('habilitar MCP mantiene el filtro de permisos personales y no concede márgenes', async () => {
    const request: { headers: { authorization: string }; auth?: CurrentAuth } =
      {
        headers: {
          authorization: 'Bearer grafo_mcp_solo_fixture_sin_valor_real',
        },
      };
    const guard = new AuthGuard(
      new Reflector(),
      {} as never,
      {
        credencialMcp: { findUnique: jest.fn().mockResolvedValue(credencial) },
      } as never,
      { get: jest.fn(), set: jest.fn() } as never,
      capacidades({ mcp: true }),
    );
    const ctx = {
      getClass: () => class TenantController {},
      getHandler: () => function ruta() {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.auth?.permisos?.has('comercial.ver')).toBe(true);
    expect(request.auth?.permisos?.has('finanzas.ver_margenes')).toBe(false);
  });

  it('sin MCP una persona puede listar y revocar sus credenciales anteriores, pero no crear nuevas', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockResolvedValue({});
    const invalidate = jest.fn();
    const db = {
      credencialMcp: {
        findMany,
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'credencial', tokenHash: 'hash-fixture' }),
        update,
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      eventoAcceso: { create: jest.fn().mockResolvedValue({}) },
    };
    const s = new CredencialesMcpService(
      db as never,
      { invalidate } as never,
      capacidades({ mcp: false }),
    );
    await expect(s.listar(auth)).resolves.toEqual([]);
    await expect(s.revocar(auth, 'credencial')).resolves.toEqual({ ok: true });
    expect(invalidate).toHaveBeenCalledWith('mcp:hash-fixture');
    await expect(s.crear(auth, { nombre: 'Nueva' })).rejects.toMatchObject({
      status: 403,
    });
  });
});
