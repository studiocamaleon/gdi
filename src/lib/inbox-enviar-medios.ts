import { apiRequest } from "@/lib/api";
import type { IntentoInbox } from "@/lib/meta-inbox-api";
import { formatoArchivoInbox } from "../../apps/api/src/common/inbox/medios";
function apiPost<T>(
  path: string,
  data: unknown,
  options?: { signal?: AbortSignal },
) {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
    signal: options?.signal,
  });
}
export type PedidoMedioInbox = {
  clave: string;
  canalId: string;
  archivoId: string;
  texto?: string;
};
export type MediosInboxApi = {
  cargar: (
    conversacionId: string,
    canalId: string,
    file: File,
    voz: boolean,
    signal: AbortSignal,
    progreso: (n: number) => void,
  ) => Promise<string>;
  enviar: (
    conversacionId: string,
    dto: PedidoMedioInbox,
    signal: AbortSignal,
  ) => Promise<IntentoInbox>;
  cancelar: (
    conversacionId: string,
    canalId: string,
    archivoId: string,
  ) => Promise<unknown>;
};
function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  signal: AbortSignal,
  progreso: (n: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abortar = () => {
      xhr.abort();
      reject(new DOMException("Carga cancelada", "AbortError"));
    };
    if (signal.aborted) return abortar();
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progreso(Math.round((e.loaded / e.total) * 100));
    };
    const terminar = (ok: boolean) => {
      signal.removeEventListener("abort", abortar);
      if (ok) resolve();
      else
        reject(new Error("No pudimos subir el archivo. Volvé a intentarlo."));
    };
    xhr.onload = () => terminar(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => terminar(false);
    xhr.ontimeout = () => terminar(false);
    xhr.onabort = () => signal.removeEventListener("abort", abortar);
    signal.addEventListener("abort", abortar, { once: true });
    xhr.send(file);
  });
}
export const mediosInboxApi: MediosInboxApi = {
  async cargar(id, canalId, file, voz, signal, progreso) {
    const mime = voz
      ? file.type.split(";")[0]
      : formatoArchivoInbox(file.name, file.type)?.mime;
    if (!mime) throw new Error("Formato no compatible con WhatsApp.");
    const r = await apiPost<{
      archivoId: string;
      subida: { url: string; headers: Record<string, string> };
    }>(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/cargas`,
      { canalId, nombre: file.name, mimeType: mime, bytes: file.size, voz },
      { signal },
    );
    if (!r?.archivoId || !r.subida?.url)
      throw new Error("No pudimos preparar la carga.");
    try {
      await put(r.subida.url, r.subida.headers, file, signal, progreso);
      return r.archivoId;
    } catch (e) {
      void mediosInboxApi.cancelar(id, canalId, r.archivoId).catch(() => {});
      throw e;
    }
  },
  async enviar(id, dto, signal) {
    const r = await apiPost<IntentoInbox>(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/medio`,
      dto,
      { signal },
    );
    if (!r) throw new Error("No pudimos confirmar el envío.");
    return r;
  },
  cancelar: (id, canalId, archivoId) =>
    apiPost(
      `/integraciones/meta/inbox/conversaciones/${encodeURIComponent(id)}/cargas/${encodeURIComponent(archivoId)}/cancelar`,
      { canalId },
    ),
};
