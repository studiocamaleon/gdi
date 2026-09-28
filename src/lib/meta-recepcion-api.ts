import { apiRequest } from "@/lib/api";

export type RecepcionMeta = {
  contacto: string;
  mensajes: {
    id: string;
    remitente: string;
    nombreContacto: string | null;
    tipo: string;
    texto: string | null;
    enviadoEl: string;
  }[];
};

export const getMetaRecepcion = () =>
  apiRequest<RecepcionMeta | null>("/integraciones/meta/recepcion");
