import { apiRequest } from "./api";
export {
  cantidadImpresionesCad,
  errorCopiasPorPagina,
  mapaCopiasCad,
  type CopiasPaginaCad,
} from "../../apps/api/src/common/copias-paginas-cad";
import { planPaginaCad } from "../../apps/api/src/common/cad-geometria";
import {
  medidasSeleccionadas,
  type MedidaPagina,
} from "../../apps/api/src/common/medidas-documento";
export {
  medidasSeleccionadas,
  resumenMedidas,
  formatoMedida,
  numeroMedida,
  sugerirCad,
} from "../../apps/api/src/common/medidas-documento";
export type { MedidaPagina } from "../../apps/api/src/common/medidas-documento";

export type PerfilCadCopiado = {
  id: string;
  revision: string;
  nombre: string;
  maquinaNombre: string;
  maquinaId: string;
  productoNombre: string;
  materialNombre: string;
  papelMateriaPrimaId: string;
  productoId: string;
  rutaAlternativaId: string;
  materialVarianteId: string;
  gramaje: number | null;
  color: "BN" | "COLOR";
  prioridad: number;
  rollo: { anchoRolloMm: number; margenMm: number };
};
export const opcionesCadCopiado = () =>
  apiRequest<{ perfiles: PerfilCadCopiado[] }>("/centro-copiado/opciones-cad");

export function perfilCadPreferido(
  perfiles: readonly PerfilCadCopiado[],
  color: string,
) {
  const compatibles = perfiles
    .filter((p) => p.color === color)
    .sort((a, b) => b.prioridad - a.prioridad);
  return compatibles.length === 1 ||
    (compatibles.length > 1 &&
      compatibles[0].prioridad > compatibles[1].prioridad)
    ? compatibles[0]
    : undefined;
}

export function paginasCad(
  medidas: readonly MedidaPagina[] | undefined,
  rango: string,
  perfil?: PerfilCadCopiado,
) {
  return medidasSeleccionadas(medidas, rango).map((pagina) => {
    try {
      return {
        ...pagina,
        plan: perfil
          ? planPaginaCad(
              {
                ...perfil.rollo,
                origenPapel: "",
                usarOrigenPredeterminado: true,
              },
              pagina,
            )
          : null,
        error: null,
      };
    } catch (e) {
      return {
        ...pagina,
        plan: null,
        error: e instanceof Error ? e.message : "Revisá las medidas.",
      };
    }
  });
}
