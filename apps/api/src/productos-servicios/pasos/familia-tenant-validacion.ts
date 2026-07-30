/**
 * LA única puerta de escritura de una FamiliaTenant (pasos componibles,
 * Etapa C — docs/pasos-componibles-plan-tecnico.md C.1).
 *
 * Valida que la forma compuesta por el tenant sea una que el motor ya sabe
 * costear: vocabularios cerrados de types.ts + reglas de coherencia entre
 * ejes. El wizard del front reusa los mismos mensajes; el service NO
 * persiste nada que no haya pasado por acá.
 *
 * El plan pedía zod; el repo no lo tiene (usa class-validator) y un
 * validador puro da las mismas garantías sin dependencia nueva — y se
 * testea igual de fácil.
 */
import { PlantillaMaquinaria } from '@prisma/client';
import {
  ALIAS_LEGACY,
  CAPACIDADES,
  capacidadesDeForma,
  formaEmisionDeFamiliaTenant,
} from './capacidades';
import { CATEGORIAS } from './categorias';
import { FAMILIAS } from './familias';
import { MODOS_ACTIVACION_UNIVERSALES } from './types';
import type {
  DefinicionFamiliaResuelta,
  MecanismoCantidad,
  ModoActivacion,
  ModoRegistroPaso,
  ModoTiempo,
  RelacionMaquina,
  SlotDeclarado,
  TipoSlot,
} from './types';

/** Lo que el tenant declara. Espeja la forma de DefinicionFamilia. */
export interface FamiliaTenantInput {
  nombre: string;
  descripcion?: string | null;
  categoria: string;
  relacionMaquina: string[];
  modosTiempo: string[];
  mecanismosCantidad: string[];
  modosActivacion?: string[];
  modoActivacionDefault?: string;
  slots?: SlotTenantInput[];
  multiplicadores?: string[];
  plantillasCompatibles?: string[];
  tiposPerfilCompatibles?: string[];
  inputsRequeridos?: string[];
  outputsCanonicos?: string[];
  modoRegistro?: string | null;
  presetOrigen?: string | null;
  /** B.3.4 — el paso acomoda piezas: superficie elegida en el wizard.
   *  Presente ⇔ mecanismo CALCULADO_POR_PASO. */
  nestingConfig?: { superficie?: string | null } | null;
}

const SUPERFICIES_NESTING = ['pliego', 'pliegos_multiples', 'rollo'];
/** Espejo del enum FamiliaMateriaPrima (schema.prisma). El slot tenant sólo
 *  puede filtrar por familia; las subfamilias siguen siendo del sistema. */
const FAMILIAS_MATERIA_PRIMA = [
  'SUSTRATO',
  'TINTA_COLORANTE',
  'TRANSFERENCIA_LAMINACION',
  'QUIMICO_AUXILIAR',
  'ADITIVA_3D',
  'ELECTRONICA_CARTELERIA',
  'NEON_LUMINARIA',
  'METAL_ESTRUCTURA',
  'PINTURA_RECUBRIMIENTO',
  'TERMINACION_EDITORIAL',
  'MAGNETICO_FIJACION',
  'POP_EXHIBIDOR',
  'HERRAJE_ACCESORIO',
  'ADHESIVO_TECNICO',
  'PACKING_INSTALACION',
  'SELLOS',
];

export interface SlotTenantInput {
  codigo: string;
  nombre: string;
  tipo: string;
  requerido: boolean;
  /** Filtro de materias primas que el slot acepta. Sin esto, el editor de
   *  rutas deja enchufar cualquier material (tinta en un slot de papel). */
  compatibilidadMaterial?: { familiasMateriaPrima?: string[] };
}

const RELACIONES: RelacionMaquina[] = ['M-0', 'M-1', 'M-2'];
const MODOS_TIEMPO: ModoTiempo[] = ['T-1', 'T-2', 'T-3', 'T-4'];
/** CALCULADO_POR_PASO es geometría (nesting): frontera del sistema, el
 *  tenant no puede declararlo (diseño §4.2). */
