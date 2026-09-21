import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { CapacidadGuard } from '../capacidad.guard';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { contratoPropuesto } from '../evaluador-capacidades';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { FidelizacionController } from '../../fidelizacion/fidelizacion.controller';
import { FidelizacionService } from '../../fidelizacion/fidelizacion.service';
import { CuponesService } from '../../cupones/cupones.service';
import { PlanificacionEntregasService } from '../../planificacion-entregas/planificacion.service';
import { EtaService } from '../../eta/eta.service';
import { PermisosGuard } from '../../auth/permisos.guard';
import { CapacidadesController } from '../capacidades.controller';
import type { CurrentAuth } from '../../auth/auth.types';

const auth = { tenantId: 'empresa-a', userId: 'usuario-a' } as CurrentAuth;
function contrato(indice = 0) {
  const capacidades = new CapacidadesEmpresaService({} as never);
  jest.spyOn(capacidades, 'actual').mockResolvedValue({
    empresa: { id: auth.tenantId, nombre: 'Prueba' },
    acceso: resolverAccesoEmpresa(true, null),
    contrato: contratoPropuesto(
      PROPUESTA_PLANES[indice].contenido,
      VERSION_CATALOGO_PLANES,
    ),
    almacenamientoAjustadoBytes: null,
  });
  return capacidades;
}

describe('Capacidades: HTTP, servicios y tareas automáticas', () => {
  const contexto = (sesion?: CurrentAuth) =>
    ({
      getClass: () => FidelizacionController,
      getHandler: () => function ruta() {},
      switchToHttp: () => ({
        getRequest: () => ({
          auth: sesion,
          body: { funciones: { fidelizacion: true } },
        }),
      }),
    }) as ExecutionContext;

  it('todos los miembros pueden consultar capacidades; incluir un módulo no concede permisos personales', async () => {
    const permisos = new PermisosGuard(new Reflector());
    const ctx = contexto({ ...auth, permisos: new Set() });
    const consulta = {
      ...ctx,
      getClass: () => CapacidadesController,
      // Referencia a la ruta para consultar sus metadatos, sin invocarla.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      getHandler: () => CapacidadesController.prototype.actuales,
    } as ExecutionContext;
    expect(permisos.canActivate(consulta)).toBe(true);
    await expect(
      new CapacidadGuard(new Reflector(), contrato(1)).canActivate(ctx),
    ).resolves.toBe(true);
    expect(() => permisos.canActivate(ctx)).toThrow('No tenés permisos');
  });

  it('exige una sesión de empresa y usa el contrato del servidor', async () => {
    const capacidades = contrato();
    const guard = new CapacidadGuard(new Reflector(), capacidades);
    await expect(guard.canActivate(contexto())).rejects.toMatchObject({
      status: 401,
    });
    await expect(guard.canActivate(contexto(auth))).rejects.toMatchObject({
      status: 403,
    });
    expect(jest.spyOn(capacidades, 'actual')).toHaveBeenCalledWith(
      auth.tenantId,
      undefined,
    );
  });

  it('permite leer una función incluida aun cuando la cuenta esté en sólo lectura', async () => {
    const capacidades = contrato(1);
    const actual = await capacidades.actual(auth.tenantId);
    jest.spyOn(capacidades, 'actual').mockResolvedValue({
      ...actual,
      acceso: resolverAccesoEmpresa(true, { estado: 'vencida' } as never),
    });
    expect((await capacidades.actual(auth.tenantId)).acceso.modo).not.toBe(
      'operativo',
    );
    await expect(
      new CapacidadGuard(new Reflector(), capacidades).canActivate(
        contexto(auth),
      ),
    ).resolves.toBe(true);
    await expect(
      capacidades.exigir(auth.tenantId, 'fidelizacion'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza cupones, canjes y planificación antes de consultar o escribir sus datos', async () => {
    const capacidades = contrato();
    const cupones = new CuponesService({} as never, capacidades);
    const puntos = new FidelizacionService({} as never, capacidades);
    const planificacion = new PlanificacionEntregasService(
      {} as never,
      {} as never,
      undefined,
      capacidades,
    );
    await expect(cupones.validar(auth, {} as never)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      puntos.simular(auth.tenantId, 'cliente', 100, 200, 1),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      planificacion.solicitar(auth, 'item', {} as never),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      planificacion.calcular(auth.tenantId, 'revision', jest.fn()),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('el scheduler no calcula fechas ni asigna personal si se excluye del plan', async () => {
    const eta = new EtaService({} as never, {} as never, contrato());
    await eta.sincronizarAsignaciones(auth.tenantId);
    await eta.capturarEmision(auth, 'orden');
    await eta.capturarCierre(auth.tenantId, 'orden');
    await eta.snapshotDiario(auth.tenantId);
    await expect(eta.contextoSimulacion(auth.tenantId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it.each(['entregada', 'cancelada'])(
    'conserva la ganancia histórica y sólo la revierte si se cancela: %s',
    async (estado) => {
      const ganancia = {
        id: 'ganancia',
        cuentaId: 'cuenta',
        clienteId: 'cliente',
        deltaPuntos: 10,
        reversiones: [],
        montoEquivalente: 10,
        montoBaseSnapshot: 100,
        puntosBaseSnapshot: 100,
      };
      const tx = {
        ordenTrabajo: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'orden',
            clienteId: 'cliente',
            estado,
            total: 100,
            fechaEmision: new Date(),
            fidelizacionCanjePuntos: 0,
            fidelizacionPuntosEstimados: 10,
          }),
        },
        cobroOrden: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { monto: 100 } }),
        },
        fidelizacionMovimiento: {
          findFirst: jest.fn().mockResolvedValue(ganancia),
          create: jest.fn(),
        },
        fidelizacionCuenta: { update: jest.fn() },
      };
      await new FidelizacionService({} as never, contrato()).reconciliarOrden(
        tx as never,
        auth.tenantId,
        'orden',
      );
      if (estado === 'cancelada')
        expect(tx.fidelizacionMovimiento.create.mock.calls).toMatchObject([
          [{ data: { tipo: 'REVERSO_GANANCIA', deltaPuntos: -10 } }],
        ]);
      else expect(tx.fidelizacionMovimiento.create).not.toHaveBeenCalled();
    },
  );
});
