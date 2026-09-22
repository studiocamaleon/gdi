import {
  diagnosticarCambioPlan,
  type OperacionCambioPlan,
} from '../planes/diagnostico-cambio-plan';
import {
  PROPUESTA_PLANES,
  VERSION_CATALOGO_PLANES,
  type ContenidoPlan,
} from '../planes/catalogo-planes';
import {
  contratoCompatible,
  contratoPropuesto,
} from '../../suscripciones/evaluador-capacidades';
import type { UsoCambioPlan } from '../planes/comparacion-planes';

const actual = contratoCompatible({ featuresJson: { todo: true } });
const plan: ContenidoPlan = {
  ...structuredClone(PROPUESTA_PLANES[0].contenido),
  almacenamientoModo: 'limitado' as const,
  almacenamientoGb: 1,
};
const GB = 1024n ** 3n;
const uso: UsoCambioPlan = {
  usuarios: { activos: 3, invitacionesPendientes: 1, adicionalesVigentes: 0 },
  archivos: {
    guardadosBytes: String(GB),
    reservadosBytes: '1024',
    cargasPendientes: 1,
  },
};
const compras: OperacionCambioPlan[] = [
  {
    codigo: 'compras_abiertas',
    funciones: ['compras', 'recepciones'],
    cantidad: 2,
    titulo: 'Compras abiertas',
    detalle: 'Completar recepciones.',
  },
];
const comparar = (
  p = plan,
  u = uso,
  ajuste: string | null = null,
  operaciones = compras,
) =>
  diagnosticarCambioPlan(
    actual,
    contratoPropuesto(p, VERSION_CATALOGO_PLANES),
    p,
    u,
    ajuste,
    operaciones,
  );

it('cuenta invitaciones y reservas de cargas, sin mutar ni recortar datos', () => {
  const copia = structuredClone({ actual, plan, uso, compras });
  const d = comparar();
  expect(d).toMatchObject({
    estado: 'resolver',
    usuariosExcedidos: 1,
    almacenamientoExcedidoBytes: '1024',
  });
  expect(d.hallazgos.map((h) => h.codigo)).toEqual(
    expect.arrayContaining([
      'usuarios_excedidos',
      'almacenamiento_excedido',
      'compras_abiertas',
    ]),
  );
  expect({ actual, plan, uso, compras }).toEqual(copia);
});
it('conserva adicionales y ajuste de archivos sin inventar cargos', () => {
  const d = comparar(
    plan,
    { ...uso, usuarios: { ...uso.usuarios, adicionalesVigentes: 2 } },
    String(2n * GB),
  );
  expect(d).toMatchObject({
    usuariosCupoResultante: 5,
    usuariosExcedidos: 0,
    almacenamientoCupoBytes: String(2n * GB),
    almacenamientoExcedidoBytes: '0',
  });
  expect(d.hallazgos.map((h) => h.codigo)).toContain('almacenamiento_ajustado');
  expect(d.hallazgos.map((h) => h.codigo)).not.toContain('usuarios_excedidos');
});
it('exige resolver adicionales vigentes cuando la propuesta no los permite', () => {
  const d = comparar(
    { ...plan, adicionalesPermitidos: false },
    {
      ...uso,
      usuarios: {
        activos: 1,
        invitacionesPendientes: 0,
        adicionalesVigentes: 1,
      },
    },
  );
  expect(d.hallazgos).toContainEqual(
    expect.objectContaining({
      codigo: 'adicionales_vigentes',
      nivel: 'resolver',
    }),
  );
});
it('no interpreta almacenamiento pendiente como ilimitado, incluso con un ajuste', () => {
  const pendiente = {
    ...plan,
    almacenamientoModo: 'pendiente' as const,
    almacenamientoGb: null,
  };
  const d = comparar(pendiente, uso, String(3n * GB));
  expect(d.hallazgos).toContainEqual(
    expect.objectContaining({
      codigo: 'almacenamiento_sin_definir',
      nivel: 'resolver',
    }),
  );
});
it('no marca compras cuando siguen incluidas, aunque haya operaciones abiertas', () => {
  const pro = {
    ...structuredClone(PROPUESTA_PLANES[1].contenido),
    almacenamientoModo: 'ilimitado' as const,
    almacenamientoGb: null,
  };
  expect(comparar(pro).hallazgos.map((h) => h.codigo)).not.toContain(
    'compras_abiertas',
  );
});
it('no confunde cero operaciones con cobertura de continuidad para todos los módulos', () => {
  const d = comparar(plan, uso, null, []);
  expect(d.hallazgos).toContainEqual(
    expect.objectContaining({ codigo: 'continuidad_manual', nivel: 'revisar' }),
  );
  const propuesta = contratoPropuesto(plan, VERSION_CATALOGO_PLANES);
  const mismo = diagnosticarCambioPlan(
    propuesta,
    propuesta,
    plan,
    {
      usuarios: {
        activos: 2,
        invitacionesPendientes: 0,
        adicionalesVigentes: 0,
      },
      archivos: {
        guardadosBytes: '0',
        reservadosBytes: '0',
        cargasPendientes: 0,
      },
    },
    null,
    [],
  );
  expect(mismo).toMatchObject({
    estado: 'sin_excedentes',
    funcionesAgregadas: 0,
    funcionesRetiradas: 0,
    hallazgos: [],
  });
});
