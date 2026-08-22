import { jsPDF } from 'jspdf';
import { strToU8, zipSync } from 'fflate';
import type {
  GeometriaVectorialCanonica,
  PiezaVectorial,
  PuntoVectorial,
  UnionVectorial,
} from '../motor-universal/geometria-vectorial/tipos';
import type {
  PanelPlantillaInstalacion,
  PlantillaInstalacion,
} from './plantilla-instalacion';

type ExportInput = {
  nombre: string;
  nombreFuente: string;
  geometria: GeometriaVectorialCanonica;
  plantilla: PlantillaInstalacion;
  uniones: UnionVectorial[];
};

const INK: [number, number, number] = [23, 23, 26];
const MUTED: [number, number, number] = [105, 105, 115];
const LIGHT: [number, number, number] = [238, 238, 240];
const BLUE: [number, number, number] = [37, 99, 235];
const ORANGE: [number, number, number] = [234, 88, 12];
const RED: [number, number, number] = [220, 38, 38];

export function crearPlanoGeneralAcotadoPdf(input: ExportInput): Buffer {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true,
  });
  pdf.setProperties({
    title: `Plano general de instalacion - ${input.nombre}`,
    subject: 'Plano acotado para instalacion de carteleria',
    creator: 'Grafoprint',
  });
  pdf.setFillColor(250, 250, 250);
  pdf.rect(0, 0, 420, 297, 'F');
  pdf.setFillColor(...INK);
  pdf.rect(0, 0, 420, 36, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('PLANO GENERAL DE INSTALACION', 20, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(input.nombre, 20, 27);
  pdf.text(`Fuente: ${input.nombreFuente}`, 400, 17, { align: 'right' });
  pdf.text('Medidas expresadas en milimetros', 400, 27, { align: 'right' });

  const box = { x: 34, y: 58, width: 348, height: 174 };
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(212, 212, 216);
  pdf.roundedRect(box.x, box.y, box.width, box.height, 3, 3, 'FD');
  const scale = Math.min(
    (box.width - 24) / input.geometria.anchoMm,
    (box.height - 24) / input.geometria.altoMm,
  );
  const origin = {
    x: box.x + (box.width - input.geometria.anchoMm * scale) / 2,
    y: box.y + (box.height - input.geometria.altoMm * scale) / 2,
  };

  dibujarComposicion(pdf, input.geometria, origin.x, origin.y, scale);
  dibujarGrillaPaneles(pdf, input.plantilla, origin, scale);
  dibujarCotasGenerales(pdf, input.geometria, origin, scale);
  dibujarUniones(pdf, input, origin, scale);

  dibujarTablaPiezas(pdf, input.geometria.piezas);
  pdf.setTextColor(...MUTED);
  pdf.setFontSize(7.5);
  pdf.text(
    'Usar las lineas de centro y nivel como referencias principales. Verificar la marca de control antes de trasladar medidas.',
    20,
    289,
  );
  pdf.text('Pagina 1 de 1', 400, 289, { align: 'right' });
  return Buffer.from(pdf.output('arraybuffer'));
}

function dibujarTablaPiezas(pdf: jsPDF, pieces: PiezaVectorial[]) {
  pdf.setTextColor(...INK);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(
    'COORDENADAS DE PIEZAS - ORIGEN: ESQUINA SUPERIOR IZQUIERDA',
    20,
    244,
  );
  const visible = pieces.slice(0, 12);
  const rowsPerColumn = Math.ceil(visible.length / 2);
  const columnWidth = 190;
  for (let group = 0; group < 2; group += 1) {
    const x = 20 + group * columnWidth;
    const groupPieces = visible.slice(
      group * rowsPerColumn,
      (group + 1) * rowsPerColumn,
    );
    if (groupPieces.length === 0) continue;
    pdf.setFillColor(235, 235, 238);
    pdf.rect(x, 248, columnWidth - 10, 6, 'F');
    pdf.setFontSize(6.8);
    const columns = [x + 2, x + 49, x + 82, x + 115, x + 148];
    ['PIEZA', 'X', 'Y', 'ANCHO', 'ALTO'].forEach((label, index) =>
      pdf.text(label, columns[index], 252),
    );
    pdf.setFont('helvetica', 'normal');
    groupPieces.forEach((piece, index) => {
      const y = 258 + index * 5.5;
      const values = [
        piece.id,
        fmt(piece.origenXmm ?? 0),
        fmt(piece.origenYmm ?? 0),
        fmt(piece.anchoMm),
        fmt(piece.altoMm),
      ];
      values.forEach((value, valueIndex) =>
        pdf.text(value, columns[valueIndex], y),
      );
    });
    pdf.setFont('helvetica', 'bold');
  }
  if (pieces.length > visible.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...MUTED);
    pdf.text(
      `Se muestran 12 de ${pieces.length} piezas. La vista numerada conserva todas las posiciones.`,
      20,
      283,
    );
  }
}

