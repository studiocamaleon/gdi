import { apiRequest } from "@/lib/api";

export type CambioSistema = {
  eventoId: string;
  tipo: string;
  topicos: string[];
  createdAt: string;
};

export type NotificacionInterna = {
  id: string;
  leidaEl: string | null;
  createdAt: string;
  evento: {
    id: string;
    tipo: string;
    actorNombre: string;
    titulo: string;
    mensaje: string;
    href: string | null;
    severidad: "INFO" | "EXITO" | "ADVERTENCIA" | "CRITICA";
    createdAt: string;
  };
};

export const listarNotificacionesInternas = (limite = 30) =>
  apiRequest<NotificacionInterna[]>(
    `/eventos-sistema/notificaciones?limite=${limite}`,
  );

export const contarNotificacionesNoLeidas = () =>
  apiRequest<{ cantidad: number }>("/eventos-sistema/notificaciones/no-leidas");

export const marcarNotificacionLeida = (id: string) =>
  apiRequest<{ ok: true }>(`/eventos-sistema/notificaciones/${id}/leer`, {
    method: "PATCH",
  });

export const marcarTodasLasNotificacionesLeidas = () =>
  apiRequest<{ actualizadas: number }>(
    "/eventos-sistema/notificaciones/leer-todas",
    { method: "PATCH" },
  );

export const consultarCambiosSistema = (desde?: string) =>
  apiRequest<{ cursor: string; cambios: CambioSistema[] }>(
    `/eventos-sistema/cambios${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`,
  );
