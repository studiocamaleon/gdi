export type EspecificacionEfectivaComponente = {
  clave: string;
  etiqueta: string;
  tipoDato: string;
  unidad?: string | null;
  requerido: boolean;
  origen: "DEFAULT_HIJO" | "FIJO" | "PADRE" | "FORMULA" | "COTIZACION";
  valor: unknown;
  valorTexto: string;
};

export type FilaEspecificacionComponente = {
  key: string;
  label: string;
  value: string;
  colorMode: boolean;
};

export type ComponenteEspecificacionesView = {
  key: string;
  nombre: string;
  resumen: string;
  filas: FilaEspecificacionComponente[];
  hijos: ComponenteEspecificacionesView[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits,
  }).format(value);
}

function formatUnit(unit: unknown, quantity: number) {
  const normalized = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  if (["unidad", "unidades", "u"].includes(normalized)) return "u.";
  if (["m2", "m²"].includes(normalized)) return "m²";
  if (["metro_lineal", "ml"].includes(normalized)) return "ml";
  if (normalized === "pieza") return quantity === 1 ? "pieza" : "piezas";
  return normalized;
}

function parseEffectiveSpecs(
  value: unknown,
): EspecificacionEfectivaComponente[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (
      !row ||
      typeof row.clave !== "string" ||
      typeof row.etiqueta !== "string"
    ) {
      return [];
    }
    return [
      {
        clave: row.clave,
        etiqueta: row.etiqueta,
        tipoDato: typeof row.tipoDato === "string" ? row.tipoDato : "text",
        unidad: typeof row.unidad === "string" ? row.unidad : null,
        requerido: row.requerido !== false,
        origen:
          typeof row.origen === "string"
            ? (row.origen as EspecificacionEfectivaComponente["origen"])
            : "FIJO",
        valor: row.valor,
        valorTexto:
          typeof row.valorTexto === "string"
            ? row.valorTexto
            : String(row.valor ?? ""),
      },
    ];
  });
}

function formatMmAsCm(value: number) {
  return formatNumber(value / 10);
}

function geometryRow(
  specs: EspecificacionEfectivaComponente[],
  jobContext: Record<string, unknown>,
) {
  const fromSpec = (suffix: string) =>
    specs.find((item) => item.clave.endsWith(suffix))?.valor;
  const measure = asRecord(jobContext.medidaCustomMm) ?? {};
  const width = asFiniteNumber(
    fromSpec("medidaCustomMm.anchoMm") ?? measure.anchoMm,
  );
  const height = asFiniteNumber(
    fromSpec("medidaCustomMm.altoMm") ?? measure.altoMm,
  );
  const depth = asFiniteNumber(
    fromSpec("medidaCustomMm.profundidadMm") ?? measure.profundidadMm,
  );
  if (width == null && height == null && depth == null) return null;
  const dimensions = [width, height, depth]
    .filter((item): item is number => item != null)
    .map(formatMmAsCm);
  return {
    key: "medidas",
    label: "Medidas",
    value: `${dimensions.join(" × ")} cm`,
    colorMode: false,
  } satisfies FilaEspecificacionComponente;
}

function materialRows(component: Record<string, unknown>) {
  const rows: FilaEspecificacionComponente[] = [];
  const seen = new Set<string>();
  const pasos = Array.isArray(component.pasos) ? component.pasos : [];
  for (const pasoValue of pasos) {
    const paso = asRecord(pasoValue);
    if (!paso || paso.activado === false || !Array.isArray(paso.materiales)) {
      continue;
    }
    for (const materialValue of paso.materiales) {
      const material = asRecord(materialValue);
      if (!material || material.tipoLineaCosto !== "MATERIAL") continue;
      const value =
        (typeof material.materialDisplayName === "string" &&
          material.materialDisplayName.trim()) ||
        (typeof material.materialNombre === "string" &&
          material.materialNombre.trim()) ||
        "";
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const slot =
        typeof material.slotNombre === "string" && material.slotNombre.trim()
          ? material.slotNombre.trim()
          : "Material";
      rows.push({
        key: `material-${rows.length}`,
        label: slot,
        value,
        colorMode: false,
      });
    }
  }
  return rows;
}

