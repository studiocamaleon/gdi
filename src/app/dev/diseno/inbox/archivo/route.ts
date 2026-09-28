import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
/** Archivo sintético y público sólo en desarrollo. Nunca representa un adjunto real. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 240]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Grafo Inbox", {
    x: 32,
    y: 186,
    size: 24,
    font,
    color: rgb(0.95, 0.3, 0.1),
  });
  page.drawText("Documento de ejemplo", { x: 32, y: 148, size: 17, font });
  page.drawText(
    "Datos ficticios. Sin cuenta de Meta ni archivos de clientes.",
    { x: 32, y: 108, size: 11, font },
  );
  const segunda = pdf.addPage([420, 240]);
  segunda.drawText("Detalle del documento", { x: 32, y: 186, size: 20, font });
  segunda.drawText("Pagina 2 de 2 - Muestra local de Grafo Inbox.", {
    x: 32,
    y: 148,
    size: 12,
    font,
  });
  segunda.drawText("Podes cambiar de pagina y ampliar la vista.", {
    x: 32,
    y: 108,
    size: 12,
    font,
  });
  return new Response(new Uint8Array(await pdf.save()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(request.url).searchParams.get("vista") === "inline" ? "inline" : "attachment"}; filename="Ejemplo-inbox.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
