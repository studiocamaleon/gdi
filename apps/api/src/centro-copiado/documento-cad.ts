import { errorCopiasPorPagina } from '../common/copias-paginas-cad';
import { errorMedidasDocumento } from '../common/medidas-documento';
import { errorPaginasDocumento } from '../common/rangos-paginas';
import type { DocumentoInput } from './adaptador';

/** El PDF conserva su geometría; una fila manual representa un plano y sus copias. */
export function errorDocumentoCad(doc: DocumentoInput): string | null {
  const error =
    errorPaginasDocumento(doc) ||
    errorMedidasDocumento(doc) ||
    errorCopiasPorPagina(doc);
  if (error) return error;
  if (doc.archivoNombre) {
    return doc.archivoNombre.toLowerCase().endsWith('.pdf') &&
      doc.medidasPaginas?.length &&
      doc.paginasOriginales
      ? null
      : 'Para Planos CAD, adjuntá un PDF con sus medidas por página.';
  }
  if (
    doc.paginas !== 1 ||
    doc.medidasPaginas?.length !== 1 ||
    doc.paginasOriginales != null ||
    doc.rangoPaginas?.trim() ||
    doc.copiasPorPagina != null ||
    doc.archivoBytes != null
  )
    return 'Cada fila manual debe tener las medidas de un plano y su cantidad de copias, sin datos de un archivo.';
  return null;
}
