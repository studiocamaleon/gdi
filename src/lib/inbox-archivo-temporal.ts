import type { AbrirAdjuntoInbox, ArchivoInbox } from "./meta-inbox-api";

const limites: Record<string, number> = {
  "image/jpeg": 5_000_000,
  "image/png": 5_000_000,
  "image/webp": 500_000,
  "audio/aac": 16_000_000,
  "audio/amr": 16_000_000,
  "audio/mpeg": 16_000_000,
  "audio/mp4": 16_000_000,
  "audio/ogg": 16_000_000,
  "video/mp4": 16_000_000,
  "video/3gpp": 16_000_000,
  "application/pdf": 100_000_000,
};

/** Copia efímera en el navegador. Sin caché persistente, tokens de Meta ni
 * paso de los bytes por Next/API. Una firma vencida se recupera una vez. */
export async function cargarArchivoInbox(
  mensajeId: string,
  abrir: AbrirAdjuntoInbox,
  signal: AbortSignal,
  alProgreso?: (porcentaje: number) => void,
  mimeEsperado?: string,
): Promise<{ archivo: ArchivoInbox; blob: Blob }> {
  for (let intento = 0; intento < 2; intento++) {
    signal.throwIfAborted();
    const archivo = await abrir(mensajeId, signal);
    signal.throwIfAborted();
    if (mimeEsperado && archivo.mimeType !== mimeEsperado)
      throw new Error("El formato del archivo cambió.");
    const max = limites[archivo.mimeType];
    if (
      !max ||
      !Number.isSafeInteger(archivo.bytes) ||
      archivo.bytes < 1 ||
      archivo.bytes > max
    )
      throw new Error("Formato o tamaño no admitido para vista previa.");
    const response = await fetch(archivo.url, {
      signal,
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
    });
    if ([401, 403].includes(response.status) && intento === 0) {
      await response.body?.cancel();
      continue;
    }
    if (
      !response.ok ||
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== archivo.mimeType
    ) {
      await response.body?.cancel();
      throw new Error("No se pudo leer el archivo.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Archivo sin contenido.");
    const partes: Uint8Array<ArrayBuffer>[] = [];
    let total = 0,
      porcentaje = -1;
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > archivo.bytes)
          throw new Error("Tamaño de archivo inesperado.");
        partes.push(new Uint8Array(chunk.value));
        const siguiente = Math.floor((total / archivo.bytes) * 100);
        if (siguiente !== porcentaje) {
          porcentaje = siguiente;
          alProgreso?.(porcentaje);
        }
      }
    } finally {
      await reader.cancel();
    }
    signal.throwIfAborted();
    if (total !== archivo.bytes)
      throw new Error("El archivo llegó incompleto.");
    return { archivo, blob: new Blob(partes, { type: archivo.mimeType }) };
  }
  throw new Error("No se pudo leer el archivo.");
}
