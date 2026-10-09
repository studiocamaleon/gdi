import type { FuenteTomoPdf } from "../../apps/api/src/common/tomo-pdf";
import { listarArchivos } from "./archivos-api";
import { urlDeArchivo, type Archivo } from "./archivos";

export type SegmentoTomoPdf = Omit<FuenteTomoPdf, "cargar"> & {
  archivoNombre?: string;
  file?: File | null;
  origenItemIds?: string[];
};

/** Usa exclusivamente archivos autorizados por los endpoints de la sesión.
 * No acepta URLs externas ni utiliza las credenciales del almacenamiento.
 */
function fuentesDeTomo(segmentos: SegmentoTomoPdf[], signal?: AbortSignal) {
  const MAX_BYTES_TOMO = 100 * 1024 * 1024;
  const porItem = new Map<string, Promise<Archivo[]>>();
  let leidos = 0;
  const fuentes: FuenteTomoPdf[] = segmentos.map((s) => ({
    ...s,
    cargar: async () => {
      signal?.throwIfAborted();
      if (s.file) {
        leidos += s.file.size;
        if (leidos > MAX_BYTES_TOMO)
          throw new Error(
            "Los originales superan los 100 MB. Dividilos en tomos más pequeños.",
          );
        return new Uint8Array(await s.file.arrayBuffer());
      }
      const nombre = s.archivoNombre ?? s.nombre;
      const archivos: Archivo[] = [];
      for (const id of s.origenItemIds ?? []) {
        if (!porItem.has(id)) porItem.set(id, listarArchivos("ORDEN_ITEM", id));
        archivos.push(...(await porItem.get(id)!));
      }
      const candidatos = [
        ...new Map(
          archivos.filter((a) => a.nombre === nombre).map((a) => [a.id, a]),
        ).values(),
      ];
      // Nunca elegir silenciosamente otro original de igual nombre.
      if (candidatos.length !== 1)
        throw new Error(
          `No se pudo identificar «${nombre}». Revisá los originales de este tomo.`,
        );
      const archivo = candidatos[0];
      if (leidos + archivo.bytes > MAX_BYTES_TOMO)
        throw new Error(
          "Los originales superan los 100 MB. Dividilos en tomos más pequeños.",
        );
      const r = await fetch(urlDeArchivo(archivo.id), {
        signal,
        cache: "no-store",
      });
      if (!r.ok || !r.body)
        throw new Error(
          `No se pudo abrir «${nombre}». Revisá tu acceso a los archivos.`,
        );
      const reader = r.body.getReader();
      const partes: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          signal?.throwIfAborted();
          const next = await reader.read();
          if (next.done) break;
          leidos += next.value.byteLength;
          bytes += next.value.byteLength;
          if (leidos > MAX_BYTES_TOMO || bytes > archivo.bytes)
            throw new Error(
              "El archivo cambió o supera el tamaño permitido. Volvé a cargarlo.",
            );
          partes.push(next.value);
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
      if (bytes !== archivo.bytes)
        throw new Error(`La descarga de «${nombre}» quedó incompleta.`);
      const contenido = new Uint8Array(bytes);
      let offset = 0;
      for (const parte of partes) {
        contenido.set(parte, offset);
        offset += parte.byteLength;
      }
      return contenido;
    },
  }));
  return fuentes;
}

export async function generarPdfTomo(
  segmentos: SegmentoTomoPdf[],
  signal?: AbortSignal,
) {
  const { unificarTomoPdf } =
    await import("../../apps/api/src/common/tomo-pdf");
  const resultado = await unificarTomoPdf(fuentesDeTomo(segmentos, signal));
  signal?.throwIfAborted();
  return resultado;
}

/** Al separar un tomo guardado, el origen sólo puede trasladarse a un destino.
 * Los otros conservan una copia privada del original para la subida habitual.
 * No se modifica ni borra ningún archivo durante la edición.
 */
export async function recuperarOriginalesTomo(
  segmentos: SegmentoTomoPdf[],
): Promise<File[]> {
  const fuentes = fuentesDeTomo(segmentos);
  const files: File[] = [];
  for (const [i, fuente] of fuentes.entries()) {
    const s = segmentos[i];
    if (s.file) {
      files.push(s.file);
      continue;
    }
    const nombre = s.archivoNombre ?? s.nombre;
    const bytes = await fuente.cargar();
    files.push(
      new File([new Uint8Array(bytes)], nombre, {
        type: nombre.toLowerCase().endsWith(".pdf") ? "application/pdf" : "",
      }),
    );
  }
  return files;
}
