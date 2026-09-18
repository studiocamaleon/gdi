import { PDFDocument, PDFName, PDFNumber, degrees } from "pdf-lib";
import { expect, it } from "vitest";
import { leerMedidasPdf } from "./pdf-medidas";
import {
  orientacionesSeleccionadas,
  resumirOrientaciones,
} from "./orientacion-pdf";

it("lee la orientación visible de cada página, incluyendo rotaciones y recortes", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  pdf.addPage([842, 595]);
  pdf.addPage([595, 842]).setRotation(degrees(90));
  pdf.addPage([842, 595]).setRotation(degrees(270));
  pdf.addPage([595, 842]).setRotation(degrees(180));
  pdf.addPage([595, 842]).setCropBox(0, 0, 595, 400);
  const bytes = await pdf.save();
  const archivo = {
    name: "orientaciones.pdf",
    type: "application/pdf",
    arrayBuffer: async () => bytes.buffer,
  } as File;
  const [resultado] = await leerMedidasPdf([archivo]);
  expect(resultado.ok).toBe(true);
  if (!resultado.ok) throw new Error(resultado.error);
  const orientaciones = resultado.paginas.map((p) => p.orientacion);
  expect(orientaciones).toEqual([
    "vertical",
    "horizontal",
    "horizontal",
    "vertical",
    "vertical",
    "horizontal",
  ]);
  expect(resumirOrientaciones(orientaciones)).toBe("mixto");
  expect(
    resumirOrientaciones(orientacionesSeleccionadas(orientaciones, "2-3,6")),
  ).toBe("horizontal");
  expect(
    resumirOrientaciones(orientacionesSeleccionadas(orientaciones, "1,4-5")),
  ).toBe("vertical");
  expect(
    resumirOrientaciones(orientacionesSeleccionadas(orientaciones, "7")),
  ).toBeNull();
});

it("mide el área visible con UserUnit, origen desplazado y rotación sin redondear", async () => {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([600, 900]);
  pagina.setMediaBox(10, 20, 600, 900);
  pagina.setCropBox(30, 40, 500, 800);
  pagina.setRotation(degrees(90));
  pagina.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
  const bytes = await pdf.save();
  const [r] = await leerMedidasPdf([
    {
      name: "medidas.pdf",
      type: "application/pdf",
      arrayBuffer: async () => bytes.buffer,
    } as File,
  ]);
  if (!r.ok) throw new Error(r.error);
  expect(r.paginas[0].medidaVisible.anchoMm).toBeCloseTo(
    (800 * 2 * 25.4) / 72,
    8,
  );
  expect(r.paginas[0].medidaVisible.altoMm).toBeCloseTo(
    (500 * 2 * 25.4) / 72,
    8,
  );
});
