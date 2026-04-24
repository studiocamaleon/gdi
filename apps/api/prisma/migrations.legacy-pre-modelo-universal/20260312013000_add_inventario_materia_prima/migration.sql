-- CreateEnum
CREATE TYPE "FamiliaMateriaPrima" AS ENUM (
  'SUSTRATO',
  'TINTA_COLORANTE',
  'TRANSFERENCIA_LAMINACION',
  'QUIMICO_AUXILIAR',
  'ADITIVA_3D',
  'ELECTRONICA_CARTELERIA',
  'NEON_LUMINARIA',
  'METAL_ESTRUCTURA',
  'PINTURA_RECUBRIMIENTO',
  'TERMINACION_EDITORIAL',
  'MAGNETICO_FIJACION',
  'POP_EXHIBIDOR',
  'HERRAJE_ACCESORIO',
  'ADHESIVO_TECNICO',
  'PACKING_INSTALACION'
);

-- CreateEnum
CREATE TYPE "SubfamiliaMateriaPrima" AS ENUM (
  'SUSTRATO_HOJA',
  'SUSTRATO_ROLLO_FLEXIBLE',
  'SUSTRATO_RIGIDO',
  'OBJETO_PROMOCIONAL_BASE',
  'TINTA_IMPRESION',
  'TONER',
  'FILM_TRANSFERENCIA',
  'PAPEL_TRANSFERENCIA',
  'LAMINADO_FILM',
  'QUIMICO_ACABADO',
  'AUXILIAR_PROCESO',
  'POLVO_DTF',
  'FILAMENTO_3D',
  'RESINA_3D',
  'MODULO_LED_CARTELERIA',
  'FUENTE_ALIMENTACION_LED',
  'CABLEADO_CONECTICA',
  'CONTROLADOR_LED',
  'NEON_FLEX_LED',
  'ACCESORIO_NEON_LED',
  'CHAPA_METALICA',
  'PERFIL_ESTRUCTURAL',
  'PINTURA_CARTELERIA',
  'PRIMER_SELLADOR',
  'ANILLADO_ENCUADERNACION',
  'TAPA_ENCUADERNACION',
  'IMAN_CERAMICO_FLEXIBLE',
  'FIJACION_AUXILIAR',
  'ACCESORIO_EXHIBIDOR_CARTON',
  'ACCESORIO_MONTAJE_POP',
  'SEMIELABORADO_POP',
  'ARGOLLA_LLAVERO_ACCESORIO',
  'OJAL_OJALILLO_REMACHE',
  'PORTABANNER_ESTRUCTURA',
  'SISTEMA_COLGADO_MONTAJE',
  'PERFIL_BASTIDOR_TEXTIL',
  'CINTA_DOBLE_FAZ_TECNICA',
  'ADHESIVO_LIQUIDO_ESTRUCTURAL',
  'VELCRO_CIERRE_TECNICO',
  'EMBALAJE_PROTECCION',
  'ETIQUETADO_IDENTIFICACION',
  'CONSUMIBLE_INSTALACION'
);

-- CreateEnum
CREATE TYPE "UnidadMateriaPrima" AS ENUM (
  'UNIDAD',
  'PACK',
  'CAJA',
  'KIT',
  'HOJA',
  'PLIEGO',
  'RESMA',
  'ROLLO',
  'METRO_LINEAL',
  'M2',
  'M3',
  'MM',
  'CM',
  'LITRO',
  'ML',
  'KG',
  'GRAMO',
  'PIEZA',
  'PAR'
);

-- CreateEnum
CREATE TYPE "ModoUsoCompatibilidadMateriaPrima" AS ENUM (
  'SUSTRATO_DIRECTO',
  'TINTA',
  'TRANSFERENCIA',
  'LAMINACION',
  'AUXILIAR',
  'MONTAJE',
  'EMBALAJE'
);

