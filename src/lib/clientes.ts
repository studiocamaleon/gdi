export type LatamCountry = {
  code: string;
  flag: string;
  name: string;
  phoneCode: string;
};

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
  contactos: ClienteContacto[];
  direcciones: ClienteDireccion[];
};

export type ClientePayload = {
  nombre: string;
  razonSocial?: string;
  cuit?: string;
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

export const latamCountries: LatamCountry[] = [
  { code: "AR", flag: "🇦🇷", name: "Argentina", phoneCode: "54" },
  { code: "BO", flag: "🇧🇴", name: "Bolivia", phoneCode: "591" },
  { code: "BR", flag: "🇧🇷", name: "Brasil", phoneCode: "55" },
  { code: "CL", flag: "🇨🇱", name: "Chile", phoneCode: "56" },
  { code: "CO", flag: "🇨🇴", name: "Colombia", phoneCode: "57" },
  { code: "CR", flag: "🇨🇷", name: "Costa Rica", phoneCode: "506" },
  { code: "CU", flag: "🇨🇺", name: "Cuba", phoneCode: "53" },
  { code: "DO", flag: "🇩🇴", name: "Republica Dominicana", phoneCode: "1809" },
  { code: "EC", flag: "🇪🇨", name: "Ecuador", phoneCode: "593" },
  { code: "SV", flag: "🇸🇻", name: "El Salvador", phoneCode: "503" },
  { code: "GT", flag: "🇬🇹", name: "Guatemala", phoneCode: "502" },
  { code: "HN", flag: "🇭🇳", name: "Honduras", phoneCode: "504" },
  { code: "MX", flag: "🇲🇽", name: "Mexico", phoneCode: "52" },
  { code: "NI", flag: "🇳🇮", name: "Nicaragua", phoneCode: "505" },
  { code: "PA", flag: "🇵🇦", name: "Panama", phoneCode: "507" },
  { code: "PY", flag: "🇵🇾", name: "Paraguay", phoneCode: "595" },
  { code: "PE", flag: "🇵🇪", name: "Peru", phoneCode: "51" },
  { code: "UY", flag: "🇺🇾", name: "Uruguay", phoneCode: "598" },
  { code: "VE", flag: "🇻🇪", name: "Venezuela", phoneCode: "58" },
];

export function createEmptyCliente(): ClienteDetalle {
  return {
    id: "",
    nombre: "",
    razonSocial: "",
    cuit: "",
    condicionFiscal: "consumidor_final",
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
