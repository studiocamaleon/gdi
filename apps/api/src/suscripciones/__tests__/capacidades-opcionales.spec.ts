import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { CapacidadGuard } from '../capacidad.guard';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { contratoPropuesto } from '../evaluador-capacidades';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { ComprasController } from '../../compras/compras.controller';
import { ComprasService } from '../../compras/compras.service';
import { ProveedoresController } from '../../proveedores/proveedores.controller';
import { AdministracionController } from '../../administracion/administracion.controller';
import { TesoreriaService } from '../../administracion/tesoreria.service';
import { EgresosController } from '../../egresos/egresos.controller';
import { EgresosService } from '../../egresos/egresos.service';
import { RecurrentesService } from '../../egresos/recurrentes.service';
import { GastosFijosController } from '../../gastos-fijos/gastos-fijos.controller';
import { ReportesController } from '../../reportes/reportes.controller';
import { PreciosEspecialesClientesController } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.controller';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { NotificacionesService } from '../../integraciones/notificaciones/notificaciones.service';
import { NotificacionesController } from '../../integraciones/notificaciones/notificaciones.controller';
import { DespachoService } from '../../integraciones/notificaciones/despacho.service';
import { AutomaticosWebService } from '../../integraciones/whatsapp-web/automaticos.service';
import { AutomaticosWebController } from '../../integraciones/whatsapp-web/automaticos.controller';
import { IntegracionesService } from '../../integraciones/integraciones.service';
import { runWithTenant } from '../../common/tenant-context';

const auth = {
  tenantId: 'empresa-prueba',
  userId: 'usuario-prueba',
} as CurrentAuth;
function plan(
  indice = 0,
  funciones: Record<string, boolean> = {},
  operativo = true,
) {
  const capacidades = new CapacidadesEmpresaService({} as never);
  const contrato = contratoPropuesto(
    PROPUESTA_PLANES[indice].contenido,
    VERSION_CATALOGO_PLANES,
  );
  Object.assign(contrato.funciones, funciones);
  jest.spyOn(capacidades, 'actual').mockResolvedValue({
    empresa: { id: auth.tenantId, nombre: 'Prueba' },
    acceso: resolverAccesoEmpresa(operativo, null),
    contrato,
    almacenamientoAjustadoBytes: null,
  });
  return capacidades;
}
function contexto(
  controller: { prototype: object },
  metodo: string,
): ExecutionContext {
  const handler = (controller.prototype as Record<string, unknown>)[metodo];
  if (!handler) throw new Error(`Ruta inexistente: ${metodo}`);
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ auth, body: { funciones: { compras: true } } }),
    }),
  } as ExecutionContext;
}

