import { CATALOGO_PLANES, type ContenidoPlan } from './catalogo-planes';
import type { ContratoCapacidades } from '../../suscripciones/evaluador-capacidades';
import type {
  DiagnosticoCambioPlan,
  HallazgoCambioPlan,
  UsoCambioPlan,
} from './comparacion-planes';

/** Conteos de una misma foto de la empresa. Nunca son instrucciones de escritura. */
export type OperacionCambioPlan = {
  codigo: string;
  funciones: string[];
  cantidad: number;
  titulo: string;
  detalle: string;
  /** Sólo para circuitos que conservan una vía de continuidad sin la función. */
  permiteRetiradaConRevision?: boolean;
  /** Identidad opaca de los pendientes; se incluye en la huella de aceptación. */
  revision?: string;
};

export const requiereCerrarOperacion = (op: OperacionCambioPlan) =>
  op.cantidad > 0 && !op.permiteRetiradaConRevision;

export function diagnosticarCambioPlan(
  actual: ContratoCapacidades,
  propuesta: ContratoCapacidades,
  contenido: ContenidoPlan,
  uso: UsoCambioPlan,
  ajusteAlmacenamiento: string | null,
  operaciones: OperacionCambioPlan[],
): DiagnosticoCambioPlan {
  const hallazgos: HallazgoCambioPlan[] = [];
  const retiradas = CATALOGO_PLANES.filter(
    (f) => actual.funciones[f.clave] && !propuesta.funciones[f.clave],
  );
  const agregadas = CATALOGO_PLANES.filter(
    (f) => !actual.funciones[f.clave] && propuesta.funciones[f.clave],
  );
  const ocupados = uso.usuarios.activos + uso.usuarios.invitacionesPendientes;
  // Los adicionales ya acordados no desaparecen ni se vuelven a cobrar al comparar.
  const cupo =
    propuesta.limites.usuariosMax === null
      ? null
      : propuesta.limites.usuariosMax + uso.usuarios.adicionalesVigentes;
  const excedidos = cupo === null ? 0 : Math.max(0, ocupados - cupo);
  if (excedidos)
    hallazgos.push({
      codigo: 'usuarios_excedidos',
      nivel: 'resolver',
      titulo: 'El equipo excede el cupo',
      cantidad: excedidos,
      detalle: `${ocupados} lugares ocupados entre accesos e invitaciones; el cupo resultante sería ${cupo}. ${contenido.adicionalesPermitidos ? 'Acordá más adicionales o liberá lugares antes de asignar.' : 'Liberá lugares o elegí un plan de mayor capacidad.'} No se desactiva a nadie automáticamente.`,
    });
  if (uso.usuarios.adicionalesVigentes && !contenido.adicionalesPermitidos)
    hallazgos.push({
      codigo: 'adicionales_vigentes',
      nivel: 'resolver',
      titulo: 'Hay adicionales vigentes',
      detalle: `El cálculo conserva ${uso.usuarios.adicionalesVigentes} adicionales ya otorgados, pero esta propuesta no los admite. Definí su continuidad antes de asignar.`,
    });
  const almacenamiento = propuesta.limites.almacenamiento;
  const ajuste =
    ajusteAlmacenamiento && BigInt(ajusteAlmacenamiento) > 0n
      ? BigInt(ajusteAlmacenamiento)
      : null;
  const cuotaBytes =
    ajuste ??
    (almacenamiento.modo === 'limitado' && almacenamiento.gb !== null
      ? BigInt(Math.floor(almacenamiento.gb * 1024 ** 3))
      : null);
  const bytes =
    BigInt(uso.archivos.guardadosBytes) + BigInt(uso.archivos.reservadosBytes);
  const exceso =
    cuotaBytes !== null && bytes > cuotaBytes ? bytes - cuotaBytes : 0n;
  if (almacenamiento.modo === 'pendiente')
    hallazgos.push({
      codigo: 'almacenamiento_sin_definir',
      nivel: 'resolver',
      titulo: 'Falta definir el almacenamiento del plan',
      detalle:
        'Elegí un cupo o la condición sin límite antes de publicar esta propuesta. Un cupo pendiente no se interpreta como ilimitado.',
    });
  if (ajuste)
    hallazgos.push({
      codigo: 'almacenamiento_ajustado',
      nivel: 'revisar',
      titulo: 'Cuota de archivos personalizada',
      detalle:
        'El cálculo conserva el ajuste vigente de esta empresa, que tiene prioridad sobre los GB del plan. Confirmá su continuidad al asignar.',
    });
  if (exceso > 0n)
    hallazgos.push({
      codigo: 'almacenamiento_excedido',
      nivel: 'resolver',
      titulo: 'Los archivos exceden el cupo',
      detalle:
        'El uso incluye archivos guardados y espacio reservado por cargas en curso. Ampliá el cupo o liberá espacio antes de asignar. No se borran archivos automáticamente.',
    });
  if (uso.archivos.cargasPendientes)
    hallazgos.push({
      codigo: 'cargas_pendientes',
      nivel: 'revisar',
      titulo: 'Hay archivos subiendo',
      cantidad: uso.archivos.cargasPendientes,
      detalle:
        'Su espacio ya está incluido en esta comparación. Repetí el diagnóstico al finalizar las cargas y justo antes de asignar.',
    });
  for (const op of operaciones) {
    if (
      op.cantidad > 0 &&
      op.funciones.some((clave) => retiradas.some((f) => f.clave === clave))
    )
      hallazgos.push({
        codigo: op.codigo,
        nivel: 'revisar',
        titulo: op.titulo,
        detalle: op.detalle,
        cantidad: op.cantidad,
      });
  }
  const revisionesManuales = retiradas.filter(
    (f) =>
      f.revisionOperativa &&
      !operaciones.some((op) => op.funciones.includes(f.clave)),
  );
  if (revisionesManuales.length)
    hallazgos.push({
      codigo: 'continuidad_manual',
      nivel: 'revisar',
      titulo: 'Continuidad que requiere revisión manual',
      detalle: `${revisionesManuales.map((f) => f.nombre).join(', ')}. Estas funciones todavía no tienen un conteo automático de operaciones pendientes. Revisá su uso antes de retirarlas.`,
    });
  if (
    retiradas.some((f) =>
      ['impresion_directa', 'colas_impresion'].includes(f.clave),
    )
  )
    hallazgos.push({
      codigo: 'impresion_en_equipos',
      nivel: 'revisar',
      titulo: 'Revisar las colas de impresión',
      detalle:
        'Confirmá con los operarios los envíos y trabajos pendientes. Los equipos y la cola del sistema operativo pueden seguir imprimiendo fuera de Grafo; esta consulta no conoce su estado físico ni cancela envíos.',
    });
  return {
    estado: hallazgos.some((h) => h.nivel === 'resolver')
      ? 'resolver'
      : hallazgos.length
        ? 'revisar'
        : 'sin_excedentes',
    usuariosCupoResultante: cupo,
    usuariosExcedidos: excedidos,
    almacenamientoCupoBytes: cuotaBytes === null ? null : String(cuotaBytes),
    almacenamientoExcedidoBytes: String(exceso),
    funcionesAgregadas: agregadas.length,
    funcionesRetiradas: retiradas.length,
    hallazgos,
  };
}
