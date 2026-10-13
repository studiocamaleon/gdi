import {
  calcularHojas,
  pliegoDeDoc,
  type VariantePapel,
  type DocumentoInput,
} from './adaptador';
import { enteroPapel } from '../inventario/papel-derivado';

export function seleccionarPapelesCortados(
  papeles: Array<{ materiaPrimaId: string; variantes: VariantePapel[] }>,
  dto: {
    documentos: DocumentoInput[];
    grupos?: Array<{ id: string; juegos: number }>;
  },
  simulacion: boolean,
  materialesFijados?: Set<string>,
  mermaPapelPct = 0,
) {
  // Un remanente sólo se ofrece si alcanza para todos los documentos del
  // pedido de ese papel/tamaño, descontando reservas de otras órdenes.
  for (const papel of papeles) {
    const fijadas =
      materialesFijados &&
      papel.variantes.filter((v) => materialesFijados!.has(v.id));
    if (fijadas?.length) {
      papel.variantes = fijadas;
      continue;
    }
    papel.variantes = papel.variantes.filter((v) => {
      if (!v.origenDerivadoId) return true;
      if (simulacion) return false; // referencia de reposición estable del tarifario
      const hojas = dto.documentos
        .filter(
          (d) =>
            d.modo !== 'CAD' &&
            d.papelMateriaPrimaId === papel.materiaPrimaId &&
            (d.gramaje == null || d.gramaje === v.gramajeGr) &&
            Math.min(pliegoDeDoc(d).anchoMm, pliegoDeDoc(d).altoMm) ===
              Math.min(v.anchoMm ?? 0, v.altoMm ?? 0) &&
            Math.max(pliegoDeDoc(d).anchoMm, pliegoDeDoc(d).altoMm) ===
              Math.max(v.anchoMm ?? 0, v.altoMm ?? 0),
        )
        .reduce(
          (s, d) =>
            s +
            enteroPapel(
              calcularHojas(
                d.paginas,
                dto.grupos?.find((g) => g.id === d.grupoId)?.juegos ?? d.copias,
                d.faz,
              ).hojas *
                (1 + Math.max(0, mermaPapelPct) / 100),
            ),
          0,
        );
      return hojas > 0 && (v.stockLibre ?? 0) >= hojas;
    });
  }
}
