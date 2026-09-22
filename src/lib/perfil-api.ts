import { apiRequest } from "./api";

export type EstadoMfa = {
  dispositivosRecordados: number;
  activo: boolean;
  activadoEl: string | null;
  codigosRestantes: number;
  disponible: boolean;
  requiereMfa: boolean;
  recuperacionConfirmada: boolean;
};
export type AltaMfa = {
  setupId: string;
  secret: string;
  qrDataUrl: string;
  expiresAt: string;
};
export const editarPerfil = (nombreCompleto: string) =>
  apiRequest<{ nombreCompleto: string; fotoPerfilVersion: string | null }>(
    "/auth/perfil",
    { method: "PATCH", body: JSON.stringify({ nombreCompleto }) },
  );
export const subirFotoPerfil = (contenido: string) =>
  apiRequest<{ fotoPerfilVersion: string }>("/auth/perfil/foto", {
    method: "PUT",
    body: JSON.stringify({ contenido }),
  });
export const quitarFotoPerfil = () =>
  apiRequest<{ fotoPerfilVersion: null }>("/auth/perfil/foto", {
    method: "DELETE",
  });
export const estadoMfa = () => apiRequest<EstadoMfa>("/auth/perfil/mfa");
export const olvidarDispositivosMfa = () =>
  apiRequest<{ ok: boolean; requiereLogin: boolean }>(
    "/auth/perfil/mfa/dispositivos",
    { method: "DELETE" },
  );
export const iniciarMfa = (password: string) =>
  apiRequest<AltaMfa>("/auth/perfil/mfa/iniciar", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
export const confirmarMfa = (setupId: string, codigo: string) =>
  apiRequest<{ codigosRecuperacion: string[]; versionRecuperacion: number }>(
    "/auth/perfil/mfa/confirmar",
    {
      method: "POST",
      body: JSON.stringify({ setupId, codigo }),
    },
  );
export const cancelarMfa = () =>
  apiRequest("/auth/perfil/mfa/pendiente", { method: "DELETE" });
export const gestionarMfa = (
  accion: "desactivar" | "recuperacion",
  password: string,
  codigo: string,
) =>
  apiRequest<{ codigosRecuperacion: string[]; versionRecuperacion: number }>(
    `/auth/perfil/mfa/${accion}`,
    {
      method: "POST",
      body: JSON.stringify({ password, codigo }),
    },
  );

export const confirmarRecuperacionMfa = (version: number) =>
  apiRequest<{ ok: boolean }>("/auth/perfil/mfa/recuperacion/confirmar", {
    method: "POST",
    body: JSON.stringify({ version }),
  });
export const reemplazarMfa = (password: string, codigo: string) =>
  apiRequest<AltaMfa>("/auth/perfil/mfa/reemplazar", {
    method: "POST",
    body: JSON.stringify({ password, codigo }),
  });

/** El navegador reduce el archivo; el servidor vuelve a validar y codificar. */
export async function prepararFotoPerfil(archivo: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type))
    throw new Error("Elegí una foto JPG, PNG o WEBP.");
  if (archivo.size > 10 * 1024 * 1024)
    throw new Error("Elegí una foto de hasta 10 MB.");
  const bitmap = await createImageBitmap(archivo);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("No pudimos preparar la foto. Probá con otra imagen.");
    const lado = Math.min(bitmap.width, bitmap.height);
    ctx.fillStyle = "#f3f2ee";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(
      bitmap,
      (bitmap.width - lado) / 2,
      (bitmap.height - lado) / 2,
      lado,
      lado,
      0,
      0,
      512,
      512,
    );
    return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
  } finally {
    bitmap.close();
  }
}
