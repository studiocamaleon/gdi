import { expect, it } from "vitest";
import { categoriaImpresora } from "./tipos-impresora";
import type {
  ConfiguracionPerfiles,
  DestinoImpresion,
} from "@/lib/impresion-api";

const maquinas: ConfiguracionPerfiles["maquinas"] = [
  { id: "laser", nombre: "Láser", plantilla: "IMPRESORA_LASER", activo: true },
  { id: "hp", nombre: "HP", plantilla: "PLOTTER_CAD", activo: false },
];
const destino: DestinoImpresion = {
  id: "destino",
  nombre: "Equipo",
  host: "localhost",
  impresora: "Cola",
  maquinaId: "laser",
  activo: true,
  version: 1,
  bandejas: [],
};

it("clasifica por máquina, no por nombre ni por haber completado el rollo", () => {
  expect(
    categoriaImpresora({ ...destino, nombre: "Láser de CAD" }, maquinas),
  ).toBe("documentos");
  expect(categoriaImpresora({ ...destino, maquinaId: "hp" }, maquinas)).toBe(
    "cad",
  );
});
it("conserva los destinos CAD existentes si su máquina ya no está disponible", () => {
  expect(
    categoriaImpresora(
      {
        ...destino,
        cad: {
          anchoRolloMm: 914,
          margenMm: 5,
          origenPapel: "Rollo 1",
          usarOrigenPredeterminado: false,
        },
      },
      [],
    ),
  ).toBe("cad");
});
