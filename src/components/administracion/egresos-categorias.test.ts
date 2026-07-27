import { describe, expect, it } from "vitest";

import { opcionesDeCategorias } from "./egresos-view";
import { agruparOpciones } from "@/components/ui/select-buscable";
import type { CategoriaEgreso } from "@/lib/egresos";

/**
 * Cómo se le ofrecen las 35 categorías a quien carga un egreso.
 *
 * La lista plana era el problema: "Combustible" y "Retiro de socios" se
 * eligen en el mismo campo pero significan cosas opuestas en el balance, y
 * sin el título del grupo nada se lo dice a quien está cargando. Que el orden
 * de las naturalezas se mantenga no es cosmética: primero lo que es costo del
 * trabajo, al final lo que ni siquiera incide en el resultado.
 */

const cat = (
  id: string,
  nombre: string,
  naturaleza: CategoriaEgreso["naturaleza"],
  activo = true,
): CategoriaEgreso =>
  ({ id, nombre, naturaleza, activo }) as CategoriaEgreso;

const CATALOGO = [
  cat("1", "Retiro de socios", "RETIRO_SOCIOS"),
  cat("2", "Alquiler", "GASTO_ESTRUCTURA"),
  cat("3", "Papel", "COSTO_PRODUCCION"),
  cat("4", "Maquinaria", "INVERSION"),
  cat("5", "Energía", "GASTO_ESTRUCTURA"),
];

describe("las categorías que se ofrecen", () => {
  it("van agrupadas por naturaleza y en el orden de la naturaleza", () => {
    const grupos = agruparOpciones(opcionesDeCategorias(CATALOGO));
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Costo de producción",
      "Gasto de estructura",
      "Inversión",
      "Retiro de socios",
    ]);
  });

  it("cada opción sabe a qué grupo pertenece", () => {
    const opciones = opcionesDeCategorias(CATALOGO);
    expect(opciones.find((o) => o.label === "Papel")?.grupo).toBe(
      "Costo de producción",
    );
    expect(opciones.find((o) => o.label === "Alquiler")?.grupo).toBe(
      "Gasto de estructura",
    );
  });

  /** Una categoría dada de baja no se puede volver a elegir. */
  it("las inactivas no se ofrecen", () => {
    const conBaja = [...CATALOGO, cat("6", "Vieja", "GASTO_ESTRUCTURA", false)];
    expect(opcionesDeCategorias(conBaja).map((o) => o.label)).not.toContain(
      "Vieja",
    );
  });

  /** Una naturaleza sin categorías no deja un encabezado suelto. */
  it("no aparece el grupo de una naturaleza sin categorías", () => {
    const grupos = agruparOpciones(
      opcionesDeCategorias([cat("1", "Papel", "COSTO_PRODUCCION")]),
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBe("Costo de producción");
  });

  it("sin categorías activas la lista queda vacía, no rota", () => {
    expect(opcionesDeCategorias([])).toEqual([]);
  });
});
