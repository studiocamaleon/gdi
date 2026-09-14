import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectField } from "./select-field";

const options = [
  { value: "", label: "Sin asignar" },
  { value: "empleado-1", label: "Responsable" },
];

describe("SelectField: contrato con los formularios nativos", () => {
  it("envía el identificador original, sin la clave interna de presentación", () => {
    const html = renderToStaticMarkup(
      <SelectField
        aria-label="Responsable"
        name="responsableEmpleadoId"
        options={options}
        defaultValue="empleado-1"
      />,
    );
    expect(html).toContain('name="responsableEmpleadoId" value="empleado-1"');
    expect(html).not.toContain('name="responsableEmpleadoId" value="option:');
  });

  it("conserva la opción vacía y marca el selector obligatorio para validación nativa", () => {
    const html = renderToStaticMarkup(
      <SelectField
        aria-label="Cliente"
        name="clienteId"
        options={options}
        required
        defaultValue=""
      />,
    );
    expect(html).toContain('name="clienteId" value=""');
    expect(html).toMatch(/<select[^>]*required=""/);
  });

  it("respeta valores controlados y el primer valor por defecto de un select nativo", () => {
    const controlled = renderToStaticMarkup(
      <SelectField
        aria-label="Responsable"
        name="responsable"
        options={options}
        value=""
        defaultValue="empleado-1"
      />,
    );
    expect(controlled).toContain('name="responsable" value=""');
    const first = renderToStaticMarkup(
      <SelectField
        aria-label="Etapa"
        name="etapa"
        options={[{ value: "BRIEF", label: "Brief" }]}
      />,
    );
    expect(first).toContain('name="etapa" value="BRIEF"');
  });
});
