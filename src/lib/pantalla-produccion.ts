export type EntregaPantalla = {
  id: string;
  orden: string;
  cliente: string;
  producto: string;
  cantidad: number;
  unidad: string;
  fecha: string;
  atrasada: boolean;
  estado: string;
  etapa: string;
  pasosHechos: number;
  pasosTotal: number;
};
export type DatosPantalla = {
  empresa: string;
  pantalla: string;
  zona: string;
  hoy: string;
  actualizadoEl: string;
  intervaloSegundos: number;
  resumen: { atrasadas: number; hoy: number; listas: number };
  filas: EntregaPantalla[];
};
export type EstadoVinculo =
  | { estado: "pendiente"; codigo: string; venceCodigoEl: string }
  | { estado: "vinculada"; nombre: string };

export function capacidadPantalla(ancho: number, alto: number) {
  const columnas = ancho >= 1300 ? 2 : 1;
  const altoTarjeta = ancho < 600 ? 190 : 210;
  return {
    columnas,
    filas: Math.max(1, Math.floor((alto + 16) / (altoTarjeta + 16))),
  };
}

export function paginarEntregas<T>(filas: T[], capacidad: number): T[][] {
  const paginas: T[][] = [];
  const porPagina = Math.max(1, capacidad);
  for (let i = 0; i < filas.length; i += porPagina)
    paginas.push(filas.slice(i, i + porPagina));
  return paginas.length ? paginas : [[]];
}
