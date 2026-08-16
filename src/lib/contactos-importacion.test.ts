import { describe, expect, it } from "vitest";

import { parseContactImportCsv } from "@/lib/contactos-importacion";

const headers = [
  "nombre",
  "razonSocial",
  "email",
  "telefonoCodigo",
  "telefonoNumero",
  "pais",
  "contactoNombre",
  "contactoCargo",
  "contactoEmail",
  "contactoTelefonoCodigo",
  "contactoTelefonoNumero",
  "direccionDescripcion",
  "codigoPostal",
  "direccion",
  "numero",
  "ciudad",
].join(",");

describe("importación de clientes y proveedores", () => {
  it("acepta un cliente mínimo sin inventar contacto ni dirección", () => {
    const parsed = parseContactImportCsv(
      `${headers}\nCliente mostrador,,,,,AR,,,,,,,,,,`,
      "clientes",
    );

    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0].payload).toMatchObject({
      nombre: "Cliente mostrador",
      email: "",
      telefonoNumero: "",
      contactos: [],
      direcciones: [],
    });
  });

  it("mantiene email y teléfono obligatorios para proveedores", () => {
    const parsed = parseContactImportCsv(
      `${headers}\nProveedor incompleto,,,,,AR,,,,,,,,,,`,
      "proveedores",
    );

    expect(parsed.rows[0].errors).toEqual(
      expect.arrayContaining([
        "Falta email.",
        "Falta telefonoCodigo.",
        "Falta telefonoNumero.",
      ]),
    );
  });

  it("rechaza contactos y direcciones parcialmente informados", () => {
    const parsed = parseContactImportCsv(
      `${headers}\nCliente parcial,,,,,AR,,Compras,,,,Principal,,,,`,
      "clientes",
    );

    expect(parsed.rows[0].errors.join(" ")).toContain("contactoNombre");
    expect(parsed.rows[0].errors.join(" ")).toContain("direccion");
  });
});
