/**
 * Perfiles impositivos por país — el "librito" que la vista de Impuestos usa
 * para adaptarse al país del tenant (Fase 3, arranque LATAM).
 *
 * Es SÓLO presentación: nombre del impuesto, tasa general de referencia, si el
 * país tiene impuestos de empresa (sub-nacionales/concurrentes) y cómo se
 * cuenta el régimen. Las tasas REALES que cotiza el motor viven en el catálogo
 * del tenant (ProductoImpuestoCatalogo); acá sólo hay defaults y textos.
 *
 * El gateo del IVA en el motor NO depende de este archivo: cobra salvo que la
 * condición fiscal sea monotributo/exento (ver motor.service.ts). Así los
 * países que "siempre cobran" (Chile, México) andan sin config extra.
 *
 * Fuentes: docs/impuestos-modelo-latam-diseno.md (investigación 2026-07-31).
 */

export interface PerfilPaisImpuestos {
  codigo: string;
  bandera: string;
  nombre: string;
  /** Nombre corto del impuesto principal: IVA | IGV | ISV. */
  impuesto: string;
  /** Alícuota general de referencia (%). El valor real lo pone el tenant. */
  tasaGeneral: number;
  /** ¿El país tiene impuestos de empresa sobre la venta (IIBB, ICA, IT…)? */
  tieneImpuestosEmpresa: boolean;
  /**
   * true SÓLO para Argentina: la vista muestra la condición fiscal (RI /
   * Monotributo) desde Datos fiscales. En el resto se usa `regimenNota`.
   */
  usaCondicionFiscal: boolean;
  /** Línea sobre el régimen para países que no usan la condición fiscal AR. */
  regimenNota?: string;
  /** Ejemplo de qué cae en "Exento" (varía por país; en Chile el libro paga). */
  notaExento: string;
  /** Organismo de facturación/recaudación (informativo). */
  organismo?: string;
}

const AR: PerfilPaisImpuestos = {
  codigo: "AR",
  bandera: "🇦🇷",
  nombre: "Argentina",
  impuesto: "IVA",
  tasaGeneral: 21,
  tieneImpuestosEmpresa: true,
  usaCondicionFiscal: true,
  notaExento: "Sin IVA — ej. libros",
  organismo: "ARCA",
};

export const PERFILES_PAIS: Record<string, PerfilPaisImpuestos> = {
  AR,
  CL: {
    codigo: "CL",
    bandera: "🇨🇱",
    nombre: "Chile",
    impuesto: "IVA",
    tasaGeneral: 19,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "En Chile el IVA se cobra en todas las ventas.",
    notaExento: "Casos puntuales (en Chile el libro sí paga IVA)",
    organismo: "SII",
  },
  UY: {
    codigo: "UY",
    bandera: "🇺🇾",
    nombre: "Uruguay",
    impuesto: "IVA",
    tasaGeneral: 22,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "El IVA aplica salvo régimen simplificado (Monotributo / Literal E).",
    notaExento: "Sin IVA — ej. libros",
    organismo: "DGI",
  },
  PY: {
    codigo: "PY",
    bandera: "🇵🇾",
    nombre: "Paraguay",
    impuesto: "IVA",
    tasaGeneral: 10,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "El IVA aplica salvo que estés en RESIMPLE (régimen simplificado).",
    notaExento: "Sin IVA — ej. libros",
    organismo: "DNIT",
  },
  PE: {
    codigo: "PE",
    bandera: "🇵🇪",
    nombre: "Perú",
    impuesto: "IGV",
    tasaGeneral: 18,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "El IGV aplica salvo que estés en el Nuevo RUS (sólo boleta).",
    notaExento: "Sin IGV — ej. libros",
    organismo: "SUNAT",
  },
  CO: {
    codigo: "CO",
    bandera: "🇨🇴",
    nombre: "Colombia",
    impuesto: "IVA",
    tasaGeneral: 19,
    tieneImpuestosEmpresa: true,
    usaCondicionFiscal: false,
    regimenNota: "El IVA aplica salvo que seas No responsable de IVA.",
    notaExento: "Sin IVA — ej. libros (excluidos)",
    organismo: "DIAN",
  },
  BO: {
    codigo: "BO",
    bandera: "🇧🇴",
    nombre: "Bolivia",
    impuesto: "IVA",
    tasaGeneral: 13,
    tieneImpuestosEmpresa: true,
    usaCondicionFiscal: false,
    regimenNota: "El IVA aplica salvo que estés en el Régimen Simplificado (RTS).",
    notaExento: "Tasa cero — ej. libros",
    organismo: "SIN",
  },
  MX: {
    codigo: "MX",
    bandera: "🇲🇽",
    nombre: "México",
    impuesto: "IVA",
    tasaGeneral: 16,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "En México el IVA se cobra en todas las ventas (RESICO no lo cambia).",
    notaExento: "Sin IVA — ej. libros propios",
    organismo: "SAT",
  },
  EC: {
    codigo: "EC",
    bandera: "🇪🇨",
    nombre: "Ecuador",
    impuesto: "IVA",
    tasaGeneral: 15,
    tieneImpuestosEmpresa: false,
    usaCondicionFiscal: false,
    regimenNota: "El IVA aplica salvo RIMPE Negocio Popular (no cobra IVA).",
    notaExento: "Tarifa 0% — ej. libros",
    organismo: "SRI",
  },
  HN: {
    codigo: "HN",
    bandera: "🇭🇳",
    nombre: "Honduras",
    impuesto: "ISV",
    tasaGeneral: 15,
    tieneImpuestosEmpresa: true,
    usaCondicionFiscal: false,
    regimenNota:
      "El ISV se cobra salvo que estés en el Régimen Simplificado (ventas < L 250.000/año).",
    notaExento: "Sin ISV — ej. libros y material educativo",
    organismo: "SAR",
  },
};

/** El perfil del país del tenant, con Argentina como fallback. */
export function perfilPais(paisCodigo: string | undefined): PerfilPaisImpuestos {
  return PERFILES_PAIS[(paisCodigo ?? "AR").toUpperCase()] ?? AR;
}
