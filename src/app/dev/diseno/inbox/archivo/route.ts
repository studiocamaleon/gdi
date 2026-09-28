import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
/** Archivo sintético y público sólo en desarrollo. Nunca representa un adjunto real. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });
  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo === "audio" || tipo === "sticker" || tipo === "texto") {
    const nombre =
      tipo === "audio"
        ? "tono.m4a"
        : tipo === "sticker"
          ? "sticker.webp"
          : "indicaciones.txt";
    const bytes =
      tipo === "texto"
        ? Buffer.from(
            "Muestra ficticia de Grafo Inbox. No contiene datos de clientes.\n",
          )
        : await readFile(
            path.join(
              process.cwd(),
              "src/app/dev/diseno/inbox/archivo/fixtures",
              nombre,
            ),
          );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          tipo === "audio"
            ? "audio/mp4"
            : tipo === "sticker"
              ? "image/webp"
              : "text/plain",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  pdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
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
  const bytes = new Uint8Array(await pdf.save());
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${new URL(request.url).searchParams.get("vista") === "inline" ? "inline" : "attachment"}; filename="Ejemplo-inbox.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
