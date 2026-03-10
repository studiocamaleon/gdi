import { latamCountries } from "@/lib/proveedores";

export { latamCountries } from "@/lib/proveedores";

export type TipoDireccion = "principal" | "facturacion" | "entrega";
export type SexoEmpleado =
  | "masculino"
  | "femenino"
  | "no_binario"
  | "prefiero_no_decir";
export type RolSistema = "administrador" | "supervisor" | "operador";
export type TipoComision = "porcentaje" | "fijo";

export type EmpleadoDireccion = {
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

export type EmpleadoComision = {
  id: string;
  descripcion: string;
  tipo: TipoComision;
  valor: string;
};

export type EmpleadoDetalle = {
  id: string;
  nombreCompleto: string;
  email: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  sector: string;
  ocupacion: string;
  sexo: SexoEmpleado | "";
  fechaIngreso: string;
  fechaNacimiento: string;
  usuarioSistema: boolean;
  emailAcceso: string;
  rolSistema: RolSistema | "";
  comisionesHabilitadas: boolean;
  ciudad: string;
  direcciones: EmpleadoDireccion[];
  comisiones: EmpleadoComision[];
};

export type EmpleadoPayload = {
  nombreCompleto: string;
  email: string;
  telefonoCodigo: string;
  telefonoNumero: string;
  sector: string;
  ocupacion?: string;
  sexo?: SexoEmpleado;
  fechaIngreso: string;
  fechaNacimiento?: string;
  usuarioSistema: boolean;
  emailAcceso?: string;
  rolSistema?: RolSistema;
  comisionesHabilitadas: boolean;
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
  comisiones: Array<{
    descripcion: string;
    tipo: TipoComision;
    valor: string;
  }>;
};

export const sexoItems: Array<{ label: string; value: SexoEmpleado }> = [
  { label: "Masculino", value: "masculino" },
  { label: "Femenino", value: "femenino" },
  { label: "No binario", value: "no_binario" },
  { label: "Prefiero no decir", value: "prefiero_no_decir" },
];

export const rolItems: Array<{ label: string; value: RolSistema }> = [
  { label: "Administrador", value: "administrador" },
  { label: "Supervisor", value: "supervisor" },
  { label: "Operador", value: "operador" },
];

export const comisionTypeItems: Array<{ label: string; value: TipoComision }> = [
  { label: "Porcentaje", value: "porcentaje" },
  { label: "Monto fijo", value: "fijo" },
];

export function createEmptyDireccion(): EmpleadoDireccion {
  return {
    id: crypto.randomUUID(),
    descripcion: "",
    pais: "AR",
    codigoPostal: "",
    direccion: "",
    numero: "",
    ciudad: "",
    tipo: "principal",
    principal: true,
  };
}

export function createEmptyComision(): EmpleadoComision {
  return {
    id: crypto.randomUUID(),
    descripcion: "5% de la venta",
    tipo: "porcentaje",
    valor: "5",
  };
}

export function createEmptyEmpleado(): EmpleadoDetalle {
  return {
    id: "",
    nombreCompleto: "",
    email: "",
    telefonoCodigo:
      latamCountries.find((country) => country.code === "AR")?.phoneCode ?? "54",
    telefonoNumero: "",
    sector: "",
    ocupacion: "",
    sexo: "",
    fechaIngreso: "",
    fechaNacimiento: "",
    usuarioSistema: false,
    emailAcceso: "",
    rolSistema: "",
    comisionesHabilitadas: false,
    ciudad: "",
    direcciones: [createEmptyDireccion()],
    comisiones: [],
  };
}
