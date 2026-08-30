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
  version: 1;
  bindings: BindingParametroComponente[];
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

export function leerConfiguracionComponente(
  value: unknown,
): ConfiguracionComponenteFabricado | null {
  if (
    !esRegistro(value) ||
    value.version !== 1 ||
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
  return { version: 1, bindings };
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

function completarGeometria(jobContext: Record<string, unknown>): void {
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
  const overrides = esRegistro(overridesRaiz[args.codigoComponente])
    ? (overridesRaiz[args.codigoComponente] as Record<string, unknown>)
    : {};
  const resultado: Record<string, unknown> = {};
  const outputsComponentes = args.outputsComponentes ?? {};
  const faltantes: string[] = [];
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
        faltantes.push(binding.etiqueta ?? binding.clave);
      continue;
    }
    escribirRuta(resultado, binding.clave, value);
  }
  if (faltantes.length) {
    throw new BadRequestException(
      `Falta configurar ${faltantes.join(', ')} del componente "${args.codigoComponente}".`,
    );
  }
  completarGeometria(resultado);
  return resultado;
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
