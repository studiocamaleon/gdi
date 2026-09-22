import { apiRequest } from "@/lib/api";
import type { Archivo, ArchivoScope } from "@/lib/archivos";

type UrlFirmada = {
  url: string;
  headers: Record<string, string>;
  expiraEn: number;
};

type MultipartIniciado = {
  uploadId: string;
  partes: Array<{ numero: number; url: string }>;
  tamanioParte: number;
};

type IniciarRespuesta = {
  archivoId: string;
  subida?: UrlFirmada;
  multipart?: MultipartIniciado;
};

/** Cuántas partes viajan a la vez. Más no acelera: satura la subida. */
const PARTES_EN_PARALELO = 3;

export async function listarArchivos(
  scope: ArchivoScope,
  entidadId?: string,
): Promise<Archivo[]> {
  const qs = new URLSearchParams({ scope });
  if (entidadId) qs.set("entidadId", entidadId);
  return apiRequest<Archivo[]>(`/archivos?${qs.toString()}`);
}

export type ArchivoEnPapelera = Archivo & {
  eliminadoEl: string;
  diasRestantes: number;
};

export type UsoAlmacenamiento = {
  bytes: number;
  bytesReservados: number;
  cargasPendientes: number;
  bytesComprometidos: number;
  excedidoBytes: number;
  /** La cuota que rige: el ajuste de la cuenta si lo hay, si no la del plan. */
  cuotaBytes: number | null;
  cuotaOrigen: "plan" | "ajuste" | "sin_limite";
  restanteBytes: number | null;
  porcentaje: number | null;
  bytesDetalle: number;
  porScope: Array<{ scope: ArchivoScope; bytes: number; cantidad: number }>;
  papelera: { bytes: number; cantidad: number };
  plan: { nombre: string; storageGb: number | null } | null;
};

export async function getUsoAlmacenamiento(): Promise<UsoAlmacenamiento> {
  return apiRequest<UsoAlmacenamiento>("/archivos/uso");
}

export async function getPapelera(
  scope: ArchivoScope,
  entidadId?: string,
): Promise<ArchivoEnPapelera[]> {
  const qs = new URLSearchParams({ scope });
  if (entidadId) qs.set("entidadId", entidadId);
  return apiRequest<ArchivoEnPapelera[]>(`/archivos/papelera?${qs.toString()}`);
}

export async function restaurarArchivo(id: string): Promise<Archivo> {
  return apiRequest(`/archivos/${id}/restaurar`, { method: "POST" });
}

export type ArchivosDeOrden = {
  documento: Archivo[];
  items: Array<{ itemId: string; nombre: string; archivos: Archivo[] }>;
};

/** Documento + todos los items en una sola request (el tab los muestra juntos). */
export async function getArchivosDeOrden(
  ordenId: string,
): Promise<ArchivosDeOrden> {
  return apiRequest<ArchivosDeOrden>(`/archivos/de-orden/${ordenId}`);
}