function buildRows(component: Record<string, unknown>) {
  const specs = parseEffectiveSpecs(component.especificacionesEfectivas);
  const jobContext = asRecord(component.jobContext) ?? {};
  const rows: FilaEspecificacionComponente[] = [];
  const geometry = geometryRow(specs, jobContext);
  const quantitySpec = specs.find((item) => item.clave === "cantidad");
  const quantity =
    asFiniteNumber(quantitySpec?.valor) ?? asFiniteNumber(component.cantidad);
  if (quantity != null) {
    // La unidad del binding describe el parámetro mostrado (piezas, unidades,
    // etc.). La unidad del renglón BOM puede representar el consumo comercial
    // del componente (por ejemplo m²) y no necesariamente esta cantidad.
    const quantityLabel = quantitySpec?.etiqueta.toLowerCase() ?? "";
    const semanticUnit = /\b(pieza|piezas|unidad|unidades)\b/.test(quantityLabel)
      ? "unidad"
      : quantitySpec?.unidad;
    const unit = formatUnit(semanticUnit ?? component.unidad, quantity);
    rows.push({
      key: "cantidad",
      label: quantitySpec?.etiqueta || "Cantidad",
      value: `${formatNumber(quantity, 4)}${unit ? ` ${unit}` : ""}`,
      colorMode: false,
    });
  }
  if (geometry) rows.push(geometry);

  const geometryKeys = new Set([
    "cantidad",
    "medidaCustomMm.anchoMm",
    "medidaCustomMm.altoMm",
    "medidaCustomMm.profundidadMm",
  ]);
  for (const spec of specs) {
    if (geometryKeys.has(spec.clave)) continue;
    const isOptional = spec.clave.startsWith("opcionalesActivados.");
    if (isOptional && spec.valor !== true) continue;
    const raw = spec.valorTexto.trim();
    if (!raw) continue;
    const value =
      isOptional ||
      (spec.tipoDato.toLowerCase() === "boolean" && spec.valor === true)
        ? "Incluido"
        : `${raw}${spec.unidad && spec.unidad !== "mm" ? ` ${spec.unidad}` : ""}`;
    rows.push({
      key: spec.clave,
      label: spec.etiqueta,
      value,
      colorMode:
        spec.tipoDato.toLowerCase() === "modo_color" ||
        spec.clave.startsWith("modoColor_"),
    });
  }

  // Compatibilidad con snapshots previos al contrato etiquetado.
  if (specs.length === 0) {
    for (const [key, value] of Object.entries(jobContext)) {
      if (!key.startsWith("modoColor_") || typeof value !== "string") continue;
      rows.push({
        key: "modo-color",
        label: "Modo de color",
        value,
        colorMode: true,
      });
      break;
    }
  }

  rows.push(...materialRows(component));
  return rows;
}

function componentView(
  value: unknown,
  index: number,
): ComponenteEspecificacionesView | null {
  const component = asRecord(value);
  if (!component) return null;
  const nombre =
    typeof component.nombre === "string" && component.nombre.trim()
      ? component.nombre.trim()
      : "Componente";
  const filas = buildRows(component);
  const summaryRows = filas.filter((row) =>
    ["cantidad", "medidas"].includes(row.key),
  );
  const hijos = (
    Array.isArray(component.componentes) ? component.componentes : []
  )
    .map(componentView)
    .filter((item): item is ComponenteEspecificacionesView => item != null);
  return {
    key:
      typeof component.codigo === "string" && component.codigo
        ? component.codigo
        : `${nombre}-${index}`,
    nombre,
    resumen: summaryRows.map((row) => row.value).join(" · "),
    filas,
    hijos,
  };
}

/** Construye una vista recursiva y sin códigos internos para propuesta/OT. */
export function construirEspecificacionesComponentes(
  componentes: unknown,
): ComponenteEspecificacionesView[] {
  if (!Array.isArray(componentes)) return [];
  return componentes
    .map(componentView)
    .filter((item): item is ComponenteEspecificacionesView => item != null);
}
