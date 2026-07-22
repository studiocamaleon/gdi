import { apiRequest } from "@/lib/api";
import type { Archivo, ArchivoScope } from "@/lib/archivos";

type UrlFirmada = {
  url: string;
  headers: Record<string, string>;
  expiraEn: number;
};

export async function listarArchivos(
  scope: ArchivoScope,
  entidadId?: string,
): Promise<Archivo[]> {
  const qs = new URLSearchParams({ scope });
  if (entidadId) qs.set("entidadId", entidadId);
  return apiRequest<Archivo[]>(`/archivos?${qs.toString()}`);
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
  const { archivoId, subida } = await apiRequest<{
    archivoId: string;
    subida: UrlFirmada;
  }>("/archivos/iniciar", {
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

  await subirAlStorage(subida, file, onProgress, signal);

  return apiRequest<Archivo>(`/archivos/${archivoId}/confirmar`, {
    method: "POST",
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
