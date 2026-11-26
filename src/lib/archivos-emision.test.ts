import { expect, it } from "vitest";
import { prepararAdjuntos } from "./archivos-emision";
import { productoDiseno } from "@/components/comercial/__fixtures__/orden-diseno";

it("conserva los bytes y el destino de referencias, originales, planos y briefs aunque se reordenen los productos", () => {
  const file = new File(["ficticio"], "referencia.pdf");
  const item = productoDiseno("propuesta", "Trabajo ficticio", 1, 100);
  const orden = {
    id: "ot",
    numero: "OT-TEST",
    productos: [
      { id: "impresion", cotizacionItemId: "dos" },
      { id: "trabajo", cotizacionItemId: "uno" },
    ],
  };
  const jobs = prepararAdjuntos(orden, [
    {
      cotizacionItemId: "uno",
      item: {
        ...item,
        archivosPendientes: [file],
        planosPendientes: [file],
        briefDisenoArchivosPendientes: [{ file, requiereVectorizacion: true }],
      },
    },
    {
      cotizacionItemId: "dos",
      item: {
        ...item,
        jobContext: { _centroCopiado: { paginas: 1 } },
        archivosPendientes: [file],
      },
    },
  ]);
  expect(jobs.map((j) => [j.itemId, j.marca, j.descripcion])).toEqual([
    ["trabajo", undefined, undefined],
    ["trabajo", "brief-diseno", "Brief de diseño · Requiere vectorización"],
    ["trabajo", "medida_pdf", undefined],
    ["impresion", "centro-copiado", "Documento · referencia.pdf"],
  ]);
  expect(new Set(jobs.map((j) => j.id)).size).toBe(4);
  expect(
    jobs.every(
      (j) => "file" in j.fuente && j.fuente.file === file && j.ordenId === "ot",
    ),
  ).toBe(true);
});
