import { Prisma } from '@prisma/client';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  compactarJson,
  jsonEsGrande,
  restaurarElementoJson,
} from '../common/json-compartido';

const FORMATO_ALMACENADO = 'grafo-snapshot-gzip-v1';
/** Una cadena comprimida evita también que Prisma serialice decenas de miles
 * de nodos JSON por consulta. Gzip verifica integridad; la tabla sigue siendo
 * autónoma y se restaura antes de llegar a cualquier servicio de negocio. */
const TABLA = '__grafo_geometrias_v2';
const GEOMETRIA = new Set([
  'placements',
  'solucionNesting',
  'layout_produccion',
  'demandaNesting',
  'interpretacionVectorial',
  'geometriaVectorial',
  'contornos',
  'contorno',
  'huecos',
  'capas',
  'recorridos',
]);
type Bloque = { formato: string; contenido: string };
// Identidad privada de getters creados por la lectura. Al copiar un componente
// a la OT puede conservar su bloque inmutable SIN expandir y volver a codificar
// miles de contornos dentro de la transacción. Al editarlo, el getter se vuelve
// un valor normal y se guarda nuevamente: nunca se ignora una modificación.
const diferidos = new WeakMap<
  () => unknown,
  { bloque: Bloque; indice: number }
>();
function guardar(valor: unknown): unknown {
  if (
    !valor ||
    typeof valor !== 'object' ||
    Array.isArray(valor) ||
    TABLA in valor
  )
    return valor;
  const bloques: Bloque[] = [];
  const heredados = new Map<Bloque, number>();
  const nuevas: unknown[] = [];
  let bloqueNuevo: number | undefined;
  const separar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(separar);
    if (!v || typeof v !== 'object' || v.constructor !== Object) return v;
    return Object.fromEntries(
      Object.keys(v).map((clave) => {
        const descriptor = Object.getOwnPropertyDescriptor(v, clave)!;
        const diferido = descriptor.get && diferidos.get(descriptor.get);
        if (diferido) {
          let tabla = heredados.get(diferido.bloque);
          if (tabla === undefined) {
            tabla = bloques.length;
            bloques.push(diferido.bloque);
            heredados.set(diferido.bloque, tabla);
          }
          return [clave, { __grafo_geometria: [tabla, diferido.indice] }];
        }
        const contenido = (v as Record<string, unknown>)[clave];
        if (GEOMETRIA.has(clave) && jsonEsGrande(contenido)) {
          if (bloqueNuevo === undefined) {
            bloqueNuevo = bloques.length;
            bloques.push({ formato: FORMATO_ALMACENADO, contenido: '' });
          }
          return [
            clave,
            { __grafo_geometria: [bloqueNuevo, nuevas.push(contenido) - 1] },
          ];
        }
        return [clave, separar(contenido)];
      }),
    );
  };
  const arbol = separar(valor) as Record<string, unknown>;
  if (!bloques.length) return valor;
  if (bloqueNuevo !== undefined)
    bloques[bloqueNuevo] = {
      formato: FORMATO_ALMACENADO,
      contenido: gzipSync(JSON.stringify(compactarJson(nuevas))).toString(
        'base64',
      ),
    };
  // Pasos, componentes e importes siguen disponibles para los reportes SQL.
  return { ...arbol, [TABLA]: bloques };
}
function leer(valor: unknown): unknown {
  if (!valor || typeof valor !== 'object' || !(TABLA in valor)) return valor;
  const { [TABLA]: tablas, ...arbol } = valor as Record<string, unknown>;
  if (!Array.isArray(tablas)) throw new Error('Snapshot técnico inválido.');
  const bloques = tablas as Bloque[];
  const diccionarios = new Map<number, unknown>();
  const cargar = (tabla: number, indice: number): unknown => {
    if (!diccionarios.has(tabla)) {
      const b = bloques[tabla];
      if (b?.formato !== FORMATO_ALMACENADO || typeof b.contenido !== 'string')
        throw new Error('Snapshot técnico inválido.');
      diccionarios.set(
        tabla,
        JSON.parse(
          gunzipSync(Buffer.from(b.contenido, 'base64'), {
            maxOutputLength: 128 * 1024 * 1024,
          }).toString('utf8'),
        ),
      );
    }
    return restaurarElementoJson(diccionarios.get(tabla), indice);
  };
  const reponer = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(reponer);
    if (!v || typeof v !== 'object') return v;
    const obj: Record<string, unknown> = {};
    for (const [clave, contenido] of Object.entries(v)) {
      const ref =
        contenido &&
        typeof contenido === 'object' &&
        Object.keys(contenido).length === 1
          ? (contenido as { __grafo_geometria?: unknown }).__grafo_geometria
          : undefined;
      if (GEOMETRIA.has(clave) && Array.isArray(ref)) {
        const [tabla, indice] = ref as number[];
        if (
          ref.length !== 2 ||
          !Number.isInteger(tabla) ||
          tabla < 0 ||
          tabla >= bloques.length ||
          !Number.isInteger(indice) ||
          indice < 0
        )
          throw new Error('Referencia geométrica inválida.');
        const fijar = (value: unknown) =>
          Object.defineProperty(obj, clave, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        const get = () => {
          const value = cargar(tabla, indice);
          fijar(value);
          return value;
        };
        diferidos.set(get, { bloque: bloques[tabla], indice });
        Object.defineProperty(obj, clave, {
          enumerable: true,
          configurable: true,
          get,
          set: fijar,
        });
      } else
        Object.defineProperty(obj, clave, {
          value: reponer(contenido),
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    return obj;
  };
  return reponer(arbol);
}

// Sólo snapshots técnicos. No se alteran JSON de configuración ni campos
// financieros que puedan consultarse mediante filtros JSON de PostgreSQL.
const CAMPOS: Record<string, Set<string>> = Object.fromEntries(
  Object.entries({
    CotizacionItem: ['trazabilidadJson', 'jobContextJson', 'snapshotJson'],
    OrdenTrabajoItem: [
      'trazabilidadSnapshotJson',
      'jobContextSnapshotJson',
      'recetaSnapshotJson',
    ],
    OrdenTrabajoItemPaso: ['nestingLoteSnapshotJson'],
    NestingGuardado: ['resultadoJson'],
    NestingCheckpoint: ['resultadoJson'],
  }).map(([modelo, campos]) => [modelo, new Set(campos)]),
);
const relaciones = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    new Map(
      m.fields.filter((f) => f.kind === 'object').map((f) => [f.name, f.type]),
    ),
  ]),
);

