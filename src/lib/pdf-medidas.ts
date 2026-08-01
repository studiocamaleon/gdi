// Lectura de la medida física de un PDF, 100% en el navegador. Un PDF exportado
// desde CAD ("Plot to PDF") a escala 1:1 tiene el MediaBox = tamaño real de la
// hoja, así que leerlo nos da la medida del plano sin backend.

const PT_TO_MM = 25.4 / 72;

export type MedidaArchivoPagina = {
  archivoNombre: string;
  pagina: number;
  totalPaginas: number;
  anchoMm: number;
  altoMm: number;
};

export type LecturaArchivoResultado =
  | { ok: true; archivoNombre: string; paginas: MedidaArchivoPagina[] }
  | { ok: false; archivoNombre: string; error: string };

function esPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

async function leerUnArchivo(file: File): Promise<LecturaArchivoResultado> {
  if (!esPdf(file)) {
    return { ok: false, archivoNombre: file.name, error: "No es un PDF" };
  }
  try {
    const { PDFDocument, PDFName, PDFNumber } = await import("pdf-lib");
    const bytes = await file.arrayBuffer();
    // `ignoreEncryption`: muchos PDFs (ej. facturas de ARCA/AFIP) vienen con
    // permisos/encriptación con contraseña de usuario vacía; sin esto pdf-lib
    // tira "Input document is encrypted" y no se leen las páginas.
    const doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
    const pages = doc.getPages();
    if (pages.length === 0) {
      return { ok: false, archivoNombre: file.name, error: "PDF sin páginas" };
    }
    const total = pages.length;
    const paginas = pages.map((page, index) => {
      const { width, height } = page.getSize(); // puntos PostScript (1/72")
      const rotacion = ((page.getRotation().angle % 360) + 360) % 360;
      const rotado = rotacion === 90 || rotacion === 270;

      // UserUnit: multiplicador para planos que exceden el límite de 200" del PDF.
      let userUnit = 1;
      try {
        const uu = page.node.lookup(PDFName.of("UserUnit"), PDFNumber);
        if (uu) userUnit = uu.asNumber();
      } catch {
        // sin UserUnit → 1
      }

      const anchoPt = (rotado ? height : width) * userUnit;
      const altoPt = (rotado ? width : height) * userUnit;
      return {
        archivoNombre: file.name,
        pagina: index + 1,
        totalPaginas: total,
        anchoMm: Math.round(anchoPt * PT_TO_MM * 10) / 10,
        altoMm: Math.round(altoPt * PT_TO_MM * 10) / 10,
      };
    });
    return { ok: true, archivoNombre: file.name, paginas };
  } catch {
    return {
      ok: false,
      archivoNombre: file.name,
      error: "No se pudo leer el PDF",
    };
  }
}

export async function leerMedidasPdf(
  files: File[] | FileList,
): Promise<LecturaArchivoResultado[]> {
  const lista = Array.from(files);
  return Promise.all(lista.map((file) => leerUnArchivo(file)));
}
