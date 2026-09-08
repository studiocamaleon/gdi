import { describe, expect, it } from "vitest";
import { presentarErrorCotizacion } from "./cotizacion-errores";

describe("presentarErrorCotizacion", () => {
  it("explica una receta desactualizada y enlaza su publicación", () => {
    const error = presentarErrorCotizacion({
      codigo: "RECETA_DESACTUALIZADA",
      mensaje:
        "La receta publicada V12 tiene cambios productivos sin publicar.",
      productoId: "producto-1",
      rutaAlternativaId: "ruta-1",
    });

    expect(error.titulo).toBe("La receta cambió después de publicarse");
    expect(error.accion).toMatchObject({
      tipo: "ABRIR_PUBLICACION",
      etiqueta: "Revisar publicación",
    });
    expect(error.accion.href).toContain("producto-1");
  });

  it("distingue datos comerciales faltantes de configuración productiva", () => {
    const datos = presentarErrorCotizacion({
      codigo: "material_comercial_requerido",
      mensaje: "Falta seleccionar el sustrato principal.",
    });
    const configuracion = presentarErrorCotizacion({
      codigo: "centro_costo_sin_tarifa_publicada",
      mensaje: "El centro de costo no tiene una tarifa publicada.",
      productoId: "producto-1",
    });

    expect(datos.accion.tipo).toBe("REVISAR_DATOS");
    expect(configuracion.accion.tipo).toBe("ABRIR_CONFIGURACION");
  });

  it("lleva los errores vectoriales a GrafoNest", () => {
    const error = presentarErrorCotizacion({
      codigo: "pieza_no_entra_en_sustrato",
      mensaje: "La pieza no entra en la placa seleccionada.",
    });

    expect(error.titulo).toBe("La pieza no entra en el material elegido");
    expect(error.accion.tipo).toBe("GENERAR_NESTING");
  });

  it("permite reintentar un problema de conectividad", () => {
    const error = presentarErrorCotizacion({
      codigo: "SERVICIO_NO_DISPONIBLE",
      mensaje: "No se pudo conectar con el API.",
    });

    expect(error.titulo).toBe("El motor de cálculo no respondió");
    expect(error.accion.tipo).toBe("REINTENTAR");
  });
});