export function crearPlantillaPapelPlotterPdf(input: ExportInput): Buffer {
  const width = input.plantilla.anchoPlantillaMm;
  const height = input.plantilla.altoPlantillaMm;
  if (width > 5000 || height > 5000) {
    throw new Error(
      'La plantilla supera el limite de pagina PDF de 5000 mm. Usá la version mosaico.',
    );
  }
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height],
    compress: true,
  });
  pdf.setProperties({
    title: `Plantilla 1 a 1 - ${input.nombre}`,
    subject: 'Plantilla de instalacion para plotter a escala real',
    creator: 'Grafoprint',
  });
  dibujarContornosCorte(pdf, input.plantilla.contornosCorte, 0, 0);
  dibujarGuiasEscalaReal(pdf, width, height);
  return Buffer.from(pdf.output('arraybuffer'));
}

export function crearPlantillaPapelMosaicoPdf(input: ExportInput): Buffer {
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 10;
  const top = 18;
  const bottom = 10;
  const usefulWidth = pageWidth - marginX * 2;
  const usefulHeight = pageHeight - top - bottom;
  const overlap = 10;
  const stepX = usefulWidth - overlap;
  const stepY = usefulHeight - overlap;
  const columns = Math.max(
    1,
    Math.ceil((input.plantilla.anchoPlantillaMm - overlap) / stepX),
  );
  const rows = Math.max(
    1,
    Math.ceil((input.plantilla.altoPlantillaMm - overlap) / stepY),
  );
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `Plantilla mosaico 1 a 1 - ${input.nombre}`,
    subject: 'Plantilla de instalacion A4 solapada a escala real',
    creator: 'Grafoprint',
  });
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const pageIndex = row * columns + column;
      if (pageIndex > 0) pdf.addPage('a4', 'portrait');
      const x0 = column * stepX;
      const y0 = row * stepY;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...INK);
      pdf.text(`${input.nombre} - F${row + 1} C${column + 1}`, marginX, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...MUTED);
      pdf.text(
        `Origen ${fmt(x0)}, ${fmt(y0)} mm - Imprimir al 100% - Pagina ${pageIndex + 1}/${rows * columns}`,
        marginX,
        13,
      );
      pdf.setDrawColor(190, 190, 195);
      pdf.setLineDashPattern([2, 2], 0);
      pdf.rect(marginX, top, usefulWidth, usefulHeight);
      pdf.setLineDashPattern([], 0);
      const viewport = {
        minX: x0,
        minY: y0,
        maxX: x0 + usefulWidth,
        maxY: y0 + usefulHeight,
      };
      const visibles = input.plantilla.contornosCorte.filter((ring) =>
        interseca(bounds(ring), viewport),
      );
      dibujarContornosCorte(pdf, visibles, marginX - x0, top - y0);
      marcasRegistro(pdf, marginX, top, usefulWidth, usefulHeight);
      if (pageIndex === 0) control100mm(pdf, marginX + 15, pageHeight - 6);
    }
  }
  return Buffer.from(pdf.output('arraybuffer'));
}

export function crearDxfPlantillaRigida(
  input: ExportInput,
  panelIndex: number | null = null,
): string {
  const panel = panelIndex == null ? null : input.plantilla.paneles[panelIndex];
  if (panelIndex != null && !panel) throw new Error('Panel DXF inexistente.');
  const width = panel?.anchoMm ?? input.plantilla.anchoPlantillaMm;
  const height = panel?.altoMm ?? input.plantilla.altoPlantillaMm;
  const contours = panel?.contornosCorte ?? input.plantilla.contornosCorte;
  const entities: string[] = [];
  for (const ring of contours) {
    entities.push(polylineDxf(ring, height, 'CORTE', true));
  }
  entities.push(lineDxf(width / 2, 0, width / 2, height, height, 'MARCAS'));
  entities.push(lineDxf(0, height / 2, width, height / 2, height, 'MARCAS'));
  entities.push(lineDxf(20, 20, 120, 20, height, 'MARCAS'));
  return dxfDocument(entities);
}

