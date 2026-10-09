import { apiRequest } from "./api";
export const condicionesAlta = [
  { value: "", label: "Seleccioná tu condición" },
  { value: "consumidor_final", label: "Consumidor final" },
  { value: "RI", label: "Responsable inscripto" },
  { value: "monotributo", label: "Monotributista" },
  { value: "exento", label: "Exento" },
];
export type AltaCliente = {
  id: string;
  nombre: string;
  documentoTipo: string;
  documentoNumero: string;
  condicionFiscal: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  estado: string;
  createdAt: string;
  clienteId: string | null;
  resueltoPorNombre: string | null;
  resueltoEl: string | null;
  motivo: string | null;
};
export type DetalleAlta = AltaCliente & {
  coincidencias: {
    id: string;
    nombre: string;
    activo: boolean;
    documento: boolean;
    motivos: string[];
  }[];
};
export type ListaAltas = {
  items: AltaCliente[];
  total: number;
  pagina: number;
};
export const raizAltas = "/solicitudes-alta-clientes";
export const listarAltas = (
  estado: string,
  pagina: number,
  signal?: AbortSignal,
) =>
  apiRequest<ListaAltas>(`${raizAltas}?estado=${estado}&pagina=${pagina}`, {
    signal,
  });
