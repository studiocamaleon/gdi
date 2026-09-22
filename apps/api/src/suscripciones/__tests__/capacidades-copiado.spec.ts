import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { contratoCompatible } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { CentroCopiadoService } from '../../centro-copiado/centro-copiado.service';
import { CentroCopiadoCadService } from '../../centro-copiado/centro-copiado-cad.service';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { DocumentosOrdenService } from '../../impresion/documentos-orden.service';
import { ImpresionDirectaGuard } from '../../impresion/impresion-directa.guard';
import { ImpresionController } from '../../impresion/impresion.controller';
import type { CurrentAuth } from '../../auth/auth.types';
import { capacidadesJobCopiado } from '../capacidades-copiado';

const auth = { tenantId: 'empresa', userId: 'usuario' } as CurrentAuth;
function capacidades(funciones: Record<string, boolean>) {
  const service = new CapacidadesEmpresaService({} as never);
  const contrato = contratoCompatible({
    featuresJson: { todo: true, impresionDirecta: true },
  });
  Object.assign(contrato.funciones, funciones);
  jest.spyOn(service, 'actual').mockResolvedValue({
    empresa: { id: auth.tenantId, nombre: 'Prueba' },
    contrato,
    acceso: resolverAccesoEmpresa(true, null),
    almacenamientoAjustadoBytes: null,
  });
  return service;
}
function contexto(metodo: keyof ImpresionController): ExecutionContext {
  return {
    getClass: () => ImpresionController,
    getHandler: () => ImpresionController.prototype[metodo],
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
}

describe('Copiado por capacidad: las cargas se validan completas antes de operar', () => {
  it.each([
    'cotizar',
    'construirItems',
    'agregarAOrden',
    'guardarTomo',
  ] as const)(
    '%s rechaza CAD en un lote mixto antes del motor, cambio monetario o idempotencia',
    async (metodo) => {
      const conTipoCambio = jest.fn();
      const ejecutar = jest.fn();
      const service = new CentroCopiadoService(
        {} as never,
        { usaTipoCambio: true, conTipoCambio } as never,
        undefined,
        { ejecutar } as never,
        undefined,
        capacidades({ cotizacion_cad: false }),
      );
      await expect(
        service[metodo](auth.tenantId, {
          documentos: [{ id: 'hoja' }, { id: 'plano', modo: 'CAD' }],
          idempotencyKey: 'reintento',
        } as never),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'cotizacion_cad' },
      });
      expect(conTipoCambio).not.toHaveBeenCalled();
      expect(ejecutar).not.toHaveBeenCalled();
    },
  );

  it.each([
    { documentos: [{ terminaciones: ['Anillado'] }] },
    {
      documentos: [{ grupoId: 't' }],
      grupos: [{ id: 't', juegos: 1, terminaciones: [] }],
    },
    { documentos: [], grupos: [{ id: 't', juegos: 1 }] },
  ])(
    'rechaza terminaciones/tomos, incluso agrupaciones sin anillo: %j',
    async (dto) => {
      const service = new CentroCopiadoService(
        {} as never,
        {} as never,
        undefined,
        undefined,
        undefined,
        capacidades({ terminaciones_copiado: false }),
      );
      await expect(
        service.construirItems(auth.tenantId, dto as never),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'terminaciones_copiado' },
      });
    },
  );

  it('no alcanza con habilitar CAD si no está incluida su base Documentos', async () => {
    const service = new CentroCopiadoCadService(
      {} as never,
      {} as never,
      {} as never,
      capacidades({ centro_copiado: false }),
    );
    await expect(service.opciones(auth.tenantId)).rejects.toMatchObject({
      status: 403,
      response: { capacidad: 'centro_copiado' },
    });
  });

  it.each(['cotizar', 'cotizarYGuardar'] as const)(
    '%s general no permite guardar o recotizar metadatos CAD excluidos',
    async (metodo) => {
      const con = capacidades({ cotizacion_cad: false });
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
      await expect(
        motor[metodo]({
          tenantId: auth.tenantId,
          jobContext: { _centroCopiado: { modo: 'CAD' } },
        } as never),
      ).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'cotizacion_cad' },
      });
    },
  );

  it('el producto reservado exige Copiado aunque se quite toda la metadata', async () => {
    const prisma = {
      producto: {
        findFirst: jest.fn().mockResolvedValue({
          codigo: 'SYS-IMPRESION-DOC',
          rutasAlternativas: [],
        }),
      },
    };
    const motor = new MotorUniversalService(
      prisma as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      capacidades({ centro_copiado: false }),
    );
    await expect(
      motor.cotizar({
        tenantId: auth.tenantId,
        productoId: 'plantilla',
        jobContext: { cantidad: 1 },
      } as never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('interpreta metadatos históricos sin exigir terminaciones por un tipo de anillo sin uso', () => {
    expect(
      capacidadesJobCopiado({
        _centroCopiado: { esTomo: true, terminaciones: [] },
      }),
    ).toContain('terminaciones_copiado');
    expect(
      capacidadesJobCopiado({ _centroCopiado: { terminacion: 'Anillado' } }),
    ).toContain('terminaciones_copiado');
    expect(
      capacidadesJobCopiado({
        _centroCopiado: { terminacion: 'Ninguna', tipoAnillo: 'WIRE_O' },
      }),
    ).toEqual(['centro_copiado']);
    expect(capacidadesJobCopiado({ cantidad: 50 })).toEqual([]);
  });
});

describe('Impresión conectada y asistente de documentos', () => {
  it.each([
    'solicitar',
    'liberar',
    'liberarLote',
    'vistaDocumentos',
    'prepararDocumento',
    'cola',
  ] as const)(
    '%s exige colas aunque la empresa tenga conexión a impresoras',
    async (metodo) => {
      const guard = new ImpresionDirectaGuard(
        capacidades({ colas_impresion: false }),
        new Reflector(),
      );
      await expect(guard.canActivate(contexto(metodo))).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'colas_impresion' },
      });
    },
  );
  it('las etiquetas directas y configurar impresoras funcionan sin contratar colas', async () => {
    const guard = new ImpresionDirectaGuard(
      capacidades({ colas_impresion: false, centro_copiado: false }),
      new Reflector(),
    );
    for (const metodo of [
      'preparar',
      'configuracion',
      'configuracionPerfiles',
    ] as const)
      await expect(guard.canActivate(contexto(metodo))).resolves.toBe(true);
  });
  it('retirar conexión no impide descargar etiquetas ni registrar el resultado de un envío existente', async () => {
    const guard = new ImpresionDirectaGuard(
      capacidades({ impresion_directa: false, colas_impresion: false }),
      new Reflector(),
    );
    for (const metodo of [
      'etiqueta',
      'estadoDocumento',
      'confirmarDocumentos',
    ] as const)
      await expect(guard.canActivate(contexto(metodo))).resolves.toBe(true);
    await expect(
      guard.canActivate(contexto('prepararDocumento')),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('el servicio también impide firmar o reservar nuevos documentos sin colas', async () => {
    const firmarDocumento = jest.fn();
    const service = new DocumentosOrdenService(
      {} as never,
      {} as never,
      { firmarDocumento } as never,
      {} as never,
      capacidades({ colas_impresion: false }),
    );
    await expect(
      service.preparar(auth, 'ot', 'item', 'intento', 'Ricoh', 'localhost'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.solicitar(auth, 'ot')).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.liberarLote(auth, [], 'perfil', 'revision'),
    ).rejects.toMatchObject({ status: 403 });
    expect(firmarDocumento).not.toHaveBeenCalled();
  });
});
