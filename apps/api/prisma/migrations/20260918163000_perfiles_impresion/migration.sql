CREATE TABLE "ImpresionDestino" (
 "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "nombre" VARCHAR(120) NOT NULL,
 "host" VARCHAR(253) NOT NULL, "impresora" VARCHAR(200) NOT NULL, "maquinaId" UUID NOT NULL,
 "activo" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ImpresionDestino_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ImpresionDestino_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImpresionDestino_tenantId_host_impresora_key" ON "ImpresionDestino"("tenantId", "host", "impresora");
CREATE INDEX "ImpresionDestino_tenantId_maquinaId_idx" ON "ImpresionDestino"("tenantId", "maquinaId");
CREATE TABLE "ImpresionBandeja" (
 "id" UUID NOT NULL, "destinoId" UUID NOT NULL, "nombre" VARCHAR(100) NOT NULL, "codigo" VARCHAR(100) NOT NULL,
 "papelPreparadoId" UUID, "gramajePreparado" INTEGER, "preparadoPor" TEXT, "preparadoEl" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "ImpresionBandeja_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ImpresionBandeja_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "ImpresionDestino"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImpresionBandeja_destinoId_codigo_key" ON "ImpresionBandeja"("destinoId", "codigo");
CREATE TABLE "ImpresionPerfil" (
 "id" UUID NOT NULL, "bandejaId" UUID NOT NULL, "nombre" VARCHAR(120) NOT NULL, "papelMateriaPrimaId" UUID NOT NULL,
 "gramaje" INTEGER NOT NULL, "tamano" VARCHAR(20) NOT NULL DEFAULT 'A4', "color" VARCHAR(10) NOT NULL DEFAULT 'BN',
 "faz" INTEGER NOT NULL, "modo" VARCHAR(20) NOT NULL DEFAULT 'PREPARACION', "probado" BOOLEAN NOT NULL DEFAULT false,
 "activo" BOOLEAN NOT NULL DEFAULT true, "prioridad" INTEGER NOT NULL DEFAULT 1, "version" INTEGER NOT NULL DEFAULT 1,
 "actualizadoPor" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ImpresionPerfil_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ImpresionPerfil_bandejaId_fkey" FOREIGN KEY ("bandejaId") REFERENCES "ImpresionBandeja"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ImpresionPerfil_faz_check" CHECK ("faz" IN (1,2)),
 CONSTRAINT "ImpresionPerfil_gramaje_check" CHECK ("gramaje" > 0 AND "gramaje" <= 1000),
 CONSTRAINT "ImpresionPerfil_modo_check" CHECK ("modo" IN ('AUTOMATICO','PREPARACION'))
);
CREATE INDEX "ImpresionPerfil_bandejaId_activo_idx" ON "ImpresionPerfil"("bandejaId", "activo");
