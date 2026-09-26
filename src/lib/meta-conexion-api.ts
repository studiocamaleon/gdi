import { apiRequest } from "./api";
export type ModoMeta = "SANDBOX" | "COEXISTENCIA";
export type IntentoMeta = { id: string; estadoSecreto: string };
export type PreparacionMeta = IntentoMeta & {
  venceEl: string;
  appId: string;
  configId: string;
  graphVersion: string;
  modo: ModoMeta;
};
export type RespuestaIntentoMeta = {
  id: string;
  estado:
    | "PREPARADA"
    | "CANJEANDO"
    | "CANJEADA"
    | "VERIFICANDO"
    | "VERIFICADA"
    | "CANCELADA"
    | "REINICIAR";
  modo: ModoMeta;
  falloCodigo: string | null;
};
export type EstadoConexionMeta = {
  empresaId: string;
  usuarioId: string;
  modo: ModoMeta | null;
  disponible: boolean;
  sandboxVerificadoEl: string | null;
  canal: null | {
    numero: string;
    reconexionPermitida?: boolean;
    resumen?: {
      estado:
        | "PREPARANDO"
        | "ESPERANDO_META"
        | "RECIBIENDO"
        | "PROCESANDO"
        | "RECIBIDO_PROCESADO"
        | "NO_COMPARTIDO"
        | "REVISION";
      pendientes: number;
      revisiones: number;
      bloquesProcesados: number;
      ultimoRecibidoEl: string | null;
    } | null;
    estado: string;
    credencialVencida: boolean;
    recepcionPreparada: boolean;
    alta: null | {
      estado: string;
      falloCodigo: string | null;
      updatedAt: string;
    };
    importacion: null | {
      progresoInformado: number;
      finInformadoEl: string | null;
      historialRechazado: boolean;
      necesitaRevision: boolean;
    };
    pendientes: number;
    revisiones: number;
  };
};
const base = "/integraciones/meta/conexion";
const identificar = (i: IntentoMeta) => ({
  id: i.id,
  estadoSecreto: i.estadoSecreto,
});
const post = <T>(ruta: string, body: unknown) =>
  apiRequest<T>(`${base}/${ruta}`, {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
export const metaConexionApi = {
  estado: (signal?: AbortSignal) =>
    apiRequest<EstadoConexionMeta>(base, { signal }),
  preparar: () => post<PreparacionMeta>("preparar", {}),
  consultar: (intento: IntentoMeta) =>
    post<RespuestaIntentoMeta>("consultar", identificar(intento)),
  canjear: (intento: IntentoMeta, codigo: string) =>
    post<RespuestaIntentoMeta>("canjear", { ...identificar(intento), codigo }),
  verificar: (
    intento: IntentoMeta,
    activos: { wabaId: string; phoneNumberId?: string },
  ) =>
    post<RespuestaIntentoMeta>("verificar", {
      ...identificar(intento),
      ...activos,
    }),
  cancelar: (intento: IntentoMeta) =>
    post<RespuestaIntentoMeta>("cancelar", identificar(intento)),
};
export type MetaConexionApi = typeof metaConexionApi;
