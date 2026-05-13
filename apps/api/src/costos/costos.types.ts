import { AreaCosto, Planta, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AreaCompleta = AreaCosto & { planta: Planta };

export type CentroCompleto = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    areaCosto: true;
    responsableEmpleado: true;
    capacidadesPeriodo: true;
    tarifasPeriodo: true;
  };
}>;

export type CentroConfiguracionCompleta = Prisma.CentroCostoGetPayload<{
  include: {
    planta: true;
    areaCosto: true;
    responsableEmpleado: true;
    recursos: {
      include: {
        empleado: true;
        maquina: true;
        maquinariaPeriodo: true;
      };
    };
    componentesCostoPeriodo: true;
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
};

export type DbClient = PrismaService | Prisma.TransactionClient;
