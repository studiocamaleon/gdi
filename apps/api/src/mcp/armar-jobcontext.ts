/**
 * Traducción respuestas → jobContext, con la validación que el motor NO hace.
 *
 * El motor recibe `jobContext` como `@IsObject()` a secas y DESCARTA EN
 * SILENCIO las claves que no conoce o no están whitelisteadas: un typo de la
 * IA no da error, da una cotización mal calculada. Y una pieza 0×0 dispara
 * división por cero en el nesting de rígidos y tumba el API por OOM (guard
 * que hoy vive sólo en el sheet, L2319). Esta capa es el único punto donde
 * un consumidor externo se valida ANTES de llegar al motor.
 *
 * Entrada: el formulario derivado (formulario-cotizacion.service) + las
 * respuestas de la IA keyed por el MISMO `jobContextKey` que el formulario
 * declaró. Salida: el jobContext que el sheet hubiera armado.
 *
 * Falla con mensajes accionables: la IA los lee y se auto-corrige.
 */

export class RespuestasInvalidasError extends Error {}

type Pregunta = Record<string, unknown> & {
  tipo: string;
  jobContextKey: string;
};

export interface FormularioParaJobContext {
  producto: { nombre: string };
  medidas: {
    instruccion: string;
    predefinidas: Array<{
      id: string;
      nombre: string;
      anchoMm: number;
      altoMm: number;
      esDefault: boolean;
    }>;
    default: { anchoMm: number; altoMm: number } | null;
  };
  cantidad: {
    minimo: {
      politica: string;
      cantidad: number | null;
      base: string | null;
    } | null;
  };
  preguntas: Pregunta[];
  multiplicadores: Array<Record<string, unknown>>;
  adicionales: Array<Record<string, unknown>>;
  personalizaciones: Array<Record<string, unknown>>;
}

export interface CotizarInputMcp {
  cantidad: number;
  anchoMm?: number;
  altoMm?: number;
  medidaPredefinidaId?: string;
  /** Respuestas keyed por el jobContextKey que declaró el formulario. */
  respuestas?: Record<string, unknown>;
  /** IDs de adicionales a activar (del bloque `adicionales` del formulario). */
  adicionales?: string[];
}

function fail(mensaje: string): never {
  throw new RespuestasInvalidasError(mensaje);
}

