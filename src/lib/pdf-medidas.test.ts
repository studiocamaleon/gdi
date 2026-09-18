import { PDFDocument, degrees } from "pdf-lib";
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
