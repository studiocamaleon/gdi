/** Agrupa eventos simultáneos y descarta lecturas anteriores a una mutación local. */
export function crearSincronizadorTablero<T>(opciones: {
  puedeActualizar: (forzar: boolean) => boolean;
  consultar: () => Promise<T>;
  aplicar: (datos: T) => void;
  fallo: (error: unknown) => void;
}) {
  let revision = 0;
  let pendiente = false;
  let forzado = false;
  let consulta: Promise<void> | null = null;

  return {
    invalidar() { revision += 1; },
    actualizar(forzar = false): Promise<void> {
      pendiente = true;
      forzado ||= forzar;
      if (consulta) return consulta;
      if (!opciones.puedeActualizar(forzado)) return Promise.resolve();
      consulta = (async () => {
        while (pendiente && opciones.puedeActualizar(forzado)) {
          const version = revision;
          const forzarLectura = forzado;
          pendiente = false;
          forzado = false;
          try {
            const datos = await opciones.consultar();
            if (version === revision && opciones.puedeActualizar(forzarLectura)) {
              opciones.aplicar(datos);
            } else {
              pendiente = true;
            }
          } catch (error) {
            if (version === revision && opciones.puedeActualizar(forzarLectura)) opciones.fallo(error);
          }
        }
      })().finally(() => { consulta = null; });
      return consulta;
    },
  };
}

export function estadoMonitorProduccion(
  conexion: "conectando" | "en_vivo" | "respaldo",
  actualizado: number | null,
  ahora: number | null,
  error: boolean,
) {
  if (error || (actualizado != null && ahora != null && ahora - actualizado > 45_000))
    return { etiqueta: "Datos sin actualizar", tono: "warning" } as const;
  if (actualizado == null || conexion === "conectando")
    return { etiqueta: "Conectando", tono: "muted" } as const;
  return conexion === "en_vivo"
    ? { etiqueta: "En vivo", tono: "success" } as const
    : { etiqueta: "Actualización automática", tono: "warning" } as const;
}
