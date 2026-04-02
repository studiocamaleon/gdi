export type Estacion = {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EstacionPayload = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

export function createEmptyEstacion(): EstacionPayload {
  return {
    nombre: "",
    descripcion: "",
    activo: true,
  };
}