-- CreateTable
CREATE TABLE "MateriaPrima" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "familia" "FamiliaMateriaPrima" NOT NULL,
  "subfamilia" "SubfamiliaMateriaPrima" NOT NULL,
  "tipoTecnico" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "unidadStock" "UnidadMateriaPrima" NOT NULL,
  "unidadCompra" "UnidadMateriaPrima" NOT NULL,
  "factorConversionCompra" DECIMAL(14,6) NOT NULL,
  "controlLote" BOOLEAN NOT NULL DEFAULT false,
  "controlVencimiento" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "atributosTecnicosJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MateriaPrimaVariante" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "materiaPrimaId" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "nombreVariante" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "atributosVarianteJson" JSONB NOT NULL,
  "unidadStock" "UnidadMateriaPrima",
  "unidadCompra" "UnidadMateriaPrima",
  "factorConversionCompra" DECIMAL(14,6),
  "precioReferencia" DECIMAL(14,6),
  "moneda" VARCHAR(3),
  "proveedorReferenciaId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MateriaPrimaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MateriaPrimaCompatibilidadMaquina" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "materiaPrimaId" UUID NOT NULL,
  "varianteId" UUID,
  "plantillaMaquinaria" "PlantillaMaquinaria",
  "maquinaId" UUID,
  "perfilOperativoId" UUID,
  "modoUso" "ModoUsoCompatibilidadMateriaPrima" NOT NULL,
  "consumoBase" DECIMAL(14,6),
  "unidadConsumo" "UnidadMateriaPrima",
  "mermaBasePct" DECIMAL(8,4),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MateriaPrimaCompatibilidadMaquina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrima_tenantId_codigo_key" ON "MateriaPrima"("tenantId", "codigo");
CREATE INDEX "MateriaPrima_tenantId_familia_subfamilia_activo_idx" ON "MateriaPrima"("tenantId", "familia", "subfamilia", "activo");
CREATE INDEX "MateriaPrima_tenantId_nombre_idx" ON "MateriaPrima"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrimaVariante_tenantId_sku_key" ON "MateriaPrimaVariante"("tenantId", "sku");
CREATE INDEX "MateriaPrimaVariante_tenantId_materiaPrimaId_activo_idx" ON "MateriaPrimaVariante"("tenantId", "materiaPrimaId", "activo");
CREATE INDEX "MateriaPrimaVariante_tenantId_proveedorReferenciaId_activo_idx" ON "MateriaPrimaVariante"("tenantId", "proveedorReferenciaId", "activo");

-- CreateIndex
CREATE INDEX "MateriaPrimaCompatibilidadMaquina_tenantId_materiaPrimaId_activo_idx" ON "MateriaPrimaCompatibilidadMaquina"("tenantId", "materiaPrimaId", "activo");
CREATE INDEX "MateriaPrimaCompatibilidadMaquina_tenantId_varianteId_activo_idx" ON "MateriaPrimaCompatibilidadMaquina"("tenantId", "varianteId", "activo");
CREATE INDEX "MateriaPrimaCompatibilidadMaquina_tenantId_plantillaMaquinaria_activo_idx" ON "MateriaPrimaCompatibilidadMaquina"("tenantId", "plantillaMaquinaria", "activo");
CREATE INDEX "MateriaPrimaCompatibilidadMaquina_tenantId_maquinaId_perfilOperativoId_activo_idx" ON "MateriaPrimaCompatibilidadMaquina"("tenantId", "maquinaId", "perfilOperativoId", "activo");

-- AddForeignKey
ALTER TABLE "MateriaPrima" ADD CONSTRAINT "MateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_proveedorReferenciaId_fkey" FOREIGN KEY ("proveedorReferenciaId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MateriaPrimaCompatibilidadMaquina" ADD CONSTRAINT "MateriaPrimaCompatibilidadMaquina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" ADD CONSTRAINT "MateriaPrimaCompatibilidadMaquina_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" ADD CONSTRAINT "MateriaPrimaCompatibilidadMaquina_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" ADD CONSTRAINT "MateriaPrimaCompatibilidadMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MateriaPrimaCompatibilidadMaquina" ADD CONSTRAINT "MateriaPrimaCompatibilidadMaquina_perfilOperativoId_fkey" FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
