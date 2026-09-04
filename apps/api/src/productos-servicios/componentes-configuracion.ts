import { BadRequestException } from '@nestjs/common';

export const ORIGENES_PARAMETRO_COMPONENTE = [
  'DEFAULT_HIJO',
  'FIJO',
  'PADRE',
  'FORMULA',
  'COTIZACION',
] as const;

export type OrigenParametroComponente =
  (typeof ORIGENES_PARAMETRO_COMPONENTE)[number];

export type BindingParametroComponente = {
  clave: string;
  etiqueta?: string;
  tipoDato?: string;
  unidad?: string | null;
  requerido?: boolean;
  origen: OrigenParametroComponente;
  valor?: unknown;
  padreClave?: string | null;
  expresion?: string | null;
  regla?: {
    campoPadre: string;
    operador: 'COPIAR' | 'SUMAR' | 'RESTAR' | 'MULTIPLICAR' | 'DIVIDIR';
    valor?: number | null;
    fuente?: {
      tipo: 'PADRE' | 'COMPONENTE';
      campo: string;
      componenteCodigo?: string | null;
    } | null;
  } | null;
  opciones?: Array<{ valor: string; etiqueta: string }>;
};

/**
 * Proyección legible y congelable del valor efectivo usado para costear un
 * componente. Conserva el valor tipado para otros consumidores y una etiqueta
 * resuelta para que propuesta, OT y producción no tengan que interpretar las
 * claves internas del JobContext.
 */
export type EspecificacionEfectivaComponente = {
  clave: string;
  etiqueta: string;
  tipoDato: string;
  unidad?: string | null;
  requerido: boolean;
  origen: OrigenParametroComponente;
  valor: unknown;
  valorTexto: string;
};

export type FuenteOperacionIncorporacion = {
  tipo: 'PADRE' | 'COMPONENTE' | 'COMPONENTES';
  campo: string;
  componenteCodigo?: string | null;
  componentesCodigos?: string[];
  agregacion?: 'SUM';
};

export type RepeticionComponenteFabricado = {
  version: 1;
  permitida: boolean;
  /** 1 incluye la ocurrencia declarada; 0 empieza vacío al cotizar. */
  minimo: 0 | 1;
  /** Máximo total de ocurrencias cotizadas. */
  maximo: number;
  etiquetaAgregar?: string | null;
};

export type OcurrenciaAdicionalComponente = {
  id: string;
  nombre: string;
  valores: Record<string, unknown>;
};

/** Clave reservada dentro de componentesConfiguracion[codigoPlantilla]. */
export const CLAVE_OCURRENCIAS_ADICIONALES = '__ocurrenciasAdicionales';

export type OperacionIncorporacion = {
  codigo: string;
  nombre: string;
  modoTiempo: 'FIJO' | 'POR_UNIDAD';
  fuenteCantidad?: FuenteOperacionIncorporacion | null;
  /** Convierte el valor técnico publicado a la unidad visible seleccionada. */
  factorConversionFuente?: number;
  unidadCantidad?: string | null;
  minutosFijos?: number | null;
  minutosPorUnidad?: number | null;
  dotacionOperarios?: number;
  orden?: number;
};

export type OperacionIncorporacionResuelta = OperacionIncorporacion & {
  componenteCodigo: string;
  componenteNombre: string;
  nodoDestinoClave: string;
  cantidadResuelta: number;
  duracionMin: number;
  dotacionOperarios: number;
};

