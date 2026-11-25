import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { RegistroClientePublico } from "./registro-cliente-publico";

describe("Formulario público de cliente", () => {
  it("pide los datos fiscales y de contacto, sin cuenta corriente ni credenciales", () => {
    const html = renderToStaticMarkup(
      <RegistroClientePublico
        token="token-ficticio"
        empresa="Imprenta ficticia"
      />,
    );
    for (const name of ["nombre", "documentoNumero", "direccion", "ciudad"])
      expect(html).toMatch(
        new RegExp(
          `name="${name}"[^>]*required=""|required=""[^>]*name="${name}"`,
        ),
      );
    expect(html).toContain("Condición frente al IVA");
    expect(html).toContain("DNI");
    expect(html).toContain("CUIT / CUIL");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('name="limiteCredito"');
    expect(html).toContain('id="telefono-alta"');
    expect(html).toContain("País del teléfono");
    expect(html).toContain('type="tel"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('data-ui="heroui"');
  });
  it("inicia el selector con el país de la empresa", () => {
    const html = renderToStaticMarkup(
      <RegistroClientePublico
        token="ficticio"
        empresa="Ensayo"
        paisCodigo="UY"
      />,
    );
    expect(html).toContain("Uruguay");
    expect(html).toContain("+598");
  });
  it("pide RUT y domicilio chileno con teclado que admite K", () => {
    const html = renderToStaticMarkup(
      <RegistroClientePublico
        token="ficticio"
        empresa="Taller ficticio"
        paisCodigo="CL"
      />,
    );
    expect(html).toContain("RUT");
    expect(html).toContain("Domicilio · Chile");
    expect(html).toContain("Comuna o ciudad");
    expect(html).toContain("+56");
    expect(
      html.match(/<input[^>]*name="documentoNumero"[^>]*>/)?.[0],
    ).toContain('inputMode="text"');
    expect(html).not.toContain("CUIT");
    expect(html).not.toContain("DNI");
    expect(html).not.toContain("Condición frente al IVA");
    expect(html).not.toContain("Domicilio fiscal · Argentina");
  });
  it("un enlace desactivado no ofrece el formulario ni el botón de envío", () => {
    const html = renderToStaticMarkup(
      <RegistroClientePublico
        token="token-ficticio"
        empresa=""
        disponible={false}
      />,
    );
    expect(html).toContain("Enlace no disponible");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Enviar solicitud");
  });
});