describe('Funciones opcionales: accesos, fallback y tareas automáticas', () => {
  it.each([
    [ComprasController, 'crear'],
    [ComprasController, 'recibir'],
    [AdministracionController, 'resumenTesoreria'],
    [EgresosController, 'crear'],
    [EgresosController, 'listarRecurrentes'],
    [ReportesController, 'finanzas'],
    [ReportesController, 'producto'],
    [ReportesController, 'equipo'],
    [PreciosEspecialesClientesController, 'crear'],
    [NotificacionesController, 'estado'],
    [AutomaticosWebController, 'iniciar'],
  ] as const)(
    'Esencial impide %p.%s aunque el cliente declare la función',
    async (controller, metodo) => {
      await expect(
        new CapacidadGuard(new Reflector(), plan()).canActivate(
          contexto(controller, metodo),
        ),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('proveedores y gastos fijos respetan su exclusión en un plan a medida', async () => {
    const guard = new CapacidadGuard(
      new Reflector(),
      plan(0, { proveedores: false, gastos_fijos: false }),
    );
    await expect(
      guard.canActivate(contexto(ProveedoresController, 'findAll')),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      guard.canActivate(contexto(GastosFijosController, 'listar')),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      guard.canActivate(contexto(ProveedoresController, 'opciones')),
    ).resolves.toBe(true);
  });

  it('conserva cuentas de cobro, proveedores de referencia y reportes básicos', async () => {
    const guard = new CapacidadGuard(new Reflector(), plan());
    for (const [controller, metodo] of [
      [AdministracionController, 'listarCuentas'],
      [AdministracionController, 'crearCuenta'],
      [ProveedoresController, 'opciones'],
      [ReportesController, 'resumen'],
      [ReportesController, 'comercial'],
    ] as const)
      await expect(
        guard.canActivate(contexto(controller, metodo)),
      ).resolves.toBe(true);
  });

  it('recepciones requiere también compras; el método no reemplaza el requisito de clase', async () => {
    const ctx = contexto(ComprasController, 'recibir');
    for (const funciones of [
      { compras: false, recepciones: true },
      { compras: true, recepciones: false },
    ]) {
      await expect(
        new CapacidadGuard(new Reflector(), plan(1, funciones)).canActivate(
          ctx,
        ),
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(
      new CapacidadGuard(new Reflector(), plan(1)).canActivate(ctx),
    ).resolves.toBe(true);
  });

  it('los ajustes compartidos de avisos admiten cualquiera de los canales contratados', async () => {
    await expect(
      new CapacidadGuard(
        new Reflector(),
        plan(0, { whatsapp_web: true }),
      ).canActivate(contexto(NotificacionesController, 'estado')),
    ).resolves.toBe(true);
  });

  it('compras, gastos y tesorería frenan las llamadas internas antes de escribir', async () => {
    const capacidades = plan();
    const compras = new ComprasService(
      {} as never,
      {} as never,
      {} as never,
      capacidades,
    );
    const egresos = new EgresosService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      capacidades,
    );
    const tesoreria = new TesoreriaService(
      {} as never,
      {} as never,
      capacidades,
    );
    for (const operacion of [
      () => compras.crear(auth, {} as never),
      () => compras.recibir(auth, 'compra', {} as never),
      () => egresos.crear(auth, {} as never),
      () => egresos.registrarPago(auth, {} as never),
      () => tesoreria.transferir(auth, {} as never),
      () => tesoreria.depositarValor(auth, 'valor', {} as never),
    ])
      await expect(operacion()).rejects.toMatchObject({ status: 403 });
  });

  it('sin precios negociados devuelve el fallback sin leer ni borrar condiciones guardadas', async () => {
    const especial = {
      id: 'precio',
      configJson: { metodoCalculo: 'por_margen' },
    };
    const findFirst = jest.fn().mockResolvedValue(especial);
    const db = { productoPrecioEspecialClienteV2: { findFirst } };
    const excluido = new PreciosEspecialesClientesService(db as never, plan());
    await expect(
      excluido.buscarActivo(auth.tenantId, 'producto', 'cliente'),
    ).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    await expect(
      excluido.crear(auth.tenantId, 'producto', {} as never),
    ).rejects.toMatchObject({ status: 403 });
    const incluido = new PreciosEspecialesClientesService(db as never, plan(1));
    await expect(
      incluido.buscarActivo(auth.tenantId, 'producto', 'cliente'),
    ).resolves.toEqual(especial);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: auth.tenantId,
        productoId: 'producto',
        clienteId: 'cliente',
        activo: true,
      },
    });
  });

  it('el cron no genera gastos sin la función o con la empresa bloqueada', async () => {
    for (const capacidades of [plan(), plan(1, {}, false)]) {
      const recurrentes = new RecurrentesService({} as never, capacidades);
      await expect(recurrentes.generarDeTenant(auth.tenantId)).resolves.toBe(0);
      await expect(recurrentes.generarAhora(auth)).rejects.toMatchObject({
        status: 403,
      });
    }
  });

  it.each(['WATI', 'WHATSAPP_WEB'])(
    'no encola avisos de %s y deja continuar el negocio',
    async (canalOrdenes) => {
      const create = jest.fn();
      const db = {
        configuracionNotificaciones: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ pausado: false, canalOrdenes }),
        },
        notificacionWhatsapp: { create },
      };
      const avisos = new NotificacionesService(
        db as never,
        {} as never,
        plan(),
      );
      await expect(
        runWithTenant(auth.tenantId, () =>
          avisos.encolar({
            evento: 'orden_recibida',
            entidadId: 'ot',
            parametros: [],
          }),
        ),
      ).resolves.toMatchObject({
        encolada: false,
        motivo: expect.stringContaining('plan') as unknown,
      });
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('revalida el plan al despachar y conserva el aviso pendiente sin enviarlo', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = {
      notificacionWhatsapp: {
        updateMany,
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'aviso', tenantId: auth.tenantId }),
      },
    };
    const enviarPlantilla = jest.fn();
    const despacho = new DespachoService(
      db as never,
      {} as never,
      { enviarPlantilla } as never,
      plan(),
    );
    await expect(despacho.despachar('aviso')).resolves.toMatchObject({
      estado: 'pendiente',
      motivo: expect.stringContaining('plan') as unknown,
    });
    expect(enviarPlantilla).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { estado: 'pendiente', reservadaEl: null },
      }),
    );
  });

  it('la extensión no obtiene trabajos ni inicia envíos fuera del plan', async () => {
    const web = new AutomaticosWebService({} as never, plan());
    await expect(web.reservar(auth.tenantId, {} as never)).resolves.toEqual({
      trabajo: null,
    });
    await expect(
      web.iniciar(auth.tenantId, 'aviso', {} as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('ni siquiera la prueba WATI puede enviar con la función excluida', async () => {
    const integraciones = new IntegracionesService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      plan(),
    );
    await expect(
      runWithTenant(auth.tenantId, () =>
        integraciones.probarEnvioWati({} as never),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      runWithTenant(auth.tenantId, () => integraciones.credencialesWati()),
    ).resolves.toBeNull();
  });
});
