import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { resolverFamilia } from './pasos/familias';
import {
  camposEditablesComercial,
  camposFijadosComercial,
} from '../motor-universal/params-runtime';

/**
 * Formulario de cotización derivado por producto: la lista plana de PREGUNTAS
 * que hay que responder para cotizarlo, cada una con su clave de jobContext
 * EXPLÍCITA.
 *
 * Es el cruce producto×familia×ruta que históricamente sólo hacía el sheet del
 * comercial (agregar-producto-sheet.tsx), portado al server para que un
 * consumidor externo (el MCP, y a futuro el propio sheet) no tenga que
 * reimplementar la derivación. Las reglas son las MISMAS:
 *
 *  - gate estructural: rutaPaso.activo && modoActivacion !== 'NO_EJECUTAR'
 *    (espejo de esConfigPasoEjecutable del front)
 *  - params abiertos: (camposEditablesComercial ∪ expuestoAlComercial de la
 *    familia) − camposFijadosComercial (espejo de paramsEfectivos, que sigue
 *    siendo la única autoridad en runtime)
 *  - slots: modoSeleccion === 'COMERCIAL_ELIGE', candidatos → variantes
 *
 * Ver docs/mcp-cotizador-diseno.md §4.
 */

type Detalle = Awaited<ReturnType<ProductosService['obtenerProducto']>>;
type RutaAlt = Detalle['rutasAlternativas'][number];
type ConfigPaso = RutaAlt['configPasos'][number];

/**
 * Un paso EXTRA del producto (inline, no reusable) hidratado por el detalle al
 * mismo shape que un configPaso (slots con candidatos, candidatas M-2). Acá se
 * adapta a la forma que consumen las derivaciones: la diferencia estructural
 * es que no cuelga de un rutaPaso — la familia y el orden son propios.
 *
 * SIN esta adaptación los pasos extras eran invisibles para el formulario: el
 * caso real fue "Cartelería PVC con vinilo", cuyo montaje_sobre_sustrato (paso
 * extra) tiene el slot de la plancha en COMERCIAL_ELIGE — la IA no veía la
 * pregunta y el motor cortaba con montaje_sin_nesting.
 */
function adaptarPasoExtra(pe: Record<string, unknown>): ConfigPaso {
  const familiaCodigo = String(pe.familiaCodigo ?? '');
  return {
    ...pe,
    requiereRutaPasoIds: pe.requiereRutaPasoIds ?? [],
    tercerizadoEntradas: pe.tercerizadoEntradas ?? [],
    slotsMateriales: pe.slotsMateriales ?? [],
    multiplicadoresActivos: pe.multiplicadoresActivos ?? [],
    cargosDirectosPaso: pe.cargosDirectosPaso ?? [],
    rutaPaso: {
      familiaCodigo,
      familiaNombre: resolverFamilia(familiaCodigo)?.nombre ?? null,
      activo: pe.activo !== false,
      // Después de los pasos de la ruta, en su orden interno.
      orden: 1000 + Number(pe.ordenInterno ?? 0),
    },
  } as unknown as ConfigPaso;
}

/** Pregunta genérica del formulario. El `tipo` discrimina el resto. */
export type PreguntaFormulario = Record<string, unknown> & {
  tipo: string;
  jobContextKey: string;
};

