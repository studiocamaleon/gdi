import type {
  AccesoEmpresa,
  ContratoCapacidades,
  diferenciasCapacidades,
} from '../../suscripciones/evaluador-capacidades';

/** Contrato público de la consulta. Mantenerlo libre de Nest/Prisma para la web. */
export type ComparacionPlanes = {
  calculadoEl: string;
  empresa: { id: string; nombre: string };
  accesoActual: AccesoEmpresa;
  actual: { nombre: string; limites: ContratoCapacidades['limites'] };
  almacenamientoAjustadoBytes: string | null;
  usuariosOcupados: number;
  uso: UsoCambioPlan;
  propuestas: Array<{
    nombre: string;
    limites: ContratoCapacidades['limites'];
    adicionalesPermitidos: boolean;
    usuariosSobreIncluidos: number;
    diferencias: ReturnType<typeof diferenciasCapacidades>;
    advertencias: string[];
    diagnostico: DiagnosticoCambioPlan;
  }>;
};

export type UsoCambioPlan = {
  usuarios: {
    activos: number;
    invitacionesPendientes: number;
    adicionalesVigentes: number;
  };
  archivos: {
    guardadosBytes: string;
    reservadosBytes: string;
    cargasPendientes: number;
  };
};

export type HallazgoCambioPlan = {
  codigo: string;
  nivel: 'resolver' | 'revisar';
  titulo: string;
  detalle: string;
  cantidad?: number;
};

export type DiagnosticoCambioPlan = {
  estado: 'resolver' | 'revisar' | 'sin_excedentes';
  usuariosCupoResultante: number | null;
  usuariosExcedidos: number;
  almacenamientoCupoBytes: string | null;
  almacenamientoExcedidoBytes: string;
  funcionesAgregadas: number;
  funcionesRetiradas: number;
  hallazgos: HallazgoCambioPlan[];
};
