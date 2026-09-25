import { apiRequest } from "@/lib/api";

export type EstadoMetaPiloto = {
  listo: boolean;
  destinatario: string;
  mensajes: {
    id: string;
    estado: string;
    estadoEntrega: string | null;
    estadoEntregaEl: string | null;
    motivo: string | null;
    metaErrorCodigo: string | null;
    createdAt: string;
  }[];
};
export const getMetaPiloto = () =>
  apiRequest<EstadoMetaPiloto | null>("/integraciones/meta/piloto");
export const enviarPruebaMeta = (clave: string) =>
  apiRequest<EstadoMetaPiloto>("/integraciones/meta/piloto/prueba", {
    method: "POST",
    body: JSON.stringify({ clave }),
  });
