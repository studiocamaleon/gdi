-- CreateEnum
CREATE TYPE "TipoDireccion" AS ENUM ('PRINCIPAL', 'FACTURACION', 'ENTREGA');

-- CreateEnum
CREATE TYPE "SexoEmpleado" AS ENUM ('MASCULINO', 'FEMENINO', 'NO_BINARIO', 'PREFIERO_NO_DECIR');

-- CreateEnum
CREATE TYPE "RolSistema" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('PORCENTAJE', 'FIJO');

-- CreateEnum
CREATE TYPE "TipoCentroCosto" AS ENUM ('PRODUCTIVO', 'APOYO', 'ADMINISTRATIVO', 'COMERCIAL', 'LOGISTICO', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "CategoriaGraficaCentroCosto" AS ENUM ('PREPRENSA', 'IMPRESION', 'TERMINACION', 'EMPAQUE', 'LOGISTICA', 'CALIDAD', 'MANTENIMIENTO', 'ADMINISTRACION', 'COMERCIAL', 'TERCERIZADO');

-- CreateEnum
CREATE TYPE "ImputacionPreferidaCentroCosto" AS ENUM ('DIRECTA', 'INDIRECTA', 'REPARTO');

-- CreateEnum
CREATE TYPE "UnidadBaseCentroCosto" AS ENUM ('NINGUNA', 'HORA_MAQUINA', 'HORA_HOMBRE', 'PLIEGO', 'UNIDAD', 'M2', 'KG');

-- CreateEnum
CREATE TYPE "TipoRecursoCentroCosto" AS ENUM ('EMPLEADO', 'MAQUINARIA', 'GASTO_GENERAL', 'ACTIVO_FIJO');

-- CreateEnum
CREATE TYPE "TipoGastoGeneralCentroCosto" AS ENUM ('LIMPIEZA', 'MANTENIMIENTO', 'SERVICIOS', 'ALQUILER', 'OTRO');

-- CreateEnum
CREATE TYPE "CategoriaComponenteCostoCentro" AS ENUM ('SUELDOS', 'CARGAS', 'MANTENIMIENTO', 'ENERGIA', 'ALQUILER', 'AMORTIZACION', 'TERCERIZACION', 'INSUMOS_INDIRECTOS', 'OTROS');

-- CreateEnum
CREATE TYPE "OrigenComponenteCostoCentro" AS ENUM ('MANUAL', 'SUGERIDO');

-- CreateEnum
CREATE TYPE "MetodoDepreciacionMaquina" AS ENUM ('LINEAL');

-- CreateEnum
CREATE TYPE "EstadoTarifaCentroCostoPeriodo" AS ENUM ('BORRADOR', 'PUBLICADA');

-- CreateEnum
CREATE TYPE "PlantillaMaquinaria" AS ENUM ('ROUTER_CNC', 'CORTE_LASER', 'GUILLOTINA', 'LAMINADORA_BOPP_ROLLO', 'REDONDEADORA_PUNTAS', 'PERFORADORA', 'IMPRESORA_3D', 'IMPRESORA_DTF', 'IMPRESORA_DTF_UV', 'IMPRESORA_UV_MESA_EXTENSORA', 'IMPRESORA_UV_CILINDRICA', 'IMPRESORA_UV_FLATBED', 'IMPRESORA_UV_ROLLO', 'IMPRESORA_SOLVENTE', 'IMPRESORA_INYECCION_TINTA', 'IMPRESORA_LATEX', 'IMPRESORA_SUBLIMACION_GRAN_FORMATO', 'IMPRESORA_LASER', 'PLOTTER_CAD', 'MESA_DE_CORTE', 'PLOTTER_DE_CORTE');

-- CreateEnum
CREATE TYPE "EstadoMaquina" AS ENUM ('ACTIVA', 'INACTIVA', 'MANTENIMIENTO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoConfiguracionMaquina" AS ENUM ('BORRADOR', 'INCOMPLETA', 'LISTA');

-- CreateEnum
CREATE TYPE "GeometriaTrabajoMaquina" AS ENUM ('PLIEGO', 'ROLLO', 'PLANO', 'CILINDRICO', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "UnidadProduccionMaquina" AS ENUM ('HORA', 'HOJA', 'COPIA', 'PPM', 'A4_EQUIV', 'M2', 'M2_H', 'METRO_LINEAL', 'PIEZAS_H', 'PIEZA', 'CICLO', 'CORTES_MIN', 'GOLPES_MIN', 'PLIEGOS_MIN', 'M_MIN');

-- CreateEnum
CREATE TYPE "TipoPerfilOperativoMaquina" AS ENUM ('IMPRESION', 'CORTE', 'LAMINADO', 'MECANIZADO', 'GRABADO', 'FABRICACION', 'MIXTO');

-- CreateEnum
CREATE TYPE "TipoConsumibleMaquina" AS ENUM ('TONER', 'TINTA', 'BARNIZ', 'PRIMER', 'FILM', 'POLVO', 'ADHESIVO', 'RESINA', 'LUBRICANTE', 'OTRO');

-- CreateEnum
CREATE TYPE "UnidadConsumoMaquina" AS ENUM ('ML', 'LITRO', 'GRAMO', 'KG', 'UNIDAD', 'M2', 'METRO_LINEAL', 'PAGINA', 'A4_EQUIV');

-- CreateEnum
CREATE TYPE "TipoComponenteDesgasteMaquina" AS ENUM ('FUSOR', 'DRUM', 'DRUM_OPC', 'DEVELOPER', 'DEVELOPER_UNIT', 'CHARGE_UNIT', 'DRUM_CLEANING_BLADE', 'CORREA_TRANSFERENCIA', 'TRANSFER_BELT_ITB', 'TRANSFER_ROLLER', 'FUSER_BELT', 'PRESSURE_ROLLER', 'FUSER_CLEANING_WEB', 'WAX_LUBRICANT_BAR', 'FUSER_STRIPPER_FINGER', 'WASTE_TONER_SUBSYSTEM', 'CABEZAL', 'LAMPARA_UV', 'FRESA', 'CUCHILLA', 'FILTRO', 'KIT_MANTENIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "UnidadDesgasteMaquina" AS ENUM ('COPIAS_A4_EQUIV', 'M2', 'METROS_LINEALES', 'HORAS', 'CICLOS', 'PIEZAS');

-- CreateEnum
CREATE TYPE "FamiliaMateriaPrima" AS ENUM ('SUSTRATO', 'TINTA_COLORANTE', 'TRANSFERENCIA_LAMINACION', 'QUIMICO_AUXILIAR', 'ADITIVA_3D', 'ELECTRONICA_CARTELERIA', 'NEON_LUMINARIA', 'METAL_ESTRUCTURA', 'PINTURA_RECUBRIMIENTO', 'TERMINACION_EDITORIAL', 'MAGNETICO_FIJACION', 'POP_EXHIBIDOR', 'HERRAJE_ACCESORIO', 'ADHESIVO_TECNICO', 'PACKING_INSTALACION');

-- CreateEnum
CREATE TYPE "SubfamiliaMateriaPrima" AS ENUM ('SUSTRATO_HOJA', 'SUSTRATO_ROLLO_FLEXIBLE', 'SUSTRATO_RIGIDO', 'OBJETO_PROMOCIONAL_BASE', 'TINTA_IMPRESION', 'TONER', 'FILM_TRANSFERENCIA', 'PAPEL_TRANSFERENCIA', 'LAMINADO_FILM', 'QUIMICO_ACABADO', 'AUXILIAR_PROCESO', 'POLVO_DTF', 'FILAMENTO_3D', 'RESINA_3D', 'MODULO_LED_CARTELERIA', 'FUENTE_ALIMENTACION_LED', 'CABLEADO_CONECTICA', 'CONTROLADOR_LED', 'NEON_FLEX_LED', 'ACCESORIO_NEON_LED', 'CHAPA_METALICA', 'PERFIL_ESTRUCTURAL', 'PINTURA_CARTELERIA', 'PRIMER_SELLADOR', 'ANILLADO_ENCUADERNACION', 'TAPA_ENCUADERNACION', 'IMAN_CERAMICO_FLEXIBLE', 'FIJACION_AUXILIAR', 'ACCESORIO_EXHIBIDOR_CARTON', 'ACCESORIO_MONTAJE_POP', 'SEMIELABORADO_POP', 'ARGOLLA_LLAVERO_ACCESORIO', 'OJAL_OJALILLO_REMACHE', 'PORTABANNER_ESTRUCTURA', 'SISTEMA_COLGADO_MONTAJE', 'PERFIL_BASTIDOR_TEXTIL', 'CINTA_DOBLE_FAZ_TECNICA', 'ADHESIVO_LIQUIDO_ESTRUCTURAL', 'VELCRO_CIERRE_TECNICO', 'EMBALAJE_PROTECCION', 'ETIQUETADO_IDENTIFICACION', 'CONSUMIBLE_INSTALACION');

-- CreateEnum
CREATE TYPE "UnidadMateriaPrima" AS ENUM ('UNIDAD', 'PACK', 'CAJA', 'KIT', 'HOJA', 'PLIEGO', 'RESMA', 'ROLLO', 'METRO_LINEAL', 'M2', 'M3', 'MM', 'CM', 'LITRO', 'ML', 'KG', 'GRAMO', 'PIEZA', 'PAR');

-- CreateEnum
CREATE TYPE "TipoMovimientoStockMateriaPrima" AS ENUM ('INGRESO', 'EGRESO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA');

-- CreateEnum
CREATE TYPE "OrigenMovimientoStockMateriaPrima" AS ENUM ('COMPRA', 'CONSUMO_PRODUCCION', 'AJUSTE_MANUAL', 'TRANSFERENCIA', 'DEVOLUCION', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoImpresionProductoVariante" AS ENUM ('BN', 'CMYK');

-- CreateEnum
CREATE TYPE "CarasProductoVariante" AS ENUM ('SIMPLE_FAZ', 'DOBLE_FAZ');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "nombreCompleto" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rol" "RolSistema" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
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
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "empleadoId" UUID,
    "invitedByMembershipId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolSistema" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
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
CREATE TABLE "Proveedor" (
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
CREATE TABLE "Empleado" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "nombreCompleto" TEXT NOT NULL,
    "emailPrincipal" TEXT NOT NULL,
    "telefonoCodigo" TEXT NOT NULL,
    "telefonoNumero" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ocupacion" TEXT,
    "sexo" "SexoEmpleado",
    "fechaIngreso" DATE NOT NULL,
    "fechaNacimiento" DATE,
    "comisionesHabilitadas" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteContacto" (
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
CREATE TABLE "ClienteDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorContacto" (
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
CREATE TABLE "ProveedorDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedorId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProveedorDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoDireccion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisCodigo" VARCHAR(2) NOT NULL,
    "codigoPostal" TEXT,
    "direccion" TEXT NOT NULL,
    "numero" TEXT,
    "ciudad" TEXT NOT NULL,
    "tipo" "TipoDireccion" NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoComision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpleadoComision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planta" (
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
CREATE TABLE "AreaCosto" (
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
CREATE TABLE "CentroCosto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantaId" UUID NOT NULL,
    "areaCostoId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoCentro" "TipoCentroCosto" NOT NULL,
    "categoriaGrafica" "CategoriaGraficaCentroCosto" NOT NULL,
    "imputacionPreferida" "ImputacionPreferidaCentroCosto" NOT NULL,
    "unidadBaseFutura" "UnidadBaseCentroCosto" NOT NULL DEFAULT 'NINGUNA',
    "responsableEmpleadoId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCostoRecurso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoRecurso" "TipoRecursoCentroCosto" NOT NULL,
    "empleadoId" UUID,
    "maquinaId" UUID,
    "nombreRecurso" TEXT,
    "tipoGastoGeneral" "TipoGastoGeneralCentroCosto",
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
CREATE TABLE "CentroCostoRecursoMaquinaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoRecursoId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "metodoDepreciacion" "MetodoDepreciacionMaquina" NOT NULL DEFAULT 'LINEAL',
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
CREATE TABLE "CentroCostoComponenteCostoPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "categoria" "CategoriaComponenteCostoCentro" NOT NULL,
    "nombre" TEXT NOT NULL,
    "origen" "OrigenComponenteCostoCentro" NOT NULL DEFAULT 'MANUAL',
    "importeMensual" DECIMAL(12,2) NOT NULL,
    "notas" TEXT,
    "detalleJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoComponenteCostoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCostoCapacidadPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "unidadBase" "UnidadBaseCentroCosto" NOT NULL,
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
CREATE TABLE "CentroCostoTarifaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "costoMensualTotal" DECIMAL(12,2) NOT NULL,
    "capacidadPractica" DECIMAL(12,2) NOT NULL,
    "tarifaCalculada" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoTarifaCentroCostoPeriodo" NOT NULL,
    "resumenJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoTarifaPeriodo_pkey" PRIMARY KEY ("id")
);

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
    "operationMode" TEXT,
    "printMode" "TipoImpresionProductoVariante",
    "printSides" "CarasProductoVariante",
    "productivityValue" DECIMAL(12,2),
    "productivityUnit" "UnidadProduccionMaquina",
    "setupMin" DECIMAL(12,2),
    "cleanupMin" DECIMAL(12,2),
    "feedReloadMin" DECIMAL(12,2),
    "sheetThicknessMm" DECIMAL(12,3),
    "maxBatchHeightMm" DECIMAL(12,2),
    "materialPreset" TEXT,
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
    "materiaPrimaVarianteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoConsumibleMaquina" NOT NULL,
    "unidad" "UnidadConsumoMaquina" NOT NULL,
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
    "materiaPrimaVarianteId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoComponenteDesgasteMaquina" NOT NULL,
    "vidaUtilEstimada" DECIMAL(12,2),
    "unidadDesgaste" "UnidadDesgasteMaquina" NOT NULL,
    "modoProrrateo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "detalleJson" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaquinaComponenteDesgaste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estacion" (
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
    "unidadStock" "UnidadMateriaPrima" NOT NULL,
    "unidadCompra" "UnidadMateriaPrima" NOT NULL,
    "esConsumible" BOOLEAN NOT NULL DEFAULT false,
    "esRepuesto" BOOLEAN NOT NULL DEFAULT false,
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
    "precioReferencia" DECIMAL(14,6),
    "moneda" VARCHAR(3),
    "proveedorReferenciaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MateriaPrimaVariante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlmacenMateriaPrima" (
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
CREATE TABLE "AlmacenMateriaPrimaUbicacion" (
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
CREATE TABLE "StockMateriaPrimaVariante" (
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
CREATE TABLE "MovimientoStockMateriaPrima" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "varianteId" UUID NOT NULL,
    "ubicacionId" UUID NOT NULL,
    "tipo" "TipoMovimientoStockMateriaPrima" NOT NULL,
    "origen" "OrigenMovimientoStockMateriaPrima" NOT NULL,
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
CREATE TABLE "ProductoImpuestoCatalogo" (
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
CREATE TABLE "ProductoComisionCatalogo" (
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
CREATE TABLE "Ruta" (
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
CREATE TABLE "RutaPaso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rutaId" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "familiaCodigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RutaPaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RutaVersion" (
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
CREATE TABLE "Producto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidadComercial" TEXT NOT NULL DEFAULT 'unidad',
    "modoMedidas" TEXT NOT NULL DEFAULT 'FIJA',
    "medidaDefaultAnchoMm" DECIMAL(12,2),
    "medidaDefaultAltoMm" DECIMAL(12,2),
    "precioConfigJson" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoRutaAlternativa" (
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
CREATE TABLE "ProductoConfigPaso" (
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

    CONSTRAINT "ProductoConfigPaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoConfigPasoSlotMaterial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "slotCodigo" TEXT NOT NULL,
    "modoSeleccion" TEXT NOT NULL,
    "criterioMotorAuto" TEXT,
    "criterioInputCampo" TEXT,
    "criterioMaterialCampo" TEXT,
    "materialVarianteId" UUID,
    "materialesCandidatosJson" JSONB,
    "estrategiaCosto" TEXT NOT NULL DEFAULT 'simple',
    "formula" TEXT NOT NULL DEFAULT 'por_unidad_productiva',
    "aplicaMultiCaras" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoConfigPasoSlotMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoConfigPasoMaquinaCandidata" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "esPreferida" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoConfigPasoMaquinaCandidata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoPasoExtra" (
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
CREATE TABLE "CargoDirectoCatalogo" (
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
CREATE TABLE "ProductoCargoDirectoPaso" (
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
CREATE TABLE "ProductoCargoDirectoCotizacion" (
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
CREATE TABLE "Cotizacion" (
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
CREATE TABLE "CotizacionItem" (
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

    CONSTRAINT "CotizacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoPrecioEspecialClienteV2" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_currentTenantId_idx" ON "AuthSession"("currentTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_email_idx" ON "Invitation"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Invitation_empleadoId_idx" ON "Invitation"("empleadoId");

-- CreateIndex
CREATE INDEX "Cliente_tenantId_nombre_idx" ON "Cliente"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_nombre_key" ON "Cliente"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "Proveedor_tenantId_nombre_idx" ON "Proveedor"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_tenantId_nombre_key" ON "Proveedor"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "Empleado_tenantId_nombreCompleto_idx" ON "Empleado"("tenantId", "nombreCompleto");

-- CreateIndex
CREATE INDEX "Empleado_tenantId_sector_idx" ON "Empleado"("tenantId", "sector");

-- CreateIndex
CREATE INDEX "ClienteContacto_tenantId_clienteId_idx" ON "ClienteContacto"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "ClienteDireccion_tenantId_clienteId_idx" ON "ClienteDireccion"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "ProveedorContacto_tenantId_proveedorId_idx" ON "ProveedorContacto"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "ProveedorDireccion_tenantId_proveedorId_idx" ON "ProveedorDireccion"("tenantId", "proveedorId");

-- CreateIndex
CREATE INDEX "EmpleadoDireccion_tenantId_empleadoId_idx" ON "EmpleadoDireccion"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "EmpleadoComision_tenantId_empleadoId_idx" ON "EmpleadoComision"("tenantId", "empleadoId");

-- CreateIndex
CREATE INDEX "Planta_tenantId_nombre_idx" ON "Planta"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Planta_tenantId_codigo_key" ON "Planta"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "AreaCosto_tenantId_plantaId_nombre_idx" ON "AreaCosto"("tenantId", "plantaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "AreaCosto_tenantId_plantaId_codigo_key" ON "AreaCosto"("tenantId", "plantaId", "codigo");

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_plantaId_areaCostoId_idx" ON "CentroCosto"("tenantId", "plantaId", "areaCostoId");

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_nombre_idx" ON "CentroCosto"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCosto_tenantId_codigo_key" ON "CentroCosto"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_centroCostoId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_tipoRecurso_periodo_idx" ON "CentroCostoRecurso"("tenantId", "tipoRecurso", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_empleadoId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "empleadoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_maquinaId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "maquinaId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_maquinaId_periodo_idx" ON "CentroCostoRecursoMaquinaPeriodo"("tenantId", "maquinaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_centroCostoRecurs_key" ON "CentroCostoRecursoMaquinaPeriodo"("tenantId", "centroCostoRecursoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoComponenteCostoPeriodo_tenantId_centroCostoId_pe_idx" ON "CentroCostoComponenteCostoPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoCapacidadPeriodo_tenantId_centroCostoId_periodo_key" ON "CentroCostoCapacidadPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_idx" ON "CentroCostoTarifaPeriodo"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoTarifaPeriodo_tenantId_centroCostoId_periodo_est_key" ON "CentroCostoTarifaPeriodo"("tenantId", "centroCostoId", "periodo", "estado");

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
CREATE INDEX "MaquinaConsumible_tenantId_materiaPrimaVarianteId_activo_idx" ON "MaquinaConsumible"("tenantId", "materiaPrimaVarianteId", "activo");

-- CreateIndex
CREATE INDEX "MaquinaComponenteDesgaste_tenantId_maquinaId_activo_idx" ON "MaquinaComponenteDesgaste"("tenantId", "maquinaId", "activo");

-- CreateIndex
CREATE INDEX "MaquinaComponenteDesgaste_tenantId_materiaPrimaVarianteId_a_idx" ON "MaquinaComponenteDesgaste"("tenantId", "materiaPrimaVarianteId", "activo");

-- CreateIndex
CREATE INDEX "Estacion_tenantId_activo_idx" ON "Estacion"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Estacion_tenantId_nombre_key" ON "Estacion"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "MateriaPrima_tenantId_familia_subfamilia_activo_idx" ON "MateriaPrima"("tenantId", "familia", "subfamilia", "activo");

-- CreateIndex
CREATE INDEX "MateriaPrima_tenantId_nombre_idx" ON "MateriaPrima"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrima_tenantId_codigo_key" ON "MateriaPrima"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "MateriaPrimaVariante_tenantId_materiaPrimaId_activo_idx" ON "MateriaPrimaVariante"("tenantId", "materiaPrimaId", "activo");

-- CreateIndex
CREATE INDEX "MateriaPrimaVariante_tenantId_proveedorReferenciaId_activo_idx" ON "MateriaPrimaVariante"("tenantId", "proveedorReferenciaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "MateriaPrimaVariante_tenantId_sku_key" ON "MateriaPrimaVariante"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrima_tenantId_activo_idx" ON "AlmacenMateriaPrima"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrima_tenantId_codigo_key" ON "AlmacenMateriaPrima"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_activo_idx" ON "AlmacenMateriaPrimaUbicacion"("tenantId", "almacenId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "AlmacenMateriaPrimaUbicacion_tenantId_almacenId_codigo_key" ON "AlmacenMateriaPrimaUbicacion"("tenantId", "almacenId", "codigo");

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_idx" ON "StockMateriaPrimaVariante"("tenantId", "varianteId");

-- CreateIndex
CREATE INDEX "StockMateriaPrimaVariante_tenantId_ubicacionId_idx" ON "StockMateriaPrimaVariante"("tenantId", "ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMateriaPrimaVariante_tenantId_varianteId_ubicacionId_key" ON "StockMateriaPrimaVariante"("tenantId", "varianteId", "ubicacionId");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_varianteId_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "varianteId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_ubicacionId_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "ubicacionId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_tipo_createdAt_idx" ON "MovimientoStockMateriaPrima"("tenantId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_referenciaTipo_referen_idx" ON "MovimientoStockMateriaPrima"("tenantId", "referenciaTipo", "referenciaId");

-- CreateIndex
CREATE INDEX "MovimientoStockMateriaPrima_tenantId_transferenciaId_idx" ON "MovimientoStockMateriaPrima"("tenantId", "transferenciaId");

-- CreateIndex
CREATE INDEX "ProductoImpuestoCatalogo_tenantId_nombre_activo_idx" ON "ProductoImpuestoCatalogo"("tenantId", "nombre", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoImpuestoCatalogo_tenantId_codigo_key" ON "ProductoImpuestoCatalogo"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "ProductoComisionCatalogo_tenantId_nombre_activo_idx" ON "ProductoComisionCatalogo"("tenantId", "nombre", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoComisionCatalogo_tenantId_codigo_key" ON "ProductoComisionCatalogo"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "Ruta_tenantId_activo_idx" ON "Ruta"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Ruta_tenantId_codigo_key" ON "Ruta"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "RutaPaso_tenantId_rutaId_activo_idx" ON "RutaPaso"("tenantId", "rutaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "RutaPaso_tenantId_rutaId_orden_key" ON "RutaPaso"("tenantId", "rutaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "RutaVersion_tenantId_rutaId_version_key" ON "RutaVersion"("tenantId", "rutaId", "version");

-- CreateIndex
CREATE INDEX "Producto_tenantId_activo_idx" ON "Producto"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_tenantId_codigo_key" ON "Producto"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "ProductoRutaAlternativa_tenantId_productoId_activo_idx" ON "ProductoRutaAlternativa"("tenantId", "productoId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoRutaAlternativa_tenantId_productoId_rutaId_key" ON "ProductoRutaAlternativa"("tenantId", "productoId", "rutaId");

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_productoRutaAlternativaId_idx" ON "ProductoConfigPaso"("tenantId", "productoRutaAlternativaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPaso_tenantId_productoRutaAlternativaId_rutaP_key" ON "ProductoConfigPaso"("tenantId", "productoRutaAlternativaId", "rutaPasoId");

-- CreateIndex
CREATE INDEX "ProductoConfigPasoSlotMaterial_tenantId_productoConfigPasoI_idx" ON "ProductoConfigPasoSlotMaterial"("tenantId", "productoConfigPasoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPasoSlotMaterial_tenantId_productoConfigPasoI_key" ON "ProductoConfigPasoSlotMaterial"("tenantId", "productoConfigPasoId", "slotCodigo");

-- CreateIndex
CREATE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_productoConfigP_idx" ON "ProductoConfigPasoMaquinaCandidata"("tenantId", "productoConfigPasoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_productoConfigP_key" ON "ProductoConfigPasoMaquinaCandidata"("tenantId", "productoConfigPasoId", "maquinaId");

-- CreateIndex
CREATE INDEX "ProductoPasoExtra_tenantId_productoId_activo_idx" ON "ProductoPasoExtra"("tenantId", "productoId", "activo");

-- CreateIndex
CREATE INDEX "CargoDirectoCatalogo_tenantId_activo_idx" ON "CargoDirectoCatalogo"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "CargoDirectoCatalogo_tenantId_codigo_key" ON "CargoDirectoCatalogo"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "ProductoCargoDirectoPaso_tenantId_productoConfigPasoId_idx" ON "ProductoCargoDirectoPaso"("tenantId", "productoConfigPasoId");

-- CreateIndex
CREATE INDEX "ProductoCargoDirectoCotizacion_tenantId_productoId_idx" ON "ProductoCargoDirectoCotizacion"("tenantId", "productoId");

-- CreateIndex
CREATE INDEX "Cotizacion_tenantId_estado_idx" ON "Cotizacion"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_tenantId_numero_key" ON "Cotizacion"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "CotizacionItem_tenantId_cotizacionId_idx" ON "CotizacionItem"("tenantId", "cotizacionId");

-- CreateIndex
CREATE INDEX "ProductoPrecioEspecialClienteV2_tenantId_clienteId_idx" ON "ProductoPrecioEspecialClienteV2"("tenantId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoPrecioEspecialClienteV2_tenantId_productoId_cliente_key" ON "ProductoPrecioEspecialClienteV2"("tenantId", "productoId", "clienteId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_currentMembershipId_fkey" FOREIGN KEY ("currentMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContacto" ADD CONSTRAINT "ClienteContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteContacto" ADD CONSTRAINT "ClienteContacto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteDireccion" ADD CONSTRAINT "ClienteDireccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorContacto" ADD CONSTRAINT "ProveedorContacto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorDireccion" ADD CONSTRAINT "ProveedorDireccion_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoDireccion" ADD CONSTRAINT "EmpleadoDireccion_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoComision" ADD CONSTRAINT "EmpleadoComision_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planta" ADD CONSTRAINT "Planta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaCosto" ADD CONSTRAINT "AreaCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaCosto" ADD CONSTRAINT "AreaCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_areaCostoId_fkey" FOREIGN KEY ("areaCostoId") REFERENCES "AreaCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCosto" ADD CONSTRAINT "CentroCosto_responsableEmpleadoId_fkey" FOREIGN KEY ("responsableEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_centroCostoRecursoId_fkey" FOREIGN KEY ("centroCostoRecursoId") REFERENCES "CentroCostoRecurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD CONSTRAINT "CentroCostoComponenteCostoPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoCapacidadPeriodo" ADD CONSTRAINT "CentroCostoCapacidadPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoTarifaPeriodo" ADD CONSTRAINT "CentroCostoTarifaPeriodo_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "MaquinaConsumible" ADD CONSTRAINT "MaquinaConsumible_materiaPrimaVarianteId_fkey" FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaquinaComponenteDesgaste" ADD CONSTRAINT "MaquinaComponenteDesgaste_materiaPrimaVarianteId_fkey" FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estacion" ADD CONSTRAINT "Estacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaPrima" ADD CONSTRAINT "MateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_materiaPrimaId_fkey" FOREIGN KEY ("materiaPrimaId") REFERENCES "MateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_proveedorReferenciaId_fkey" FOREIGN KEY ("proveedorReferenciaId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrima" ADD CONSTRAINT "AlmacenMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlmacenMateriaPrimaUbicacion" ADD CONSTRAINT "AlmacenMateriaPrimaUbicacion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "AlmacenMateriaPrima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMateriaPrimaVariante" ADD CONSTRAINT "StockMateriaPrimaVariante_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStockMateriaPrima" ADD CONSTRAINT "MovimientoStockMateriaPrima_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "AlmacenMateriaPrimaUbicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoImpuestoCatalogo" ADD CONSTRAINT "ProductoImpuestoCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoComisionCatalogo" ADD CONSTRAINT "ProductoComisionCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaPaso" ADD CONSTRAINT "RutaPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaPaso" ADD CONSTRAINT "RutaPaso_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaVersion" ADD CONSTRAINT "RutaVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RutaVersion" ADD CONSTRAINT "RutaVersion_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRutaAlternativa" ADD CONSTRAINT "ProductoRutaAlternativa_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_productoRutaAlternativaId_fkey" FOREIGN KEY ("productoRutaAlternativaId") REFERENCES "ProductoRutaAlternativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_rutaPasoId_fkey" FOREIGN KEY ("rutaPasoId") REFERENCES "RutaPaso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_maquinaM1Id_fkey" FOREIGN KEY ("maquinaM1Id") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_perfilM1Id_fkey" FOREIGN KEY ("perfilM1Id") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoSlotMaterial" ADD CONSTRAINT "ProductoConfigPasoSlotMaterial_materialVarianteId_fkey" FOREIGN KEY ("materialVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoConfigPasoMaquinaCandidata" ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoDirectoCatalogo" ADD CONSTRAINT "CargoDirectoCatalogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoPaso" ADD CONSTRAINT "ProductoCargoDirectoPaso_cargoDirectoCatalogoId_fkey" FOREIGN KEY ("cargoDirectoCatalogoId") REFERENCES "CargoDirectoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoCargoDirectoCotizacion" ADD CONSTRAINT "ProductoCargoDirectoCotizacion_cargoDirectoCatalogoId_fkey" FOREIGN KEY ("cargoDirectoCatalogoId") REFERENCES "CargoDirectoCatalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoPrecioEspecialClienteV2" ADD CONSTRAINT "ProductoPrecioEspecialClienteV2_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
