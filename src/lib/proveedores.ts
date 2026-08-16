/**
 * La lista de países vive en `paises.ts`: estaba duplicada acá y en el otro
 * módulo, y el día que se agregara un país en uno solo las dos altas iban a
 * ofrecer opciones distintas. Se re-exporta para no romper los imports que ya
 * apuntan a este archivo.
 */
export { latamCountries, type LatamCountry } from "@/lib/paises";

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
  /** === Datos para PAGARLE (docs/egresos-y-cuentas-por-pagar-diseno.md) === */
  cuit: string;
  /** 'RI' | 'MONOTRIBUTO' | 'EXENTO' | 'CF' | ''. */
  condicionIva: string;
  /** Días de plazo. Precarga el vencimiento al cargar su factura; null = no sabemos. */
  condicionPagoDias: number | null;
  cbuAlias: string;
  activo: boolean;
  updatedAt: string;
  datosPagoCompletos: boolean;
  contactos: ProveedorContacto[];
  direcciones: ProveedorDireccion[];
  eventos: Array<{
    id: string;
    tipo: string;
    actorNombre: string;
    createdAt: string;
  }>;
};

export type ProveedorOpcion = {
  id: string;
  nombre: string;
  cuit: string | null;
  condicionIva: string | null;
  condicionPagoDias: number | null;
  cbuAlias: string | null;
};

export type ProveedorPayload = {
  nombre: string;
  razonSocial?: string;
  email: string;
  pais: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  cuit?: string;
  condicionIva?: string;
  condicionPagoDias?: number;
  cbuAlias?: string;
  contactos: Array<{
    id?: string;
    nombre: string;
    cargo?: string;
    email?: string;
    telefonoCodigo?: string;
    telefonoNumero?: string;
    principal: boolean;
  }>;
  direcciones: Array<{
    id?: string;
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
    cuit: "",
    condicionIva: "",
    condicionPagoDias: null,
    cbuAlias: "",
    activo: true,
    updatedAt: new Date().toISOString(),
    datosPagoCompletos: false,
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
    eventos: [],
  };
}