function resolverRegla(
  regla: NonNullable<BindingParametroComponente['regla']>,
  padre: Record<string, unknown>,
  outputsComponentes: Record<string, Record<string, unknown>>,
): unknown {
  const fuente = regla.fuente;
  const campo = fuente?.campo || regla.campoPadre;
  const root =
    fuente?.tipo === 'COMPONENTE' && fuente.componenteCodigo
      ? outputsComponentes[fuente.componenteCodigo]
      : padre;
  const base = root
    ? Object.prototype.hasOwnProperty.call(root, campo)
      ? root[campo]
      : leerRuta(root, campo)
    : undefined;
  if (regla.operador === 'COPIAR') return base;
  const numeroBase = Number(base);
  const valor = Number(regla.valor);
  if (!Number.isFinite(numeroBase) || !Number.isFinite(valor)) {
    throw new BadRequestException(
      `No se pudo calcular desde "${campo}": se requieren valores numéricos.`,
    );
  }
  if (regla.operador === 'SUMAR') return numeroBase + valor;
  if (regla.operador === 'RESTAR') return numeroBase - valor;
  if (regla.operador === 'MULTIPLICAR') return numeroBase * valor;
  if (valor === 0) {
    throw new BadRequestException('No se puede dividir por cero.');
  }
  return numeroBase / valor;
}

