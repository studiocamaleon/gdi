import { BadRequestException } from '@nestjs/common';
import type { FuenteOperacionIncorporacion } from './componentes-configuracion';

export type DimensionOperacionCompuesta =
  'FIJO' | 'UNIDAD' | 'LONGITUD' | 'SUPERFICIE' | 'CANTIDAD';

export type DefinicionOperacionCompuesta = {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  dimension: DimensionOperacionCompuesta;
  requerida: boolean;
  orden: number;
};

export type ConfiguracionOperacionCompuesta = {
  codigo: string;
  nombre: string;
  activa: boolean;
  componentesCodigos: string[];
  modoTiempo: 'FIJO' | 'POR_UNIDAD';
  fuenteCantidad?: FuenteOperacionIncorporacion | null;
  factorConversionFuente?: number;
  unidadCantidad?: string | null;
  minutosFijos?: number | null;
  minutosPorUnidad?: number | null;
  dotacionOperarios?: number;
  orden?: number;
};

export type ConfiguracionPasoCompuesto = {
  version: 1;
  nodoClave: string;
  pasoTenantId: string;
  pasoNombre: string;
  operaciones: ConfiguracionOperacionCompuesta[];
};

export type OperacionCompuestaResuelta = ConfiguracionOperacionCompuesta & {
  nodoDestinoClave: string;
  pasoTenantId: string;
  pasoNombre: string;
  componentesNombres: string[];
  cantidadResuelta: number;
  duracionMin: number;
  dotacionOperarios: number;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function leerRuta(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }, root);
}

export function leerDefinicionesPasoCompuesto(
  value: unknown,
): DefinicionOperacionCompuesta[] {
  if (!Array.isArray(value)) return [];
  const definiciones = value.filter(
    (item): item is DefinicionOperacionCompuesta =>
      esRegistro(item) &&
      typeof item.codigo === 'string' &&
      Boolean(item.codigo.trim()) &&
      typeof item.nombre === 'string' &&
      Boolean(item.nombre.trim()) &&
      ['FIJO', 'UNIDAD', 'LONGITUD', 'SUPERFICIE', 'CANTIDAD'].includes(
        String(item.dimension),
      ) &&
      typeof item.requerida === 'boolean',
  );
  if (definiciones.length !== value.length) {
    throw new BadRequestException(
      'Las operaciones del paso compuesto contienen una definición inválida.',
    );
  }
  const codigos = new Set<string>();
  for (const definicion of definiciones) {
    const codigo = definicion.codigo.trim().toLowerCase();
    if (codigos.has(codigo)) {
      throw new BadRequestException(
        `La operación "${definicion.nombre}" está duplicada.`,
      );
    }
    codigos.add(codigo);
  }
  return definiciones
    .map((item, index) => ({
      ...item,
      codigo: item.codigo.trim(),
      nombre: item.nombre.trim(),
      descripcion: item.descripcion?.trim() || null,
      orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index,
    }))
    .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
}

