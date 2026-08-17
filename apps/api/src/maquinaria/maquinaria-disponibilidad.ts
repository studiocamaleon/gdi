import {
  EstadoConfiguracionMaquina,
  EstadoMaquina,
  Prisma,
} from '@prisma/client';

/** Única definición de una máquina utilizable por productos y producción. */
export const MAQUINA_DISPONIBLE_WHERE = {
  activo: true,
  estado: EstadoMaquina.ACTIVA,
  estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
} satisfies Prisma.MaquinaWhereInput;
