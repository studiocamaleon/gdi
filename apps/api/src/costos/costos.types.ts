import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CentroCompleto = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    capacidadesPeriodo: true;
    tarifasPeriodo: true;
  };
}>;

export type CentroConfiguracionCompleta = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    lineas: true;
    capacidadesPeriodo: true;
    tarifasPeriodo: true;
  };
}>;

export type TarifaSnapshot = {
  centro: CentroConfiguracionCompleta;
  periodo: string;
  costoMensualTotal: Prisma.Decimal;
  capacidadPractica: Prisma.Decimal;
  tarifaCalculada: Prisma.Decimal;
  /** Mano de obra (SUELDOS + CARGAS): mensual y tarifa horaria del centro. */
  costoMensualManoObra: Prisma.Decimal;
  tarifaManoObra: Prisma.Decimal;
  advertencias: string[];
  validaParaPublicar: boolean;
  resumenJson: Prisma.JsonObject;
};

export type RepartoAbsorbidoItem = {
  desdeCentroCostoId: string;
  desdeCentroCodigo: string;
  desdeCentroNombre: string;
  monto: number;
};

export type RepartoPeriodo = {
  absorbidoByCentroId: Map<string, Prisma.Decimal>;
  desgloseByCentroId: Map<string, RepartoAbsorbidoItem[]>;
  /**
   * Lo que cada centro de estructura mandó a los productivos. Es la columna
   * "Prorrateado" del listado, y su total tiene que dar igual que el de
   * "Absorbido": es la verificación a ojo de que el reparto no perdió plata.
   */
  distribuidoByCentroId: Map<string, Prisma.Decimal>;
};

export type DbClient = PrismaService | Prisma.TransactionClient;