export async function actualizarArchivo(
  id: string,
  dto: { publico?: boolean; descripcion?: string },
): Promise<Archivo> {
  return apiRequest(`/archivos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export async function eliminarArchivo(id: string): Promise<void> {
  await apiRequest(`/archivos/${id}`, { method: "DELETE" });
}

/**
 * Sube en tres pasos: pedir URL firmada → PUT **directo al storage** →
 * confirmar. Los bytes no pasan por el API ni por el proxy de Next; sólo
 * viajan dos JSON chicos.
 *
 * El PUT va con XHR y no con fetch porque `fetch` no expone progreso de
 * subida (no hay equivalente a `upload.onprogress`), y sin barra de progreso
 * un archivo de imprenta de 80 MB parece que se colgó.
 */
export async function subirArchivo(
  file: File,
  destino: {
    scope: ArchivoScope;
    entidadId?: string;
    descripcion?: string;
    publico?: boolean;
    /** Marca de automatismo: lo produjo el sistema, no una persona. */
    autogeneradoPor?: string;
    /** Calcula SHA-256 antes de subir; requerido para una revisión controlada. */
    calcularHash?: boolean;
  },
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Archivo> {
  signal?.throwIfAborted();
  const hash = destino.calcularHash ? await sha256Archivo(file) : undefined;
  const inicio = await apiRequest<IniciarRespuesta>("/archivos/iniciar", {
    method: "POST",
    body: JSON.stringify({
      scope: destino.scope,
      entidadId: destino.entidadId,
      nombre: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: file.size,
      descripcion: destino.descripcion,
      publico: destino.publico,
      autogeneradoPor: destino.autogeneradoPor,
      hash,
    }),
  });

  try {
    signal?.throwIfAborted();
    const partes = inicio.multipart
      ? await subirEnPartes(inicio.multipart, file, onProgress, signal)
      : (await subirAlStorage(inicio.subida!, file, onProgress, signal), []);
    signal?.throwIfAborted();
    return await apiRequest<Archivo>(
      `/archivos/${inicio.archivoId}/confirmar`,
      {
        method: "POST",
        body: JSON.stringify(partes.length > 0 ? { partes } : {}),
      },
    );
  } catch (error) {
    // No usa la señal cancelada. Si el confirmar ya tuvo éxito pero se perdió
    // su respuesta, este endpoint preserva el archivo que quedó LISTO.
    await apiRequest(`/archivos/${inicio.archivoId}/cancelar-subida`, {
      method: "POST",
    }).catch(() => undefined);
    throw error;
  }
}

async function sha256Archivo(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Subida en partes. Un PUT único de 800 MB se cae con cualquier microcorte y
 * hay que empezar de cero; partido, se reintenta sólo el trozo que falló.
 *
 * Cada PUT devuelve un ETag que hay que juntar para cerrar el multipart. En
 * R2 eso exige que el bucket exponga el header `ETag` por CORS: si no, el
 * navegador lo esconde y `getResponseHeader` devuelve null.
 */
async function subirEnPartes(
  multipart: MultipartIniciado,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Array<{ numero: number; etag: string }>> {
  const control = new AbortController();
  const cancelar = () => control.abort();
  signal?.addEventListener("abort", cancelar, { once: true });
  if (signal?.aborted) control.abort();
  const subidoPorParte = new Map<number, number>();
  const avisar = () => {
    if (!onProgress) return;
    let subido = 0;
    for (const n of subidoPorParte.values()) subido += n;
    onProgress(Math.min(99, Math.round((subido / file.size) * 100)));
  };

  const resultados: Array<{ numero: number; etag: string }> = [];
  const cola = [...multipart.partes];

  const trabajador = async () => {
    for (;;) {
      control.signal.throwIfAborted();
      const parte = cola.shift();
      if (!parte) return;
      const desde = (parte.numero - 1) * multipart.tamanioParte;
      const trozo = file.slice(desde, desde + multipart.tamanioParte);
      const etag = await putConEtag(
        parte.url,
        trozo,
        control.signal,
        (bytes) => {
          subidoPorParte.set(parte.numero, bytes);
          avisar();
        },
      );
      resultados.push({ numero: parte.numero, etag });
    }
  };

  try {
    const tareas = Array.from(
      { length: Math.min(PARTES_EN_PARALELO, cola.length) },
      () =>
        trabajador().catch((error: unknown) => {
          control.abort();
          throw error;
        }),
    );
    // Se detienen TODOS los PUT antes de liberar la reserva.
    const resultadosTareas = await Promise.allSettled(tareas);
    const fallo = resultadosTareas.find((r) => r.status === "rejected");
    if (fallo?.status === "rejected") throw fallo.reason;
    onProgress?.(100);
    return resultados;
  } finally {
    signal?.removeEventListener("abort", cancelar);
  }
}

function putConEtag(
  url: string,
  trozo: Blob,
  signal: AbortSignal | undefined,
  onBytes: (bytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelado", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(`El almacenamiento rechazó una parte (${xhr.status}).`),
        );
        return;
      }
      const etag = xhr.getResponseHeader("ETag");
      if (!etag) {
        reject(
          new Error(
            "El almacenamiento no devolvió el ETag de la parte. " +
              "Revisá que el bucket exponga ese header por CORS.",
          ),
        );
        return;
      }
      resolve(etag);
    };
    xhr.onerror = () =>
      reject(new Error("Se cortó la conexión subiendo una parte."));
    xhr.onabort = () => reject(new DOMException("Cancelado", "AbortError"));
    const cancelar = () => xhr.abort();
    signal?.addEventListener("abort", cancelar, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", cancelar);
    xhr.send(trozo);
  });
}

function subirAlStorage(
  subida: UrlFirmada,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelado", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", subida.url, true);
    for (const [k, v] of Object.entries(subida.headers)) {
      xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            `El almacenamiento rechazó la subida (${xhr.status}). Probá de nuevo.`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new Error("Se cortó la conexión con el almacenamiento."));
    xhr.onabort = () => reject(new DOMException("Cancelado", "AbortError"));

    const cancelar = () => xhr.abort();
    signal?.addEventListener("abort", cancelar, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", cancelar);
    xhr.send(file);
  });
}

// ── Logo del tenant ──────────────────────────────────────────────────

export type LogoTenant = { archivoId: string; nombre: string } | null;

export async function getLogoTenant(): Promise<LogoTenant> {
  return apiRequest<LogoTenant>("/tenants/logo");
}

export async function definirLogoTenant(
  archivoId: string,
): Promise<LogoTenant> {
  return apiRequest("/tenants/logo", {
    method: "PUT",
    body: JSON.stringify({ archivoId }),
  });
}

export async function quitarLogoTenant(): Promise<void> {
  await apiRequest("/tenants/logo", { method: "DELETE" });
}