function asNumber(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function armarJobContext(
  formulario: FormularioParaJobContext,
  input: CotizarInputMcp,
): Record<string, unknown> {
  const jobContext: Record<string, unknown> = {};
  const respuestas = { ...(input.respuestas ?? {}) };

  // ── Cantidad ─────────────────────────────────────────────────────────
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    fail('`cantidad` debe ser un entero mayor a 0.');
  }
  const minimo = formulario.cantidad.minimo;
  if (
    minimo?.politica === 'BLOQUEAR' &&
    minimo.cantidad != null &&
    minimo.base !== 'pliegos_impresos' &&
    input.cantidad < minimo.cantidad
  ) {
    fail(
      `"${formulario.producto.nombre}" tiene un mínimo de ${minimo.cantidad}: ` +
        `cotizá al menos esa cantidad.`,
    );
  }
  jobContext.cantidad = input.cantidad;

  // ── Medidas (guard anti-OOM: jamás una pieza sin medida positiva) ────
  const medida = resolverMedida(formulario, input);
  if (medida) {
    jobContext.piezas = [
      { cantidad: input.cantidad, anchoMm: medida.anchoMm, altoMm: medida.altoMm },
    ];
    jobContext.medidaCustomMm = {
      anchoMm: medida.anchoMm,
      altoMm: medida.altoMm,
    };
    const areaM2 = (medida.anchoMm * medida.altoMm) / 1_000_000;
    jobContext.piezaAnchoMaxMm = medida.anchoMm;
    jobContext.piezaAltoMaxMm = medida.altoMm;
    jobContext.piezaAreaTotalM2 = areaM2 * input.cantidad;
    jobContext.piezaPerimetroTotalM =
      ((2 * (medida.anchoMm + medida.altoMm)) / 1000) * input.cantidad;
  }

  // ── Índice de preguntas por jobContextKey ────────────────────────────
  // (las personalizaciones van aparte: su respuesta es medida/activación y
  // producen área + piezas, no un passthrough de clave)
  const porKey = new Map<string, Pregunta>();
  for (const p of formulario.preguntas) {
    if (p.jobContextKey) porKey.set(p.jobContextKey, p);
  }
  for (const m of formulario.multiplicadores) {
    porKey.set(String(m.jobContextKey), {
      tipo: 'multiplicador',
      ...m,
      jobContextKey: String(m.jobContextKey),
    });
  }
  const persPorKey = new Map(
    formulario.personalizaciones.map((p) => [String(p.jobContextKey), p]),
  );

  // ── Respuestas: cada clave tiene que existir en el formulario ────────
  // (el motor las descartaría en silencio; acá es un error explícito)
  for (const key of Object.keys(respuestas)) {
    if (!porKey.has(key) && !persPorKey.has(key)) {
      fail(
        `"${key}" no es una pregunta de este producto. Claves válidas: ` +
          `${[...porKey.keys(), ...persPorKey.keys()].join(', ') || '(ninguna)'}.`,
      );
    }
  }

  // ── Aplicar cada pregunta (respuesta → validación → jobContext) ──────
  const faltantes: string[] = [];
  for (const [key, pregunta] of porKey) {
    const valor = respuestas[key];
    aplicarPregunta(jobContext, pregunta, key, valor, faltantes);
  }
  aplicarPersonalizaciones(
    jobContext,
    formulario,
    respuestas,
    input.cantidad,
    // Medida propia: la que respondió el usuario, o la default que el motor
    // sintetiza solo. Sólo sin NINGUNA de las dos las piezas salen de las
    // estampas (taza/remera), igual que la cascada del sheet.
    medida !== null || formulario.medidas.default !== null,
    faltantes,
  );
  if (faltantes.length) {
    fail(
      `Faltan respuestas obligatorias: ${faltantes.join('; ')}. ` +
        `Preguntáselas al usuario antes de cotizar.`,
    );
  }

  // ── Tercerizado: el eje `cantidad` lo completa el sistema, no la IA ──
  // (mismo comportamiento que el sheet: qty entra como valor del eje)
  for (const [key, valor] of Object.entries(jobContext)) {
    if (key.startsWith('tercerizado_') && typeof valor === 'object' && valor) {
      const grupo = valor as Record<string, unknown>;
      if (grupo.cantidad === undefined) grupo.cantidad = input.cantidad;
    }
  }

  // ── Adicionales ──────────────────────────────────────────────────────
  if (input.adicionales?.length) {
    const activables = new Map(
      formulario.adicionales
        .filter((a) => a.tipo !== 'paso_condicional')
        .map((a) => [String(a.id), a]),
    );
    const opcionales: Record<string, boolean> = {
      ...(jobContext.opcionalesActivados as Record<string, boolean> | undefined),
    };
    for (const id of input.adicionales) {
      if (!activables.has(id)) {
        fail(
          `El adicional "${id}" no existe en este producto. Disponibles: ` +
            `${[...activables.values()].map((a) => `${a.id} (${a.nombre})`).join(', ') || '(ninguno)'}.`,
        );
      }
      opcionales[id] = true;
    }
    jobContext.opcionalesActivados = opcionales;
  }

  return jobContext;
}

