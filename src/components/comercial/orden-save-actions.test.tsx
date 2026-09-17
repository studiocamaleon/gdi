import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { OrdenSaveActions } from "./orden-resumen-financiero";

function botones(props: Partial<ComponentProps<typeof OrdenSaveActions>>) {
  const html = renderToStaticMarkup(
    <OrdenSaveActions
      tipo="orden"
      empty={false}
      clienteSeleccionado
      {...props}
    />,
  );
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(
    ([, atributos, contenido]) => ({
      texto: contenido.replace(/<[^>]*>/g, ""),
      deshabilitado: /\bdisabled(?:=|\s|$)/.test(atributos),
    }),
  );
}

describe("acciones de emisión en la cabecera", () => {
  it("con productos sin cliente sólo permite guardar borrador", () => {
    expect(botones({ clienteSeleccionado: false })).toEqual([
      { texto: "Guardar borrador", deshabilitado: false },
      { texto: "Emitir OT", deshabilitado: true },
    ]);
  });

  it("habilita Emitir OT al asignar un cliente", () => {
    expect(botones({})).toContainEqual({
      texto: "Emitir OT",
      deshabilitado: false,
    });
  });

  it("conserva el requisito de productos aunque haya cliente", () => {
    expect(botones({ empty: true }).every((b) => b.deshabilitado)).toBe(true);
  });

  it.each([{ emitiendo: true }, { guardandoBorrador: true }])(
    "bloquea ambas acciones mientras hay una operación en curso: %j",
    (estado) => {
      expect(botones(estado).every((b) => b.deshabilitado)).toBe(true);
    },
  );

  it("también exige cliente para emitir un presupuesto", () => {
    expect(
      botones({ tipo: "presupuesto", clienteSeleccionado: false }),
    ).toEqual([{ texto: "Emitir presupuesto", deshabilitado: true }]);
  });
});