export type ConfiguracionComponenteFabricado = {
  version: 1 | 2;
  bindings: BindingParametroComponente[];
  operacionesIncorporacion?: OperacionIncorporacion[];
  repeticion?: RepeticionComponenteFabricado;
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function esFuenteVectorialValida(value: unknown): boolean {
  if (!esRegistro(value)) return false;
  return (
    [1, 2].includes(Number(value.schemaVersion)) &&
    typeof value.nombreArchivo === 'string' &&
    value.nombreArchivo.length > 0 &&
    value.nombreArchivo.length <= 255 &&
    typeof value.svg === 'string' &&
    value.svg.length > 0 &&
    Buffer.byteLength(value.svg, 'utf8') <= 512 * 1024 &&
    Number(value.anchoFinalMm) > 0 &&
    (value.altoFinalMm == null || Number(value.altoFinalMm) > 0)
  );
}

function esReglaControlada(
  value: unknown,
): value is NonNullable<BindingParametroComponente['regla']> {
  if (!esRegistro(value) || typeof value.campoPadre !== 'string') return false;
  if (value.fuente != null) {
    if (
      !esRegistro(value.fuente) ||
      !['PADRE', 'COMPONENTE'].includes(String(value.fuente.tipo)) ||
      typeof value.fuente.campo !== 'string' ||
      !value.fuente.campo.trim() ||
      (value.fuente.tipo === 'COMPONENTE' &&
        (typeof value.fuente.componenteCodigo !== 'string' ||
          !value.fuente.componenteCodigo.trim()))
    ) {
      return false;
    }
  }
  if (
    !['COPIAR', 'SUMAR', 'RESTAR', 'MULTIPLICAR', 'DIVIDIR'].includes(
      String(value.operador),
    )
  ) {
    return false;
  }
  return (
    value.operador === 'COPIAR' ||
    (typeof value.valor === 'number' && Number.isFinite(value.valor))
  );
}

function leerRepeticion(
  value: unknown,
): RepeticionComponenteFabricado | null | undefined {
  if (value == null) return undefined;
  if (
    !esRegistro(value) ||
    Number(value.version) !== 1 ||
    typeof value.permitida !== 'boolean'
  ) {
    return null;
  }
  const minimo = Number(value.minimo ?? 1);
  if (![0, 1].includes(minimo) || (!value.permitida && minimo === 0)) {
    return null;
  }
  const maximo = Number(value.maximo ?? 20);
  if (!Number.isInteger(maximo) || maximo < 1 || maximo > 50) return null;
  if (
    value.etiquetaAgregar != null &&
    (typeof value.etiquetaAgregar !== 'string' ||
      !value.etiquetaAgregar.trim() ||
      value.etiquetaAgregar.trim().length > 100)
  ) {
    return null;
  }
  return {
    version: 1,
    permitida: value.permitida,
    minimo: minimo as 0 | 1,
    maximo,
    etiquetaAgregar:
      typeof value.etiquetaAgregar === 'string'
        ? value.etiquetaAgregar.trim()
        : null,
  };
}

export function leerConfiguracionComponente(
  value: unknown,
): ConfiguracionComponenteFabricado | null {
  if (
    !esRegistro(value) ||
    ![1, 2].includes(Number(value.version)) ||
    !Array.isArray(value.bindings)
  ) {
    return null;
  }
  const bindings = value.bindings.filter(
    (item): item is BindingParametroComponente =>
      esRegistro(item) &&
      typeof item.clave === 'string' &&
      item.clave.trim().length > 0 &&
      (item.regla == null || esReglaControlada(item.regla)) &&
      ORIGENES_PARAMETRO_COMPONENTE.includes(
        item.origen as OrigenParametroComponente,
      ),
  );
  if (bindings.length !== value.bindings.length) return null;
  const operacionesRaw = Array.isArray(value.operacionesIncorporacion)
    ? value.operacionesIncorporacion
    : [];
  const operacionesIncorporacion = operacionesRaw.filter(
    (item): item is OperacionIncorporacion => {
      if (
        !esRegistro(item) ||
        typeof item.codigo !== 'string' ||
        !item.codigo.trim() ||
        typeof item.nombre !== 'string' ||
        !item.nombre.trim() ||
        !['FIJO', 'POR_UNIDAD'].includes(String(item.modoTiempo))
      ) {
        return false;
      }
      if (item.modoTiempo === 'FIJO') {
        return Number(item.minutosFijos) > 0;
      }
      const fuente = item.fuenteCantidad;
      return (
        esRegistro(fuente) &&
        ['PADRE', 'COMPONENTE', 'COMPONENTES'].includes(String(fuente.tipo)) &&
        typeof fuente.campo === 'string' &&
        Boolean(fuente.campo.trim()) &&
        (fuente.tipo !== 'COMPONENTE' ||
          (typeof fuente.componenteCodigo === 'string' &&
            Boolean(fuente.componenteCodigo.trim()))) &&
        (fuente.tipo !== 'COMPONENTES' ||
          (fuente.agregacion === 'SUM' &&
            Array.isArray(fuente.componentesCodigos) &&
            fuente.componentesCodigos.length > 0 &&
            fuente.componentesCodigos.every(
              (codigo) => typeof codigo === 'string' && Boolean(codigo.trim()),
            ))) &&
        Number(item.minutosPorUnidad) > 0 &&
        Number(item.factorConversionFuente ?? 1) > 0
      );
    },
  );
  if (operacionesIncorporacion.length !== operacionesRaw.length) return null;
  const repeticion = leerRepeticion(value.repeticion);
  if (repeticion === null) return null;
  return {
    version: Number(value.version) === 2 ? 2 : 1,
    bindings,
    operacionesIncorporacion,
    ...(repeticion ? { repeticion } : {}),
  };
}

/**
 * Lee las instancias creadas por el comercial para una ocurrencia repetible.
 * La receta sigue siendo la autoridad: sin permiso explícito, cualquier
 * instancia enviada por el cliente se rechaza.
 */
export function leerOcurrenciasAdicionalesComponente(args: {
  configuracion: unknown;
  contextoPadre: Record<string, unknown>;
  codigoComponente: string;
  nombreComponente: string;
}): OcurrenciaAdicionalComponente[] {
  const raiz = esRegistro(args.contextoPadre.componentesConfiguracion)
    ? args.contextoPadre.componentesConfiguracion
    : {};
  const valoresPlantilla = esRegistro(raiz[args.codigoComponente])
    ? (raiz[args.codigoComponente] as Record<string, unknown>)
    : {};
  const raw = valoresPlantilla[CLAVE_OCURRENCIAS_ADICIONALES];
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException(
      `Las ocurrencias adicionales de "${args.nombreComponente}" no tienen un formato válido.`,
    );
  }
  // El formulario puede conservar la clave reservada mientras no haya
  // ocurrencias. Una colección vacía no intenta repetir el componente y debe
  // ser válida aunque la receta no habilite repetición.
  if (raw.length === 0) return [];
  const repeticion = leerConfiguracionComponente(
    args.configuracion,
  )?.repeticion;
  if (!repeticion?.permitida) {
    throw new BadRequestException(
      `El componente "${args.nombreComponente}" no admite ocurrencias adicionales.`,
    );
  }
  if (raw.length + repeticion.minimo > repeticion.maximo) {
    throw new BadRequestException(
      `El componente "${args.nombreComponente}" admite hasta ${repeticion.maximo} ocurrencias por cotización.`,
    );
  }
  const ids = new Set<string>();
  return raw.map((item, index) => {
    if (!esRegistro(item)) {
      throw new BadRequestException(
        `La ocurrencia ${index + 2} de "${args.nombreComponente}" es inválida.`,
      );
    }
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || ids.has(id)) {
      throw new BadRequestException(
        `La ocurrencia ${index + 2} de "${args.nombreComponente}" no tiene un identificador válido y único.`,
      );
    }
    if (!nombre || nombre.length > 180 || !esRegistro(item.valores)) {
      throw new BadRequestException(
        `La ocurrencia ${index + 2} de "${args.nombreComponente}" debe tener nombre y configuración válidos.`,
      );
    }
    ids.add(id);
    return { id, nombre, valores: item.valores };
  });
}

