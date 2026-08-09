/**
 * La lista de países vive en `paises.ts`: estaba duplicada acá y en el otro
 * módulo, y el día que se agregara un país en uno solo las dos altas iban a
 * ofrecer opciones distintas. Se re-exporta para no romper los imports que ya
 * apuntan a este archivo.
 */
export { latamCountries, type LatamCountry } from "@/lib/paises";

export type ClienteContacto = {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  principal: boolean;
};

export type TipoDireccion = "principal" | "facturacion" | "entrega";

export type ClienteDireccion = {
  id: string;
  descripcion: string;
  pais: string;
  codigoPostal: string;
  direccion: string;
  numero: string;
  ciudad: string;
  tipo: TipoDireccion;
  principal: boolean;
};

/**
 * Condición fiscal del receptor (AR). Junto con la del emisor define la
 * letra del comprobante — ver docs/modulo-administracion-diseno.md.
 * Espejo de CONDICIONES_FISCALES del API.
 */
export const CONDICIONES_FISCALES = [
  "RI",
  "monotributo",
  "exento",
  "consumidor_final",
  "exterior",
] as const;

export type CondicionFiscal = (typeof CONDICIONES_FISCALES)[number];

export const CONDICION_FISCAL_LABELS: Record<CondicionFiscal, string> = {
  RI: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor final",
  exterior: "Exterior (exportación)",
};

/** Sólo un RI puede recibir Factura A, y para eso necesita CUIT. */
export function requiereCuit(condicion: CondicionFiscal): boolean {
  return condicion === "RI";
}

/** "30712345678" → "30-71234567-8" (para mostrar). */
export function formatCuit(cuit: string): string {
  const digitos = cuit.replace(/\D/g, "");
  if (digitos.length !== 11) return cuit;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

export type ClienteDetalle = {
  /** Inhabilitado: no aparece en listas ni buscadores, su historial queda. */
  activo: boolean;
  id: string;
  nombre: string;
  razonSocial: string;
  /** CUIT sin guiones (11 dígitos) o "" si no está cargado. */
  cuit: string;
  condicionFiscal: CondicionFiscal;
  /** Tope de deuda en cta. cte.; null = sin límite definido. */
  limiteCredito: number | null;
  contacto: string;
  email: string;
  ciudad: string;
  pais: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  /** DNI, cuando el alta salió del documento escaneado. */
  documentoNumero: string | null;
  /** 'mostrador' = alta rápida por DNI; puede faltarle email o teléfono. */
  origenAlta: string | null;
  contactos: ClienteContacto[];
  direcciones: ClienteDireccion[];
};

export type ClientePayload = {
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  /** DNI sin puntos. Distinto del CUIT: ARCA los declara aparte. */
  documentoNumero?: string;
  condicionFiscal?: CondicionFiscal;
  limiteCredito?: number | null;
  email: string;
  pais: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  contactos: Array<{
    nombre: string;
    cargo?: string;
    email?: string;
    telefonoCodigo?: string;
    telefonoNumero?: string;
    principal: boolean;
  }>;
  direcciones: Array<{
    descripcion: string;
    pais: string;
    codigoPostal?: string;
    direccion: string;
    numero?: string;
    ciudad: string;
    tipo: TipoDireccion;
    principal: boolean;
  }>;
};

export function createEmptyCliente(): ClienteDetalle {
  return {
    id: "",
    nombre: "",
    razonSocial: "",
    cuit: "",
    documentoNumero: null,
    origenAlta: null,
    condicionFiscal: "consumidor_final",
    activo: true,
    limiteCredito: null,
    contacto: "",
    email: "",
    ciudad: "",
    pais: "AR",
    telefonoCodigo: "54",
    telefonoNumero: "",
    contactos: [
      {
        id: crypto.randomUUID(),
        nombre: "",
        cargo: "",
        email: "",
        telefonoCodigo: "54",
        telefonoNumero: "",
        principal: true,
      },
    ],
    direcciones: [
      {
        id: crypto.randomUUID(),
        descripcion: "",
        pais: "AR",
        codigoPostal: "",
        direccion: "",
        numero: "",
        ciudad: "",
        tipo: "principal",
        principal: true,
      },
    ],
  };
}