export function crearDxfPatronPounce(input: ExportInput): string {
  const entities: string[] = [];
  for (const piece of input.geometria.piezas) {
    for (const contour of piece.contornos.filter((item) => !item.esHueco)) {
      entities.push(
        polylineDxf(
          trasladarContorno(
            contour.puntos,
            piece.origenXmm ?? 0,
            piece.origenYmm ?? 0,
          ),
          input.geometria.altoMm,
          'POUNCE',
          true,
        ),
      );
    }
  }
  return dxfDocument(entities, true);
}

export function crearEpsPlantillaVinilo(input: ExportInput): string {
  const pt = 72 / 25.4;
  const widthPt = input.geometria.anchoMm * pt;
  const heightPt = input.geometria.altoMm * pt;
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%Title: ${ascii(input.nombre)}`,
    `%%BoundingBox: 0 0 ${Math.ceil(widthPt)} ${Math.ceil(heightPt)}`,
    `%%HiResBoundingBox: 0 0 ${n(widthPt)} ${n(heightPt)}`,
    '%%LanguageLevel: 2',
    '%%EndComments',
    '0 setgray',
    `${n(0.1 * pt)} setlinewidth`,
  ];
  for (const piece of input.geometria.piezas) {
    for (const contour of piece.contornos.filter((item) => !item.esHueco)) {
      const points = trasladarContorno(
        contour.puntos,
        piece.origenXmm ?? 0,
        piece.origenYmm ?? 0,
      );
      if (points.length < 3) continue;
      lines.push('newpath');
      lines.push(
        `${n(points[0].x * pt)} ${n((input.geometria.altoMm - points[0].y) * pt)} moveto`,
      );
      for (const point of points.slice(1)) {
        lines.push(
          `${n(point.x * pt)} ${n((input.geometria.altoMm - point.y) * pt)} lineto`,
        );
      }
      lines.push('closepath stroke');
    }
  }
  lines.push('showpage', '%%EOF');
  return lines.join('\n');
}

export function crearPaqueteInstalacion(input: ExportInput): Buffer {
  const files: Record<string, Uint8Array> = {
    '01-plano-general-acotado.pdf': crearPlanoGeneralAcotadoPdf(input),
    '02-plantilla-papel-mosaico-a4-1a1.pdf':
      crearPlantillaPapelMosaicoPdf(input),
    '03-plantilla-rigida-completa.dxf': strToU8(crearDxfPlantillaRigida(input)),
    '03-plantilla-rigida-respaldo.svg': strToU8(input.plantilla.svg),
    '04-plantilla-vinilo.eps': strToU8(crearEpsPlantillaVinilo(input)),
    '05-patron-pounce.dxf': strToU8(crearDxfPatronPounce(input)),
    'LEEME.txt': strToU8(instrucciones(input)),
  };
  if (
    input.plantilla.anchoPlantillaMm <= 5000 &&
    input.plantilla.altoPlantillaMm <= 5000
  ) {
    files['02-plantilla-papel-plotter-1a1.pdf'] =
      crearPlantillaPapelPlotterPdf(input);
  }
  for (const panel of input.plantilla.paneles) {
    const index = String(panel.indice + 1).padStart(2, '0');
    files[`03-paneles-rigidos/panel-${index}.dxf`] = strToU8(
      crearDxfPlantillaRigida(input, panel.indice),
    );
    files[`03-paneles-rigidos/panel-${index}.svg`] = strToU8(panel.svg);
  }
  return Buffer.from(zipSync(files, { level: 6 }));
}

function dibujarComposicion(
  pdf: jsPDF,
  geometry: GeometriaVectorialCanonica,
  x: number,
  y: number,
  scale: number,
) {
  for (const piece of geometry.piezas) {
    pdf.setFillColor(...LIGHT);
    pdf.setDrawColor(...INK);
    pdf.setLineWidth(0.25);
    for (const contour of piece.contornos.filter((item) => !item.esHueco)) {
      drawRing(
        pdf,
        contour.puntos,
        (point) => ({
          x: x + ((piece.origenXmm ?? 0) + point.x) * scale,
          y: y + ((piece.origenYmm ?? 0) + point.y) * scale,
        }),
        'FD',
      );
    }
    for (const contour of piece.contornos.filter((item) => item.esHueco)) {
      pdf.setFillColor(255, 255, 255);
      drawRing(
        pdf,
        contour.puntos,
        (point) => ({
          x: x + ((piece.origenXmm ?? 0) + point.x) * scale,
          y: y + ((piece.origenYmm ?? 0) + point.y) * scale,
        }),
        'FD',
      );
    }
    const centerX = x + ((piece.origenXmm ?? 0) + piece.anchoMm / 2) * scale;
    const centerY = y + ((piece.origenYmm ?? 0) + piece.altoMm / 2) * scale;
    pdf.setTextColor(...INK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.text(piece.id, centerX, centerY, { align: 'center' });
  }
}

function dibujarGrillaPaneles(
  pdf: jsPDF,
  template: PlantillaInstalacion,
  origin: { x: number; y: number },
  scale: number,
) {
  if (template.paneles.length <= 1) return;
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([2, 2], 0);
  for (const panel of template.paneles) {
    const x = origin.x + (panel.origenXmm - template.bordeMm) * scale;
    const y = origin.y + (panel.origenYmm - template.bordeMm) * scale;
    pdf.rect(x, y, panel.anchoMm * scale, panel.altoMm * scale);
  }
  pdf.setLineDashPattern([], 0);
}

function dibujarCotasGenerales(
  pdf: jsPDF,
  geometry: GeometriaVectorialCanonica,
  origin: { x: number; y: number },
  scale: number,
) {
  const width = geometry.anchoMm * scale;
  const height = geometry.altoMm * scale;
  pdf.setDrawColor(...INK);
  pdf.setTextColor(...INK);
  pdf.setLineWidth(0.2);
  const top = origin.y - 7;
  pdf.line(origin.x, top, origin.x + width, top);
  pdf.line(origin.x, top - 2, origin.x, top + 2);
  pdf.line(origin.x + width, top - 2, origin.x + width, top + 2);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(`${fmt(geometry.anchoMm)} mm`, origin.x + width / 2, top - 2, {
    align: 'center',
  });
  const left = origin.x - 7;
  pdf.line(left, origin.y, left, origin.y + height);
  pdf.line(left - 2, origin.y, left + 2, origin.y);
  pdf.line(left - 2, origin.y + height, left + 2, origin.y + height);
  pdf.text(`${fmt(geometry.altoMm)} mm`, left - 3, origin.y + height / 2, {
    align: 'center',
    angle: 90,
  });
  pdf.setDrawColor(...BLUE);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(
    origin.x + width / 2,
    origin.y,
    origin.x + width / 2,
    origin.y + height,
  );
  pdf.line(
    origin.x,
    origin.y + height / 2,
    origin.x + width,
    origin.y + height / 2,
  );
  pdf.setLineDashPattern([], 0);
}

function dibujarUniones(
  pdf: jsPDF,
  input: ExportInput,
  origin: { x: number; y: number },
  scale: number,
) {
  pdf.setDrawColor(...ORANGE);
  pdf.setLineWidth(0.35);
  pdf.setLineDashPattern([1, 1], 0);
  for (const union of input.uniones) {
    const piece = input.geometria.piezas.find(
      (item) => item.id === union.piezaOrigenId,
    );
    if (!piece) continue;
    const pieceX = piece.origenXmm ?? 0;
    const pieceY = piece.origenYmm ?? 0;
    if (union.inicio && union.fin) {
      pdf.line(
        origin.x + (pieceX + union.inicio.x) * scale,
        origin.y + (pieceY + union.inicio.y) * scale,
        origin.x + (pieceX + union.fin.x) * scale,
        origin.y + (pieceY + union.fin.y) * scale,
      );
      continue;
    }
    if (union.eje === 'vertical') {
      const x = origin.x + (pieceX + union.posicionMm) * scale;
      pdf.line(
        x,
        origin.y + pieceY * scale,
        x,
        origin.y + (pieceY + piece.altoMm) * scale,
      );
    } else {
      const y = origin.y + (pieceY + union.posicionMm) * scale;
      pdf.line(
        origin.x + pieceX * scale,
        y,
        origin.x + (pieceX + piece.anchoMm) * scale,
        y,
      );
    }
  }
  pdf.setLineDashPattern([], 0);
}

function dibujarContornosCorte(
  pdf: jsPDF,
  contours: PuntoVectorial[][],
  offsetX: number,
  offsetY: number,
) {
  pdf.setDrawColor(...RED);
  pdf.setLineWidth(0.15);
  for (const ring of contours) {
    drawRing(
      pdf,
      ring,
      (point) => ({ x: point.x + offsetX, y: point.y + offsetY }),
      'S',
    );
  }
}

function dibujarGuiasEscalaReal(pdf: jsPDF, width: number, height: number) {
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([4, 3], 0);
  pdf.line(width / 2, 0, width / 2, height);
  pdf.line(0, height / 2, width, height / 2);
  pdf.setLineDashPattern([], 0);
  control100mm(pdf, 20, 20);
}

function control100mm(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.25);
  pdf.line(x, y, x + 100, y);
  pdf.line(x, y - 3, x, y + 3);
  pdf.line(x + 100, y - 3, x + 100, y + 3);
  pdf.setTextColor(...BLUE);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('CONTROL 100 mm', x + 50, y - 2, { align: 'center' });
}

function marcasRegistro(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  pdf.setDrawColor(...BLUE);
  pdf.setLineWidth(0.2);
  for (const point of [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ]) {
    pdf.line(point.x - 3, point.y, point.x + 3, point.y);
    pdf.line(point.x, point.y - 3, point.x, point.y + 3);
  }
}

function drawRing(
  pdf: jsPDF,
  points: PuntoVectorial[],
  transform: (point: PuntoVectorial) => PuntoVectorial,
  style: 'S' | 'FD',
) {
  if (points.length < 3) return;
  const first = transform(points[0]);
  pdf.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const transformed = transform(point);
    pdf.lineTo(transformed.x, transformed.y);
  }
  pdf.close();
  if (style === 'FD') pdf.fillStroke();
  else pdf.stroke();
}

function dxfDocument(entities: string[], includePounceLayer = false) {
  const layers = [
    layerDxf('CORTE', 1),
    layerDxf('MARCAS', 5),
    layerDxf('UNIONES', 30),
    ...(includePounceLayer ? [layerDxf('POUNCE', 3)] : []),
  ].join('');
  return [
    '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1014\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n',
    `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${includePounceLayer ? 4 : 3}\n${layers}0\nENDTAB\n0\nENDSEC\n`,
    `0\nSECTION\n2\nENTITIES\n${entities.join('')}0\nENDSEC\n0\nEOF\n`,
  ].join('');
}

function layerDxf(name: string, color: number) {
  return `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n`;
}

function polylineDxf(
  points: PuntoVectorial[],
  height: number,
  layer: string,
  closed: boolean,
) {
  return [
    `0\nLWPOLYLINE\n8\n${layer}\n90\n${points.length}\n70\n${closed ? 1 : 0}\n`,
    ...points.map((point) => `10\n${n(point.x)}\n20\n${n(height - point.y)}\n`),
  ].join('');
}

function lineDxf(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
  layer: string,
) {
  return `0\nLINE\n8\n${layer}\n10\n${n(x1)}\n20\n${n(height - y1)}\n11\n${n(x2)}\n21\n${n(height - y2)}\n`;
}

function instrucciones(input: ExportInput) {
  return [
    `PAQUETE DE INSTALACION - ${input.nombre}`,
    '',
    `Medida final: ${fmt(input.geometria.anchoMm)} x ${fmt(input.geometria.altoMm)} mm`,
    `Piezas: ${input.geometria.piezas.length}`,
    `Paneles rigidos: ${input.plantilla.paneles.length}`,
    '',
    'ARCHIVOS',
    '- Plano general PDF: referencia acotada. No imprimir como plantilla.',
    '- PDF plotter 1:1: imprimir al 100%, sin ajustar a pagina.',
    '- PDF mosaico A4 1:1: unir por marcas y zonas de solape.',
    '- DXF rigido: unidades en milimetros. Rojo/CORTE y azul/MARCAS.',
    '- EPS vinilo: contornos exteriores en composicion original.',
    '- DXF pounce: aplicar perforacion desde el software de la maquina.',
    '',
    'CONTROL OBLIGATORIO',
    '- Medir la marca de 100 mm antes de usar cualquier plantilla impresa.',
    '- Confirmar centro y nivel en el soporte antes de fijar piezas.',
    '- Las lineas de uniones son referencias de armado, no posiciones nuevas.',
  ].join('\n');
}

function trasladarContorno(points: PuntoVectorial[], dx: number, dy: number) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

function bounds(points: PuntoVectorial[]) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function interseca(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
) {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

function fmt(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(
    value,
  );
}

function n(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

function ascii(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
