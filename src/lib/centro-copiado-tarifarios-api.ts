import { apiRequest } from "./api";
import type { ContenidoTarifario } from "../../apps/api/src/centro-copiado/tarifarios/contenido-tarifario";
import type {
  PoliticaPrecios,
  CanalCopiado,
} from "../../apps/api/src/centro-copiado/tarifarios/politica-precios";
import type { PerfilCadCopiado } from "./centro-copiado-cad";
export type { ContenidoTarifario, PoliticaPrecios, CanalCopiado };

export type ResumenTarifario = {
  id: string;
  nombre: string;
  revision: number;
  ultimoNumero: number;
};
export type BorradorTarifario = ResumenTarifario & {
  contenido: ContenidoTarifario;
};
export type ResumenVersion = {
  id: string;
  numero: number;
  revisionBorrador: number;
  nombre: string;
  tipoVigencia: "INMEDIATA" | "PROGRAMADA";
  vigenteDesde: string;
  publicadoEl: string;
};
export type VersionTarifario = ResumenVersion & {
  tarifarioId: string;
  contenido: ContenidoTarifario;
};
export type BorradorPolitica = {
  estado: "BORRADOR";
  operativa: false;
  revision: number;
  contenido: PoliticaPrecios;
  actualizadoEl: string | null;
};
export type VistaCanales = {
  borrador: BorradorPolitica;
  monedaCodigo: string;
  evaluadoEl: string;
  canales: ({ canalVenta: CanalCopiado; origen: "GENERAL" | "CANAL" } & (
    | { estado: "MOTOR" }
    | {
        estado: "TARIFARIO";
        version: Pick<
          ResumenVersion,
          "id" | "numero" | "nombre" | "vigenteDesde"
        >;
      }
    | {
        estado: "PENDIENTE";
        motivo:
          | "SIN_VERSION_VIGENTE"
          | "TARIFARIO_NO_DISPONIBLE"
          | "MONEDA_INCOMPATIBLE";
      }
  ))[];
};
const ruta = "/centro-copiado/tarifarios";
export type Pagina<T> = { items: T[]; siguiente: number | null };
// Los selectores deben incluir también tarifarios que estén después de la primera página.
export async function todasLasPaginas<T>(
  leer: (desplazamiento: number) => Promise<Pagina<T>>,
) {
  const items: T[] = [];
  let desplazamiento = 0;
  for (;;) {
    const pagina = await leer(desplazamiento);
    items.push(...pagina.items);
    if (pagina.siguiente === null) return items;
    if (pagina.siguiente <= desplazamiento)
      throw new Error("No se pudo completar el listado. Volvé a cargarlo.");
    desplazamiento = pagina.siguiente;
  }
}
export const listarTarifarios = () =>
  todasLasPaginas((d) =>
    apiRequest<Pagina<ResumenTarifario>>(`${ruta}?desplazamiento=${d}`),
  );
export const obtenerTarifario = (id: string) =>
  apiRequest<BorradorTarifario>(`${ruta}/${id}`);
export const guardarTarifario = (
  id: string | null,
  datos: { nombre: string; contenido: ContenidoTarifario; revision?: number },
) =>
  apiRequest<BorradorTarifario>(id ? `${ruta}/${id}` : ruta, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos),
  });
export const versionesTarifario = (id: string) =>
  todasLasPaginas((d) =>
    apiRequest<Pagina<ResumenVersion>>(
      `${ruta}/${id}/versiones?desplazamiento=${d}`,
    ),
  );
export const leerVersionTarifario = (id: string, version: string) =>
  apiRequest<VersionTarifario>(`${ruta}/${id}/versiones/${version}`);
export const vigenteTarifario = (id: string) =>
  apiRequest<{ version: VersionTarifario | null }>(`${ruta}/${id}/vigente`);
export const publicarTarifario = (
  id: string,
  datos: {
    revision: number;
    tipoVigencia: "INMEDIATA" | "PROGRAMADA";
    vigenteDesde?: string;
  },
) =>
  apiRequest<VersionTarifario>(`${ruta}/${id}/publicar`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
export const catalogoCadTarifarios = () =>
  apiRequest<{ perfiles: PerfilCadCopiado[] }>(
    "/centro-copiado/config/opciones-cad",
  );
const politica = "/centro-copiado/politica-precios/borrador";
export const leerPoliticaTarifarios = () =>
  apiRequest<BorradorPolitica>(politica);
export const guardarPoliticaTarifarios = (
  revision: number,
  contenido: PoliticaPrecios,
) =>
  apiRequest<BorradorPolitica>(politica, {
    method: "PUT",
    body: JSON.stringify({ revision, contenido }),
  });
export const previsualizarCanales = () =>
  apiRequest<VistaCanales>(`${politica}/previsualizacion`);
