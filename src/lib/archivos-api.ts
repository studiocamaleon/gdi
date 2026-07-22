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
  cuotaBytes: number | null;
  porcentaje: number | null;
  bytesDetalle: number;
  porScope: Array<{ scope: ArchivoScope; bytes: number; cantidad: number }>;
  papelera: { bytes: number; cantidad: number };
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
  },
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Archivo> {
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
    }),
  });

  // El backend decide el camino según el tamaño: un solo PUT, o partes.
  const partes = inicio.multipart
    ? await subirEnPartes(inicio.multipart, file, onProgress, signal)
    : (await subirAlStorage(inicio.subida!, file, onProgress, signal), []);

  return apiRequest<Archivo>(`/archivos/${inicio.archivoId}/confirmar`, {
    method: "POST",
    body: JSON.stringify(partes.length > 0 ? { partes } : {}),
  });
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
      const parte = cola.shift();
      if (!parte) return;
      const desde = (parte.numero - 1) * multipart.tamanioParte;
      const trozo = file.slice(desde, desde + multipart.tamanioParte);
      const etag = await putConEtag(parte.url, trozo, signal, (bytes) => {
        subidoPorParte.set(parte.numero, bytes);
        avisar();
      });
      resultados.push({ numero: parte.numero, etag });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PARTES_EN_PARALELO, cola.length) }, trabajador),
  );
  onProgress?.(100);
  return resultados;
}

function putConEtag(
  url: string,
  trozo: Blob,
  signal: AbortSignal | undefined,
  onBytes: (bytes: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`El almacenamiento rechazó una parte (${xhr.status}).`));
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
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
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

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
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
