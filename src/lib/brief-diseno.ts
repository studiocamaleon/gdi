export type BriefDisenoArchivo = {
  nombre: string;
  requiereVectorizacion: boolean;
};

export type BriefDiseno = {
  schemaVersion: 1;
  frente: string;
  dorso: string;
  colores: string;
  indicaciones: string;
  archivos: BriefDisenoArchivo[];
};

export type BriefDisenoArchivoPendiente = {
  file: File;
  requiereVectorizacion: boolean;
};

export const BRIEF_DISENO_VACIO: BriefDiseno = {
  schemaVersion: 1,
  frente: "",
  dorso: "",
  colores: "",
  indicaciones: "",
  archivos: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function texto(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function leerBriefDiseno(value: unknown): BriefDiseno {
  const raw = asRecord(value);
  if (!raw) return { ...BRIEF_DISENO_VACIO, archivos: [] };

  const archivos = Array.isArray(raw.archivos)
    ? raw.archivos.flatMap((value) => {
        const archivo = asRecord(value);
        const nombre = texto(archivo?.nombre).trim();
        if (!nombre) return [];
        return [
          {
            nombre,
            requiereVectorizacion:
              archivo?.requiereVectorizacion === true,
          },
        ];
      })
    : [];

  return {
    schemaVersion: 1,
    frente: texto(raw.frente),
    dorso: texto(raw.dorso),
    colores: texto(raw.colores),
    indicaciones: texto(raw.indicaciones),
    archivos,
  };
}

export function prepararBriefDiseno(
  value: BriefDiseno,
  pendientes: BriefDisenoArchivoPendiente[],
): BriefDiseno {
  const archivos = new Map<string, BriefDisenoArchivo>();
  for (const archivo of value.archivos) {
    const nombre = archivo.nombre.trim();
    if (!nombre) continue;
    archivos.set(nombre, { ...archivo, nombre });
  }
  for (const pendiente of pendientes) {
    archivos.set(pendiente.file.name, {
      nombre: pendiente.file.name,
      requiereVectorizacion: pendiente.requiereVectorizacion,
    });
  }

  return {
    schemaVersion: 1,
    frente: value.frente.trim(),
    dorso: value.dorso.trim(),
    colores: value.colores.trim(),
    indicaciones: value.indicaciones.trim(),
    archivos: [...archivos.values()],
  };
}

export function briefDisenoTieneContenido(value: BriefDiseno): boolean {
  return Boolean(
    value.frente.trim() ||
      value.dorso.trim() ||
      value.colores.trim() ||
      value.indicaciones.trim() ||
      value.archivos.length > 0,
  );
}

/** Bloqueo mínimo: alcanza con indicaciones del frente o un archivo base. */
export function errorBriefDiseno(value: BriefDiseno): string | null {
  if (value.frente.trim() || value.archivos.length > 0) return null;
  return "Completá el contenido del frente o adjuntá al menos un archivo para diseño.";
}

export function briefDisenoEstaCompleto(
  value: BriefDiseno,
  caras: 1 | 2,
): boolean {
  if (errorBriefDiseno(value)) return false;
  return caras === 1 || value.dorso.trim().length > 0;
}