/** Código estable para snapshots y para el unique (padre, componenteCodigo). */
export function codigoOcurrenciaComponente(
  codigoPlantilla: string,
  ocurrenciaId: string,
): string {
  const sufijo = ocurrenciaId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  return `${codigoPlantilla.slice(0, Math.max(1, 74 - sufijo.length))}__${sufijo}`;
}

export type OcurrenciaCotizadaComponente = {
  codigo: string;
  nombre: string;
  ocurrenciaId?: string;
  overrideCotizacion?: Record<string, unknown>;
};

/**
 * Materializa la cardinalidad efectiva del uso BOM. Las recetas anteriores y
 * los componentes no repetibles conservan su única ocurrencia base; una
 * plantilla 0..N sólo produce las ocurrencias creadas al cotizar.
 */
export function resolverOcurrenciasCotizadasComponente(args: {
  configuracion: unknown;
  contextoPadre: Record<string, unknown>;
  codigoComponente: string;
  nombreComponente: string;
}): OcurrenciaCotizadaComponente[] {
  const repeticion = leerConfiguracionComponente(
    args.configuracion,
  )?.repeticion;
  const adicionales = leerOcurrenciasAdicionalesComponente(args);
  return [
    ...(repeticion?.minimo === 0
      ? []
      : [
          {
            codigo: args.codigoComponente,
            nombre: args.nombreComponente,
          },
        ]),
    ...adicionales.map((ocurrencia) => ({
      codigo: codigoOcurrenciaComponente(args.codigoComponente, ocurrencia.id),
      nombre: ocurrencia.nombre,
      ocurrenciaId: ocurrencia.id,
      overrideCotizacion: ocurrencia.valores,
    })),
  ];
}

function leerFuenteOperacion(
  fuente: FuenteOperacionIncorporacion,
  contextoPadre: Record<string, unknown>,
  outputsComponentes: Record<string, Record<string, unknown>>,
): unknown {
  if (fuente.tipo === 'COMPONENTES') {
    const codigos = new Set(fuente.componentesCodigos ?? []);
    return Object.entries(outputsComponentes).reduce((total, [, outputs]) => {
      const plantillaCodigo = esRegistro(outputs._componente)
        ? outputs._componente.plantillaCodigo
        : undefined;
      const plantillaCodigoTexto =
        typeof plantillaCodigo === 'string' ? plantillaCodigo : '';
      const componenteCodigoTexto =
        typeof outputs._componenteCodigo === 'string'
          ? outputs._componenteCodigo
          : '';
      if (
        !codigos.has(plantillaCodigoTexto) &&
        !codigos.has(componenteCodigoTexto)
      ) {
        return total;
      }
      const value = Object.prototype.hasOwnProperty.call(outputs, fuente.campo)
        ? outputs[fuente.campo]
        : leerRuta(outputs, fuente.campo);
      const numero = Number(value);
      return Number.isFinite(numero) ? total + numero : total;
    }, 0);
  }
  const root =
    fuente.tipo === 'COMPONENTE' && fuente.componenteCodigo
      ? outputsComponentes[fuente.componenteCodigo]
      : contextoPadre;
  if (!root) return undefined;
  return Object.prototype.hasOwnProperty.call(root, fuente.campo)
    ? root[fuente.campo]
    : leerRuta(root, fuente.campo);
}

