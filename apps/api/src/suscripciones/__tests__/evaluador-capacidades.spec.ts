import {
  CATALOGO_PLANES,
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
} from '../../plataforma/planes/catalogo-planes';
import {
  CAPACIDADES_COMPATIBLES_V1,
  contratoCompatible,
  contratoPropuesto,
  decisionCapacidad,
} from '../evaluador-capacidades';
import { resolverAccesoEmpresa } from '../acceso-empresa';
import { funcionIncluidaEnPlan } from '../capacidades-plan';
const operativo = resolverAccesoEmpresa(true, null);

describe('Contrato común de capacidades', () => {
  it('mantiene explícita la lista de compatibilidad y deniega claves desconocidas', () => {
    expect([...CAPACIDADES_COMPATIBLES_V1].sort()).toEqual(
      CATALOGO_PLANES.filter((c) => c.clave !== 'nesting_irregular').map((c) => c.clave).sort(),
    );
    const actual = contratoCompatible(null);
    actual.funciones.funcion_futura = true;
    expect(
      decisionCapacidad(actual, 'funcion_futura', operativo).puedeOperar,
    ).toBe(false);
    expect(decisionCapacidad(actual, 'toString', operativo).puedeOperar).toBe(
      false,
    );
  });
  it.each([
    null,
    { featuresJson: {} },
    { featuresJson: { todo: true } },
    {
      featuresJson: { centroCopiado: true, impresionDirecta: true, afip: true },
    },
  ])('preserva derechos previos y el opt-in de impresión: %j', (plan) => {
    const actual = contratoCompatible(plan);
    for (const [nuevo, anterior] of [
      ['centro_copiado', 'centroCopiado'],
      ['impresion_directa', 'impresionDirecta'],
      ['fiscal_argentina', 'afip'],
      ['whatsapp_web', 'whatsapp'],
    ] as const)
      expect(actual.funciones[nuevo]).toBe(
        funcionIncluidaEnPlan(anterior, plan),
      );
    expect(actual.funciones.reservas).toBe(true);
  });
  it('las tres propuestas mantienen sus cupos independientes de las funciones', () => {
    expect(
      PROPUESTA_PLANES.map(
        (p) =>
          contratoPropuesto(p.contenido, VERSION_CATALOGO_PLANES).limites
            .usuariosMax,
      ),
    ).toEqual([3, 20, 40]);
    const esencial = contratoPropuesto(
      PROPUESTA_PLANES[0].contenido,
      VERSION_CATALOGO_PLANES,
    );
    expect(esencial.funciones).toMatchObject({
      cotizacion: true,
      ordenes: true,
      centro_copiado: true,
      reservas: false,
      prevision_materiales: false,
      impresion_directa: false,
    });
    expect(esencial.limites.almacenamiento.modo).toBe('pendiente');
    expect(
      contratoCompatible({ featuresJson: { todo: true, usuariosMax: 3 } })
        .limites.usuariosMax,
    ).toBeNull();
  });
  it('rechaza propuestas incoherentes y versiones distintas', () => {
    const invalido = structuredClone(PROPUESTA_PLANES[1].contenido);
    invalido.funciones.centro_copiado = false;
    expect(() =>
      contratoPropuesto(invalido, VERSION_CATALOGO_PLANES),
    ).toThrow();
    expect(() => contratoPropuesto(PROPUESTA_PLANES[0].contenido, 999)).toThrow(
      'versión',
    );
  });
  it('un plan incluido no levanta bloqueos ni restricciones de suscripción', () => {
    const contrato = contratoPropuesto(
      PROPUESTA_PLANES[2].contenido,
      VERSION_CATALOGO_PLANES,
    );
    for (const acceso of [
      resolverAccesoEmpresa(false, null),
      resolverAccesoEmpresa(true, { estado: 'baja' }),
    ])
      expect(decisionCapacidad(contrato, 'ordenes', acceso)).toMatchObject({
        incluida: true,
        puedeOperar: false,
      });
  });
});
