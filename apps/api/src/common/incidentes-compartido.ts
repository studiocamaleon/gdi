export type FiltroIncidentes = {
  entorno: 'production' | 'staging';
  periodo: '24h' | '7d' | '14d';
  estado: 'abiertos' | 'resueltos' | 'todos';
  pruebas: 'no' | 'si';
};
export type Incidente = {
  id: string;
  referencia: string;
  proyecto: 'grafoprint-web' | 'grafoprint-api';
  titulo: string;
  estado: 'abierto' | 'resuelto' | 'archivado';
  prioridad: 'alta' | 'media' | 'baja';
  repeticiones: number | null;
  ultimaVez: string | null;
  enlace: string;
};
export type ResumenIncidentes = {
  conexion: 'conectado' | 'sin_configurar' | 'no_disponible';
  actualizadoEl: string | null;
  incidentes: Incidente[];
  hayMas: boolean;
  enlace: string;
};
