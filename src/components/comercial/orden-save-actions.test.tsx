// @vitest-environment jsdom
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
  const documento = new DOMParser().parseFromString(html, "text/html");
  return [...documento.querySelectorAll("button")].map((boton) => ({
    texto: boton.textContent,
    deshabilitado: boton.disabled,
  }));
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
    ).toEqual([
      { texto: "Guardar borrador", deshabilitado: true },
      { texto: "Emitir presupuesto", deshabilitado: true },
    ]);
  });
  it("permite guardar un presupuesto sin enviarlo cuando tiene cliente y productos", () => {
    expect(botones({ tipo: "presupuesto" })).toEqual([
      { texto: "Guardar borrador", deshabilitado: false },
      { texto: "Emitir presupuesto", deshabilitado: false },
    ]);
  });

});