const MECANISMOS_COMPONIBLES: MecanismoCantidad[] = [
  'DIRECT_FROM_JOBCONTEXT',
  'HEREDAR_DEL_OUTPUT_CANONICO',
  'CONVERSION',
];
const TIPOS_SLOT: TipoSlot[] = [
  'SUSTRATO',
  'CONSUMIBLE_MAQUINA',
  'INSUMO_PASO',
  'TAPA',
  'OTRO',
];
const MODOS_REGISTRO: ModoRegistroPaso[] = ['cronometro', 'solo_completar'];
const TIPOS_PERFIL = ['IMPRESION', 'CORTE', 'MIXTO'];
/** Multiplicadores que una familia TENANT puede declarar: son los que el
 *  cotizador siempre pone en el JobContext, así que siempre tienen un valor
 *  real. Los del catálogo que dependen de params propios (hojasPorLibro,
 *  perforacionesPorPieza, cantidadModificacionesPorPieza) NO se aceptan acá:
 *  se guardarían y no multiplicarían nunca. */
const MULTIPLICADORES_TENANT = ['caras', 'tipoCopia'];

function fueraDe(valores: string[], validos: readonly string[]): string[] {
  return valores.filter((v) => !validos.includes(v));
}

/** Devuelve la lista de errores humanos. Vacía = la forma es válida. */
export function validarDefinicionFamiliaTenant(
  input: FamiliaTenantInput,
): string[] {
  const errores: string[] = [];

  const nombre = input.nombre?.trim() ?? '';
  if (!nombre) errores.push('El nombre es obligatorio.');
  if (nombre.length > 80)
    errores.push('El nombre no puede superar 80 caracteres.');

  if (!Object.keys(CATEGORIAS).includes(input.categoria)) {
    errores.push(
      `Categoría desconocida: "${input.categoria}". Válidas: ${Object.keys(CATEGORIAS).join(', ')}.`,
    );
  }

  // --- relación con máquina ---
  const relacion = input.relacionMaquina ?? [];
  if (relacion.length === 0) {
    errores.push('relacionMaquina no puede estar vacía (M-0, M-1 o M-2).');
  }
  for (const v of fueraDe(relacion, RELACIONES)) {
    errores.push(`Relación con máquina desconocida: "${v}".`);
  }
  const sinMaquina = relacion.length > 0 && relacion.every((r) => r === 'M-0');
  const conMaquina = relacion.some((r) => r === 'M-1' || r === 'M-2');

  // --- tiempo ---
  const tiempos = input.modosTiempo ?? [];
  if (tiempos.length === 0) {
    errores.push('modosTiempo no puede estar vacío (T-1 a T-4).');
  }
  for (const v of fueraDe(tiempos, MODOS_TIEMPO)) {
    errores.push(`Modo de tiempo desconocido: "${v}".`);
  }
  if (sinMaquina && tiempos.includes('T-3')) {
    errores.push(
      'T-3 (productividad del perfil de máquina) requiere que el paso use máquina (M-1/M-2).',
    );
  }

  // --- cantidad ---
  const mecanismos = input.mecanismosCantidad ?? [];
  if (mecanismos.length === 0) {
    errores.push('mecanismosCantidad no puede estar vacío.');
  }
  // --- nesting (B.3.4) ---
  // La frontera se relaja SOLO por elección: con superficie declarada, el
  // paso adquiere CALCULADO_POR_PASO (elige NUESTRO algoritmo, nunca
  // escribe uno). Sin superficie, la prohibición histórica sigue.
  const superficie = input.nestingConfig?.superficie ?? null;
  if (superficie !== null && !SUPERFICIES_NESTING.includes(superficie)) {
    errores.push(
      `Superficie de acomodo desconocida: "${superficie}". Opciones: ${SUPERFICIES_NESTING.join(', ')}.`,
    );
  }
  const acomoda = superficie !== null && SUPERFICIES_NESTING.includes(superficie);
  if (acomoda && !mecanismos.includes('CALCULADO_POR_PASO')) {
    errores.push(
      'Un paso que acomoda piezas calcula su propia cantidad: mecanismosCantidad tiene que incluir CALCULADO_POR_PASO.',
    );
  }
  if (mecanismos.includes('CALCULADO_POR_PASO') && !acomoda) {
    errores.push(
      'CALCULADO_POR_PASO implica un algoritmo de geometría (nesting): declaralo eligiendo una superficie de acomodo (nestingConfig.superficie) — o usá DIRECT_FROM_JOBCONTEXT, HEREDAR_DEL_OUTPUT_CANONICO o CONVERSION.',
    );
  }
  for (const v of fueraDe(mecanismos, [
    ...MECANISMOS_COMPONIBLES,
    'CALCULADO_POR_PASO',
  ])) {
    errores.push(`Mecanismo de cantidad desconocido: "${v}".`);
  }

  // --- activación ---
  const activaciones = input.modosActivacion ?? [
    ...MODOS_ACTIVACION_UNIVERSALES,
  ];
  for (const v of fueraDe(activaciones, MODOS_ACTIVACION_UNIVERSALES)) {
    errores.push(`Modo de activación desconocido: "${v}".`);
  }
  const activacionDefault = input.modoActivacionDefault ?? 'OPCIONAL';
  if (!activaciones.includes(activacionDefault)) {
    errores.push(
      `El modo de activación default (${activacionDefault}) tiene que estar entre los soportados (${activaciones.join(', ')}).`,
    );
  }

  // --- slots ---
  const slots = input.slots ?? [];
  const codigosSlot = new Set<string>();
  for (const slot of slots) {
    if (!slot.codigo?.trim()) errores.push('Todos los slots necesitan código.');
    else if (codigosSlot.has(slot.codigo)) {
      errores.push(`Slot duplicado: "${slot.codigo}".`);
    } else codigosSlot.add(slot.codigo);
    if (!slot.nombre?.trim()) {
      errores.push(`El slot "${slot.codigo}" necesita nombre.`);
    }
    if (!TIPOS_SLOT.includes(slot.tipo as TipoSlot)) {
      errores.push(
        `Tipo de slot desconocido en "${slot.codigo}": "${slot.tipo}".`,
      );
    }
    for (const fam of fueraDe(
      slot.compatibilidadMaterial?.familiasMateriaPrima ?? [],
      FAMILIAS_MATERIA_PRIMA,
    )) {
      errores.push(
        `Familia de material desconocida en el slot "${slot.codigo}": "${fam}".`,
      );
    }
    if (slot.tipo === 'CONSUMIBLE_MAQUINA' && !conMaquina) {
      errores.push(
        `El slot "${slot.codigo}" es CONSUMIBLE_MAQUINA pero el paso no usa máquina.`,
      );
    }
  }

  // --- plantillas de máquina ---
  const plantillas = input.plantillasCompatibles ?? [];
  const plantillasValidas = Object.keys(PlantillaMaquinaria);
  for (const v of fueraDe(plantillas, plantillasValidas)) {
    errores.push(`Plantilla de máquina desconocida: "${v}".`);
  }

  // --- outputs (B.3.2) ---
  // El vocabulario es del Registro de Capacidades; el service DERIVA los
  // outputs de la forma antes de validar, así que desde ese camino esto es
  // un invariante. Protege a quien use el validador directo.
  for (const key of input.outputsCanonicos ?? []) {
    if (!(key in CAPACIDADES) && !(key in ALIAS_LEGACY)) {
      errores.push(
        `Output desconocido: "${key}". Los outputs se derivan de la forma del paso, no se declaran a mano.`,
      );
    }
  }
  if (conMaquina && plantillas.length === 0) {
    errores.push(
      'Un paso con máquina (M-1/M-2) necesita al menos una plantilla compatible — sin eso ninguna máquina puede ejecutarlo.',
    );
  }
  if (sinMaquina && plantillas.length > 0) {
    errores.push('Un paso sin máquina (M-0) no lleva plantillas compatibles.');
  }

  // --- multiplicadores ---
  for (const v of fueraDe(input.multiplicadores ?? [], MULTIPLICADORES_TENANT)) {
    errores.push(
      `Multiplicador no disponible para pasos propios: "${v}". Se puede usar: ${MULTIPLICADORES_TENANT.join(', ')}.`,
    );
  }

  // --- perfiles ---
  for (const v of fueraDe(input.tiposPerfilCompatibles ?? [], TIPOS_PERFIL)) {
    errores.push(`Tipo de perfil desconocido: "${v}".`);
  }

  // --- registro en tablero ---
  if (
    input.modoRegistro != null &&
    !MODOS_REGISTRO.includes(input.modoRegistro as ModoRegistroPaso)
  ) {
    errores.push(`Modo de registro desconocido: "${input.modoRegistro}".`);
  }

  // --- preset ---
  if (input.presetOrigen != null && !(input.presetOrigen in FAMILIAS)) {
    errores.push(`Preset de origen desconocido: "${input.presetOrigen}".`);
  }

  return errores;
}

