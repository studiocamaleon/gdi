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

const providerHeaders = [
  headers,
  "cuit",
  "condicionIva",
  "condicionPagoDias",
  "cbuAlias",
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

  it("acepta un proveedor mínimo sin email ni teléfono", () => {
    const parsed = parseContactImportCsv(
      `${providerHeaders}\nProveedor mínimo,,,,,AR,,,,,,,,,,,,,,,`,
      "proveedores",
    );

    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0].payload).toMatchObject({
      nombre: "Proveedor mínimo",
      email: "",
      telefonoNumero: "",
    });
  });

  it("importa los datos de pago del proveedor", () => {
    const parsed = parseContactImportCsv(
      `${providerHeaders}\nPapelera Sur,,,,,AR,,,,,,,,,,,30712345671,MONOTRIBUTO,30,papelera.sur`,
      "proveedores",
    );

    expect(parsed.rows[0].errors).toEqual([]);
    expect(parsed.rows[0].payload).toMatchObject({
      cuit: "30712345671",
      condicionIva: "MONOTRIBUTO",
      condicionPagoDias: 30,
      cbuAlias: "papelera.sur",
    });
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
