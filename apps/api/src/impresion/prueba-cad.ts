import { jsPDF } from 'jspdf';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  type ConfiguracionCad,
  type FormatoPruebaCad,
  planPruebaCad,
} from './cad.domain';

const PT_POR_MM = 72 / 25.4;

/** Lámina vectorial fija. El navegador no puede proporcionar arte ni comandos. */
export async function pdfPruebaCad(
  configuracion: ConfiguracionCad,
  formato: FormatoPruebaCad,
) {
  const plan = planPruebaCad(configuracion, formato);
  const { anchoMm: w, altoMm: h } = plan.original;
  const pdf = new jsPDF({
    unit: 'mm',
    format: [w, h],
    orientation: w > h ? 'landscape' : 'portrait',
    compress: true,
  });
  pdf.setDrawColor(190);
  pdf.setLineWidth(0.2);
  pdf.rect(10, 10, w - 20, h - 20);
  pdf.setDrawColor(255, 107, 59);
  pdf.setFillColor(255, 107, 59);
  pdf.setLineWidth(1.1);
  pdf.triangle(24, 25, 36.5, 25, 30.5, 36, 'S');
  for (const [x, y] of [
    [24, 25],
    [36.5, 25],
    [30.5, 36],
  ])
    pdf.circle(x, y, 2.2, 'F');
  pdf.setTextColor(16, 19, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(34);
  pdf.text('grafoprint', 45, 35);
  const puntoX = 45 + pdf.getTextWidth('grafoprint');
  pdf.setTextColor(255, 107, 59);
  pdf.text('.', puntoX, 35);
  pdf.setTextColor(16, 19, 20);
  pdf.setFontSize(30);
  pdf.text('Prueba de impresion CAD', 24, 60);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(16);
  pdf.text(
    `${plan.original.nombre} - ${w} x ${h} mm - Tamano real 100%`,
    24,
    73,
  );
  pdf.text(
    `Rollo ${configuracion.anchoRolloMm} mm - Giro ${plan.giro} grados - Salida ${plan.anchoSalidaMm} x ${plan.largoSalidaMm} mm`,
    24,
    84,
  );
  pdf.setDrawColor(16, 19, 20);
  pdf.setLineWidth(0.2);
  pdf.rect(35, 100, 200, 200);
  pdf.circle(135, 200, 50, 'S');
  pdf.setFont('helvetica', 'bold');
  pdf.text('200 x 200 mm', 135, 120, { align: 'center' });
  pdf.text('Diametro 100 mm', 135, 198, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.text('Medir entre centros de los trazos.', 135, 280, { align: 'center' });
  for (const [x, y] of [
    [35, 100],
    [235, 100],
    [35, 300],
    [235, 300],
  ]) {
    pdf.line(x - 3, y, x + 3, y);
    pdf.line(x, y - 3, x, y + 3);
  }
  const ry = h > 400 ? 380 : 170;
  const rx = h > 400 ? 35 : 340;
  pdf.line(rx, ry, rx + 500, ry);
  for (let i = 0; i <= 500; i++) {
    pdf.setLineWidth(0.15);
    pdf.line(
      rx + i,
      ry,
      rx + i,
      ry - (i % 50 === 0 ? 6 : i % 10 === 0 ? 4 : 1.5),
    );
    if (i % 50 === 0) {
      pdf.setFontSize(11);
      pdf.text(String(i), rx + i, ry + 7, { align: 'center' });
    }
  }
  pdf.setFontSize(16);
  pdf.text('Regla de control: 500 mm', rx, ry - 15);
  const tx = h > 400 ? 35 : 340;
  const ty = h > 400 ? 440 : 225;
  pdf.setFontSize(16);
  pdf.text(
    [
      '1. Medir el cuadrado en ambos ejes: 200 mm.',
      '2. Medir la regla: 500 mm. El circulo debe conservar su forma.',
      '3. Confirmar las cuatro esquinas y que no falte contenido.',
      'El estado de la cola no confirma las medidas del impreso.',
    ],
    tx,
    ty,
    { lineHeightFactor: 1.7 },
  );
  const muestraY = h > 400 ? 505 : 275;
  [
    [0, 174, 239],
    [236, 0, 140],
    [255, 242, 0],
    [16, 19, 20],
  ].forEach(([r, g, b], i) => {
    pdf.setFillColor(r, g, b);
    pdf.rect(tx + i * 34, muestraY, 26, 8, 'F');
  });
  for (const [x, y, dx, dy] of [
    [10, 10, 1, 1],
    [w - 10, 10, -1, 1],
    [10, h - 10, 1, -1],
    [w - 10, h - 10, -1, -1],
  ]) {
    pdf.setDrawColor(255, 107, 59);
    pdf.setLineWidth(0.4);
    pdf.line(x, y, x + dx * 7, y);
    pdf.line(x, y, x, y + dy * 7);
  }
  pdf.setFontSize(12);
  pdf.text(
    'Grafo - Prueba del controlador. No genera una OT ni cargos.',
    24,
    h - 20,
  );

  const salida = await PDFDocument.create();
  const [original] = await salida.embedPdf(pdf.output('arraybuffer'), [0]);
  const hoja = salida.addPage([
    plan.anchoSalidaMm * PT_POR_MM,
    plan.largoSalidaMm * PT_POR_MM,
  ]);
  // Giro y traslación exclusivamente: no establecer width/height ni factores de ajuste.
  hoja.drawPage(original, {
    x: (plan.desplazamientoXMm + (plan.giro === 90 ? h : 0)) * PT_POR_MM,
    y: plan.desplazamientoYMm * PT_POR_MM,
    rotate: degrees(plan.giro),
  });
  salida.setTitle(`Grafo - Prueba CAD ${plan.original.nombre} - 100%`);
  return { pdf: Buffer.from(await salida.save()), plan };
}