export function leerConfiguracionesPasosCompuestos(
  value: unknown,
): ConfiguracionPasoCompuesto[] {
  if (!Array.isArray(value)) return [];
  const resultado: ConfiguracionPasoCompuesto[] = [];
  for (const raw of value) {
    if (
      !esRegistro(raw) ||
      Number(raw.version) !== 1 ||
      typeof raw.nodoClave !== 'string' ||
      !raw.nodoClave.trim() ||
      typeof raw.pasoTenantId !== 'string' ||
      !raw.pasoTenantId.trim() ||
      typeof raw.pasoNombre !== 'string' ||
      !raw.pasoNombre.trim() ||
      !Array.isArray(raw.operaciones)
    ) {
      throw new BadRequestException(
        'La configuración de pasos compuestos es inválida.',
      );
    }
    const operaciones: ConfiguracionOperacionCompuesta[] = raw.operaciones.map(
      (item, index) => {
        if (
          !esRegistro(item) ||
          typeof item.codigo !== 'string' ||
          !item.codigo.trim() ||
          typeof item.nombre !== 'string' ||
          !item.nombre.trim() ||
          typeof item.activa !== 'boolean' ||
          !Array.isArray(item.componentesCodigos) ||
          !item.componentesCodigos.every(
            (codigo) => typeof codigo === 'string',
          ) ||
          !['FIJO', 'POR_UNIDAD'].includes(String(item.modoTiempo))
        ) {
          throw new BadRequestException(
            `La operación ${index + 1} de "${raw.pasoNombre}" es inválida.`,
          );
        }
        if (item.modoTiempo === 'FIJO' && !(Number(item.minutosFijos) > 0)) {
          throw new BadRequestException(
            `La duración de "${item.nombre}" debe ser mayor que cero.`,
          );
        }
        if (item.modoTiempo === 'POR_UNIDAD') {
          const fuente = item.fuenteCantidad;
          if (
            !esRegistro(fuente) ||
            !['PADRE', 'COMPONENTE'].includes(String(fuente.tipo)) ||
            typeof fuente.campo !== 'string' ||
            !fuente.campo.trim() ||
            (fuente.tipo === 'COMPONENTE' &&
              (typeof fuente.componenteCodigo !== 'string' ||
                !fuente.componenteCodigo.trim())) ||
            !(Number(item.minutosPorUnidad) > 0) ||
            !(Number(item.factorConversionFuente ?? 1) > 0)
          ) {
            throw new BadRequestException(
              `La regla de tiempo de "${item.nombre}" es inválida.`,
            );
          }
        }
        return {
          codigo: item.codigo.trim(),
          nombre: item.nombre.trim(),
          activa: item.activa,
          componentesCodigos: [...new Set(item.componentesCodigos.map(String))],
          modoTiempo: item.modoTiempo as 'FIJO' | 'POR_UNIDAD',
          fuenteCantidad: item.fuenteCantidad as
            FuenteOperacionIncorporacion | null | undefined,
          factorConversionFuente: Number(item.factorConversionFuente ?? 1),
          unidadCantidad:
            typeof item.unidadCantidad === 'string'
              ? item.unidadCantidad
              : null,
          minutosFijos:
            item.minutosFijos == null ? null : Number(item.minutosFijos),
          minutosPorUnidad:
            item.minutosPorUnidad == null
              ? null
              : Number(item.minutosPorUnidad),
          dotacionOperarios: Math.max(
            1,
            Math.round(Number(item.dotacionOperarios ?? 1)),
          ),
          orden: Number.isFinite(Number(item.orden))
            ? Number(item.orden)
            : index,
        };
      },
    );
    resultado.push({
      version: 1,
      nodoClave: raw.nodoClave.trim(),
      pasoTenantId: raw.pasoTenantId.trim(),
      pasoNombre: raw.pasoNombre.trim(),
      operaciones,
    });
  }
  return resultado;
}

function valorFuente(
  fuente: FuenteOperacionIncorporacion,
  contextoPadre: Record<string, unknown>,
  outputsComponentes: Record<string, Record<string, unknown>>,
) {
  const root =
    fuente.tipo === 'COMPONENTE' && fuente.componenteCodigo
      ? outputsComponentes[fuente.componenteCodigo]
      : contextoPadre;
  if (!root) return undefined;
  return Object.prototype.hasOwnProperty.call(root, fuente.campo)
    ? root[fuente.campo]
    : leerRuta(root, fuente.campo);
}

export function resolverPasoCompuesto(args: {
  configuracion: ConfiguracionPasoCompuesto;
  contextoPadre: Record<string, unknown>;
  outputsComponentes: Record<string, Record<string, unknown>>;
  nombresComponentes: Record<string, string>;
}): OperacionCompuestaResuelta[] {
  return args.configuracion.operaciones
    .filter((item) => item.activa)
    .map((operacion) => {
      const cantidadResuelta =
        operacion.modoTiempo === 'FIJO'
          ? 1
          : Number(
              valorFuente(
                operacion.fuenteCantidad!,
                args.contextoPadre,
                args.outputsComponentes,
              ),
            ) * Number(operacion.factorConversionFuente ?? 1);
      if (!Number.isFinite(cantidadResuelta) || cantidadResuelta <= 0) {
        throw new BadRequestException(
          `No se pudo resolver la cantidad de "${operacion.nombre}".`,
        );
      }
      const duracionMin =
        operacion.modoTiempo === 'FIJO'
          ? Number(operacion.minutosFijos)
          : cantidadResuelta * Number(operacion.minutosPorUnidad);
      return {
        ...operacion,
        nodoDestinoClave: args.configuracion.nodoClave,
        pasoTenantId: args.configuracion.pasoTenantId,
        pasoNombre: args.configuracion.pasoNombre,
        componentesNombres: operacion.componentesCodigos.map(
          (codigo) => args.nombresComponentes[codigo] ?? codigo,
        ),
        cantidadResuelta,
        duracionMin,
        dotacionOperarios: Math.max(
          1,
          Math.round(Number(operacion.dotacionOperarios ?? 1)),
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(a.orden ?? 0) - Number(b.orden ?? 0) ||
        a.codigo.localeCompare(b.codigo),
    );
}
