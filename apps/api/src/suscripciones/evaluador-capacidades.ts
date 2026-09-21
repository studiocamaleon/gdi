import {
  CATALOGO_PLANES,
  VERSION_CATALOGO_PLANES,
  type ContenidoPlan,
} from '../plataforma/planes/catalogo-planes';
import { problemasPlan } from '../plataforma/planes/validacion-planes';
import {
  funcionIncluidaEnPlan,
  type ClaveFuncionPlan,
} from './capacidades-plan';
import type { resolverAccesoEmpresa } from './acceso-empresa';

// Lista cerrada del comportamiento anterior. Agregar una función al catálogo
// no la concede automáticamente a las cuentas existentes.
export const CAPACIDADES_COMPATIBLES_V1 = [
  'identidad',
  'roles',
  'empresa',
  'archivos',
  'notificaciones',
  'cuenta',
  'cotizacion',
  'presupuestos',
  'aprobacion_presupuestos',
  'documentos_pdf',
  'ordenes',
  'seguimiento_qr',
  'proyectos',
  'aprobacion_arte',
  'clientes',
  'cupones',
  'fidelizacion',
  'empleados',
  'materiales',
  'productos',
  'productos_compuestos',
  'procesos',
  'centros_costo',
  'maquinaria',
  'reglas_precio',
  'precios_especiales',
  'analisis_vectorial',
  'geometrias',
  'aprovechamiento_cotizacion',
  'exportacion_fabricacion',
  'recorridos_fabricacion',
  'centro_copiado',
  'terminaciones_copiado',
  'cotizacion_cad',
  'impresion_directa',
  'colas_impresion',
  'etiquetas_pdf',
  'tablero',
  'estaciones',
  'equipos_produccion',
  'asignacion_automatica',
  'eta_capacidad',
  'planificacion_avanzada',
  'colas_produccion',
  'existencias',
  'reservas',
  'prevision_materiales',
  'proveedores',
  'compras',
  'recepciones',
  'cobros',
  'cuentas_cobrar',
  'tesoreria',
  'valores',
  'cuentas_pagar',
  'gastos_recurrentes',
  'gastos_fijos',
  'fiscal_argentina',
  'reportes_resumen',
  'reportes_finanzas',
  'reportes_comerciales',
  'reportes_produccion',
  'whatsapp_automatico',
  'whatsapp_web',
  'mcp',
] as const;
export type ClaveCapacidad = (typeof CAPACIDADES_COMPATIBLES_V1)[number];
export type AccesoEmpresa = ReturnType<typeof resolverAccesoEmpresa>;
const equivalencias: Partial<Record<ClaveCapacidad, ClaveFuncionPlan>> = {
  centro_copiado: 'centroCopiado',
  terminaciones_copiado: 'centroCopiado',
  cotizacion_cad: 'centroCopiado',
  impresion_directa: 'impresionDirecta',
  colas_impresion: 'impresionDirecta',
  fiscal_argentina: 'afip',
  whatsapp_automatico: 'whatsapp',
  whatsapp_web: 'whatsapp',
};
export type ContratoCapacidades = {
  origen: 'compatibilidad' | 'borrador';
  catalogoVersion: number;
  nombre: string;
  funciones: Record<string, boolean>;
  limites: {
    usuariosMax: number | null;
    ordenesMesMax: number | null;
    almacenamiento: {
      modo: 'pendiente' | 'limitado' | 'ilimitado';
      gb: number | null;
    };
  };
};

/** Interpreta las condiciones anteriores, incluidas sus excepciones. No
 * endurece cuentas reales durante la fase de comparación. */
export function contratoCompatible(
  plan: { nombre?: string; featuresJson: unknown } | null,
): ContratoCapacidades {
  const f =
    plan?.featuresJson &&
    typeof plan.featuresJson === 'object' &&
    !Array.isArray(plan.featuresJson)
      ? (plan.featuresJson as Record<string, unknown>)
      : {};
  const limite = (clave: string) =>
    f.todo === true || typeof f[clave] !== 'number' ? null : f[clave];
  // El sistema anterior interpreta cero como ausencia de cupo de archivos.
  const storage = limite('storageGb') || null;
  return {
    origen: 'compatibilidad',
    catalogoVersion: VERSION_CATALOGO_PLANES,
    nombre: plan?.nombre ?? 'Cuenta sin plan asignado',
    funciones: Object.fromEntries(
      CAPACIDADES_COMPATIBLES_V1.map((clave) => [
        clave,
        equivalencias[clave]
          ? funcionIncluidaEnPlan(equivalencias[clave], plan)
          : true,
      ]),
    ),
    limites: {
      usuariosMax: limite('usuariosMax'),
      ordenesMesMax: limite('ordenesMesMax'),
      almacenamiento: {
        modo: storage === null ? 'ilimitado' : 'limitado',
        gb: storage,
      },
    },
  };
}

/** Una propuesta no es un contrato asignado. Sólo sirve para comparar y para
 * verificar recorridos aislados hasta implementar publicación/versiones. */
export function contratoPropuesto(
  plan: ContenidoPlan,
  version: number,
): ContratoCapacidades {
  const errores = problemasPlan(plan);
  if (version !== VERSION_CATALOGO_PLANES)
    errores.unshift('La versión del catálogo no coincide.');
  if (errores.length) throw new Error(errores.join(' '));
  return {
    origen: 'borrador',
    catalogoVersion: version,
    nombre: plan.nombre,
    funciones: { ...plan.funciones },
    limites: {
      usuariosMax: plan.usuariosIncluidos,
      ordenesMesMax: null,
      almacenamiento: {
        modo: plan.almacenamientoModo,
        gb: plan.almacenamientoGb,
      },
    },
  };
}

export function decisionCapacidad(
  contrato: ContratoCapacidades,
  clave: string,
  acceso: AccesoEmpresa,
) {
  const conocida = CATALOGO_PLANES.some((c) => c.clave === clave);
  const incluida =
    conocida &&
    Object.hasOwn(contrato.funciones, clave) &&
    contrato.funciones[clave] === true;
  return {
    incluida,
    puedeOperar: incluida && acceso.modo === 'operativo',
    motivo: !conocida
      ? 'capacidad_desconocida'
      : acceso.modo !== 'operativo'
        ? acceso.codigo
        : !incluida
          ? 'no_incluida'
          : 'incluida',
  };
}

export function diferenciasCapacidades(
  actual: ContratoCapacidades,
  propuesta: ContratoCapacidades,
) {
  return CATALOGO_PLANES.filter(
    (c) => actual.funciones[c.clave] !== propuesta.funciones[c.clave],
  ).map((c) => ({
    clave: c.clave,
    nombre: c.nombre,
    actual: actual.funciones[c.clave] === true,
    propuesta: propuesta.funciones[c.clave] === true,
    cobertura: c.cobertura,
  }));
}
