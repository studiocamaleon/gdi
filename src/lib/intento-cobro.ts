/** Conserva la identidad de un cobro al reintentar una respuesta perdida. */
export function crearIntentoCobro() {
  let enCurso = false;
  let huella: string | null = null;
  let clave: string | null = null;
  return {
    iniciar(payload: unknown): string | null {
      if (enCurso) return null;
      const siguiente = JSON.stringify(payload);
      if (siguiente !== huella) {
        huella = siguiente;
        clave = crypto.randomUUID();
      }
      enCurso = true;
      return clave;
    },
    liberar() {
      enCurso = false;
    },
  };
}
