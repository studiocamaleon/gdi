-- Lease de ejecución para los jobs programados.
-- Sin él, cada instancia del API corre todos los crons: el barrido de
-- acreditaciones acreditaría dos veces y el alta de plantillas de Wati
-- quemaría el doble del cupo de 10 por hora que impone Meta.
CREATE TABLE "CronLock" (
    "nombre" TEXT NOT NULL,
    "tomadoEl" TIMESTAMP(3) NOT NULL,
    "expiraEl" TIMESTAMP(3) NOT NULL,
    "instancia" TEXT,

    CONSTRAINT "CronLock_pkey" PRIMARY KEY ("nombre")
);
