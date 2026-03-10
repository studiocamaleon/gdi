export type LatamCountry = {
  code: string;
  flag: string;
  name: string;
  phoneCode: string;
};

export type ProveedorContacto = {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  principal: boolean;
};

export type TipoDireccion = "principal" | "facturacion" | "entrega";

export type ProveedorDireccion = {
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

export type ProveedorDetalle = {
  id: string;
  nombre: string;
  razonSocial: string;
  contacto: string;
  email: string;
  ciudad: string;
  pais: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  contactos: ProveedorContacto[];
  direcciones: ProveedorDireccion[];
};

export type ProveedorPayload = {
  nombre: string;
  razonSocial?: string;
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

export function createEmptyProveedor(): ProveedorDetalle {
  return {
    id: "",
    nombre: "",
    razonSocial: "",
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
