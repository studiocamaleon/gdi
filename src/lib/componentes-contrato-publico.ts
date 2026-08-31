import type {
  BindingParametroComponente,
  FormularioCotizacionProducto,
} from "@/lib/productos-servicios-api";

export type CondicionalPublicoComponente = {
  id: string;
  nombre: string;
  condicionadoPor: string[];
};

/**
 * Convierte el formulario público del producto hijo en el contrato que la
 * instancia del componente puede fijar, heredar o pedir durante la cotización.
 * Los pasos condicionales no son bindings: el motor hijo conserva su regla y
 * sólo necesita recibir los datos que esa regla consulta.
 */
export function parametrosPublicosDelComponente(
  formulario: FormularioCotizacionProducto,
  cantidadLegacy: number,
): BindingParametroComponente[] {
  const productoConMedida =
    formulario.medidas.instruccion !== "no_preguntar" ||
    Boolean(formulario.medidas.default);
  const parametros: BindingParametroComponente[] = [
    {
      clave: "cantidad",
      etiqueta: productoConMedida
        ? "Cantidad de piezas"
        : `Cantidad (${formulario.cantidad.unidad})`,
      tipoDato: "number",
      unidad: productoConMedida ? "unidad" : formulario.cantidad.unidad,
      requerido: true,
      origen: "FORMULA",
      regla: {
        campoPadre: "cantidad",
        operador: "MULTIPLICAR",
        valor: cantidadLegacy || 1,
        fuente: { tipo: "PADRE", campo: "cantidad" },
      },
    },
  ];

  if (productoConMedida) {
    parametros.push(
      {
        clave: "medidaCustomMm.anchoMm",
        etiqueta: "Ancho",
        tipoDato: "number",
        unidad: "mm",
        requerido: true,
        origen: formulario.medidas.default ? "DEFAULT_HIJO" : "COTIZACION",
        valor: formulario.medidas.default?.anchoMm,
      },
      {
        clave: "medidaCustomMm.altoMm",
        etiqueta: "Alto",
        tipoDato: "number",
        unidad: "mm",
        requerido: true,
        origen: formulario.medidas.default ? "DEFAULT_HIJO" : "COTIZACION",
        valor: formulario.medidas.default?.altoMm,
      },
    );
    if (formulario.medidas.ejes.includes("PROFUNDIDAD")) {
      parametros.push({
        clave: "profundidadMm",
        etiqueta: "Profundidad",
        tipoDato: "number",
        unidad: "mm",
        requerido: true,
        origen: formulario.medidas.default ? "DEFAULT_HIJO" : "COTIZACION",
        valor: formulario.medidas.default?.profundidadMm ?? undefined,
      });
    }
  }

  for (const pregunta of formulario.preguntas) {
    const opcionesCrudas = Array.isArray(pregunta.opciones)
      ? (pregunta.opciones as Array<Record<string, unknown>>)
      : [];
    parametros.push({
      clave: pregunta.jobContextKey,
      etiqueta: String(
        pregunta.etiqueta ??
          pregunta.slotNombre ??
          pregunta.paso ??
          pregunta.jobContextKey,
      ),
      tipoDato: String(pregunta.tipoDato ?? pregunta.tipo ?? "text"),
      unidad: typeof pregunta.unidad === "string" ? pregunta.unidad : null,
      requerido: pregunta.requerido === true,
      origen:
        pregunta.sugerido !== undefined || pregunta.default !== undefined
          ? "DEFAULT_HIJO"
          : pregunta.requerido === true
            ? "COTIZACION"
            : "DEFAULT_HIJO",
      valor: pregunta.sugerido ?? pregunta.default,
      opciones: opcionesCrudas.flatMap((opcion) => {
        const valor = opcion.varianteId ?? opcion.valor;
        return typeof valor === "string"
          ? [{ valor, etiqueta: String(opcion.etiqueta ?? valor) }]
          : [];
      }),
    });
  }

  for (const adicional of formulario.adicionales ?? []) {
    if (adicional.tipo !== "paso" || !adicional.jobContextKey) continue;
    parametros.push({
      clave: adicional.jobContextKey,
      etiqueta: adicional.nombre,
      tipoDato: "boolean",
      requerido: false,
      // Un paso opcional no debe desaparecer por usar el valor false del
      // hijo. Igual que en un producto cotizado de forma directa, nace
      // desmarcado pero disponible para que el comercial lo decida.
      origen: "COTIZACION",
      valor: false,
    });
  }

  return parametros.filter(
    (parametro, index, lista) =>
      lista.findIndex((item) => item.clave === parametro.clave) === index,
  );
}

export function condicionalesPublicosDelComponente(
  formulario: FormularioCotizacionProducto,
): CondicionalPublicoComponente[] {
  return (formulario.adicionales ?? []).flatMap((adicional) =>
    adicional.tipo === "paso_condicional"
      ? [
          {
            id: adicional.id,
            nombre: adicional.nombre,
            condicionadoPor: adicional.condicionadoPor ?? [],
          },
        ]
      : [],
  );
}
