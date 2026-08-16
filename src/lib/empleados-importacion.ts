import type { EmpleadoPayload, SexoEmpleado } from "@/lib/empleados";

export interface EmpleadoImportRowResult {
  rowNumber: number;
  payload?: EmpleadoPayload;
  errors: string[];
}

export interface EmpleadoImportParseResult {
  rows: EmpleadoImportRowResult[];
  fatalError?: string;
}

const EMPLEADOS_IMPORT_HEADERS = [
  "nombreCompleto",
  "email",
  "telefonoCodigo",
  "telefonoNumero",
  "sector",
  "ocupacion",
  "sexo",
  "fechaIngreso",
  "fechaNacimiento",
  "comisionesHabilitadas",
  "direccionDescripcion",
  "pais",
  "codigoPostal",
  "direccion",
  "numero",
  "ciudad",
  "comisionDescripcion",
  "comisionTipo",
  "comisionValor",
] as const;

const EMPLEADOS_IMPORT_SAMPLE = [
  "Ana Perez",
  "ana.perez@empresa.com",
  "54",
  "1122334455",
  "Produccion",
  "Operaria",
  "femenino",
  "2026-05-01",
  "1992-03-14",
  "no",
  "Principal",
  "AR",
  "1406",
  "Av. Rivadavia",
  "1234",
  "CABA",
  "",
  "",
  "",
] as const;

const REQUIRED_HEADERS = new Set([
  "nombreCompleto",
  "email",
  "telefonoCodigo",
  "telefonoNumero",
  "sector",
  "fechaIngreso",
  "direccionDescripcion",
  "pais",
  "direccion",
  "ciudad",
]);

const EMPLEADOS_IMPORT_HEADER_LABELS = EMPLEADOS_IMPORT_HEADERS.map((header) =>
  REQUIRED_HEADERS.has(header) ? `${header}*` : header,
);

const SEXO_VALUES = new Set<SexoEmpleado>([
  "masculino",
  "femenino",
  "no_binario",
  "prefiero_no_decir",
]);


export function downloadEmpleadosImportTemplate() {
  downloadCsv(
    "plantilla-importacion-empleados.csv",
    buildEmpleadosImportTemplateCsv(),
  );
}

export function buildEmpleadosImportTemplateCsv() {
  return toCsv([EMPLEADOS_IMPORT_HEADER_LABELS, EMPLEADOS_IMPORT_SAMPLE]);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseEmpleadosImportCsv(csv: string): EmpleadoImportParseResult {
  const rows = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  if (rows.length < 2) {
    return {
      rows: [],
      fatalError: "El archivo debe tener encabezados y al menos una fila de empleados.",
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const missingHeaders = EMPLEADOS_IMPORT_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      fatalError: `Faltan columnas requeridas por la plantilla: ${missingHeaders.join(", ")}.`,
    };
  }

  const results = rows.slice(1).map((row, idx) => {
    const record = Object.fromEntries(
      headers.map((header, headerIdx) => [header, row[headerIdx]?.trim() ?? ""]),
    );
    return recordToEmpleadoPayload(record, idx + 2);
  });

  return { rows: results };
}

export function toCsv(rows: readonly (readonly string[])[]) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

function recordToEmpleadoPayload(
  record: Record<string, string>,
  rowNumber: number,
): EmpleadoImportRowResult {
  const errors: string[] = [];
  for (const header of REQUIRED_HEADERS) {
    if (!record[header]) errors.push(`Falta ${header}.`);
  }

  const comisionesHabilitadas = parseBoolean(record.comisionesHabilitadas);
  if (comisionesHabilitadas === null) {
    errors.push("comisionesHabilitadas debe ser si/no.");
  }

  const sexo = record.sexo as SexoEmpleado;
  if (record.sexo && !SEXO_VALUES.has(sexo)) {
    errors.push("sexo debe ser masculino, femenino, no_binario o prefiero_no_decir.");
  }


  if (!isIsoDate(record.fechaIngreso)) {
    errors.push("fechaIngreso debe tener formato YYYY-MM-DD.");
  }
  if (record.fechaNacimiento && !isIsoDate(record.fechaNacimiento)) {
    errors.push("fechaNacimiento debe tener formato YYYY-MM-DD.");
  }

  if (record.pais && record.pais.length !== 2) {
    errors.push("pais debe ser un código ISO de 2 letras, por ejemplo AR.");
  }

  const hasComision = record.comisionDescripcion || record.comisionTipo || record.comisionValor;
  if (hasComision) {
    if (!record.comisionDescripcion || !record.comisionTipo || !record.comisionValor) {
      errors.push("Para cargar comisión, completá descripción, tipo y valor.");
    }
    if (record.comisionTipo && !["porcentaje", "fijo"].includes(record.comisionTipo)) {
      errors.push("comisionTipo debe ser porcentaje o fijo.");
    }
    if (record.comisionValor && !Number.isFinite(Number(record.comisionValor))) {
      errors.push("comisionValor debe ser numérico.");
    }
  }

  if (errors.length > 0) return { rowNumber, errors };

  return {
    rowNumber,
    errors: [],
    payload: {
      nombreCompleto: record.nombreCompleto,
      email: record.email,
      telefonoCodigo: record.telefonoCodigo,
      telefonoNumero: record.telefonoNumero,
      sector: record.sector,
      ocupacion: record.ocupacion || undefined,
      sexo: record.sexo ? sexo : undefined,
      fechaIngreso: record.fechaIngreso,
      fechaNacimiento: record.fechaNacimiento || undefined,
      comisionesHabilitadas: comisionesHabilitadas ?? false,
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
      comisiones: hasComision
        ? [
            {
              descripcion: record.comisionDescripcion,
              tipo: record.comisionTipo as "porcentaje" | "fijo",
              valor: record.comisionValor,
            },
          ]
        : [],
    },
  };
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["si", "sí", "s", "true", "1", "yes"].includes(normalized)) return true;
  if (["no", "n", "false", "0", ""].includes(normalized)) return false;
  return null;
}

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim().replace(/\*$/, "");
}


function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
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
