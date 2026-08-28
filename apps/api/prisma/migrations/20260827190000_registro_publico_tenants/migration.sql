-- Registro público de tenants + catálogo comercial definitivo.

ALTER TABLE "Tenant"
  ADD COLUMN "origenAlta" TEXT NOT NULL DEFAULT 'plataforma',
  ADD COLUMN "onboardingCompletadoEl" TIMESTAMP(3);

-- Los tenants que ya existían no deben entrar retroactivamente al onboarding.
UPDATE "Tenant" SET "onboardingCompletadoEl" = CURRENT_TIMESTAMP;

ALTER TABLE "Plan"
  ADD COLUMN "registroPublico" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recomendado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "precioAConsultar" BOOLEAN NOT NULL DEFAULT false;

-- Trial deja de ser un plan ofrecido: el Trial es un período sobre Taller o
-- Producción. Founder continúa siendo estrictamente interno.
UPDATE "Plan"
SET "publico" = false,
    "registroPublico" = false,
    "recomendado" = false
WHERE "codigo" IN ('trial', 'founder');

UPDATE "Plan"
SET "nombre" = 'Taller',
    "precioMensual" = 190,
    "moneda" = 'USD',
    "trialDias" = 14,
    "publico" = true,
    "registroPublico" = true,
    "recomendado" = false,
    "precioAConsultar" = false,
    "featuresJson" = '{"afip":false,"whatsapp":true,"usuariosMax":6,"ordenesMesMax":300,"storageGb":20}'::jsonb,
    "orden" = 1
WHERE "codigo" = 'taller';

-- Se conserva el código estable `estudio`; comercialmente pasa a llamarse
-- Producción para no romper referencias históricas ni webhooks de Paddle.
UPDATE "Plan"
SET "nombre" = 'Producción',
    "precioMensual" = 290,
    "moneda" = 'USD',
    "trialDias" = 14,
    "publico" = true,
    "registroPublico" = true,
    "recomendado" = true,
    "precioAConsultar" = false,
    "featuresJson" = '{"afip":true,"whatsapp":true,"usuariosMax":15,"ordenesMesMax":1200,"storageGb":100}'::jsonb,
    "orden" = 2
WHERE "codigo" = 'estudio';

-- Se conserva el código estable `diamante`; el precio queda a consultar y por
-- eso no participa de checkout aunque exista un price_id histórico.
UPDATE "Plan"
SET "nombre" = 'Enterprise',
    "moneda" = 'USD',
    "trialDias" = NULL,
    "publico" = true,
    "registroPublico" = false,
    "recomendado" = false,
    "precioAConsultar" = true,
    "featuresJson" = '{"afip":true,"whatsapp":true,"ordenesMesMax":1200,"storageGb":100,"soportePrioritario":true,"especialistaHorasMes":4}'::jsonb,
    "orden" = 3
WHERE "codigo" = 'diamante';

CREATE TABLE "RegistroTenant" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "nombreCompleto" TEXT NOT NULL,
  "empresaNombre" TEXT NOT NULL,
  "passwordHash" TEXT,
  "planId" UUID NOT NULL,
  "paisCodigo" VARCHAR(2) NOT NULL,
  "zonaHoraria" TEXT NOT NULL,
  "tokenHash" TEXT,
  "tokenExpiraEl" TIMESTAMP(3),
  "tokenVersion" INTEGER NOT NULL DEFAULT 1,
  "ultimoEnvioEl" TIMESTAMP(3),
  "proveedorMensajeId" TEXT,
  "emailVerificadoEl" TIMESTAMP(3),
  "completadoEl" TIMESTAMP(3),
  "revocadoEl" TIMESTAMP(3),
  "tenantCreadoId" UUID,
  "terminosVersion" TEXT NOT NULL,
  "terminosAceptadosEl" TIMESTAMP(3) NOT NULL,
  "marketingAceptadoEl" TIMESTAMP(3),
  "origen" TEXT,
  "atribucionJson" JSONB,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegistroTenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistroTenant_email_key" ON "RegistroTenant"("email");
CREATE UNIQUE INDEX "RegistroTenant_tokenHash_key" ON "RegistroTenant"("tokenHash");
CREATE UNIQUE INDEX "RegistroTenant_tenantCreadoId_key" ON "RegistroTenant"("tenantCreadoId");
CREATE INDEX "RegistroTenant_planId_createdAt_idx" ON "RegistroTenant"("planId", "createdAt");
CREATE INDEX "RegistroTenant_tokenExpiraEl_idx" ON "RegistroTenant"("tokenExpiraEl");
CREATE INDEX "RegistroTenant_completadoEl_idx" ON "RegistroTenant"("completadoEl");

ALTER TABLE "RegistroTenant"
  ADD CONSTRAINT "RegistroTenant_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegistroTenant"
  ADD CONSTRAINT "RegistroTenant_tenantCreadoId_fkey"
  FOREIGN KEY ("tenantCreadoId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
