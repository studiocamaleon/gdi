import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Checkbox,
  ProductoEdicion,
  ProductoVisualProvider,
} from "./producto-ui";

function renderCheckbox({ checked = false, disabled = false } = {}) {
  return renderToStaticMarkup(
    <ProductoVisualProvider>
      <ProductoEdicion disabled={disabled}>
        <Checkbox
          id="comision"
          aria-label="Aplicar comisión"
          checked={checked}
        />
      </ProductoEdicion>
    </ProductoVisualProvider>,
  );
}

describe("Selección de comisiones en la ficha", () => {
  it("expone un control interactivo con nombre accesible y estado", () => {
    const html = renderCheckbox({ checked: true });
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).toContain('aria-label="Aplicar comisión"');
    expect(html).toMatch(/<input[^>]*checked=""/);
  });

  it("mantiene la casilla bloqueada en consulta", () => {
    const html = renderCheckbox({ disabled: true });
    expect(html).toMatch(/<input[^>]*disabled=""/);
    expect(html).not.toMatch(/<input[^>]*checked=""/);
  });
});
