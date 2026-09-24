import { esConfigPasoEjecutable } from "./config-paso-activacion";
import { getDimensionesRequeridas } from "./producto-medidas";
import type { ConfigPasoDetalle, ProductoDetalle } from "./productos-servicios";
import type { SelloModeloDiseno } from "./sello-arte/diseno";

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const positivo = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Recibe sólo los pasos activos de la ruta elegida (incluidos sus opcionales). */
export function permiteImportarMedidasPdf(
  producto: ProductoDetalle | null,
  pasos: ConfigPasoDetalle[],
  modo: "medidas" | "svg" | "placas",
) {
  if (
    !producto ||
    producto.estructuraProducto === "COMPUESTO" ||
    modo !== "medidas" ||
    !["LIBRE", "MIXTA"].includes(producto.modoMedidas)
  )
    return false;
  const dimensiones = getDimensionesRequeridas(producto);
  if (
    dimensiones.length !== 2 ||
    !dimensiones.includes("ANCHO") ||
    !dimensiones.includes("ALTO")
  )
    return false;
  const activos = pasos.filter(esConfigPasoEjecutable);
  if (!activos.length) return false;
  // Una página de un libro no es una pieza independiente del producto.
  return !activos.some((p) => {
    const params = record(p.paramsPasoJson);
    const imposicion = record(record(params.nestingConfig).imposicion);
    return (
      ["abrochado_caballete", "encuadernado_anillado"].includes(
        p.rutaPaso.familiaCodigo,
      ) ||
      imposicion.esquema === "caballete" ||
      p.multiplicadoresActivos.includes("paginas")
    );
  });
}

export type MaterialEditorSello = {
  templateId?: string;
  subfamilia?: string;
  nombre: string;
  atributos?: Record<string, unknown> | null;
};

function tipoMaterialSello(m: MaterialEditorSello) {
  if (
    ["sello_automatico_v1", "sello_manual_v1"].includes(m.templateId ?? "") ||
    ["SELLOS_AUTOMATICOS", "SELLOS_MANUALES"].includes(m.subfamilia ?? "")
  )
    return "cuerpo";
  if (m.templateId === "goma_laserable_v1" || m.subfamilia === "GOMA_LASERABLE")
    return "goma";
  return null;
}

export function modeloSelloDeAtributos(
  attrs: Record<string, unknown> | null | undefined,
  nombre: string,
): SelloModeloDiseno | null {
  const a = attrs ?? {};
  const widthMm = positivo(a.anchoPolimero);
  const heightMm = positivo(a.altoPolimero);
  const lineasMax = positivo(a.lineasTexto);
  if (!widthMm || !heightMm || !lineasMax) return null;
  return {
    nombre: typeof a.modelo === "string" && a.modelo.trim() ? a.modelo : nombre,
    widthMm,
    heightMm,
    lineasMax: Math.max(1, Math.floor(lineasMax)),
  };
}

export function resolverEditorSello({
  pasos,
  materiales,
  medida,
  lineasGoma = 4,
}: {
  pasos: ConfigPasoDetalle[];
  materiales: MaterialEditorSello[];
  medida?: { anchoMm: number; altoMm: number } | null;
  lineasGoma?: number;
}): {
  visible: boolean;
  modelo: SelloModeloDiseno | null;
  motivo?: string;
  esGoma?: boolean;
} {
  const familias = new Set(
    pasos.filter(esConfigPasoEjecutable).map((p) => p.rutaPaso.familiaCodigo),
  );
  const preparaArte =
    familias.has("pre_prensa") || familias.has("diseno_grafico");
  const fabrica =
    familias.has("grabado_laser") ||
    (preparaArte &&
      (familias.has("trabajo_manual") || familias.has("ensamble_estructural")));
  if (!fabrica) return { visible: false, modelo: null };
  const cuerpos = materiales.filter((m) => tipoMaterialSello(m) === "cuerpo");
  if (cuerpos.length) {
    const modelos = cuerpos.map((m) =>
      modeloSelloDeAtributos(m.atributos, m.nombre),
    );
    const modelo = modelos[0];
    if (!modelo || modelos.some((m) => !m))
      return {
        visible: true,
        modelo: null,
        motivo:
          "Completá el ancho y alto del polímero y las líneas de texto en la variante del cuerpo de sello.",
      };
    if (
      modelos.some(
        (m) =>
          m!.widthMm !== modelo.widthMm ||
          m!.heightMm !== modelo.heightMm ||
          m!.lineasMax !== modelo.lineasMax,
      )
    )
      return {
        visible: true,
        modelo: null,
        motivo:
          "Hay cuerpos de sello con distintas áreas de grabado. Cotizalos en ítems separados para diseñar cada uno.",
      };
    return { visible: true, modelo };
  }
  if (materiales.some((m) => tipoMaterialSello(m) === "goma")) {
    if (!positivo(medida?.anchoMm) || !positivo(medida?.altoMm))
      return {
        visible: true,
        modelo: null,
        esGoma: true,
        motivo:
          "Ingresá una única medida para la goma del sello. Para diseños de distintos tamaños, agregá un ítem por tamaño.",
      };
    return {
      visible: true,
      esGoma: true,
      modelo: {
        nombre: "Goma de sello a medida",
        widthMm: medida!.anchoMm,
        heightMm: medida!.altoMm,
        lineasMax: Math.min(30, Math.max(1, Math.floor(lineasGoma))),
      },
    };
  }
  return { visible: false, modelo: null };
}