function resolverMedida(
  formulario: FormularioParaJobContext,
  input: CotizarInputMcp,
): { anchoMm: number; altoMm: number } | null {
  const { instruccion, predefinidas } = formulario.medidas;
  if (instruccion === 'no_preguntar') return null; // el motor sintetiza

  const custom =
    input.anchoMm !== undefined || input.altoMm !== undefined
      ? { anchoMm: asNumber(input.anchoMm), altoMm: asNumber(input.altoMm) }
      : null;

  if (custom) {
    if (
      custom.anchoMm === null ||
      custom.altoMm === null ||
      custom.anchoMm <= 0 ||
      custom.altoMm <= 0
    ) {
      fail(
        '`anchoMm` y `altoMm` deben ser números mayores a 0 (en milímetros). ' +
          'Una medida en 0 no es cotizable.',
      );
    }
    if (instruccion === 'elegir_predefinida') {
      fail(
        'Este producto no acepta medida libre: elegí una predefinida con ' +
          `\`medidaPredefinidaId\` (${predefinidas.map((m) => `${m.id}: ${m.nombre}`).join(', ')}).`,
      );
    }
    return { anchoMm: custom.anchoMm, altoMm: custom.altoMm };
  }

  if (input.medidaPredefinidaId) {
    const elegida = predefinidas.find((m) => m.id === input.medidaPredefinidaId);
    if (!elegida) {
      fail(
        `La medida "${input.medidaPredefinidaId}" no existe. Opciones: ` +
          `${predefinidas.map((m) => `${m.id}: ${m.nombre}`).join(', ')}.`,
      );
    }
    return { anchoMm: elegida.anchoMm, altoMm: elegida.altoMm };
  }

  if (instruccion === 'pedir_ancho_alto') {
    fail(
      'Este producto se cotiza por medida: mandá `anchoMm` y `altoMm` en ' +
        'milímetros (preguntale la medida al usuario).',
    );
  }

  // elegir_predefinida / predefinida_o_custom sin elección → default.
  const def =
    predefinidas.find((m) => m.esDefault) ?? predefinidas[0] ?? null;
  return def ? { anchoMm: def.anchoMm, altoMm: def.altoMm } : null;
}

/**
 * Personalizaciones (estampas): activación + medida → área en m² por clave
 * `personalizacion_<codigo>_areaM2` + detalle `personalizaciones[]`, y — para
 * productos SIN medida propia (taza, remera: la pieza que se imprime ES la
 * estampa) — sintetiza `piezas` desde las estampas activas. Espejo exacto de
 * buildJobContext del sheet (piezasDesdePersonalizaciones, L2519-2586): sin
 * esto el motor corta con requires_piezas.
 *
 * Respuesta aceptada por personalización: `true` (activar con la medida
 * declarada/sugerida), `{anchoMm, altoMm}` (medida CLIENTE), o ausencia
 * (las obligatorias van igual; las opcionales quedan afuera).
 */
function aplicarPersonalizaciones(
  jobContext: Record<string, unknown>,
  formulario: FormularioParaJobContext,
  respuestas: Record<string, unknown>,
  cantidad: number,
  hayMedidaPropia: boolean,
  faltantes: string[],
): void {
  const detalles: Array<{
    codigo: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
    areaM2: number;
  }> = [];

  for (const p of formulario.personalizaciones) {
    const key = String(p.jobContextKey);
    const codigo = String(p.codigo);
    const nombre = String(p.nombre ?? codigo);
    const obligatoria = p.obligatoria === true;
    const respuesta = respuestas[key];

    const activa = obligatoria || (respuesta !== undefined && respuesta !== false);
    if (!activa) continue;

    let anchoMm = asNumber(p.anchoMm);
    let altoMm = asNumber(p.altoMm);
    if (
      typeof respuesta === 'object' &&
      respuesta !== null &&
      p.modoMedida === 'CLIENTE'
    ) {
      const r = respuesta as { anchoMm?: unknown; altoMm?: unknown };
      anchoMm = asNumber(r.anchoMm);
      altoMm = asNumber(r.altoMm);
    }
    if (!anchoMm || !altoMm || anchoMm <= 0 || altoMm <= 0) {
      if (p.modoMedida === 'CLIENTE') {
        faltantes.push(
          `${key} — medida de "${nombre}" como {anchoMm, altoMm} en mm`,
        );
        continue;
      }
      continue; // FIJA sin medida válida: no aporta pieza (producto mal cargado)
    }

    const areaM2 = ((anchoMm * altoMm) / 1_000_000) * Math.max(0, cantidad);
    jobContext[`personalizacion_${codigo}_areaM2`] = areaM2;
    detalles.push({ codigo, nombre, anchoMm, altoMm, areaM2 });
  }

  if (detalles.length === 0) return;
  jobContext.personalizaciones = detalles;

  // Merchandising sin medida propia: la pieza producida ES la estampa.
  if (!hayMedidaPropia) {
    jobContext.piezas = detalles.map((d) => ({
      cantidad,
      anchoMm: d.anchoMm,
      altoMm: d.altoMm,
    }));
    jobContext.piezaAnchoMaxMm = Math.max(...detalles.map((d) => d.anchoMm));
    jobContext.piezaAltoMaxMm = Math.max(...detalles.map((d) => d.altoMm));
    jobContext.piezaAreaTotalM2 = detalles.reduce((t, d) => t + d.areaM2, 0);
    jobContext.piezaPerimetroTotalM = detalles.reduce(
      (t, d) => t + (cantidad * 2 * (d.anchoMm + d.altoMm)) / 1000,
      0,
    );
    if (detalles.length === 1) {
      jobContext.medidaCustomMm = {
        anchoMm: detalles[0].anchoMm,
        altoMm: detalles[0].altoMm,
      };
    }
  }
}