export function resolverOperacionesIncorporacion(args: {
  configuracion: unknown;
  contextoPadre: Record<string, unknown>;
  outputsComponentes: Record<string, Record<string, unknown>>;
  componenteCodigo: string;
  componenteNombre: string;
  nodoDestinoClave: string | null | undefined;
}): OperacionIncorporacionResuelta[] {
  const config = leerConfiguracionComponente(args.configuracion);
  const operaciones = config?.operacionesIncorporacion ?? [];
  if (!operaciones.length) return [];
  if (!args.nodoDestinoClave) {
    throw new BadRequestException(
      `El componente "${args.componenteNombre}" necesita un paso de incorporación.`,
    );
  }
  const nodoDestinoClave = args.nodoDestinoClave;
  return operaciones
    .map((operacion) => {
      const cantidadResuelta =
        operacion.modoTiempo === 'FIJO'
          ? 1
          : Number(
              leerFuenteOperacion(
                operacion.fuenteCantidad!,
                args.contextoPadre,
                args.outputsComponentes,
              ),
            ) * Number(operacion.factorConversionFuente ?? 1);
      if (!Number.isFinite(cantidadResuelta) || cantidadResuelta <= 0) {
        throw new BadRequestException(
          `No se pudo resolver la cantidad de "${operacion.nombre}" para incorporar "${args.componenteNombre}".`,
        );
      }
      const duracionMin =
        operacion.modoTiempo === 'FIJO'
          ? Number(operacion.minutosFijos)
          : cantidadResuelta * Number(operacion.minutosPorUnidad);
      if (!Number.isFinite(duracionMin) || duracionMin <= 0) {
        throw new BadRequestException(
          `El tiempo de "${operacion.nombre}" debe ser mayor que cero.`,
        );
      }
      return {
        ...operacion,
        componenteCodigo: args.componenteCodigo,
        componenteNombre: args.componenteNombre,
        nodoDestinoClave,
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

function leerRuta(root: Record<string, unknown>, path: string): unknown {
  const normalizada = path
    .replace(/^padre\./, '')
    .replace(/^medidas\.ancho$/, 'medidaCustomMm.anchoMm')
    .replace(/^medidas\.alto$/, 'medidaCustomMm.altoMm');
  return normalizada.split('.').reduce<unknown>((value, key) => {
    return esRegistro(value) ? value[key] : undefined;
  }, root);
}

function escribirRuta(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const partes = path.split('.').filter(Boolean);
  let cursor = root;
  partes.forEach((parte, index) => {
    if (index === partes.length - 1) {
      cursor[parte] = value;
      return;
    }
    if (!esRegistro(cursor[parte])) cursor[parte] = {};
    cursor = cursor[parte] as Record<string, unknown>;
  });
}

function evaluarFormula(
  expresion: string,
  padre: Record<string, unknown>,
): number {
  const tokens = expresion.match(
    /padre\.[A-Za-z0-9_.]+|\d+(?:\.\d+)?|[()+\-*/]/g,
  );
  if (
    !tokens ||
    tokens.join('').replace(/\s/g, '') !== expresion.replace(/\s/g, '')
  ) {
    throw new BadRequestException(
      `La fórmula "${expresion}" contiene símbolos no admitidos.`,
    );
  }
  let pos = 0;
  const primario = (): number => {
    const token = tokens[pos++];
    if (token === '(') {
      const value = suma();
      if (tokens[pos++] !== ')') throw new Error('Falta cerrar un paréntesis');
      return value;
    }
    if (token === '-') return -primario();
    if (token?.startsWith('padre.')) {
      const value = Number(leerRuta(padre, token));
      if (!Number.isFinite(value)) throw new Error(`No existe ${token}`);
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value))
      throw new Error(`Valor inválido: ${token ?? ''}`);
    return value;
  };
  const producto = (): number => {
    let value = primario();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const next = primario();
      value = op === '*' ? value * next : value / next;
    }
    return value;
  };
  const suma = (): number => {
    let value = producto();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const next = producto();
      value = op === '+' ? value + next : value - next;
    }
    return value;
  };
  try {
    const value = suma();
    if (pos !== tokens.length || !Number.isFinite(value))
      throw new Error('Fórmula incompleta');
    return value;
  } catch (error) {
    throw new BadRequestException(
      `No se pudo resolver la fórmula "${expresion}": ${error instanceof Error ? error.message : 'expresión inválida'}.`,
    );
  }
}

function proporcionSvg(svg: unknown): number | null {
  if (typeof svg !== 'string') return null;
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  const viewBox = root?.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!viewBox) return null;
  const values = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = values[2];
  const height = values[3];
  return Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? height / width
    : null;
}

