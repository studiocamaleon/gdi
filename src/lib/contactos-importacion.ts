import type { ClientePayload } from "@/lib/clientes";
import type { ProveedorPayload } from "@/lib/proveedores";
import { downloadCsv, toCsv } from "@/lib/empleados-importacion";

type ContactImportKind = "clientes" | "proveedores";
type ContactPayload = ClientePayload | ProveedorPayload;

export interface ContactImportRowResult {
  rowNumber: number;
  payload?: ContactPayload;
  errors: string[];
}

export interface ContactImportParseResult {
  rows: ContactImportRowResult[];
  fatalError?: string;
}

const CONTACT_IMPORT_HEADERS = [
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
] as const;

const REQUIRED_HEADERS = new Set([
  "nombre",
  "email",
  "telefonoCodigo",
  "telefonoNumero",
  "pais",
  "contactoNombre",
  "direccionDescripcion",
  "direccion",
  "ciudad",
]);

const CONTACT_IMPORT_HEADER_LABELS = CONTACT_IMPORT_HEADERS.map((header) =>
  REQUIRED_HEADERS.has(header) ? `${header}*` : header,
);

const SAMPLE_BY_KIND: Record<ContactImportKind, readonly string[]> = {
  clientes: [
    "Acme S.A.",
    "Acme Sociedad Anonima",
    "compras@acme.com",
    "54",
    "1122334455",
    "AR",
    "Laura Gomez",
    "Compras",
    "laura.gomez@acme.com",
    "54",
    "1199988877",
    "Principal",
    "1406",
    "Av. Rivadavia",
    "1234",
    "CABA",
  ],
  proveedores: [
    "Papelera Sur",
    "Papelera Sur S.R.L.",
    "ventas@papelerasur.com",
    "54",
    "1144556677",
    "AR",
    "Martin Ruiz",
    "Ventas",
    "martin.ruiz@papelerasur.com",
    "54",
    "1166677788",
    "Principal",
    "1870",
    "Av. Mitre",
    "2450",
    "Avellaneda",
  ],
};

export function downloadContactImportTemplate(kind: ContactImportKind) {
  downloadCsv(
    `plantilla-importacion-${kind}.csv`,
    toCsv([CONTACT_IMPORT_HEADER_LABELS, SAMPLE_BY_KIND[kind]]),
  );
}

export function parseContactImportCsv(csv: string): ContactImportParseResult {
  const rows = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  if (rows.length < 2) {
    return {
      rows: [],
      fatalError: "El archivo debe tener encabezados y al menos una fila.",
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const missingHeaders = CONTACT_IMPORT_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      fatalError: `Faltan columnas requeridas por la plantilla: ${missingHeaders.join(", ")}.`,
    };
  }

  return {
    rows: rows.slice(1).map((row, idx) => {
      const record = Object.fromEntries(
        headers.map((header, headerIdx) => [header, row[headerIdx]?.trim() ?? ""]),
      );
      return recordToContactPayload(record, idx + 2);
    }),
  };
}

function recordToContactPayload(
  record: Record<string, string>,
  rowNumber: number,
): ContactImportRowResult {
  const errors: string[] = [];
  for (const header of REQUIRED_HEADERS) {
    if (!record[header]) errors.push(`Falta ${header}.`);
  }
  if (record.pais && record.pais.length !== 2) {
    errors.push("pais debe ser un código ISO de 2 letras, por ejemplo AR.");
  }
  if (record.email && !isEmailLike(record.email)) {
    errors.push("email no tiene un formato válido.");
  }
  if (record.contactoEmail && !isEmailLike(record.contactoEmail)) {
    errors.push("contactoEmail no tiene un formato válido.");
  }

  if (errors.length > 0) return { rowNumber, errors };

  const payload: ContactPayload = {
    nombre: record.nombre,
    razonSocial: record.razonSocial || undefined,
    email: record.email,
    pais: record.pais.toUpperCase(),
    telefonoCodigo: record.telefonoCodigo,
    telefonoNumero: record.telefonoNumero,
    contactos: [
      {
        nombre: record.contactoNombre,
        cargo: record.contactoCargo || undefined,
        email: record.contactoEmail || undefined,
        telefonoCodigo: record.contactoTelefonoCodigo || undefined,
        telefonoNumero: record.contactoTelefonoNumero || undefined,
        principal: true,
      },
    ],
    direcciones: [
      {
        descripcion: record.direccionDescripcion,
        pais: record.pais.toUpperCase(),
        codigoPostal: record.codigoPostal || undefined,
        direccion: record.direccion,
        numero: record.numero || undefined,
        ciudad: record.ciudad,
        tipo: "principal",
        principal: true,
      },
    ],
  };

  return { rowNumber, payload, errors: [] };
}

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().replace(/\*$/, "");
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