const MODO_NO_EJECUTAR = 'NO_EJECUTAR';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positivo(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Espejo server de esConfigPasoEjecutable (config-paso-activacion.ts). */
function esEjecutable(config: {
  modoActivacion: string | null;
  rutaPaso?: { activo?: boolean } | null;
}): boolean {
  return (
    config.rutaPaso?.activo !== false &&
    config.modoActivacion !== MODO_NO_EJECUTAR
  );
}

/**
 * Nombre del paso para un humano (o una IA): nombre manual del modelador →
 * nombre real de la familia (para pasos tenant el código es un UUID) → código
 * humanizado como último recurso. Espejo del sheet.
 */
function nombrePaso(
  nombreVisible: string | null | undefined,
  familiaCodigo: string,
  familiaNombre?: string | null,
): string {
  const propio = nombreVisible?.trim();
  if (propio) return propio;
  if (familiaNombre?.trim()) return familiaNombre.trim();
  const humanizado = familiaCodigo.replace(/_/g, ' ');
  return humanizado.charAt(0).toUpperCase() + humanizado.slice(1);
}

/**
 * Etiqueta legible de una variante de material: "Vinilo blanco · 3M IJ180 ·
 * 100µ · 1370mm". La IA ofrece ESTO, nunca SKUs crudos.
 */
function etiquetaVariante(
  materialNombre: string,
  variante: {
    sku: string | null;
    nombreVariante: string | null;
    atributosVarianteJson: unknown;
  },
): string {
  const attrs = asRecord(variante.atributosVarianteJson);
  const partes: string[] = [materialNombre];
  const nombre = variante.nombreVariante?.trim();
  if (nombre && nombre !== materialNombre) partes.push(nombre);

  const espesorMm = positivo(attrs.espesorMm ?? attrs.espesor);
  const micrones = positivo(attrs.espesorMicrones);
  if (espesorMm) partes.push(`${espesorMm}mm`);
  else if (micrones) partes.push(`${micrones}µ`);

  const anchoMm = positivo(attrs.anchoMm ?? attrs.ancho);
  if (anchoMm) partes.push(`${anchoMm}mm de ancho`);

  const color =
    typeof attrs.color === 'string' && attrs.color.trim()
      ? attrs.color.trim()
      : typeof attrs.colorBase === 'string'
        ? attrs.colorBase.trim()
        : '';
  if (color) partes.push(color);

  if (partes.length === 1 && variante.sku) partes.push(variante.sku);
  return partes.join(' · ');
}

@Injectable()
export class FormularioCotizacionService {
  constructor(private readonly productos: ProductosService) {}

  async obtener(
    tenantId: string,
    productoId: string,
    rutaAlternativaId?: string,
  ) {
    const producto = await this.productos.obtenerProducto(tenantId, productoId);

    const rutas = producto.rutasAlternativas.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      esPreferida: r.esPreferida,
      tieneReglaAuto: r.reglaAutoSeleccionJson != null,
    }));
    if (rutas.length === 0) {
      throw new BadRequestException(
        'Este producto no tiene rutas de producción activas: no se puede cotizar.',
      );
    }

    const ruta = rutaAlternativaId
      ? producto.rutasAlternativas.find((r) => r.id === rutaAlternativaId)
      : (producto.rutasAlternativas.find((r) => r.esPreferida) ??
        producto.rutasAlternativas[0]);
    if (!ruta) {
      throw new NotFoundException(
        `La ruta ${rutaAlternativaId} no existe en este producto.`,
      );
    }

    // Los pasos EXTRAS del producto cotizan igual que los de la ruta (el motor
    // los ejecuta con su propio id como configPasoId): entran a TODAS las
    // derivaciones — preguntas, multiplicadores, adicionales y validaciones.
    const extras = (
      (ruta as { pasosExtras?: Array<Record<string, unknown>> }).pasosExtras ??
      []
    ).map(adaptarPasoExtra);
    const ejecutables = [
      ...ruta.configPasos.filter(esEjecutable),
      ...extras.filter(esEjecutable),
    ];
    // rutaPasoId → configPasoId, para traducir requiereRutaPasoIds (arrastre).
    const rutaPasoAConfig = new Map(
      ruta.configPasos.map((c) => [c.rutaPasoId, c.id]),
    );

    return {
      producto: this.bloqueProducto(producto),
      rutas,
      rutaSeleccionada: ruta.id,
      cantidad: this.bloqueCantidad(producto),
      medidas: this.bloqueMedidas(producto),
      preguntas: this.preguntasDePasos(ejecutables),
      multiplicadores: this.bloqueMultiplicadores(ejecutables),
      adicionales: this.bloqueAdicionales(producto, ejecutables, rutaPasoAConfig),
      personalizaciones: this.bloquePersonalizaciones(producto),
      validaciones: this.bloqueValidaciones(ejecutables),
    };
  }

  private bloqueProducto(producto: Detalle) {
    return {
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      categoria: producto.subcategoriaComercial?.categoria?.nombre ?? null,
      subcategoria: producto.subcategoriaComercial?.nombre ?? null,
      unidadComercial: producto.unidadComercial,
      activo: producto.activo,
    };
  }

  private bloqueCantidad(producto: Detalle) {
    return {
      jobContextKey: 'cantidad',
      unidad: producto.unidadComercial,
      minimo:
        producto.minimoComercialPolitica &&
        producto.minimoComercialPolitica !== 'NONE'
          ? {
              politica: producto.minimoComercialPolitica,
              cantidad: producto.minimoComercialCantidad
                ? Number(producto.minimoComercialCantidad)
                : null,
              base: producto.minimoComercialBase,
            }
          : null,
    };
  }

  /**
   * Medidas resueltas a instrucción accionable. Todo en MM: la UI del sheet
   * trabaja en cm y convierte; acá no hay conversión que confunda a la IA.
   */
  private bloqueMedidas(producto: Detalle) {
    const predefinidas = this.medidasPredefinidas(producto);
    const modo = producto.modoMedidas;
    const instruccion =
      modo === 'FIJA'
        ? 'no_preguntar'
        : modo === 'COMERCIAL_ELIGE'
          ? 'elegir_predefinida'
          : modo === 'LIBRE'
            ? 'pedir_ancho_alto'
            : 'predefinida_o_custom'; // MIXTA
    return {
      modo,
      instruccion,
      unidadEntrada: 'mm',
      jobContextKeys:
        modo === 'FIJA'
          ? []
          : ['piezas', 'medidaCustomMm'], // el MCP arma ambos desde ancho×alto
      predefinidas,
      default: predefinidas.find((m) => m.esDefault) ?? predefinidas[0] ?? null,
    };
  }

  /** Espejo server de getMedidasPredefinidas (producto-medidas.ts). */
  private medidasPredefinidas(producto: Detalle) {
    const json = producto.medidasPredefinidasJson;
    if (Array.isArray(json) && json.length > 0) {
      const medidas = json
        .map((m, i) => {
          const medida = asRecord(m);
          return {
            id: String(medida.id || `medida-${i + 1}`),
            nombre: String(
              medida.nombre || `${medida.anchoMm} x ${medida.altoMm} mm`,
            ),
            anchoMm: positivo(medida.anchoMm) ?? 0,
            altoMm: positivo(medida.altoMm) ?? 0,
            esDefault: medida.esDefault === true,
          };
        })
        .filter((m) => m.anchoMm > 0 && m.altoMm > 0);
      if (medidas.some((m) => m.esDefault)) return medidas;
      return medidas.map((m, i) => ({ ...m, esDefault: i === 0 }));
    }
    const anchoMm = positivo(producto.medidaDefaultAnchoMm);
    const altoMm = positivo(producto.medidaDefaultAltoMm);
    if (!anchoMm || !altoMm) return [];
    return [
      {
        id: 'default',
        nombre: `${anchoMm} x ${altoMm} mm`,
        anchoMm,
        altoMm,
        esDefault: true,
      },
    ];
  }

  private preguntasDePasos(ejecutables: ConfigPaso[]): PreguntaFormulario[] {
    const preguntas: PreguntaFormulario[] = [];
    for (const config of ejecutables) {
      const familiaCodigo = config.rutaPaso?.familiaCodigo ?? '';
      const familia = resolverFamilia(familiaCodigo);
      const paso = nombrePaso(
        config.nombreVisible,
        familiaCodigo,
        (config.rutaPaso as { familiaNombre?: string | null } | null)
          ?.familiaNombre,
      );
      const base = { configPasoId: config.id, paso, orden: config.rutaPaso?.orden ?? 0 };

      preguntas.push(
        ...this.preguntasParams(config, base, familia?.paramsPasoSchema ?? []),
        ...this.preguntasSlots(config, base, familia),
        ...this.preguntaModoColor(config, base, familia),
        ...this.preguntaTiempoManual(config, base),
        ...this.preguntasTercerizado(config, base),
        ...this.preguntaProfundidad(config, base, familiaCodigo),
      );
    }
    return preguntas;
  }

  /** Espejo de getParamsComercialDeRuta: abiertos = (editables ∪ expuestos) − fijados. */
  private preguntasParams(
    config: ConfigPaso,
    base: Record<string, unknown>,
    schema: Array<{
      campo: string;
      etiqueta: string;
      tipo: string;
      valoresPermitidos?: string[];
      default?: unknown;
      requerido?: boolean;
      descripcion?: string;
      expuestoAlComercial?: boolean;
    }>,
  ): PreguntaFormulario[] {
    const params = asRecord(config.paramsPasoJson);
    const fijados = new Set(camposFijadosComercial(params));
    const abiertos = new Set(
      [
        ...camposEditablesComercial(params),
        ...schema.filter((p) => p.expuestoAlComercial).map((p) => p.campo),
      ].filter((campo) => !fijados.has(campo)),
    );
    if (abiertos.size === 0) return [];

    return schema
      .filter((p) => abiertos.has(p.campo))
      .map((p) => ({
        tipo: 'param',
        ...base,
        campo: p.campo,
        etiqueta: p.etiqueta,
        tipoDato: p.tipo,
        valoresPermitidos: p.valoresPermitidos ?? [],
        descripcion: p.descripcion ?? null,
        sugerido: params[p.campo] ?? p.default ?? null,
        requerido: p.requerido === true && params[p.campo] === undefined,
        jobContextKey: `configPasoRuntime.${config.id}.${p.campo}`,
      }));
  }

  /** Slots COMERCIAL_ELIGE con sus opciones válidas, etiquetadas. */
  private preguntasSlots(
    config: ConfigPaso,
    base: Record<string, unknown>,
    familia: ReturnType<typeof resolverFamilia>,
  ): PreguntaFormulario[] {
    return config.slotsMateriales
      .filter((slot) => slot.modoSeleccion === 'COMERCIAL_ELIGE')
      .map((slot) => {
        const declarado = familia?.slotsRequeridos.find(
          (s) => s.codigo === slot.slotCodigo,
        );
        const opciones = slot.candidatos.flatMap((candidato) => {
          const variantes = candidato.todasLasVariantes
            ? (candidato.materiaPrima.variantes ?? []).map((v) => ({
                variante: v,
              }))
            : candidato.variantes;
          return variantes.map(({ variante }) => ({
            varianteId: variante.id,
            etiqueta: etiquetaVariante(candidato.materiaPrima.nombre, {
              sku: variante.sku,
              nombreVariante: variante.nombreVariante,
              atributosVarianteJson:
                'atributosVarianteJson' in variante
                  ? variante.atributosVarianteJson
                  : null,
            }),
            esDefault: variante.id === candidato.defaultVarianteId,
            sinPrecio:
              !('precioReferencia' in variante) ||
              variante.precioReferencia == null,
          }));
        });
        return {
          tipo: 'material',
          ...base,
          slotCodigo: slot.slotCodigo,
          slotNombre: slot.slotNombre ?? declarado?.nombre ?? slot.slotCodigo,
          requerido: declarado?.requerido !== false,
          opciones,
          jobContextKey: `slotMateriales.${config.id}_${slot.slotCodigo}`,
        };
      })
      .filter((p) => (p.opciones as unknown[]).length > 0);
  }

  /**
   * Modo de color: sólo pasos de impresión donde el comercial elige y hay más
   * de una opción real. Las opciones ya vienen intersecadas server-side
   * (perfil × candidatas × allowedModes) en modoColorOptions del detalle.
   */
  private preguntaModoColor(
    config: ConfigPaso,
    base: Record<string, unknown>,
    familia: ReturnType<typeof resolverFamilia>,
  ): PreguntaFormulario[] {
    if (familia?.esImpresion !== true) return [];
    const modoColorConfig = asRecord(
      asRecord(config.paramsPasoJson).modoColorConfig,
    );
    if (modoColorConfig.enabled === false) return [];
    if (modoColorConfig.comercialElige === false) return [];
    const opciones = (
      (config as { modoColorOptions?: Array<{ value: string; label: string }> })
        .modoColorOptions ?? []
    ).map((o) => ({ valor: o.value, etiqueta: o.label }));
    if (opciones.length <= 1) return [];
    const defaultMode =
      typeof modoColorConfig.defaultMode === 'string'
        ? modoColorConfig.defaultMode
        : (opciones[0]?.valor ?? null);
    return [
      {
        tipo: 'modo_color',
        ...base,
        opciones,
        default: defaultMode,
        requerido: false,
        jobContextKey: `modoColor_${config.id}`,
      },
    ];
  }

  /** Espejo de getTiemposManualesComercial (sheet). Siempre en MINUTOS. */
  private preguntaTiempoManual(
    config: ConfigPaso,
    base: Record<string, unknown>,
  ): PreguntaFormulario[] {
    const tiempoManual = asRecord(asRecord(config.paramsPasoJson).tiempoManual);
    if (tiempoManual.habilitado !== true) return [];
    return [
      {
        tipo: 'tiempo_manual',
        ...base,
        etiqueta:
          typeof tiempoManual.etiqueta === 'string' &&
          tiempoManual.etiqueta.trim()
            ? tiempoManual.etiqueta.trim()
            : `${base.paso as string} · tiempo estimado`,
        unidad: 'minutos',
        requerido: tiempoManual.obligatorio === true,
        sugerido: positivo(tiempoManual.defaultMin),
        min: positivo(tiempoManual.minMin),
        max: positivo(tiempoManual.maxMin),
        jobContextKey: `tiempoManualMin_${config.id}`,
      },
    ];
  }

  /**
   * Ejes de la matriz de tercerizado. Los valores válidos por eje salen de las
   * entradas cargadas (claveMatch = valores unidos por '|', en el orden de los
   * ejes). El eje `cantidad` no se pregunta: lo completa el llamador con la
   * cantidad del trabajo, igual que el sheet.
   */
  private preguntasTercerizado(
    config: ConfigPaso,
    base: Record<string, unknown>,
  ): PreguntaFormulario[] {
    if (!config.tercerizado) return [];
    if (config.fuenteCostoTercerizado !== 'matriz') return [];
    const configJson = asRecord(config.tercerizadoConfigJson);
    const ejes = Array.isArray(configJson.ejes)
      ? (configJson.ejes as Array<{ clave?: unknown; orden?: unknown }>)
          .map((e) => ({
            clave: typeof e.clave === 'string' ? e.clave : '',
            orden: Number(e.orden ?? 0),
          }))
          .filter((e) => e.clave)
          .sort((a, b) => a.orden - b.orden)
      : [];
    if (ejes.length === 0) return [];

    // claveMatch: "valorEje1|valorEje2|..." — posición i = eje ordenado i.
    const valoresPorEje = new Map<string, Set<string>>();
    for (const entrada of config.tercerizadoEntradas ?? []) {
      const partes = entrada.claveMatch.split('|');
      ejes.forEach((eje, i) => {
        if (partes[i] === undefined) return;
        const set = valoresPorEje.get(eje.clave) ?? new Set<string>();
        set.add(partes[i]);
        valoresPorEje.set(eje.clave, set);
      });
    }

    return ejes
      .filter((eje) => eje.clave !== 'cantidad')
      .map((eje) => ({
        tipo: 'tercerizado_eje',
        ...base,
        eje: eje.clave,
        valores: [...(valoresPorEje.get(eje.clave) ?? [])],
        requerido: true,
        jobContextKey: `tercerizado_${config.id}.${eje.clave}`,
      }));
  }

  /**
   * Cartelería backlight: bastidor DOBLE sin profundidad fija en params ⇒ el
   * comercial (o la IA) carga la profundidad del cajón. Espejo de
   * getProfundidadDeRuta (sheet). En MM (la UI muestra cm y convierte).
   */
  private preguntaProfundidad(
    config: ConfigPaso,
    base: Record<string, unknown>,
    familiaCodigo: string,
  ): PreguntaFormulario[] {
    if (familiaCodigo !== 'estructura_bastidor') return [];
    const params = asRecord(config.paramsPasoJson);
    if (String(params.tipoBastidor ?? 'doble').toLowerCase() === 'simple') {
      return [];
    }
    const fija = positivo(params.profundidadMm);
    return [
      {
        tipo: 'profundidad',
        ...base,
        unidad: 'mm',
        sugerido: fija,
        requerido: fija === null,
        jobContextKey: 'profundidadMm',
      },
    ];
  }

  /**
   * Multiplicadores activos de la ruta → campos del jobContext SIN los cuales
   * la cotización sale mal en silencio. Espejo de routeUsesCaras /
   * routeUsesTipoCopia (sheet): los pasos tercerizados no multiplican.
   */
  private bloqueMultiplicadores(ejecutables: ConfigPaso[]) {
    const multiplicadores: Array<Record<string, unknown>> = [];
    const internos = ejecutables.filter((c) => !c.tercerizado);

    const usaCaras = internos.some(
      (c) =>
        c.multiplicadoresActivos.includes('caras') ||
        c.slotsMateriales.some((s) => s.aplicaMultiCaras),
    );
    if (usaCaras) {
      multiplicadores.push({
        campo: 'caras',
        jobContextKey: 'caras',
        valores: [1, 2],
        default: 1,
        obligatorio: true,
        descripcion: 'Simple o doble faz.',
      });
    }

    const usaTipoCopia = internos.some(
      (c) =>
        c.multiplicadoresActivos.includes('tipoCopia') ||
        JSON.stringify(c.condicionActivacionJson ?? '').includes('tipoCopia'),
    );
    if (usaTipoCopia) {
      multiplicadores.push({
        campo: 'tipoCopia',
        jobContextKey: 'tipoCopia',
        valores: [1, 2, 3],
        default: 1,
        obligatorio: true,
        descripcion: 'Original solo, original+duplicado, o +triplicado.',
      });
      multiplicadores.push({
        campo: 'numerosXTalonario',
        jobContextKey: 'numerosXTalonario',
        tipoDato: 'number',
        obligatorio: false,
        descripcion: 'Cantidad de números por talonario (ej. 50).',
      });
    }

    // Resto de multiplicadores dinámicos: el motor lee el campo homónimo del
    // jobContext (hojasPorLibro, cantidadModificacionesPorPieza, ...).
    const conocidos = new Set(['caras', 'tipoCopia']);
    const dinamicos = new Set(
      internos
        .flatMap((c) => c.multiplicadoresActivos)
        .filter((m) => !conocidos.has(m)),
    );
    for (const campo of dinamicos) {
      multiplicadores.push({
        campo,
        jobContextKey: campo,
        tipoDato: 'number',
        obligatorio: true,
      });
    }

    return multiplicadores;
  }

  /**
   * Adicionales activables: pasos OPCIONALES + cargos directos OPCIONALES (de
   * paso y de cotización). `jobContextKey` apunta a opcionalesActivados.<id>
   * (id de configPaso o de la fila de asociación del cargo, igual que el
   * motor). Espejo de getOpcionales (sheet).
   */
  private bloqueAdicionales(
    producto: Detalle,
    ejecutables: ConfigPaso[],
    rutaPasoAConfig: Map<string, string>,
  ) {
    const adicionales: Array<Record<string, unknown>> = [];

    for (const cargo of producto.cargosDirectosCotizacion) {
      if (cargo.modoActivacion !== 'OPCIONAL') continue;
      adicionales.push({
        id: cargo.id,
        tipo: 'cargo_cotizacion',
        nombre: cargo.cargoDirectoCatalogo.nombre,
        descripcion: cargo.cargoDirectoCatalogo.descripcion ?? null,
        jobContextKey: `opcionalesActivados.${cargo.id}`,
      });
    }

    for (const config of ejecutables) {
      const familiaCodigo = config.rutaPaso?.familiaCodigo ?? '';
      if (config.modoActivacion === 'OPCIONAL') {
        adicionales.push({
          id: config.id,
          tipo: 'paso',
          nombre: nombrePaso(
            config.nombreVisible,
            familiaCodigo,
            (config.rutaPaso as { familiaNombre?: string | null } | null)
              ?.familiaNombre,
          ),
          descripcion: null,
          // Arrastre: activar este paso enciende también estos (lo hace el
          // motor solo; se informa para que la IA pueda explicarlo).
          requiereIds: (config.requiereRutaPasoIds ?? [])
            .map((rutaPasoId) => rutaPasoAConfig.get(rutaPasoId))
            .filter((id): id is string => !!id),
          jobContextKey: `opcionalesActivados.${config.id}`,
        });
      }
      if (config.modoActivacion === 'CONDICIONAL') {
        adicionales.push({
          id: config.id,
          tipo: 'paso_condicional',
          nombre: nombrePaso(
            config.nombreVisible,
            familiaCodigo,
            (config.rutaPaso as { familiaNombre?: string | null } | null)
              ?.familiaNombre,
          ),
          descripcion:
            'Se activa solo según los datos del trabajo: no hay que activarlo a mano.',
          condicionadoPor: this.camposDeCondicion(config.condicionActivacionJson),
          jobContextKey: '',
        });
      }
      for (const cargo of config.cargosDirectosPaso) {
        if (cargo.modoActivacion !== 'OPCIONAL') continue;
        adicionales.push({
          id: cargo.id,
          tipo: 'cargo_paso',
          nombre: cargo.cargoDirectoCatalogo.nombre,
          descripcion: cargo.cargoDirectoCatalogo.descripcion ?? null,
          configPasoId: config.id,
          jobContextKey: `opcionalesActivados.${cargo.id}`,
        });
      }
    }

    return adicionales;
  }

  /** Campos del jobContext que referencia una condición JsonLogic (aprox). */
  private camposDeCondicion(condicion: unknown): string[] {
    if (!condicion) return [];
    const campos = new Set<string>();
    const recorrer = (nodo: unknown): void => {
      if (Array.isArray(nodo)) return nodo.forEach(recorrer);
      const record = asRecord(nodo);
      for (const [op, valor] of Object.entries(record)) {
        if (op === 'var' && typeof valor === 'string') campos.add(valor);
        else recorrer(valor);
      }
    };
    recorrer(condicion);
    return [...campos];
  }

  /**
   * Personalizaciones (áreas de decoración: estampas de remera, taza).
   *
   * El que responde manda MEDIDAS (o `true` para activar una de medida fija);
   * el área en m² y las piezas sintetizadas las calcula la capa de traducción
   * (armarJobContext), nunca la IA — pedirle el área calculada fue el bug de
   * los personalizados. `obligatoria !== false` espejo de getPersonalizaciones.
   */
  private bloquePersonalizaciones(producto: Detalle) {
    const json = producto.personalizacionesJson;
    if (!Array.isArray(json)) return [];
    return json
      .map((p, i) => {
        const item = asRecord(p);
        const codigo =
          typeof item.codigo === 'string' && item.codigo.trim()
            ? item.codigo.trim()
            : `pers_${i + 1}`;
        const modoMedida = item.modoMedida === 'CLIENTE' ? 'CLIENTE' : 'FIJA';
        const obligatoria = item.obligatoria !== false;
        return {
          codigo,
          nombre: typeof item.nombre === 'string' ? item.nombre : codigo,
          obligatoria,
          modoMedida,
          // FIJA: la medida real. CLIENTE: sugerencia (puede venir vacía).
          anchoMm: positivo(item.anchoMm),
          altoMm: positivo(item.altoMm),
          instruccion:
            modoMedida === 'CLIENTE'
              ? 'responder {anchoMm, altoMm} de la estampa (mm); true usa la sugerencia'
              : obligatoria
                ? 'incluida siempre: no hay que responder nada'
                : 'responder true para incluirla',
          jobContextKey: `personalizacion_${codigo}`,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }

  /**
   * Validaciones declaradas por las familias de los pasos activos: la IA puede
   * chequear ANTES de llamar al motor en vez de rebotar contra errores[].
   */
  private bloqueValidaciones(ejecutables: ConfigPaso[]) {
    const validaciones: Array<Record<string, unknown>> = [];
    for (const config of ejecutables) {
      const familia = resolverFamilia(config.rutaPaso?.familiaCodigo ?? '');
      for (const v of familia?.validaciones ?? []) {
        validaciones.push({ configPasoId: config.id, ...v });
      }
    }
    return validaciones;
  }
}