/**
 * Proyecta una fila de FamiliaTenant (ya validada al escribirse) a la
 * interfaz que consume el motor. `codigo` = el UUID de la fila.
 */
/**
 * B.3.2 — Los outputs de una familia tenant se DERIVAN de su forma (el
 * usuario nunca los escribe). Hoy: unidades + minutos siempre, + grupos si
 * soporta CONVERSION. En B.3.4 la superficie de nesting suma su set.
 */
export function derivarOutputsTenant(input: {
  mecanismosCantidad?: readonly string[];
  nestingConfig?: { superficie?: string | null } | null;
}): string[] {
  return capacidadesDeForma(formaEmisionDeFamiliaTenant(input));
}

export function proyectarFamiliaTenant(row: {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  relacionMaquina: unknown;
  modosTiempo: unknown;
  mecanismosCantidad: unknown;
  modosActivacion: unknown;
  modoActivacionDefault: string;
  slots: unknown;
  multiplicadores: unknown;
  plantillasCompatibles: unknown;
  tiposPerfilCompatibles: unknown;
  inputsRequeridos: unknown;
  outputsCanonicos: unknown;
  validaciones: unknown;
  permiteSlotsAdicionales: boolean;
  modoRegistro: string | null;
  nestingConfigJson?: unknown;
  activo: boolean;
}): DefinicionFamiliaResuelta {
  const nestingRaw = row.nestingConfigJson as {
    superficie?: string;
  } | null;
  const nestingConfig =
    nestingRaw &&
    typeof nestingRaw === 'object' &&
    typeof nestingRaw.superficie === 'string' &&
    SUPERFICIES_NESTING.includes(nestingRaw.superficie)
      ? {
          superficie: nestingRaw.superficie as
            | 'pliego'
            | 'pliegos_multiples'
            | 'rollo',
        }
      : null;
  return {
    codigo: row.id,
    nombre: row.nombre,
    categoria: row.categoria as DefinicionFamiliaResuelta['categoria'],
    descripcion: row.descripcion ?? undefined,
    relacionMaquinaSoportada: (row.relacionMaquina as RelacionMaquina[]) ?? [],
    modosTiempoSoportados: (row.modosTiempo as ModoTiempo[]) ?? [],
    mecanismosCantidadSoportados:
      (row.mecanismosCantidad as MecanismoCantidad[]) ?? [],
    modosActivacionSoportados: (row.modosActivacion as ModoActivacion[]) ?? [],
    modoActivacionDefault: row.modoActivacionDefault as ModoActivacion,
    multiplicadoresSoportados: (row.multiplicadores as string[]) ?? [],
    slotsRequeridos: (row.slots as SlotDeclarado[]) ?? [],
    permiteSlotsAdicionales: row.permiteSlotsAdicionales,
    plantillasCompatibles: (row.plantillasCompatibles as string[]) ?? [],
    tiposPerfilCompatibles:
      (row.tiposPerfilCompatibles as string[] | null) ?? undefined,
    inputsRequeridos: (row.inputsRequeridos as string[]) ?? [],
    outputsCanonicos: (row.outputsCanonicos as string[]) ?? [],
    nestingConfig,
    validaciones:
      (row.validaciones as DefinicionFamiliaResuelta['validaciones']) ?? [],
    // Los params declarados son autoría del sistema (formularios ricos por
    // familia); una familia compuesta no los tiene en v1.
    paramsPasoSchema: [],
    modoRegistro: (row.modoRegistro as ModoRegistroPaso | null) ?? undefined,
    esDeTenant: true,
    tenantId: row.tenantId,
    activo: row.activo,
  };
}