function completarGeometria(jobContext: Record<string, unknown>): void {
  const fuenteVectorial = jobContext.disenoVectorialFuente;
  if (esRegistro(fuenteVectorial)) {
    const anchoFuenteMm = Number(fuenteVectorial.anchoFinalMm);
    const altoDeclaradoMm = Number(fuenteVectorial.altoFinalMm);
    const proporcion = proporcionSvg(fuenteVectorial.svg);
    const altoFuenteMm =
      altoDeclaradoMm > 0
        ? altoDeclaradoMm
        : anchoFuenteMm > 0 && proporcion
          ? anchoFuenteMm * proporcion
          : Number.NaN;
    if (anchoFuenteMm > 0 && altoFuenteMm > 0) {
      jobContext.medidaCustomMm = {
        ...(esRegistro(jobContext.medidaCustomMm)
          ? jobContext.medidaCustomMm
          : {}),
        anchoMm: anchoFuenteMm,
        altoMm: altoFuenteMm,
      };
    }
  }

  const medida = jobContext.medidaCustomMm;
  const cantidad = Number(jobContext.cantidad);
  if (!esRegistro(medida) || !Number.isFinite(cantidad) || cantidad <= 0)
    return;
  const anchoMm = Number(medida.anchoMm);
  const altoMm = Number(medida.altoMm);
  if (!(anchoMm > 0) || !(altoMm > 0)) return;
  jobContext.piezas = [{ cantidad, anchoMm, altoMm }];
  jobContext.piezaAnchoMaxMm = anchoMm;
  jobContext.piezaAltoMaxMm = altoMm;
  jobContext.piezaAreaTotalM2 = (anchoMm * altoMm * cantidad) / 1_000_000;
  jobContext.piezaPerimetroTotalM =
    ((2 * (anchoMm + altoMm)) / 1_000) * cantidad;
}