/** Recorre relaciones Prisma, nunca el interior de un JSON de negocio. Así
 * también funciona con include/select y escrituras anidadas dentro de una OT. */
function transformar(
  valor: unknown,
  modelo: string,
  escribir: boolean,
): unknown {
  if (Array.isArray(valor))
    return valor.map((v) => transformar(v, modelo, escribir));
  if (!valor || typeof valor !== 'object') return valor;
  const salida = { ...valor } as Record<string, unknown>;
  for (const [clave, v] of Object.entries(salida)) {
    if (CAMPOS[modelo]?.has(clave)) {
      salida[clave] = escribir ? guardar(v) : leer(v);
    } else {
      const relacionado = relaciones.get(modelo)?.get(clave);
      if (relacionado)
        salida[clave] = escribir
          ? transformarEscrituraAnidada(v, relacionado)
          : transformar(v, relacionado, false);
    }
  }
  return salida;
}
function transformarEscrituraAnidada(valor: unknown, modelo: string): unknown {
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor).map(([operacion, contenido]) => {
      if (operacion === 'create')
        return [operacion, transformar(contenido, modelo, true)];
      if (
        [
          'update',
          'updateMany',
          'upsert',
          'connectOrCreate',
          'createMany',
        ].includes(operacion)
      ) {
        const visitar = (v: unknown): unknown => {
          if (Array.isArray(v)) return v.map(visitar);
          if (!v || typeof v !== 'object') return v;
          const obj = { ...v } as Record<string, unknown>;
          let tieneWrapper = false;
          for (const campo of ['data', 'create', 'update'])
            if (campo in obj) {
              obj[campo] = transformar(obj[campo], modelo, true);
              tieneWrapper = true;
            }
          return tieneWrapper ? obj : transformar(obj, modelo, true);
        };
        return [operacion, visitar(contenido)];
      }
      return [operacion, contenido];
    }),
  );
}

export function prepararDatosSnapshot<T>(modelo: string, datos: T): T {
  return transformar(datos, modelo, true) as T;
}

/** Mantenimiento/rollback de formato: mismo lector que utiliza la aplicación. */
export function restaurarDatosSnapshot<T>(modelo: string, datos: T): T {
  return transformar(datos, modelo, false) as T;
}

type ConsultaSnapshot = {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
};
// Adaptador de consultas puro: no agrega modelos/campos al cliente. Evita
// inferir un segundo cliente Prisma completo al emitir las declaraciones TS.
export const snapshotsExtension = {
  name: 'snapshots-tecnicos-compartidos',
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: ConsultaSnapshot): Promise<unknown> {
        let entrada = args;
        if (
          [
            'create',
            'createMany',
            'createManyAndReturn',
            'update',
            'updateMany',
            'updateManyAndReturn',
            'upsert',
          ].includes(operation)
        ) {
          entrada = { ...args };
          const data = entrada as Record<string, unknown>;
          for (const clave of ['data', 'create', 'update'])
            if (clave in data)
              data[clave] = prepararDatosSnapshot(model, data[clave]);
        }
        const resultado = await query(entrada);
        return transformar(resultado, model, false);
      },
    },
  },
};
