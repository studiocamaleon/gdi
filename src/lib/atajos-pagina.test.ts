// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { permiteAtajoDePagina } from "./atajos-pagina";

afterEach(() => {
  document.body.replaceChildren();
});
describe("atajos de una letra en la página", () => {
  it("mantiene C y P disponibles fuera de controles", () => {
    expect(
      permiteAtajoDePagina(new KeyboardEvent("keydown", { key: "c" })),
    ).toBe(true);
    expect(
      permiteAtajoDePagina(new KeyboardEvent("keydown", { key: "p" })),
    ).toBe(true);
  });
  it.each(["input", "textarea", "select"])(
    "ignora teclas reenviadas con foco en %s",
    (tag) => {
      const field = document.createElement(tag);
      document.body.append(field);
      field.focus();
      // El buscador puede reenviar el evento a la ventana: no basta event.target.
      expect(
        permiteAtajoDePagina(new KeyboardEvent("keydown", { key: "c" })),
      ).toBe(false);
    },
  );
  it.each(["dialog", "listbox", "combobox", "menu"])(
    "respeta la navegación dentro de %s",
    (role) => {
      const overlay = document.createElement("div");
      overlay.setAttribute("role", role);
      const button = document.createElement("button");
      overlay.append(button);
      document.body.append(overlay);
      button.focus();
      expect(
        permiteAtajoDePagina(new KeyboardEvent("keydown", { key: "c" })),
      ).toBe(false);
    },
  );
  it("no interrumpe composición, repetición ni modificadores", () => {
    for (const option of [
      "isComposing",
      "repeat",
      "ctrlKey",
      "metaKey",
      "altKey",
      "shiftKey",
    ]) {
      expect(
        permiteAtajoDePagina(
          new KeyboardEvent("keydown", { key: "c", [option]: true }),
        ),
      ).toBe(false);
    }
  });
});