export function resolverJobContextComponente(args: {
  configuracion: unknown;
  contextoPadre: Record<string, unknown>;
  codigoComponente: string;
  cantidadLegacy: number;
  outputsComponentes?: Record<string, Record<string, unknown>>;
  /** Valores propios de una ocurrencia dinámica de la misma plantilla. */
  overrideCotizacion?: Record<string, unknown>;
}): Record<string, unknown> {
  const config = leerConfiguracionComponente(args.configuracion);
  if (!config || config.bindings.length === 0) {
    return {
      cantidad: Number(args.contextoPadre.cantidad ?? 1) * args.cantidadLegacy,
    };
  }
  const overridesRaiz = esRegistro(args.contextoPadre.componentesConfiguracion)
    ? args.contextoPadre.componentesConfiguracion
    : {};
  const overrides =
    args.overrideCotizacion ??
    (esRegistro(overridesRaiz[args.codigoComponente])
      ? (overridesRaiz[args.codigoComponente] as Record<string, unknown>)
      : {});
  const resultado: Record<string, unknown> = {};
  const outputsComponentes = args.outputsComponentes ?? {};
  const faltantes: Array<{ clave: string; etiqueta: string }> = [];
  for (const binding of config.bindings) {
    let value: unknown;
    if (binding.origen === 'DEFAULT_HIJO' || binding.origen === 'FIJO') {
      value = binding.valor;
    } else if (binding.origen === 'PADRE') {
      value = binding.regla
        ? resolverRegla(binding.regla, args.contextoPadre, outputsComponentes)
        : binding.padreClave
          ? leerRuta(args.contextoPadre, binding.padreClave)
          : undefined;
    } else if (binding.origen === 'FORMULA') {
      value = binding.regla
        ? resolverRegla(binding.regla, args.contextoPadre, outputsComponentes)
        : binding.expresion
          ? evaluarFormula(binding.expresion, args.contextoPadre)
          : undefined;
    } else {
      value = leerRuta(overrides, binding.clave);
      if (value === undefined) value = binding.valor;
    }
    if (value === undefined || value === null || value === '') {
      if (binding.requerido !== false)
        faltantes.push({
          clave: binding.clave,
          etiqueta: binding.etiqueta ?? binding.clave,
        });
      continue;
    }
    if (
      binding.clave === 'disenoVectorialFuente' &&
      !esFuenteVectorialValida(value)
    ) {
      throw new BadRequestException(
        `El diseño vectorial del componente "${args.codigoComponente}" no es válido.`,
      );
    }
    escribirRuta(resultado, binding.clave, value);
  }
  // Un SVG dimensionado define su caja final. Ancho y alto del componente se
  // derivan de esa geometría y no deben volver a exigirse como datos paralelos.
  completarGeometria(resultado);
  const faltantesReales = faltantes.filter(
    (item) => leerRuta(resultado, item.clave) == null,
  );
  if (faltantesReales.length) {
    throw new BadRequestException(
      `Falta configurar ${faltantesReales.map((item) => item.etiqueta).join(', ')} del componente "${args.codigoComponente}".`,
    );
  }
  return resultado;
}

function textoValorEfectivo(
  binding: BindingParametroComponente,
  valor: unknown,
): string {
  const opcion = binding.opciones?.find(
    (item) => String(item.valor) === String(valor),
  );
  if (opcion) return opcion.etiqueta;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 4,
    }).format(valor);
  }
  if (typeof valor === 'string') return valor;
  return '';
}

/**
 * Convierte el contrato BOM + el JobContext ya resuelto en especificaciones
 * efectivas. Se ejecuta después de resolver herencias, fórmulas y overrides de
 * cotización, por lo que describe exactamente lo que el motor costeó.
 */
export function proyectarEspecificacionesEfectivasComponente(args: {
  configuracion: unknown;
  jobContext: Record<string, unknown>;
}): EspecificacionEfectivaComponente[] {
  const config = leerConfiguracionComponente(args.configuracion);
  if (!config) return [];

  return config.bindings.flatMap((binding) => {
    const valor = leerRuta(args.jobContext, binding.clave);
    if (valor === undefined || valor === null || valor === '') return [];
    return [
      {
        clave: binding.clave,
        // Los consumidores nunca deben caer en la clave técnica o un UUID.
        etiqueta: binding.etiqueta?.trim() || 'Parámetro',
        tipoDato: binding.tipoDato?.trim() || typeof valor,
        unidad: binding.unidad ?? null,
        requerido: binding.requerido !== false,
        origen: binding.origen,
        valor,
        valorTexto: textoValorEfectivo(binding, valor),
      },
    ];
  });
}

