-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CategoriaComponenteCostoCentro" AS ENUM ('SUELDOS', 'CARGAS', 'MANTENIMIENTO', 'ENERGIA', 'ALQUILER', 'AMORTIZACION', 'TERCERIZACION', 'INSUMOS_INDIRECTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "public"."CategoriaGraficaCentroCosto" AS ENUM ('PREPRENSA', 'IMPRESION', 'TERMINACION', 'EMPAQUE', 'LOGISTICA', 'CALIDAD', 'MANTENIMIENTO', 'ADMINISTRACION', 'COMERCIAL', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "public"."EstadoConfiguracionMaquina" AS ENUM ('BORRADOR', 'INCOMPLETA', 'LISTA');

-- CreateEnum
CREATE TYPE "public"."EstadoMaquina" AS ENUM ('ACTIVA', 'INACTIVA', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "public"."EstadoTarifaCentroCostoPeriodo" AS ENUM ('BORRADOR', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "public"."FamiliaMateriaPrima" AS ENUM ('SUSTRATO', 'TINTA_COLORANTE', 'TRANSFERENCIA_LAMINACION', 'QUIMICO_AUXILIAR', 'ADITIVA_3D', 'ELECTRONICA_CARTELERIA', 'NEON_LUMINARIA', 'METAL_ESTRUCTURA', 'PINTURA_RECUBRIMIENTO', 'TERMINACION_EDITORIAL', 'MAGNETICO_FIJACION', 'POP_EXHIBIDOR', 'HERRAJE_ACCESORIO', 'ADHESIVO_TECNICO', 'PACKING_INSTALACION');

-- CreateEnum
CREATE TYPE "public"."GeometriaTrabajoMaquina" AS ENUM ('PLIEGO', 'ROLLO', 'PLANO', 'CILINDRICO', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "public"."ImputacionPreferidaCentroCosto" AS ENUM ('DIRECTA', 'INDIRECTA', 'REPARTO');

-- CreateEnum
CREATE TYPE "public"."MetodoDepreciacionMaquina" AS ENUM ('LINEAL');

-- CreateEnum
CREATE TYPE "public"."ModoMedidasProducto" AS ENUM ('FIJA', 'LIBRE', 'COMERCIAL_ELIGE', 'MIXTA');

-- CreateEnum
CREATE TYPE "public"."OrigenComponenteCostoCentro" AS ENUM ('MANUAL', 'SUGERIDO');

-- CreateEnum
CREATE TYPE "public"."OrigenMovimientoStockMateriaPrima" AS ENUM ('COMPRA', 'CONSUMO_PRODUCCION', 'AJUSTE_MANUAL', 'TRANSFERENCIA', 'DEVOLUCION', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."PlantillaMaquinaria" AS ENUM ('IMPRESORA_LASER', 'IMPRESORA_GRAN_FORMATO_POR_AREA', 'GUILLOTINA', 'PLOTTER_DE_CORTE', 'PLOTTER_CAD', 'LAMINADORA_BOPP_ROLLO', 'CORTE_LASER', 'ROUTER_CNC', 'ANILLADORA', 'SOLDADORA', 'CABINA_PINTURA', 'MESA_DE_CORTE');

-- CreateEnum
CREATE TYPE "public"."RolSistema" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "public"."SexoEmpleado" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERO_NO_DECIR');

-- CreateEnum
CREATE TYPE "public"."SubfamiliaMateriaPrima" AS ENUM ('SUSTRATO_HOJA', 'SUSTRATO_ROLLO_FLEXIBLE', 'SUSTRATO_RIGIDO', 'OBJETO_PROMOCIONAL_BASE', 'TINTA_IMPRESION', 'TONER', 'FILM_TRANSFERENCIA', 'PAPEL_TRANSFERENCIA', 'LAMINADO_FILM', 'QUIMICO_ACABADO', 'AUXILIAR_PROCESO', 'POLVO_DTF', 'FILAMENTO_3D', 'RESINA_3D', 'MODULO_LED_CARTELERIA', 'FUENTE_ALIMENTACION_LED', 'CABLEADO_CONECTICA', 'CONTROLADOR_LED', 'NEON_FLEX_LED', 'ACCESORIO_NEON_LED', 'CHAPA_METALICA', 'PERFIL_ESTRUCTURAL', 'PINTURA_CARTELERIA', 'PRIMER_SELLADOR', 'ANILLADO_ENCUADERNACION', 'TAPA_ENCUADERNACION', 'IMAN_CERAMICO_FLEXIBLE', 'FIJACION_AUXILIAR', 'ACCESORIO_EXHIBIDOR_CARTON', 'ACCESORIO_MONTAJE_POP', 'SEMIELABORADO_POP', 'ARGOLLA_LLAVERO_ACCESORIO', 'OJAL_OJALILLO_REMACHE', 'PORTABANNER_ESTRUCTURA', 'SISTEMA_COLGADO_MONTAJE', 'PERFIL_BASTIDOR_TEXTIL', 'CINTA_DOBLE_FAZ_TECNICA', 'ADHESIVO_LIQUIDO_ESTRUCTURAL', 'VELCRO_CIERRE_TECNICO', 'EMBALAJE_PROTECCION', 'ETIQUETADO_IDENTIFICACION', 'CONSUMIBLE_INSTALACION', 'LAMINADO_POUCH', 'COMPONENTE_EDITORIAL');

-- CreateEnum
CREATE TYPE "public"."TipoCentroCosto" AS ENUM ('PRODUCTIVO', 'APOYO', 'ADMINISTRATIVO', 'COMERCIAL', 'LOGISTICO', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "public"."TipoComision" AS ENUM ('PORCENTAJE', 'FIJO');

-- CreateEnum
CREATE TYPE "public"."TipoComponenteDesgasteMaquina" AS ENUM ('FUSOR', 'DRUM', 'DRUM_OPC', 'DEVELOPER', 'DEVELOPER_UNIT', 'CHARGE_UNIT', 'DRUM_CLEANING_BLADE', 'CORREA_TRANSFERENCIA', 'TRANSFER_BELT_ITB', 'TRANSFER_ROLLER', 'FUSER_BELT', 'PRESSURE_ROLLER', 'FUSER_CLEANING_WEB', 'WAX_LUBRICANT_BAR', 'FUSER_STRIPPER_FINGER', 'WASTE_TONER_SUBSYSTEM', 'CABEZAL', 'LAMPARA_UV', 'FRESA', 'CUCHILLA', 'FILTRO', 'KIT_MANTENIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoConsumibleMaquina" AS ENUM ('TONER', 'TINTA', 'BARNIZ', 'PRIMER', 'FILM', 'POLVO', 'ADHESIVO', 'RESINA', 'LUBRICANTE', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoDireccion" AS ENUM ('PRINCIPAL', 'FACTURACION', 'ENTREGA');

-- CreateEnum
CREATE TYPE "public"."TipoGastoGeneralCentroCosto" AS ENUM ('LIMPIEZA', 'MANTENIMIENTO', 'SERVICIOS', 'ALQUILER', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoMovimientoStockMateriaPrima" AS ENUM ('INGRESO', 'EGRESO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA');

-- CreateEnum
CREATE TYPE "public"."TipoPerfilOperativoMaquina" AS ENUM ('IMPRESION', 'CORTE', 'LAMINADO', 'MECANIZADO', 'GRABADO', 'FABRICACION', 'MIXTO');

-- CreateEnum
CREATE TYPE "public"."TipoRecursoCentroCosto" AS ENUM ('EMPLEADO', 'MAQUINARIA', 'GASTO_GENERAL', 'ACTIVO_FIJO');

-- CreateEnum
CREATE TYPE "public"."UnidadBaseCentroCosto" AS ENUM ('NINGUNA', 'HORA_MAQUINA', 'HORA_HOMBRE', 'PLIEGO', 'UNIDAD', 'M2', 'KG');

-- CreateEnum
CREATE TYPE "public"."UnidadConsumoMaquina" AS ENUM ('ML', 'LITRO', 'GRAMO', 'KG', 'UNIDAD', 'M2', 'METRO_LINEAL', 'PAGINA', 'A4_EQUIV');

-- CreateEnum
CREATE TYPE "public"."UnidadDesgasteMaquina" AS ENUM ('COPIAS_A4_EQUIV', 'M2', 'METROS_LINEALES', 'HORAS', 'CICLOS', 'PIEZAS');

-- CreateEnum
CREATE TYPE "public"."UnidadMateriaPrima" AS ENUM ('UNIDAD', 'PACK', 'CAJA', 'KIT', 'HOJA', 'PLIEGO', 'RESMA', 'ROLLO', 'METRO_LINEAL', 'M2', 'M3', 'MM', 'CM', 'LITRO', 'ML', 'KG', 'GRAMO', 'PIEZA', 'PAR');

-- CreateEnum
CREATE TYPE "public"."UnidadProduccionMaquina" AS ENUM ('HORA', 'HOJA', 'COPIA', 'PPM', 'A4_EQUIV', 'M2', 'M2_H', 'METRO_LINEAL', 'PIEZAS_H', 'PIEZA', 'CICLO', 'CORTES_MIN', 'GOLPES_MIN', 'PLIEGOS_MIN', 'M_MIN', 'MM_S');

-- CreateTable
CREATE TABLE "public"."AlmacenMateriaPrima" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmacenMateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlmacenMateriaPrimaUbicacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "almacenId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlmacenMateriaPrimaUbicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AreaCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantaId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currentTenantId" UUID NOT NULL,
    "currentMembershipId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CargoDirectoCatalogo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "modoCalculo" TEXT NOT NULL,
    "modosActivacionSoportados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "configJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoDirectoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantaId" UUID NOT NULL,
    "areaCostoId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoCentro" "public"."TipoCentroCosto" NOT NULL,
    "categoriaGrafica" "public"."CategoriaGraficaCentroCosto" NOT NULL,
    "imputacionPreferida" "public"."ImputacionPreferidaCentroCosto" NOT NULL,
    "unidadBaseFutura" "public"."UnidadBaseCentroCosto" NOT NULL DEFAULT 'NINGUNA',
    "responsableEmpleadoId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCostoCapacidadPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "unidadBase" "public"."UnidadBaseCentroCosto" NOT NULL,
    "diasPorMes" DECIMAL(10,2) NOT NULL,
    "horasPorDia" DECIMAL(10,2) NOT NULL,
    "porcentajeNoProductivo" DECIMAL(5,2) NOT NULL,
    "capacidadTeorica" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "overrideManualCapacidad" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoCapacidadPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCostoComponenteCostoPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "categoria" "public"."CategoriaComponenteCostoCentro" NOT NULL,
    "nombre" TEXT NOT NULL,
    "origen" "public"."OrigenComponenteCostoCentro" NOT NULL DEFAULT 'MANUAL',
    "importeMensual" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "detalleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoComponenteCostoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCostoRecurso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoRecurso" "public"."TipoRecursoCentroCosto" NOT NULL,
    "empleadoId" UUID,
    "maquinaId" UUID,
    "nombreRecurso" TEXT,
    "tipoGastoGeneral" "public"."TipoGastoGeneralCentroCosto",
    "valorMensual" DECIMAL(14,2),
    "vidaUtilRestanteMeses" INTEGER,
    "valorActual" DECIMAL(14,2),
    "valorFinalVida" DECIMAL(14,2),
    "depreciacionMensualCalc" DECIMAL(14,2),
    "descripcion" TEXT,
    "porcentajeAsignacion" DECIMAL(5,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoRecurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCostoRecursoMaquinaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoRecursoId" UUID NOT NULL,
    "maquinaId" UUID,
    "periodo" TEXT NOT NULL,
    "metodoDepreciacion" "public"."MetodoDepreciacionMaquina" NOT NULL DEFAULT 'LINEAL',
    "valorCompra" DECIMAL(14,2) NOT NULL,
    "valorResidual" DECIMAL(14,2) NOT NULL,
    "vidaUtilMeses" INTEGER NOT NULL,
    "potenciaNominalKw" DECIMAL(10,4) NOT NULL,
    "factorCargaPct" DECIMAL(5,2) NOT NULL,
    "tarifaEnergiaKwh" DECIMAL(12,4) NOT NULL,
    "horasProgramadasMes" DECIMAL(10,2) NOT NULL,
    "disponibilidadPct" DECIMAL(5,2) NOT NULL,
    "eficienciaPct" DECIMAL(5,2) NOT NULL,
    "mantenimientoMensual" DECIMAL(14,2) NOT NULL,
    "segurosMensual" DECIMAL(14,2) NOT NULL,
    "otrosFijosMensual" DECIMAL(14,2) NOT NULL,
    "amortizacionMensualCalc" DECIMAL(14,2) NOT NULL,
    "energiaMensualCalc" DECIMAL(14,2) NOT NULL,
    "costoMensualTotalCalc" DECIMAL(14,2) NOT NULL,
    "tarifaHoraCalc" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CentroCostoTarifaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "costoMensualTotal" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "tarifaCalculada" DECIMAL(12,2) NOT NULL,
    "estado" "public"."EstadoTarifaCentroCostoPeriodo" NOT NULL,
    "resumenJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoTarifaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClienteContacto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefonoCodigo" TEXT,
    "telefonoNumero" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClienteDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "public"."TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cotizacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numero" TEXT,
    "clienteId" UUID,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaEmision" TIMESTAMP(3),
    "fechaValidez" TIMESTAMP(3),
    "observaciones" TEXT,
    "cargosDirectosCotizacionJson" JSONB,
    "subtotal" DECIMAL(14,2),
    "total" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CotizacionItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cotizacionId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "rutaAlternativaId" UUID,
    "cantidad" DECIMAL(14,2) NOT NULL,
    "jobContextJson" JSONB NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "costoUnitario" DECIMAL(14,2),
    "costoTotal" DECIMAL(14,2),
    "precioUnitario" DECIMAL(14,2),
    "precioTotal" DECIMAL(14,2),
    "trazabilidadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "comisionesSnapshotJson" JSONB,
    "impuestosSnapshotJson" JSONB,
    "precioConfigSnapshotJson" JSONB,
    "precioEspecialClienteSnapshotJson" JSONB,

    CONSTRAINT "CotizacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Empleado" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "nombreCompleto" TEXT NOT NULL,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ocupacion" TEXT,
    "sexo" "public"."SexoEmpleado",
    "fechaIngreso" DATE NOT NULL,
    "fechaNacimiento" DATE,
    "comisionesHabilitadas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpleadoComision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "public"."TipoComision" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoComision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmpleadoDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "public"."TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Estacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "empleadoId" UUID,
    "invitedByMembershipId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "public"."RolSistema" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Maquina" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "plantilla" "public"."PlantillaMaquinaria" NOT NULL,
    "plantillaVersion" INTEGER NOT NULL DEFAULT 1,
    "fabricante" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "plantaId" UUID NOT NULL,
    "centroCostoPrincipalId" UUID,
    "estado" "public"."EstadoMaquina" NOT NULL DEFAULT 'ACTIVA',
    "estadoConfiguracion" "public"."EstadoConfiguracionMaquina" NOT NULL DEFAULT 'BORRADOR',
    "geometriaTrabajo" "public"."GeometriaTrabajoMaquina" NOT NULL,
    "unidadProduccionPrincipal" "public"."UnidadProduccionMaquina" NOT NULL,
    "anchoUtil" DECIMAL(12,2),
    "largoUtil" DECIMAL(12,2),
    "altoUtil" DECIMAL(12,2),
    "espesorMaximo" DECIMAL(12,2),
    "pesoMaximo" DECIMAL(12,2),
    "gramajeMaxGr" DECIMAL(12,2),
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
CREATE TABLE "public"."MaquinaComponenteDesgaste" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "materiaPrimaVarianteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "public"."TipoComponenteDesgasteMaquina" NOT NULL,
    "vidaUtilEstimada" DECIMAL(12,2),
    "unidadDesgaste" "public"."UnidadDesgasteMaquina" NOT NULL,
    "modoProrrateo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "detalleJson" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaComponenteDesgaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaquinaConsumible" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "perfilOperativoId" UUID,
    "materiaPrimaVarianteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "public"."TipoConsumibleMaquina" NOT NULL,
    "unidad" "public"."UnidadConsumoMaquina" NOT NULL,
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
CREATE TABLE "public"."MaquinaPerfilOperativo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoPerfil" "public"."TipoPerfilOperativoMaquina" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "productivityValue" DECIMAL(12,2),
    "productivityUnit" "public"."UnidadProduccionMaquina",
    "setupMin" DECIMAL(12,2),
    "cleanupMin" DECIMAL(12,2),
    "feedReloadMin" DECIMAL(12,2),
    "detalleJson" JSONB,
    "reglaSeleccionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaPerfilOperativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MateriaPrima" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "familia" "public"."FamiliaMateriaPrima" NOT NULL,
    "subfamilia" "public"."SubfamiliaMateriaPrima" NOT NULL,
    "tipoTecnico" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "unidadStock" "public"."UnidadMateriaPrima" NOT NULL,
    "unidadCompra" "public"."UnidadMateriaPrima" NOT NULL,
    "esConsumible" BOOLEAN NOT NULL DEFAULT false,
    "esRepuesto" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "atributosTecnicosJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "materialPresetId" UUID,
    "canonicalMaterialKey" TEXT,
    "canonicalMaterialName" TEXT,
    "canonicalAliasUsado" TEXT,

    CONSTRAINT "MateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MateriaPrimaVariante" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "materiaPrimaId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "nombreVariante" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "atributosVarianteJson" JSONB NOT NULL,
    "unidadStock" "public"."UnidadMateriaPrima",
    "unidadCompra" "public"."UnidadMateriaPrima",
    "precioReferencia" DECIMAL(14,6),
    "moneda" VARCHAR(3),
    "proveedorReferenciaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "materialPresetVarianteId" UUID,

    CONSTRAINT "MateriaPrimaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialPreset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "nombreCanonico" TEXT NOT NULL,
    "descripcionCorta" TEXT NOT NULL,
    "familia" "public"."FamiliaMateriaPrima" NOT NULL,
    "subfamilia" "public"."SubfamiliaMateriaPrima" NOT NULL,
    "tipoTecnico" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "iconKind" TEXT NOT NULL,
    "aliasDisponiblesJson" JSONB NOT NULL,
    "usosRecomendadosJson" JSONB NOT NULL,
    "procesosCompatiblesJson" JSONB NOT NULL,
    "advertenciasJson" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaterialPresetVariante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "presetId" UUID NOT NULL,
    "skuSugerido" TEXT NOT NULL,
    "nombreVarianteSugerido" TEXT,
    "formato" TEXT NOT NULL,
    "espesor" DECIMAL(10,3),
    "color" TEXT NOT NULL,
    "recomendada" BOOLEAN NOT NULL DEFAULT false,
    "atributosVarianteJson" JSONB NOT NULL,
    "unidadStock" "public"."UnidadMateriaPrima",
    "unidadCompra" "public"."UnidadMateriaPrima",
    "precioReferencia" DECIMAL(14,6),
    "moneda" VARCHAR(3),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPresetVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rol" "public"."RolSistema" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MovimientoStockMateriaPrima" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "tipo" "public"."TipoMovimientoStockMateriaPrima" NOT NULL,
    "origen" "public"."OrigenMovimientoStockMateriaPrima" NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "costoUnitario" DECIMAL(14,6),
    "saldoPosterior" DECIMAL(14,4) NOT NULL,
    "costoPromedioPost" DECIMAL(14,6) NOT NULL,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "transferenciaId" UUID,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoStockMateriaPrima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Planta" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Producto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadComercial" TEXT NOT NULL DEFAULT 'unidad',
    "modoMedidas" "public"."ModoMedidasProducto" NOT NULL DEFAULT 'FIJA',
    "medidaDefaultAnchoMm" DECIMAL(12,2),
    "medidaDefaultAltoMm" DECIMAL(12,2),
    "precioConfigJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subcategoriaComercialId" UUID NOT NULL,
    "atributosComercialesJson" JSONB,
    "medidasPredefinidasJson" JSONB,
    "minimoComercialPolitica" TEXT NOT NULL DEFAULT 'NONE',
    "minimoComercialCantidad" DECIMAL(12,4),
    "minimoComercialBase" TEXT NOT NULL DEFAULT 'cantidad_comercial',

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoCargoDirectoCotizacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "cargoDirectoCatalogoId" UUID NOT NULL,
    "modoActivacion" TEXT NOT NULL,
    "condicionActivacionJson" JSONB,
    "configOverrideJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoCargoDirectoCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoCargoDirectoPaso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "cargoDirectoCatalogoId" UUID NOT NULL,
    "modoActivacion" TEXT NOT NULL,
    "condicionActivacionJson" JSONB,
    "configOverrideJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoCargoDirectoPaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoCategoriaComercial" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoCategoriaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoComisionAplicada" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "comisionCatalogoId" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoComisionAplicada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoComisionCatalogo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "detalleJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoComisionCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoConfigPaso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoRutaAlternativaId" UUID NOT NULL,
    "rutaPasoId" UUID NOT NULL,
    "modoActivacion" TEXT,
    "condicionActivacionJson" JSONB,
    "modoTiempo" TEXT,
    "mecanismoCantidad" TEXT,
    "mecanismoCantidadConfigJson" JSONB,
    "multiplicadoresActivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paramsPasoJson" JSONB,
    "maquinaM1Id" UUID,
    "perfilM1Id" UUID,
    "setupOverrideMin" DECIMAL(12,2),
    "cleanupOverrideMin" DECIMAL(12,2),
    "tiempoFijoOverrideMin" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "centroCostoId" UUID,
    "nombreVisible" TEXT,

    CONSTRAINT "ProductoConfigPaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoConfigPasoMaquinaCandidata" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "esPreferida" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perfilDefaultId" UUID,
    "modoColorAllowedModes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ProductoConfigPasoMaquinaCandidata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoConfigPasoSlotMaterial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "slotCodigo" TEXT NOT NULL,
    "modoSeleccion" TEXT NOT NULL,
    "criterioMotorAuto" TEXT,
    "criterioInputCampo" TEXT,
    "criterioMaterialCampo" TEXT,
    "materialVarianteId" UUID,
    "estrategiaCosto" TEXT NOT NULL DEFAULT 'simple',
    "formula" TEXT NOT NULL DEFAULT 'por_unidad_productiva',
    "aplicaMultiCaras" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slotNombre" TEXT,
    "slotRol" TEXT,
    "cantidadFactor" DECIMAL(12,4) DEFAULT 1,
    "cantidadBase" TEXT,

    CONSTRAINT "ProductoConfigPasoSlotMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoConfigPasoSlotMaterialCandidato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "slotMaterialId" UUID NOT NULL,
    "materiaPrimaId" UUID NOT NULL,
    "defaultVarianteId" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoConfigPasoSlotMaterialCandidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoConfigPasoSlotMaterialCandidatoVariante" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "candidatoId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoConfigPasoSlotMaterialCandidatoVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoImpuestoAplicado" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "impuestoCatalogoId" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoImpuestoAplicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoImpuestoCatalogo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "detalleJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoImpuestoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoPasoExtra" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "insertarDespuesDeRutaPasoId" UUID,
    "ordenInterno" INTEGER NOT NULL DEFAULT 0,
    "familiaCodigo" TEXT NOT NULL,
    "modoActivacion" TEXT,
    "condicionActivacionJson" JSONB,
    "modoTiempo" TEXT,
    "mecanismoCantidad" TEXT,
    "mecanismoCantidadConfigJson" JSONB,
    "multiplicadoresActivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paramsPasoJson" JSONB,
    "maquinaM1Id" UUID,
    "perfilM1Id" UUID,
    "configSlotsMaterialesJson" JSONB,
    "configMaquinasCandidatasJson" JSONB,
    "configCargosDirectosJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoPasoExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoPrecioEspecialClienteV2" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "configJson" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoPrecioEspecialClienteV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoRutaAlternativa" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoId" UUID NOT NULL,
    "rutaId" UUID NOT NULL,
    "rutaVersion" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPreferida" BOOLEAN NOT NULL DEFAULT false,
    "reglaAutoSeleccionJson" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoRutaAlternativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductoSubcategoriaComercial" (
    "id" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "atributosSchemaJson" JSONB NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoSubcategoriaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Proveedor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProveedorContacto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefonoCodigo" TEXT,
    "telefonoNumero" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProveedorDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "public"."TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ruta" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "versionActual" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RutaPaso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rutaId" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "familiaCodigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "arquetipoCodigo" TEXT,
    "nombreVisible" TEXT,
    "descripcionVisible" TEXT,
    "icono" TEXT NOT NULL DEFAULT 'Layout',

    CONSTRAINT "RutaPaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RutaVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rutaId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "cambios" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RutaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMateriaPrimaVariante" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "cantidadDisponible" DECIMAL(14,4) NOT NULL,
    "costoPromedio" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMateriaPrimaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nombreCompleto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrima_tenantId_activo_idx" ON "public"."AlmacenMateriaPrima"("tenantId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrima_tenantId_codigo_key" ON "public"."AlmacenMateriaPrima"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_activo_idx" ON "public"."AlmacenMateriaPrimaUbicacion"("tenantId" ASC, "almacenId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_codigo_key" ON "public"."AlmacenMateriaPrimaUbicacion"("tenantId" ASC, "almacenId" ASC, "codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AreaCosto_tenantId_plantaId_codigo_key" ON "public"."AreaCosto"("tenantId" ASC, "plantaId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "AreaCosto_tenantId_plantaId_nombre_idx" ON "public"."AreaCosto"("tenantId" ASC, "plantaId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "AuthSession_currentTenantId_idx" ON "public"."AuthSession"("currentTenantId" ASC);

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "public"."AuthSession"("userId" ASC);

-- CreateIndex
CREATE INDEX "CargoDirectoCatalogo_tenantId_activo_idx" ON "public"."CargoDirectoCatalogo"("tenantId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CargoDirectoCatalogo_tenantId_codigo_key" ON "public"."CargoDirectoCatalogo"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCosto_tenantId_codigo_key" ON "public"."CentroCosto"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_nombre_idx" ON "public"."CentroCosto"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_plantaId_areaCostoId_idx" ON "public"."CentroCosto"("tenantId" ASC, "plantaId" ASC, "areaCostoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoCapacidadPeriodo_tenantId_centroCostoId_periodo_key" ON "public"."CentroCostoCapacidadPeriodo"("tenantId" ASC, "centroCostoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoComponenteCostoPeriodo_tenantId_centroCostoId_pe_idx" ON "public"."CentroCostoComponenteCostoPeriodo"("tenantId" ASC, "centroCostoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_centroCostoId_periodo_idx" ON "public"."CentroCostoRecurso"("tenantId" ASC, "centroCostoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_empleadoId_periodo_idx" ON "public"."CentroCostoRecurso"("tenantId" ASC, "empleadoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_maquinaId_periodo_idx" ON "public"."CentroCostoRecurso"("tenantId" ASC, "maquinaId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_tipoRecurso_periodo_idx" ON "public"."CentroCostoRecurso"("tenantId" ASC, "tipoRecurso" ASC, "periodo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_centroCostoRecurs_key" ON "public"."CentroCostoRecursoMaquinaPeriodo"("tenantId" ASC, "centroCostoRecursoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_maquinaId_periodo_idx" ON "public"."CentroCostoRecursoMaquinaPeriodo"("tenantId" ASC, "maquinaId" ASC, "periodo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_est_key" ON "public"."CentroCostoTarifaPeriodo"("tenantId" ASC, "centroCostoId" ASC, "periodo" ASC, "estado" ASC);

-- CreateIndex
CREATE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_idx" ON "public"."CentroCostoTarifaPeriodo"("tenantId" ASC, "centroCostoId" ASC, "periodo" ASC);

-- CreateIndex
CREATE INDEX "Cliente_tenantId_nombre_idx" ON "public"."Cliente"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_nombre_key" ON "public"."Cliente"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "ClienteContacto_tenantId_clienteId_idx" ON "public"."ClienteContacto"("tenantId" ASC, "clienteId" ASC);

-- CreateIndex
CREATE INDEX "ClienteDireccion_tenantId_clienteId_idx" ON "public"."ClienteDireccion"("tenantId" ASC, "clienteId" ASC);

-- CreateIndex
CREATE INDEX "Cotizacion_tenantId_clienteId_idx" ON "public"."Cotizacion"("tenantId" ASC, "clienteId" ASC);

-- CreateIndex
CREATE INDEX "Cotizacion_tenantId_createdAt_idx" ON "public"."Cotizacion"("tenantId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Cotizacion_tenantId_estado_idx" ON "public"."Cotizacion"("tenantId" ASC, "estado" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_tenantId_numero_key" ON "public"."Cotizacion"("tenantId" ASC, "numero" ASC);

-- CreateIndex
CREATE INDEX "CotizacionItem_tenantId_cotizacionId_idx" ON "public"."CotizacionItem"("tenantId" ASC, "cotizacionId" ASC);

-- CreateIndex
CREATE INDEX "CotizacionItem_tenantId_productoId_idx" ON "public"."CotizacionItem"("tenantId" ASC, "productoId" ASC);

-- CreateIndex
CREATE INDEX "Empleado_tenantId_nombreCompleto_idx" ON "public"."Empleado"("tenantId" ASC, "nombreCompleto" ASC);

-- CreateIndex
CREATE INDEX "Empleado_tenantId_sector_idx" ON "public"."Empleado"("tenantId" ASC, "sector" ASC);

-- CreateIndex
CREATE INDEX "EmpleadoComision_tenantId_empleadoId_idx" ON "public"."EmpleadoComision"("tenantId" ASC, "empleadoId" ASC);

-- CreateIndex
CREATE INDEX "EmpleadoDireccion_tenantId_empleadoId_idx" ON "public"."EmpleadoDireccion"("tenantId" ASC, "empleadoId" ASC);

-- CreateIndex
CREATE INDEX "Estacion_tenantId_activo_idx" ON "public"."Estacion"("tenantId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Estacion_tenantId_nombre_key" ON "public"."Estacion"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "Invitation_empleadoId_idx" ON "public"."Invitation"("empleadoId" ASC);

-- CreateIndex
CREATE INDEX "Invitation_tenantId_email_idx" ON "public"."Invitation"("tenantId" ASC, "email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "public"."Invitation"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "Maquina_tenantId_centroCostoPrincipalId_idx" ON "public"."Maquina"("tenantId" ASC, "centroCostoPrincipalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Maquina_tenantId_codigo_key" ON "public"."Maquina"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "Maquina_tenantId_estado_idx" ON "public"."Maquina"("tenantId" ASC, "estado" ASC);

-- CreateIndex
CREATE INDEX "Maquina_tenantId_plantaId_activo_idx" ON "public"."Maquina"("tenantId" ASC, "plantaId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "Maquina_tenantId_plantilla_activo_idx" ON "public"."Maquina"("tenantId" ASC, "plantilla" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MaquinaComponenteDesgaste_tenantId_maquinaId_activo_idx" ON "public"."MaquinaComponenteDesgaste"("tenantId" ASC, "maquinaId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MaquinaComponenteDesgaste_tenantId_materiaPrimaVarianteId_a_idx" ON "public"."MaquinaComponenteDesgaste"("tenantId" ASC, "materiaPrimaVarianteId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MaquinaConsumible_tenantId_maquinaId_activo_idx" ON "public"."MaquinaConsumible"("tenantId" ASC, "maquinaId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MaquinaConsumible_tenantId_materiaPrimaVarianteId_activo_idx" ON "public"."MaquinaConsumible"("tenantId" ASC, "materiaPrimaVarianteId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MaquinaConsumible_tenantId_perfilOperativoId_idx" ON "public"."MaquinaConsumible"("tenantId" ASC, "perfilOperativoId" ASC);

-- CreateIndex
CREATE INDEX "MaquinaPerfilOperativo_tenantId_maquinaId_activo_idx" ON "public"."MaquinaPerfilOperativo"("tenantId" ASC, "maquinaId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MaquinaPerfilOperativo_tenantId_maquinaId_nombre_key" ON "public"."MaquinaPerfilOperativo"("tenantId" ASC, "maquinaId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrima_materialPresetId_idx" ON "public"."MateriaPrima"("materialPresetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrima_tenantId_codigo_key" ON "public"."MateriaPrima"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrima_tenantId_familia_subfamilia_activo_idx" ON "public"."MateriaPrima"("tenantId" ASC, "familia" ASC, "subfamilia" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrima_tenantId_nombre_idx" ON "public"."MateriaPrima"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrima_tenant_canonicalKey_idx" ON "public"."MateriaPrima"("tenantId" ASC, "canonicalMaterialKey" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrimaVariante_presetVar_idx" ON "public"."MateriaPrimaVariante"("materialPresetVarianteId" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrimaVariante_tenantId_materiaPrimaId_activo_idx" ON "public"."MateriaPrimaVariante"("tenantId" ASC, "materiaPrimaId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "MateriaPrimaVariante_tenantId_proveedorReferenciaId_activo_idx" ON "public"."MateriaPrimaVariante"("tenantId" ASC, "proveedorReferenciaId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrimaVariante_tenantId_sku_key" ON "public"."MateriaPrimaVariante"("tenantId" ASC, "sku" ASC);

-- CreateIndex
CREATE INDEX "MaterialPreset_activo_orden_idx" ON "public"."MaterialPreset"("activo" ASC, "orden" ASC);

-- CreateIndex
CREATE INDEX "MaterialPreset_fam_sub_act_idx" ON "public"."MaterialPreset"("familia" ASC, "subfamilia" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPreset_key_key" ON "public"."MaterialPreset"("key" ASC);

-- CreateIndex
CREATE INDEX "MaterialPresetVariante_preset_act_ord_idx" ON "public"."MaterialPresetVariante"("presetId" ASC, "activo" ASC, "orden" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPresetVariante_preset_sku_key" ON "public"."MaterialPresetVariante"("presetId" ASC, "skuSugerido" ASC);

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "public"."Membership"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "public"."Membership"("userId" ASC, "tenantId" ASC);

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_referenciaTipo_referen_idx" ON "public"."MovimientoStockMateriaPrima"("tenantId" ASC, "referenciaTipo" ASC, "referenciaId" ASC);

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_tipo_createdAt_idx" ON "public"."MovimientoStockMateriaPrima"("tenantId" ASC, "tipo" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_transferenciaId_idx" ON "public"."MovimientoStockMateriaPrima"("tenantId" ASC, "transferenciaId" ASC);

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_ubicacionId_createdAt_idx" ON "public"."MovimientoStockMateriaPrima"("tenantId" ASC, "ubicacionId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_varianteId_createdAt_idx" ON "public"."MovimientoStockMateriaPrima"("tenantId" ASC, "varianteId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Planta_tenantId_codigo_key" ON "public"."Planta"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "Planta_tenantId_nombre_idx" ON "public"."Planta"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "Producto_subcategoriaComercialId_idx" ON "public"."Producto"("subcategoriaComercialId" ASC);

-- CreateIndex
CREATE INDEX "Producto_tenantId_activo_idx" ON "public"."Producto"("tenantId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_tenantId_codigo_key" ON "public"."Producto"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "ProductoCargoDirectoCotizacion_tenantId_productoId_idx" ON "public"."ProductoCargoDirectoCotizacion"("tenantId" ASC, "productoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoCargoDirectoPaso_tenantId_productoConfigPasoId_idx" ON "public"."ProductoCargoDirectoPaso"("tenantId" ASC, "productoConfigPasoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoCategoriaComercial_activo_orden_idx" ON "public"."ProductoCategoriaComercial"("activo" ASC, "orden" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoCategoriaComercial_codigo_key" ON "public"."ProductoCategoriaComercial"("codigo" ASC);

-- CreateIndex
CREATE INDEX "ProductoComisionAplicada_tenantId_comisionCatalogoId_idx" ON "public"."ProductoComisionAplicada"("tenantId" ASC, "comisionCatalogoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoComisionAplicada_tenantId_productoId_comisionCatalo_key" ON "public"."ProductoComisionAplicada"("tenantId" ASC, "productoId" ASC, "comisionCatalogoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoComisionAplicada_tenantId_productoId_idx" ON "public"."ProductoComisionAplicada"("tenantId" ASC, "productoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoComisionCatalogo_tenantId_codigo_key" ON "public"."ProductoComisionCatalogo"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "ProductoComisionCatalogo_tenantId_nombre_activo_idx" ON "public"."ProductoComisionCatalogo"("tenantId" ASC, "nombre" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_centroCostoId_idx" ON "public"."ProductoConfigPaso"("tenantId" ASC, "centroCostoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_maquinaM1Id_idx" ON "public"."ProductoConfigPaso"("tenantId" ASC, "maquinaM1Id" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_perfilM1Id_idx" ON "public"."ProductoConfigPaso"("tenantId" ASC, "perfilM1Id" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_productoRutaAlternativaId_idx" ON "public"."ProductoConfigPaso"("tenantId" ASC, "productoRutaAlternativaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPaso_tenantId_productoRutaAlternativaId_rutaP_key" ON "public"."ProductoConfigPaso"("tenantId" ASC, "productoRutaAlternativaId" ASC, "rutaPasoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_perfilDefaul_idx" ON "public"."ProductoConfigPasoMaquinaCandidata"("tenantId" ASC, "perfilDefaultId" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_productoConfigP_idx" ON "public"."ProductoConfigPasoMaquinaCandidata"("tenantId" ASC, "productoConfigPasoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_productoConfigP_key" ON "public"."ProductoConfigPasoMaquinaCandidata"("tenantId" ASC, "productoConfigPasoId" ASC, "maquinaId" ASC);

-- CreateIndex
CREATE INDEX "ProductoConfigPasoSlotMaterial_tenantId_productoConfigPasoI_idx" ON "public"."ProductoConfigPasoSlotMaterial"("tenantId" ASC, "productoConfigPasoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPasoSlotMaterial_tenantId_productoConfigPasoI_key" ON "public"."ProductoConfigPasoSlotMaterial"("tenantId" ASC, "productoConfigPasoId" ASC, "slotCodigo" ASC);

-- CreateIndex
CREATE INDEX "SlotMaterialCand_tenant_materia_idx" ON "public"."ProductoConfigPasoSlotMaterialCandidato"("tenantId" ASC, "materiaPrimaId" ASC);

-- CreateIndex
CREATE INDEX "SlotMaterialCand_tenant_slot_idx" ON "public"."ProductoConfigPasoSlotMaterialCandidato"("tenantId" ASC, "slotMaterialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SlotMaterialCand_tenant_slot_materia_key" ON "public"."ProductoConfigPasoSlotMaterialCandidato"("tenantId" ASC, "slotMaterialId" ASC, "materiaPrimaId" ASC);

-- CreateIndex
CREATE INDEX "SlotMaterialCandVar_tenant_candidate_idx" ON "public"."ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId" ASC, "candidatoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SlotMaterialCandVar_tenant_candidate_variant_key" ON "public"."ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId" ASC, "candidatoId" ASC, "varianteId" ASC);

-- CreateIndex
CREATE INDEX "SlotMaterialCandVar_tenant_variant_idx" ON "public"."ProductoConfigPasoSlotMaterialCandidatoVariante"("tenantId" ASC, "varianteId" ASC);

-- CreateIndex
CREATE INDEX "ProductoImpuestoAplicado_tenantId_impuestoCatalogoId_idx" ON "public"."ProductoImpuestoAplicado"("tenantId" ASC, "impuestoCatalogoId" ASC);

-- CreateIndex
CREATE INDEX "ProductoImpuestoAplicado_tenantId_productoId_idx" ON "public"."ProductoImpuestoAplicado"("tenantId" ASC, "productoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoImpuestoAplicado_tenantId_productoId_impuestoCatalo_key" ON "public"."ProductoImpuestoAplicado"("tenantId" ASC, "productoId" ASC, "impuestoCatalogoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoImpuestoCatalogo_tenantId_codigo_key" ON "public"."ProductoImpuestoCatalogo"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "ProductoImpuestoCatalogo_tenantId_nombre_activo_idx" ON "public"."ProductoImpuestoCatalogo"("tenantId" ASC, "nombre" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "ProductoPasoExtra_tenantId_productoId_activo_idx" ON "public"."ProductoPasoExtra"("tenantId" ASC, "productoId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "ProductoPrecioEspecialClienteV2_tenantId_clienteId_idx" ON "public"."ProductoPrecioEspecialClienteV2"("tenantId" ASC, "clienteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPrecioEspecialClienteV2_tenantId_productoId_cliente_key" ON "public"."ProductoPrecioEspecialClienteV2"("tenantId" ASC, "productoId" ASC, "clienteId" ASC);

-- CreateIndex
CREATE INDEX "ProductoRutaAlternativa_rutaId_idx" ON "public"."ProductoRutaAlternativa"("rutaId" ASC);

-- CreateIndex
CREATE INDEX "ProductoRutaAlternativa_tenantId_productoId_activo_idx" ON "public"."ProductoRutaAlternativa"("tenantId" ASC, "productoId" ASC, "activo" ASC);

-- CreateIndex
CREATE INDEX "ProductoRutaAlternativa_tenantId_productoId_rutaId_idx" ON "public"."ProductoRutaAlternativa"("tenantId" ASC, "productoId" ASC, "rutaId" ASC);

-- CreateIndex
CREATE INDEX "ProductoSubcategoriaComercial_categoriaId_activo_orden_idx" ON "public"."ProductoSubcategoriaComercial"("categoriaId" ASC, "activo" ASC, "orden" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoSubcategoriaComercial_categoriaId_codigo_key" ON "public"."ProductoSubcategoriaComercial"("categoriaId" ASC, "codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductoSubcategoriaComercial_codigo_key" ON "public"."ProductoSubcategoriaComercial"("codigo" ASC);

-- CreateIndex
CREATE INDEX "Proveedor_tenantId_nombre_idx" ON "public"."Proveedor"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_tenantId_nombre_key" ON "public"."Proveedor"("tenantId" ASC, "nombre" ASC);

-- CreateIndex
CREATE INDEX "ProveedorContacto_tenantId_proveedorId_idx" ON "public"."ProveedorContacto"("tenantId" ASC, "proveedorId" ASC);

-- CreateIndex
CREATE INDEX "ProveedorDireccion_tenantId_proveedorId_idx" ON "public"."ProveedorDireccion"("tenantId" ASC, "proveedorId" ASC);

-- CreateIndex
CREATE INDEX "Ruta_tenantId_activo_idx" ON "public"."Ruta"("tenantId" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Ruta_tenantId_codigo_key" ON "public"."Ruta"("tenantId" ASC, "codigo" ASC);

-- CreateIndex
CREATE INDEX "RutaPaso_tenantId_rutaId_version_activo_idx" ON "public"."RutaPaso"("tenantId" ASC, "rutaId" ASC, "version" ASC, "activo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RutaPaso_tenantId_rutaId_version_orden_key" ON "public"."RutaPaso"("tenantId" ASC, "rutaId" ASC, "version" ASC, "orden" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RutaVersion_tenantId_rutaId_version_key" ON "public"."RutaVersion"("tenantId" ASC, "rutaId" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_ubicacionId_idx" ON "public"."StockMateriaPrimaVariante"("tenantId" ASC, "ubicacionId" ASC);

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_idx" ON "public"."StockMateriaPrimaVariante"("tenantId" ASC, "varianteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_ubicacionId_key" ON "public"."StockMateriaPrimaVariante"("tenantId" ASC, "varianteId" ASC, "ubicacionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."AlmacenMateriaPrima" ADD CONSTRAINT "AlmacenMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "public"."AlmacenMateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AreaCosto" ADD CONSTRAINT "AreaCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "public"."Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AreaCosto" ADD CONSTRAINT "AreaCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_currentMembershipId_fkey" FOREIGN KEY ("currentMembershipId") REFERENCES "public"."Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CargoDirectoCatalogo" ADD CONSTRAINT "CargoDirectoCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCosto" ADD CONSTRAINT "CentroCosto_areaCostoId_fkey" FOREIGN KEY ("areaCostoId") REFERENCES "public"."AreaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCosto" ADD CONSTRAINT "CentroCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "public"."Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCosto" ADD CONSTRAINT "CentroCosto_responsableEmpleadoId_fkey" FOREIGN KEY ("responsableEmpleadoId") REFERENCES "public"."Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCosto" ADD CONSTRAINT "CentroCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "public"."Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_centroCostoRecursoId_fkey" FOREIGN KEY ("centroCostoRecursoId") REFERENCES "public"."CentroCostoRecurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClienteContacto" ADD CONSTRAINT "ClienteContacto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClienteContacto" ADD CONSTRAINT "ClienteContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CotizacionItem" ADD CONSTRAINT "CotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "public"."Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CotizacionItem" ADD CONSTRAINT "CotizacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CotizacionItem" ADD CONSTRAINT "CotizacionItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Empleado" ADD CONSTRAINT "Empleado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Empleado" ADD CONSTRAINT "Empleado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "public"."Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "public"."Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Estacion" ADD CONSTRAINT "Estacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "public"."Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "public"."Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Maquina" ADD CONSTRAINT "Maquina_centroCostoPrincipalId_fkey" FOREIGN KEY ("centroCostoPrincipalId") REFERENCES "public"."CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Maquina" ADD CONSTRAINT "Maquina_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "public"."Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Maquina" ADD CONSTRAINT "Maquina_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_materiaPrimaVarianteId_fkey" FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_materiaPrimaVarianteId_fkey" FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_perfilOperativoId_fkey" FOREIGN KEY ("perfilOperativoId") REFERENCES "public"."MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaPerfilOperativo" ADD CONSTRAINT "MaquinaPerfilOperativo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaquinaPerfilOperativo" ADD CONSTRAINT "MaquinaPerfilOperativo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrima" ADD CONSTRAINT "MateriaPrima_materialPresetId_fkey" FOREIGN KEY ("materialPresetId") REFERENCES "public"."MaterialPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrima" ADD CONSTRAINT "MateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "public"."MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_presetVar_fkey" FOREIGN KEY ("materialPresetVarianteId") REFERENCES "public"."MaterialPresetVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_proveedorReferenciaId_fkey" FOREIGN KEY ("proveedorReferenciaId") REFERENCES "public"."Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaterialPresetVariante" ADD CONSTRAINT "MaterialPresetVariante_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "public"."MaterialPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "public"."AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Planta" ADD CONSTRAINT "Planta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_subcategoriaComercialId_fkey" FOREIGN KEY ("subcategoriaComercialId") REFERENCES "public"."ProductoSubcategoriaComercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_cargoDirectoCatalogoId_fkey" FOREIGN KEY ("cargoDirectoCatalogoId") REFERENCES "public"."CargoDirectoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_cargoDirectoCatalogoId_fkey" FOREIGN KEY ("cargoDirectoCatalogoId") REFERENCES "public"."CargoDirectoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "public"."ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoComisionAplicada" ADD CONSTRAINT "ProductoComisionAplicada_comisionCatalogoId_fkey" FOREIGN KEY ("comisionCatalogoId") REFERENCES "public"."ProductoComisionCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoComisionAplicada" ADD CONSTRAINT "ProductoComisionAplicada_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoComisionAplicada" ADD CONSTRAINT "ProductoComisionAplicada_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoComisionCatalogo" ADD CONSTRAINT "ProductoComisionCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "public"."CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_maquinaM1Id_fkey" FOREIGN KEY ("maquinaM1Id") REFERENCES "public"."Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_perfilM1Id_fkey" FOREIGN KEY ("perfilM1Id") REFERENCES "public"."MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_productoRutaAlternativaId_fkey" FOREIGN KEY ("productoRutaAlternativaId") REFERENCES "public"."ProductoRutaAlternativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_rutaPasoId_fkey" FOREIGN KEY ("rutaPasoId") REFERENCES "public"."RutaPaso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "public"."Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_perfilDefaultId_fkey" FOREIGN KEY ("perfilDefaultId") REFERENCES "public"."MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "public"."ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_materialVarianteId_fkey" FOREIGN KEY ("materialVarianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "public"."ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidato" ADD CONSTRAINT "SlotMaterialCand_default_variant_fkey" FOREIGN KEY ("defaultVarianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidato" ADD CONSTRAINT "SlotMaterialCand_materia_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "public"."MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidato" ADD CONSTRAINT "SlotMaterialCand_slot_fkey" FOREIGN KEY ("slotMaterialId") REFERENCES "public"."ProductoConfigPasoSlotMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidato" ADD CONSTRAINT "SlotMaterialCand_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidatoVariante" ADD CONSTRAINT "SlotMaterialCandVar_candidate_fkey" FOREIGN KEY ("candidatoId") REFERENCES "public"."ProductoConfigPasoSlotMaterialCandidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidatoVariante" ADD CONSTRAINT "SlotMaterialCandVar_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoConfigPasoSlotMaterialCandidatoVariante" ADD CONSTRAINT "SlotMaterialCandVar_variant_fkey" FOREIGN KEY ("varianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoImpuestoAplicado" ADD CONSTRAINT "ProductoImpuestoAplicado_impuestoCatalogoId_fkey" FOREIGN KEY ("impuestoCatalogoId") REFERENCES "public"."ProductoImpuestoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoImpuestoAplicado" ADD CONSTRAINT "ProductoImpuestoAplicado_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoImpuestoAplicado" ADD CONSTRAINT "ProductoImpuestoAplicado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoImpuestoCatalogo" ADD CONSTRAINT "ProductoImpuestoCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "public"."Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "public"."Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductoSubcategoriaComercial" ADD CONSTRAINT "ProductoSubcategoriaComercial_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."ProductoCategoriaComercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proveedor" ADD CONSTRAINT "Proveedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "public"."Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "public"."Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ruta" ADD CONSTRAINT "Ruta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RutaPaso" ADD CONSTRAINT "RutaPaso_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "public"."Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RutaPaso" ADD CONSTRAINT "RutaPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RutaVersion" ADD CONSTRAINT "RutaVersion_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "public"."Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RutaVersion" ADD CONSTRAINT "RutaVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "public"."AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "public"."MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

