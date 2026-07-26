import { apiRequest } from "@/lib/api";

/**
 * Datos comerciales del negocio: cómo se presenta ante el cliente.
 *
 * Lo fiscal —razón social, CUIT, punto de venta— vive en
 * `administracion-api.ts`: son dos pantallas, dos permisos y dos usos.
 */
export type DatosEmpresa = {
  /** Nombre comercial. Del lado del API vive en `Tenant.nombre`. */
  nombre: string;
  telefonoCodigo: string | null;
  telefonoNumero: string | null;
  paisCodigo: string | null;
  whatsappCodigo: string | null;
  whatsappNumero: string | null;
  email: string | null;
  sitioWeb: string | null;
  domicilioComercial: string | null;
  localidad: string | null;
  provincia: string | null;
  horarioAtencion: string | null;
  urlResenas: string | null;
};

export type GuardarDatosEmpresa = {
  nombre: string;
} & Partial<Omit<DatosEmpresa, "nombre">>;

export async function getDatosEmpresa(): Promise<DatosEmpresa> {
  return apiRequest<DatosEmpresa>("/tenants/empresa");
}

export async function guardarDatosEmpresa(
  datos: GuardarDatosEmpresa,
): Promise<DatosEmpresa> {
  return apiRequest<DatosEmpresa>("/tenants/empresa", {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}