export function validarConfiguracionComponente(
  value: unknown,
  nombre: string,
): void {
  if (value == null) return;
  const config = leerConfiguracionComponente(value);
  if (!config) {
    throw new BadRequestException(
      `La configuración de "${nombre}" no tiene un formato válido.`,
    );
  }
  const claves = new Set<string>();
  for (const binding of config.bindings) {
    if (claves.has(binding.clave)) {
      throw new BadRequestException(
        `El parámetro ${binding.clave} está duplicado en "${nombre}".`,
      );
    }
    claves.add(binding.clave);
    if (binding.origen === 'PADRE' && !binding.padreClave && !binding.regla) {
      throw new BadRequestException(
        `El parámetro ${binding.clave} de "${nombre}" no indica qué dato hereda.`,
      );
    }
    if (binding.origen === 'FORMULA' && !binding.expresion && !binding.regla) {
      throw new BadRequestException(
        `El parámetro ${binding.clave} de "${nombre}" no tiene fórmula.`,
      );
    }
  }
  if (!claves.has('cantidad')) {
    throw new BadRequestException(
      `La configuración de "${nombre}" debe resolver la cantidad del componente.`,
    );
  }
  const codigosOperacion = new Set<string>();
  for (const operacion of config.operacionesIncorporacion ?? []) {
    const codigo = operacion.codigo.trim().toLowerCase();
    if (codigosOperacion.has(codigo)) {
      throw new BadRequestException(
        `La operación "${operacion.nombre}" está duplicada en "${nombre}".`,
      );
    }
    codigosOperacion.add(codigo);
    if (Number(operacion.dotacionOperarios ?? 1) < 1) {
      throw new BadRequestException(
        `La dotación de "${operacion.nombre}" debe ser al menos una persona.`,
      );
    }
  }
}

export function dependenciasCalculoComponente(
  configuracion: unknown,
): string[] {
  const config = leerConfiguracionComponente(configuracion);
  if (!config) return [];
  return [
    ...new Set(
      config.bindings.flatMap((binding) => {
        const fuente = binding.regla?.fuente;
        return fuente?.tipo === 'COMPONENTE' && fuente.componenteCodigo
          ? [fuente.componenteCodigo]
          : [];
      }),
    ),
  ];
}

export function ordenarComponentesPorCalculo<
  T extends {
    codigo: string;
    nombre: string;
    requerido?: boolean;
    configuracionJson?: unknown;
    orden?: number;
  },
>(componentes: T[]): T[] {
  const porCodigo = new Map(componentes.map((item) => [item.codigo, item]));
  const dependencias = new Map<string, string[]>();
  for (const item of componentes) {
    const deps = dependenciasCalculoComponente(item.configuracionJson);
    for (const codigo of deps) {
      const origen = porCodigo.get(codigo);
      if (!origen) {
        throw new BadRequestException(
          `El componente "${item.nombre}" usa outputs de "${codigo}", que no existe en esta receta.`,
        );
      }
      if (codigo === item.codigo) {
        throw new BadRequestException(
          `El componente "${item.nombre}" no puede depender de sus propios outputs.`,
        );
      }
      if (item.requerido !== false && origen.requerido === false) {
        throw new BadRequestException(
          `El componente requerido "${item.nombre}" no puede depender del componente opcional "${origen.nombre}".`,
        );
      }
    }
    dependencias.set(item.codigo, deps);
  }

  const pendientes = new Map(porCodigo);
  const resueltos = new Set<string>();
  const resultado: T[] = [];
  while (pendientes.size > 0) {
    const disponibles = [...pendientes.values()]
      .filter((item) =>
        (dependencias.get(item.codigo) ?? []).every((dep) =>
          resueltos.has(dep),
        ),
      )
      .sort(
        (a, b) =>
          Number(a.orden ?? 0) - Number(b.orden ?? 0) ||
          a.codigo.localeCompare(b.codigo),
      );
    if (disponibles.length === 0) {
      throw new BadRequestException(
        `La composición contiene un ciclo de cálculo entre: ${[
          ...pendientes.values(),
        ]
          .map((item) => item.nombre)
          .join(', ')}.`,
      );
    }
    for (const item of disponibles) {
      pendientes.delete(item.codigo);
      resueltos.add(item.codigo);
      resultado.push(item);
    }
  }
  return resultado;
}
