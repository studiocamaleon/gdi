import { jsPDF } from 'jspdf';

/** Documento fijo: permite probar el equipo sin acceder a archivos de clientes. */
export function pdfPruebaA4() {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (let pagina = 1; pagina <= 2; pagina++) {
    if (pagina > 1) pdf.addPage();
    pdf.setTextColor(20);
    pdf.setDrawColor(80);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('GRAFO / PRUEBA DE IMPRESION', 20, 24);
    pdf.setFontSize(28);
    pdf.text(`Pagina ${pagina} de 2`, 20, 49);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('A4 / Blanco y negro / Una pagina por cara', 20, 63);
    pdf.text('ARRIBA', 105, 87, { align: 'center' });
    pdf.line(105, 94, 105, 114);
    pdf.line(105, 94, 101, 100);
    pdf.line(105, 94, 109, 100);
    pdf.rect(20, 124, 170, 70);
    pdf.setFontSize(60);
    pdf.text(String(pagina), 105, 170, { align: 'center' });
    pdf.setFontSize(11);
    const lineas =
      pagina === 1
        ? [
            'Simple faz: deben salir dos hojas por copia.',
            'Doble faz: deben salir ambas paginas en una misma hoja.',
            'Cada copia debe contener las paginas 1 y 2, en ese orden.',
          ]
        : [
            'Doble faz: dar vuelta la hoja por el borde largo.',
            'Ambas paginas deben quedar derechas, como un libro.',
            'Confirmar el papel fisico: la cola puede finalizar antes.',
          ];
    pdf.text(lineas, 20, 215, { lineHeightFactor: 1.6 });
    for (let i = 0; i < 5; i++) {
      pdf.setFillColor(i * 50, i * 50, i * 50);
      pdf.rect(20 + i * 34, 246, 34, 8, 'F');
    }
    pdf.text('Documento de prueba. No genera una orden ni cargos.', 20, 276);
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
