import type {
  AccionErrorCotizacion,
  ErrorTrabajoCotizacion,
} from "@/lib/productos-servicios-api";

export type ErrorCotizacionPresentado = {
  codigo: string;
  titulo: string;
  mensaje: string;
  sugerencia: string;
  accion: AccionErrorCotizacion;
  referencia?: string;
};

export type FuenteErrorCotizacion = {
  codigo?: string;
  mensaje: string;
  sugerencia?: string;
  accion?: AccionErrorCotizacion;
  referencia?: string;
  productoId?: string;
  rutaAlternativaId?: string | null;
};

const CODIGOS_NESTING =
  /nesting|vector|svg|dxf|geometr|contorno|placa|pieza_no_entra|rollo_mas_ancho|formato_vectorial/i;
const CODIGOS_CONFIGURACION =
  /receta|config|tarifa|precio|centro_costo|maquina|perfil|material|sustrato|consumible|componente|paso_compuesto|ruta_alternativa|dependencia|herencia/i;
const CODIGOS_DATOS =
  /job_context|configuracion_componente_incompleta|material_comercial|cantidad|medida|ancho|alto|profundidad|tiempo_manual|tercerizado_costo_manual|descuento|periodo_tarifario|ocurrencias/i;

export function presentarErrorCotizacion(
  fuente: FuenteErrorCotizacion,
): ErrorCotizacionPresentado {
  const codigo = fuente.codigo?.trim() || "CALCULO_FALLIDO";
  const texto = `${codigo} ${fuente.mensaje}`;
  const hrefConfiguracion = fuente.productoId
    ? `/productos-servicios/${encodeURIComponent(fuente.productoId)}?tab=produccion&vista=operaciones${fuente.rutaAlternativaId ? `&rutaAltId=${encodeURIComponent(fuente.rutaAlternativaId)}` : ""}`
    : undefined;

  if (
    codigo === "RECETA_DESACTUALIZADA" ||
    /cambios productivos sin publicar/i.test(texto)
  ) {
    return {
      codigo,
      titulo: "La receta cambió después de publicarse",
      mensaje: fuente.mensaje,
      sugerencia:
        fuente.sugerencia ??
        "Publicá una nueva revisión de la receta y luego reintentá la cotización.",
      accion:
        fuente.accion ??
        accionAbrir(
          "ABRIR_PUBLICACION",
          "Revisar publicación",
          hrefConfiguracion,
        ),
      referencia: fuente.referencia,
    };
  }

  if (
    codigo === "RECETA_NO_PUBLICADA" ||
    /receta.{0,35}(sin publicar|no publicada)|sin receta publicada/i.test(texto)
  ) {
    return {
      codigo,
      titulo: "Falta publicar la receta",
      mensaje: fuente.mensaje,
      sugerencia:
        fuente.sugerencia ??
        "Creá o actualizá la receta productiva y publicala antes de cotizar.",
      accion:
        fuente.accion ??
        accionAbrir("ABRIR_PUBLICACION", "Publicar receta", hrefConfiguracion),
      referencia: fuente.referencia,
    };
  }

  if (
    codigo === "SERVICIO_NO_DISPONIBLE" ||
    /api|servicio|conexi[oó]n|timeout|tiempo m[aá]ximo|network|fetch/i.test(
      texto,
    )
  ) {
    return {
      codigo,
      titulo: "El motor de cálculo no respondió",
      mensaje: fuente.mensaje,
      sugerencia:
        fuente.sugerencia ??
        "Esperá unos segundos y reintentá. Los datos cargados no se perdieron.",
      accion:
        fuente.accion ?? {
          tipo: "REINTENTAR",
          etiqueta: "Reintentar ahora",
        },
      referencia: fuente.referencia,
    };
  }

  if (
    codigo === "NESTING_FALLIDO" ||
    CODIGOS_NESTING.test(texto)
  ) {
    const titulo = /pieza_no_entra|no entra|fuera del [aá]rea/i.test(texto)
      ? "La pieza no entra en el material elegido"
      : /archivo_vectorial_requerido|geometria_requerida|falta cargar/i.test(
            texto,
          )
        ? "Falta cargar la geometría del producto"
        : /nesting_vectorial_pendiente|falta generar/i.test(texto)
          ? "Falta generar el nesting"
          : "GrafoNest necesita una corrección";
    return {
      codigo,
      titulo,
      mensaje: fuente.mensaje.replaceAll("OpenNest", "GrafoNest"),
      sugerencia:
        fuente.sugerencia ??
        "Revisá el archivo, las medidas y el material; después volvé a generar el nesting.",
      accion:
        fuente.accion ?? {
          tipo: "GENERAR_NESTING",
          etiqueta: "Volver a GrafoNest",
        },
      referencia: fuente.referencia,
    };
  }

  if (codigo === "DATOS_INCOMPLETOS" || CODIGOS_DATOS.test(texto)) {
    return {
      codigo,
      titulo: "Faltan datos para calcular",
      mensaje: fuente.mensaje,
      sugerencia:
        fuente.sugerencia ??
        "Completá o corregí los campos indicados y volvé a cotizar.",
      accion:
        fuente.accion ?? {
          tipo: "REVISAR_DATOS",
          etiqueta: "Revisar datos",
        },
      referencia: fuente.referencia,
    };
  }

  if (
    codigo === "CONFIGURACION_INCOMPLETA" ||
    CODIGOS_CONFIGURACION.test(texto)
  ) {
    return {
      codigo,
      titulo: "La configuración productiva está incompleta",
      mensaje: fuente.mensaje,
      sugerencia:
        fuente.sugerencia ??
        "Corregí la configuración indicada y luego volvé a cotizar.",
      accion:
        fuente.accion ??
        accionAbrir(
          "ABRIR_CONFIGURACION",
          "Abrir configuración",
          hrefConfiguracion,
        ),
      referencia: fuente.referencia,
    };
  }

  return {
    codigo,
    titulo: "El cálculo no pudo completarse",
    mensaje: fuente.mensaje,
    sugerencia:
      fuente.sugerencia ??
      "Reintentá una vez. Si vuelve a ocurrir, compartí la referencia con soporte.",
    accion:
      fuente.accion ?? { tipo: "REINTENTAR", etiqueta: "Reintentar ahora" },
    referencia: fuente.referencia,
  };
}

export function presentarErrorTrabajoCotizacion(
  error: ErrorTrabajoCotizacion,
  referencia?: string,
): ErrorCotizacionPresentado {
  return presentarErrorCotizacion({ ...error, referencia });
}

function accionAbrir(
  tipo: "ABRIR_CONFIGURACION" | "ABRIR_PUBLICACION",
  etiqueta: string,
  href: string | undefined,
): AccionErrorCotizacion {
  return href
    ? { tipo, etiqueta, href }
    : { tipo: "REVISAR_DATOS", etiqueta: "Revisar datos" };
}
