-- CreateEnum
CREATE TYPE "PlantillaMaquinaria" AS ENUM ('ROUTER_CNC', 'CORTE_LASER', 'IMPRESORA_3D', 'IMPRESORA_DTF', 'IMPRESORA_DTF_UV', 'IMPRESORA_UV_MESA_EXTENSORA', 'IMPRESORA_UV_CILINDRICA', 'IMPRESORA_UV_FLATBED', 'IMPRESORA_UV_ROLLO', 'IMPRESORA_SOLVENTE', 'IMPRESORA_INYECCION_TINTA', 'IMPRESORA_LATEX', 'IMPRESORA_SUBLIMACION_GRAN_FORMATO', 'IMPRESORA_LASER', 'PLOTTER_CAD', 'MESA_DE_CORTE', 'PLOTTER_DE_CORTE');

-- CreateEnum
CREATE TYPE "EstadoMaquina" AS ENUM ('ACTIVA', 'INACTIVA', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoConfiguracionMaquina" AS ENUM ('BORRADOR', 'INCOMPLETA', 'LISTA');

-- CreateEnum
CREATE TYPE "GeometriaTrabajoMaquina" AS ENUM ('PLIEGO', 'ROLLO', 'PLANO', 'CILINDRICO', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "UnidadProduccionMaquina" AS ENUM ('HORA', 'HOJA', 'COPIA', 'A4_EQUIV', 'M2', 'METRO_LINEAL', 'PIEZA', 'CICLO');

-- CreateEnum
CREATE TYPE "TipoPerfilOperativoMaquina" AS ENUM ('IMPRESION', 'CORTE', 'MECANIZADO', 'GRABADO', 'FABRICACION', 'MIXTO');

-- CreateEnum
CREATE TYPE "TipoConsumibleMaquina" AS ENUM ('TONER', 'TINTA', 'BARNIZ', 'PRIMER', 'FILM', 'POLVO', 'ADHESIVO', 'RESINA', 'LUBRICANTE', 'OTRO');

-- CreateEnum
CREATE TYPE "UnidadConsumoMaquina" AS ENUM ('ML', 'LITRO', 'GRAMO', 'KG', 'UNIDAD', 'M2', 'METRO_LINEAL', 'PAGINA', 'A4_EQUIV');

-- CreateEnum
CREATE TYPE "TipoComponenteDesgasteMaquina" AS ENUM ('FUSOR', 'DRUM', 'DEVELOPER', 'CORREA_TRANSFERENCIA', 'CABEZAL', 'LAMPARA_UV', 'FRESA', 'CUCHILLA', 'FILTRO', 'KIT_MANTENIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "UnidadDesgasteMaquina" AS ENUM ('COPIAS_A4_EQUIV', 'M2', 'METROS_LINEALES', 'HORAS', 'CICLOS', 'PIEZAS');

-- CreateTable
CREATE TABLE "Maquina" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "plantilla" "PlantillaMaquinaria" NOT NULL,
    "plantillaVersion" INTEGER NOT NULL DEFAULT 1,
    "fabricante" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "plantaId" UUID NOT NULL,
    "centroCostoPrincipalId" UUID,
    "ubicacionDetalle" TEXT,
    "estado" "EstadoMaquina" NOT NULL DEFAULT 'ACTIVA',
    "estadoConfiguracion" "EstadoConfiguracionMaquina" NOT NULL DEFAULT 'BORRADOR',
    "geometriaTrabajo" "GeometriaTrabajoMaquina" NOT NULL,
    "unidadProduccionPrincipal" "UnidadProduccionMaquina" NOT NULL,
    "anchoUtil" DECIMAL(12,2),
    "largoUtil" DECIMAL(12,2),
    "altoUtil" DECIMAL(12,2),
    "espesorMaximo" DECIMAL(12,2),
    "pesoMaximo" DECIMAL(12,2),
    "fechaAlta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "parametrosTecnicosJson" JSONB,
    "capacidadesAvanzadasJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaquinaPerfilOperativo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoPerfil" "TipoPerfilOperativoMaquina" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "anchoAplicable" DECIMAL(12,2),
    "altoAplicable" DECIMAL(12,2),
    "modoTrabajo" TEXT,
    "calidad" TEXT,
    "productividad" DECIMAL(12,2),
    "unidadProductividad" "UnidadProduccionMaquina",
    "tiempoPreparacionMin" DECIMAL(12,2),
    "tiempoCargaMin" DECIMAL(12,2),
    "tiempoDescargaMin" DECIMAL(12,2),
    "tiempoRipMin" DECIMAL(12,2),
    "cantidadPasadas" INTEGER,
    "dobleFaz" BOOLEAN NOT NULL DEFAULT false,
    "detalleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaPerfilOperativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaquinaConsumible" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "perfilOperativoId" UUID,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoConsumibleMaquina" NOT NULL,
    "unidad" "UnidadConsumoMaquina" NOT NULL,
    "costoReferencia" DECIMAL(12,2),
    "rendimientoEstimado" DECIMAL(12,2),
    "consumoBase" DECIMAL(12,4),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "detalleJson" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaConsumible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaquinaComponenteDesgaste" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoComponenteDesgasteMaquina" NOT NULL,
    "vidaUtilEstimada" DECIMAL(12,2),
    "unidadDesgaste" "UnidadDesgasteMaquina" NOT NULL,
    "costoReposicion" DECIMAL(12,2),
    "modoProrrateo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "detalleJson" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaComponenteDesgaste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Maquina_tenantId_plantilla_activo_idx" ON "Maquina"("tenantId", "plantilla", "activo");

-- CreateIndex
CREATE INDEX "Maquina_tenantId_plantaId_activo_idx" ON "Maquina"("tenantId", "plantaId", "activo");

-- CreateIndex
CREATE INDEX "Maquina_tenantId_estado_idx" ON "Maquina"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Maquina_tenantId_centroCostoPrincipalId_idx" ON "Maquina"("tenantId", "centroCostoPrincipalId");

-- CreateIndex
CREATE UNIQUE INDEX "Maquina_tenantId_codigo_key" ON "Maquina"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "MaquinaPerfilOperativo_tenantId_maquinaId_activo_idx" ON "MaquinaPerfilOperativo"("tenantId", "maquinaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "MaquinaPerfilOperativo_tenantId_maquinaId_nombre_key" ON "MaquinaPerfilOperativo"("tenantId", "maquinaId", "nombre");

-- CreateIndex
CREATE INDEX "MaquinaConsumible_tenantId_maquinaId_activo_idx" ON "MaquinaConsumible"("tenantId", "maquinaId", "activo");

-- CreateIndex
CREATE INDEX "MaquinaConsumible_tenantId_perfilOperativoId_idx" ON "MaquinaConsumible"("tenantId", "perfilOperativoId");

-- CreateIndex
CREATE INDEX "MaquinaComponenteDesgaste_tenantId_maquinaId_activo_idx" ON "MaquinaComponenteDesgaste"("tenantId", "maquinaId", "activo");

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maquina" ADD CONSTRAINT "Maquina_centroCostoPrincipalId_fkey" FOREIGN KEY ("centroCostoPrincipalId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaPerfilOperativo" ADD CONSTRAINT "MaquinaPerfilOperativo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaPerfilOperativo" ADD CONSTRAINT "MaquinaPerfilOperativo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_perfilOperativoId_fkey" FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
