import type { VistaEtiqueta } from "./impresion-api";
/** Descarga manual: conserva los 100 × 150 mm y el mismo QR de entrega. */
export async function descargarEtiquetaPdf(vista: VistaEtiqueta) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    unit: "mm",
    format: [100, 150],
    orientation: "portrait",
    compress: true,
  });
  vista.paginas.forEach((imagen, i) => {
    if (i) pdf.addPage([100, 150], "portrait");
    pdf.addImage(imagen, "PNG", 0, 0, 100, 150);
  });
  pdf.save(`etiqueta-${vista.numero.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`);
}
