CREATE TABLE "TrabajoEmisionOt" (
  "ordenId" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "usuarioId" UUID NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "planificar" BOOLEAN NOT NULL,
  "preparar" BOOLEAN NOT NULL,
  "fechasDiferidas" BOOLEAN NOT NULL,
  "disponibleEl" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "turno" UUID,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("tenantId", "ordenId") REFERENCES "OrdenTrabajo"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrabajoEmisionOt_disponibleEl_idx" ON "TrabajoEmisionOt"("disponibleEl");
CREATE INDEX "TrabajoEmisionOt_tenantId_disponibleEl_idx" ON "TrabajoEmisionOt"("tenantId", "disponibleEl");

CREATE TABLE "TurnoEmisionOt" (
  "tenantId" UUID PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "atendidoEl" TIMESTAMPTZ NOT NULL
);
