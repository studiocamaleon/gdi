import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import { problemasPlan, problemasPublicacionPlan } from '../../plataforma/planes/validacion-planes';
import { contratoPublicado } from '../contrato-suscripcion';
import { contratoPropuesto, decisionCapacidad } from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { CapacidadesEmpresaService } from '../capacidades-empresa.service';
import { GeometriaJobsService } from '../../workers/geometria/geometria-jobs.service';
import { AnalisisVectorialAsyncService } from '../../motor-universal/geometria-vectorial/analisis-vectorial-async.service';
import { GeometriaWorker } from '../../workers/geometria/geometria.worker';
import { runNestingForPaso } from '../../motor-universal/nesting-dispatcher';
import type { JobContext, PasoCargado } from '../../motor-universal/tipos';

const acceso = resolverAccesoEmpresa(true, null);
function capacidadesEsencial() {
  const service = new CapacidadesEmpresaService({} as never);
  jest.spyOn(service, 'actual').mockResolvedValue({
    empresa: { id: 'empresa', nombre: 'Prueba' },
    contrato: contratoPropuesto(
      PROPUESTA_PLANES[0].contenido,
      VERSION_CATALOGO_PLANES,
    ),
    acceso,
    almacenamientoAjustadoBytes: null,
  });
  return service;
}

describe('Nesting rectangular e irregular separados por contrato', () => {
  it.each(PROPUESTA_PLANES)(
    '$codigo conserva rectangular y define irregular explícitamente',
    (plan) => {
      const c = contratoPropuesto(plan.contenido, VERSION_CATALOGO_PLANES);
      expect(
        decisionCapacidad(c, 'aprovechamiento_cotizacion', acceso).puedeOperar,
      ).toBe(true);
      expect(
        decisionCapacidad(c, 'nesting_irregular', acceso).puedeOperar,
      ).toBe(plan.codigo !== 'esencial');
    },
  );

  it('exige la base geométrica al habilitar irregular en el editor', () => {
    const plan = structuredClone(PROPUESTA_PLANES[1].contenido);
    plan.funciones.aprovechamiento_cotizacion = false;
    expect(
      problemasPlan(plan).some((e) => e.includes('Nesting irregular requiere')),
    ).toBe(true);
  });

  it('conserva los contratos v1 y no concede la función ausente en v2', () => {
    const contenido = {
      ...structuredClone(PROPUESTA_PLANES[0].contenido),
      almacenamientoModo: 'limitado',
      almacenamientoGb: 250,
    };
    delete contenido.funciones.nesting_irregular;
    const version = {
      id: 'historico',
      numero: 1,
      catalogoVersion: 1,
      contenido,
    };
    expect(contratoPublicado(version).funciones.nesting_irregular).toBe(true);
    expect(
      contratoPublicado({ ...version, catalogoVersion: 2 }).funciones
        .nesting_irregular,
    ).toBe(false);
    expect(contenido.funciones).not.toHaveProperty('nesting_irregular');
    expect(problemasPublicacionPlan(contenido, 1)).toEqual([]);
    expect(problemasPublicacionPlan(contenido, 2)).toContain('Definí la inclusión de Nesting irregular.');
  });

  it('Esencial rechaza cálculo directo, interno y caché antes de consultar geometría', async () => {
    const capacidades = capacidadesEsencial();
    const jobs = new GeometriaJobsService(
      {} as never,
      {} as never,
      capacidades,
    );
    const asyncService = new AnalisisVectorialAsyncService(
      jobs,
      {} as never,
      capacidades,
    );
    const input = { tenantId: 'empresa', dto: {} as never };
    for (const request of [
      () => jobs.crear(input),
      () => jobs.crearParaCotizacion(input),
      () => asyncService.iniciar(input),
      () => asyncService.resolverParaCotizacion(input),
      () =>
        asyncService.resolverProblemaParaCotizacion({
          tenantId: 'empresa',
          problema: {} as never,
        }),
    ]) {
      await expect(request()).rejects.toMatchObject({
        status: 403,
        response: { capacidad: 'nesting_irregular' },
      });
    }
  });

  it.each([false, true])(
    'el worker revalida también un trabajo interno=%s',
    async (calculoCotizacion) => {
      const adquirir = jest.fn();
      const cancelar = jest.fn();
      const worker = new GeometriaWorker(
        {} as never,
        { leerCancelacion: async () => false } as never,
        { adquirir } as never,
        { cancelar } as never,
        capacidadesEsencial(),
      );
      const ejecutar = worker as unknown as {
        procesarOpenNest(job: unknown): Promise<unknown>;
      };
      await expect(
        ejecutar.procesarOpenNest({
          id: 'nest-prueba',
          data: { tenantId: 'empresa', calculoCotizacion },
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(adquirir).not.toHaveBeenCalled();
      expect(cancelar).toHaveBeenCalledWith('nest-prueba');
    },
  );

  it('el dispatcher conserva medidas rectangulares y exige permiso antes de usar contornos de una receta', async () => {
    const exigir = jest.fn(() =>
      capacidadesEsencial().exigir('empresa', 'nesting_irregular'),
    );
    const paso = {
      familiaCodigo: 'corte_laser',
      paramsPasoJson: { permitirIngresoPorMedidas: true },
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      maquina: {
        parametrosTecnicosJson: { anchoTrabajoMm: 1200, altoTrabajoMm: 900 },
      },
    } as unknown as PasoCargado;
    const material = {
      atributosVarianteJson: { anchoMm: 1200, altoMm: 900 },
      subfamilia: 'SUSTRATO_PLACA',
    };
    const medidas = {
      cantidad: 4,
      modoCotizacionVectorial: 'medidas',
      piezas: [{ cantidad: 4, anchoMm: 200, altoMm: 300 }],
    } as JobContext;
    const result = await runNestingForPaso(paso, medidas, material, {
      exigirNestingIrregular: exigir,
    });
    expect(result?.placements).toHaveLength(4);
    expect(exigir).not.toHaveBeenCalled();
    await expect(
      runNestingForPaso(
        paso,
        {
          ...medidas,
          modoCotizacionVectorial: 'svg',
          geometriaVectorial: { piezas: [{}] },
        } as JobContext,
        material,
        { exigirNestingIrregular: exigir },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