/** Setea una clave con puntos ("slotMateriales.X" / "configPasoRuntime.a.b"). */
function setAnidado(
  jobContext: Record<string, unknown>,
  key: string,
  valor: unknown,
): void {
  const partes = key.split('.');
  let nodo = jobContext;
  for (let i = 0; i < partes.length - 1; i++) {
    const parte = partes[i];
    const actual = nodo[parte];
    if (typeof actual !== 'object' || actual === null) {
      nodo[parte] = {};
    }
    nodo = nodo[parte] as Record<string, unknown>;
  }
  nodo[partes[partes.length - 1]] = valor;
}

function aplicarPregunta(
  jobContext: Record<string, unknown>,
  pregunta: Pregunta,
  key: string,
  valor: unknown,
  faltantes: string[],
): void {
  const etiqueta = String(pregunta.etiqueta ?? pregunta.paso ?? key);

  switch (pregunta.tipo) {
    case 'material': {
      const opciones = (pregunta.opciones ?? []) as Array<{
        varianteId: string;
        etiqueta: string;
        esDefault: boolean;
      }>;
      let elegida = valor as string | undefined;
      if (elegida === undefined) {
        // Sin respuesta: el default del modelador, igual que el sheet.
        elegida = opciones.find((o) => o.esDefault)?.varianteId;
        if (!elegida && opciones.length === 1) elegida = opciones[0].varianteId;
        if (!elegida) {
          if (pregunta.requerido !== false) {
            faltantes.push(
              `${key} — elegí el material (${opciones.map((o) => `${o.varianteId}: ${o.etiqueta}`).join(', ')})`,
            );
          }
          return;
        }
      } else if (!opciones.some((o) => o.varianteId === elegida)) {
        fail(
          `"${String(valor)}" no es una opción del slot ${String(pregunta.slotCodigo)}. ` +
            `Válidas: ${opciones.map((o) => `${o.varianteId} (${o.etiqueta})`).join(', ')}.`,
        );
      }
      setAnidado(jobContext, key, elegida);
      return;
    }

    case 'param': {
      if (valor === undefined) {
        if (pregunta.requerido === true && pregunta.sugerido == null) {
          faltantes.push(`${key} — ${etiqueta}`);
        }
        return; // sin respuesta = queda la sugerencia del modelador
      }
      const permitidos = (pregunta.valoresPermitidos ?? []) as string[];
      if (permitidos.length && !permitidos.includes(String(valor))) {
        fail(
          `"${String(valor)}" no es válido para ${etiqueta}. ` +
            `Opciones: ${permitidos.join(', ')}.`,
        );
      }
      if (pregunta.tipoDato === 'number' && asNumber(valor) === null) {
        fail(`${etiqueta} debe ser un número (llegó "${String(valor)}").`);
      }
      setAnidado(
        jobContext,
        key,
        pregunta.tipoDato === 'number' ? asNumber(valor) : valor,
      );
      return;
    }

    case 'modo_color': {
      if (valor === undefined) return; // el motor usa el default del paso
      const opciones = (pregunta.opciones ?? []) as Array<{ valor: string }>;
      if (!opciones.some((o) => o.valor === valor)) {
        fail(
          `Modo de color "${String(valor)}" no disponible. Opciones: ` +
            `${opciones.map((o) => o.valor).join(', ')}.`,
        );
      }
      setAnidado(jobContext, key, valor);
      return;
    }

    case 'tiempo_manual': {
      const n = valor === undefined ? null : asNumber(valor);
      if (valor !== undefined && (n === null || n <= 0)) {
        fail(`${etiqueta} debe ser un número de MINUTOS mayor a 0.`);
      }
      const min = asNumber(pregunta.min);
      const max = asNumber(pregunta.max);
      if (n !== null && min !== null && n < min) {
        fail(`${etiqueta}: mínimo ${min} minutos.`);
      }
      if (n !== null && max !== null && n > max) {
        fail(`${etiqueta}: máximo ${max} minutos.`);
      }
      if (n === null) {
        if (pregunta.requerido === true && pregunta.sugerido == null) {
          faltantes.push(`${key} — ${etiqueta} (en minutos)`);
        }
        return;
      }
      setAnidado(jobContext, key, n);
      return;
    }

    case 'tercerizado_eje': {
      // key = "tercerizado_<configPasoId>.<eje>" → objeto {eje: valor}.
      if (valor === undefined) {
        if (pregunta.requerido === true) {
          const valores = (pregunta.valores ?? []) as string[];
          faltantes.push(
            `${key} — eje "${String(pregunta.eje)}"` +
              (valores.length ? ` (valores: ${valores.join(', ')})` : ''),
          );
        }
        return;
      }
      const valores = (pregunta.valores ?? []) as string[];
      if (valores.length && !valores.includes(String(valor))) {
        fail(
          `"${String(valor)}" no está en la matriz del proveedor para el eje ` +
            `"${String(pregunta.eje)}". Valores: ${valores.join(', ')}.`,
        );
      }
      setAnidado(jobContext, key, String(valor));
      return;
    }

    case 'tercerizado_costo': {
      // Cotización del proveedor para este trabajo (neto). Sin respuesta:
      // el motor usa el estimado de referencia; si tampoco hay, es faltante.
      const n = valor === undefined ? null : asNumber(valor);
      if (valor !== undefined && (n === null || n <= 0)) {
        fail(`${etiqueta} debe ser un monto neto mayor a 0.`);
      }
      if (n === null) {
        if (pregunta.requerido === true) {
          faltantes.push(`${key} — ${etiqueta}`);
        }
        return;
      }
      setAnidado(jobContext, key, n);
      return;
    }

    case 'profundidad': {
      const n = valor === undefined ? null : asNumber(valor);
      if (valor !== undefined && (n === null || n <= 0)) {
        fail('La profundidad debe ser un número de milímetros mayor a 0.');
      }
      if (n === null) {
        if (pregunta.requerido === true) {
          faltantes.push(`${key} — profundidad del cajón en mm`);
        }
        return;
      }
      setAnidado(jobContext, key, n);
      return;
    }

    case 'multiplicador': {
      const permitidos = (pregunta.valores ?? []) as number[];
      if (valor === undefined) {
        if (pregunta.default !== undefined) {
          setAnidado(jobContext, key, pregunta.default);
        } else if (pregunta.obligatorio === true) {
          faltantes.push(
            `${key}` + (permitidos.length ? ` (${permitidos.join(' o ')})` : ''),
          );
        }
        return;
      }
      const n = asNumber(valor);
      if (n === null) {
        fail(`${key} debe ser un número (llegó "${String(valor)}").`);
      }
      if (permitidos.length && !permitidos.includes(n)) {
        fail(`${key} sólo acepta ${permitidos.join(' o ')} (llegó ${n}).`);
      }
      setAnidado(jobContext, key, n);
      return;
    }

    default:
      // Tipo de pregunta que esta versión no maneja: si vino respuesta la
      // pasamos tal cual (el motor la whitelistea); si no, nada.
      if (valor !== undefined) setAnidado(jobContext, key, valor);
  }
}
