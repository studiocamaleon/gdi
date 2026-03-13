"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertMaquinaDto = exports.MaquinaComponenteDesgasteItemDto = exports.MaquinaConsumibleItemDto = exports.MaquinaPerfilOperativoItemDto = exports.UnidadDesgasteMaquinaDto = exports.TipoComponenteDesgasteMaquinaDto = exports.UnidadConsumoMaquinaDto = exports.TipoConsumibleMaquinaDto = exports.TipoPerfilOperativoMaquinaDto = exports.UnidadProduccionMaquinaDto = exports.GeometriaTrabajoMaquinaDto = exports.EstadoConfiguracionMaquinaDto = exports.EstadoMaquinaDto = exports.PlantillaMaquinariaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var PlantillaMaquinariaDto;
(function (PlantillaMaquinariaDto) {
    PlantillaMaquinariaDto["router_cnc"] = "router_cnc";
    PlantillaMaquinariaDto["corte_laser"] = "corte_laser";
    PlantillaMaquinariaDto["impresora_3d"] = "impresora_3d";
    PlantillaMaquinariaDto["impresora_dtf"] = "impresora_dtf";
    PlantillaMaquinariaDto["impresora_dtf_uv"] = "impresora_dtf_uv";
    PlantillaMaquinariaDto["impresora_uv_mesa_extensora"] = "impresora_uv_mesa_extensora";
    PlantillaMaquinariaDto["impresora_uv_cilindrica"] = "impresora_uv_cilindrica";
    PlantillaMaquinariaDto["impresora_uv_flatbed"] = "impresora_uv_flatbed";
    PlantillaMaquinariaDto["impresora_uv_rollo"] = "impresora_uv_rollo";
    PlantillaMaquinariaDto["impresora_solvente"] = "impresora_solvente";
    PlantillaMaquinariaDto["impresora_inyeccion_tinta"] = "impresora_inyeccion_tinta";
    PlantillaMaquinariaDto["impresora_latex"] = "impresora_latex";
    PlantillaMaquinariaDto["impresora_sublimacion_gran_formato"] = "impresora_sublimacion_gran_formato";
    PlantillaMaquinariaDto["impresora_laser"] = "impresora_laser";
    PlantillaMaquinariaDto["plotter_cad"] = "plotter_cad";
    PlantillaMaquinariaDto["mesa_de_corte"] = "mesa_de_corte";
    PlantillaMaquinariaDto["plotter_de_corte"] = "plotter_de_corte";
})(PlantillaMaquinariaDto || (exports.PlantillaMaquinariaDto = PlantillaMaquinariaDto = {}));
var EstadoMaquinaDto;
(function (EstadoMaquinaDto) {
    EstadoMaquinaDto["activa"] = "activa";
    EstadoMaquinaDto["inactiva"] = "inactiva";
    EstadoMaquinaDto["mantenimiento"] = "mantenimiento";
    EstadoMaquinaDto["baja"] = "baja";
})(EstadoMaquinaDto || (exports.EstadoMaquinaDto = EstadoMaquinaDto = {}));
var EstadoConfiguracionMaquinaDto;
(function (EstadoConfiguracionMaquinaDto) {
    EstadoConfiguracionMaquinaDto["borrador"] = "borrador";
    EstadoConfiguracionMaquinaDto["incompleta"] = "incompleta";
    EstadoConfiguracionMaquinaDto["lista"] = "lista";
})(EstadoConfiguracionMaquinaDto || (exports.EstadoConfiguracionMaquinaDto = EstadoConfiguracionMaquinaDto = {}));
var GeometriaTrabajoMaquinaDto;
(function (GeometriaTrabajoMaquinaDto) {
    GeometriaTrabajoMaquinaDto["pliego"] = "pliego";
    GeometriaTrabajoMaquinaDto["rollo"] = "rollo";
    GeometriaTrabajoMaquinaDto["plano"] = "plano";
    GeometriaTrabajoMaquinaDto["cilindrico"] = "cilindrico";
    GeometriaTrabajoMaquinaDto["volumen"] = "volumen";
})(GeometriaTrabajoMaquinaDto || (exports.GeometriaTrabajoMaquinaDto = GeometriaTrabajoMaquinaDto = {}));
var UnidadProduccionMaquinaDto;
(function (UnidadProduccionMaquinaDto) {
    UnidadProduccionMaquinaDto["hora"] = "hora";
    UnidadProduccionMaquinaDto["hoja"] = "hoja";
    UnidadProduccionMaquinaDto["copia"] = "copia";
    UnidadProduccionMaquinaDto["ppm"] = "ppm";
    UnidadProduccionMaquinaDto["a4_equiv"] = "a4_equiv";
    UnidadProduccionMaquinaDto["m2"] = "m2";
    UnidadProduccionMaquinaDto["m2_h"] = "m2_h";
    UnidadProduccionMaquinaDto["metro_lineal"] = "metro_lineal";
    UnidadProduccionMaquinaDto["piezas_h"] = "piezas_h";
    UnidadProduccionMaquinaDto["pieza"] = "pieza";
    UnidadProduccionMaquinaDto["ciclo"] = "ciclo";
})(UnidadProduccionMaquinaDto || (exports.UnidadProduccionMaquinaDto = UnidadProduccionMaquinaDto = {}));
var TipoPerfilOperativoMaquinaDto;
(function (TipoPerfilOperativoMaquinaDto) {
    TipoPerfilOperativoMaquinaDto["impresion"] = "impresion";
    TipoPerfilOperativoMaquinaDto["corte"] = "corte";
    TipoPerfilOperativoMaquinaDto["mecanizado"] = "mecanizado";
    TipoPerfilOperativoMaquinaDto["grabado"] = "grabado";
    TipoPerfilOperativoMaquinaDto["fabricacion"] = "fabricacion";
    TipoPerfilOperativoMaquinaDto["mixto"] = "mixto";
})(TipoPerfilOperativoMaquinaDto || (exports.TipoPerfilOperativoMaquinaDto = TipoPerfilOperativoMaquinaDto = {}));
var TipoConsumibleMaquinaDto;
(function (TipoConsumibleMaquinaDto) {
    TipoConsumibleMaquinaDto["toner"] = "toner";
    TipoConsumibleMaquinaDto["tinta"] = "tinta";
    TipoConsumibleMaquinaDto["barniz"] = "barniz";
    TipoConsumibleMaquinaDto["primer"] = "primer";
    TipoConsumibleMaquinaDto["film"] = "film";
    TipoConsumibleMaquinaDto["polvo"] = "polvo";
    TipoConsumibleMaquinaDto["adhesivo"] = "adhesivo";
    TipoConsumibleMaquinaDto["resina"] = "resina";
    TipoConsumibleMaquinaDto["lubricante"] = "lubricante";
    TipoConsumibleMaquinaDto["otro"] = "otro";
})(TipoConsumibleMaquinaDto || (exports.TipoConsumibleMaquinaDto = TipoConsumibleMaquinaDto = {}));
var UnidadConsumoMaquinaDto;
(function (UnidadConsumoMaquinaDto) {
    UnidadConsumoMaquinaDto["ml"] = "ml";
    UnidadConsumoMaquinaDto["litro"] = "litro";
    UnidadConsumoMaquinaDto["gramo"] = "gramo";
    UnidadConsumoMaquinaDto["kg"] = "kg";
    UnidadConsumoMaquinaDto["unidad"] = "unidad";
    UnidadConsumoMaquinaDto["m2"] = "m2";
    UnidadConsumoMaquinaDto["metro_lineal"] = "metro_lineal";
    UnidadConsumoMaquinaDto["pagina"] = "pagina";
    UnidadConsumoMaquinaDto["a4_equiv"] = "a4_equiv";
})(UnidadConsumoMaquinaDto || (exports.UnidadConsumoMaquinaDto = UnidadConsumoMaquinaDto = {}));
var TipoComponenteDesgasteMaquinaDto;
(function (TipoComponenteDesgasteMaquinaDto) {
    TipoComponenteDesgasteMaquinaDto["fusor"] = "fusor";
    TipoComponenteDesgasteMaquinaDto["drum"] = "drum";
    TipoComponenteDesgasteMaquinaDto["developer"] = "developer";
    TipoComponenteDesgasteMaquinaDto["correa_transferencia"] = "correa_transferencia";
    TipoComponenteDesgasteMaquinaDto["cabezal"] = "cabezal";
    TipoComponenteDesgasteMaquinaDto["lampara_uv"] = "lampara_uv";
    TipoComponenteDesgasteMaquinaDto["fresa"] = "fresa";
    TipoComponenteDesgasteMaquinaDto["cuchilla"] = "cuchilla";
    TipoComponenteDesgasteMaquinaDto["filtro"] = "filtro";
    TipoComponenteDesgasteMaquinaDto["kit_mantenimiento"] = "kit_mantenimiento";
    TipoComponenteDesgasteMaquinaDto["otro"] = "otro";
})(TipoComponenteDesgasteMaquinaDto || (exports.TipoComponenteDesgasteMaquinaDto = TipoComponenteDesgasteMaquinaDto = {}));
var UnidadDesgasteMaquinaDto;
(function (UnidadDesgasteMaquinaDto) {
    UnidadDesgasteMaquinaDto["copias_a4_equiv"] = "copias_a4_equiv";
    UnidadDesgasteMaquinaDto["m2"] = "m2";
    UnidadDesgasteMaquinaDto["metros_lineales"] = "metros_lineales";
    UnidadDesgasteMaquinaDto["horas"] = "horas";
    UnidadDesgasteMaquinaDto["ciclos"] = "ciclos";
    UnidadDesgasteMaquinaDto["piezas"] = "piezas";
})(UnidadDesgasteMaquinaDto || (exports.UnidadDesgasteMaquinaDto = UnidadDesgasteMaquinaDto = {}));
class MaquinaPerfilOperativoItemDto {
    nombre;
    tipoPerfil;
    activo;
    anchoAplicable;
    altoAplicable;
    modoTrabajo;
    calidad;
    productividad;
    unidadProductividad;
    tiempoPreparacionMin;
    tiempoCargaMin;
    tiempoDescargaMin;
    tiempoRipMin;
    cantidadPasadas;
    dobleFaz;
    detalle;
}
exports.MaquinaPerfilOperativoItemDto = MaquinaPerfilOperativoItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], MaquinaPerfilOperativoItemDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoPerfilOperativoMaquinaDto),
    __metadata("design:type", String)
], MaquinaPerfilOperativoItemDto.prototype, "tipoPerfil", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MaquinaPerfilOperativoItemDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "anchoAplicable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "altoAplicable", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaPerfilOperativoItemDto.prototype, "modoTrabajo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaPerfilOperativoItemDto.prototype, "calidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "productividad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadProduccionMaquinaDto),
    __metadata("design:type", String)
], MaquinaPerfilOperativoItemDto.prototype, "unidadProductividad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "tiempoPreparacionMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "tiempoCargaMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "tiempoDescargaMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "tiempoRipMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaPerfilOperativoItemDto.prototype, "cantidadPasadas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MaquinaPerfilOperativoItemDto.prototype, "dobleFaz", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MaquinaPerfilOperativoItemDto.prototype, "detalle", void 0);
class MaquinaConsumibleItemDto {
    materiaPrimaVarianteId;
    nombre;
    tipo;
    unidad;
    rendimientoEstimado;
    consumoBase;
    perfilOperativoNombre;
    activo;
    detalle;
    observaciones;
}
exports.MaquinaConsumibleItemDto = MaquinaConsumibleItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(undefined, {
        message: 'Selecciona una variante valida para el consumible.',
    }),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoConsumibleMaquinaDto),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadConsumoMaquinaDto),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "unidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaConsumibleItemDto.prototype, "rendimientoEstimado", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaConsumibleItemDto.prototype, "consumoBase", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "perfilOperativoNombre", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MaquinaConsumibleItemDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MaquinaConsumibleItemDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaConsumibleItemDto.prototype, "observaciones", void 0);
class MaquinaComponenteDesgasteItemDto {
    materiaPrimaVarianteId;
    nombre;
    tipo;
    vidaUtilEstimada;
    unidadDesgaste;
    modoProrrateo;
    activo;
    detalle;
    observaciones;
}
exports.MaquinaComponenteDesgasteItemDto = MaquinaComponenteDesgasteItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(undefined, {
        message: 'Selecciona una variante valida para el componente de desgaste.',
    }),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoComponenteDesgasteMaquinaDto),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MaquinaComponenteDesgasteItemDto.prototype, "vidaUtilEstimada", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadDesgasteMaquinaDto),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "unidadDesgaste", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "modoProrrateo", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MaquinaComponenteDesgasteItemDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MaquinaComponenteDesgasteItemDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MaquinaComponenteDesgasteItemDto.prototype, "observaciones", void 0);
class UpsertMaquinaDto {
    codigo;
    nombre;
    plantilla;
    plantillaVersion;
    fabricante;
    modelo;
    numeroSerie;
    plantaId;
    centroCostoPrincipalId;
    estado;
    estadoConfiguracion;
    geometriaTrabajo;
    unidadProduccionPrincipal;
    anchoUtil;
    largoUtil;
    altoUtil;
    espesorMaximo;
    pesoMaximo;
    fechaAlta;
    activo;
    observaciones;
    parametrosTecnicos;
    capacidadesAvanzadas;
    perfilesOperativos;
    consumibles;
    componentesDesgaste;
}
exports.UpsertMaquinaDto = UpsertMaquinaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(PlantillaMaquinariaDto),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "plantilla", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "plantillaVersion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "fabricante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "modelo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "numeroSerie", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "plantaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "centroCostoPrincipalId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(EstadoMaquinaDto),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "estado", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(EstadoConfiguracionMaquinaDto),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "estadoConfiguracion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(GeometriaTrabajoMaquinaDto),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "geometriaTrabajo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadProduccionMaquinaDto),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "unidadProduccionPrincipal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "anchoUtil", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "largoUtil", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "altoUtil", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "espesorMaximo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertMaquinaDto.prototype, "pesoMaximo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "fechaAlta", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMaquinaDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMaquinaDto.prototype, "observaciones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertMaquinaDto.prototype, "parametrosTecnicos", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertMaquinaDto.prototype, "capacidadesAvanzadas", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MaquinaPerfilOperativoItemDto),
    __metadata("design:type", Array)
], UpsertMaquinaDto.prototype, "perfilesOperativos", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MaquinaConsumibleItemDto),
    __metadata("design:type", Array)
], UpsertMaquinaDto.prototype, "consumibles", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MaquinaComponenteDesgasteItemDto),
    __metadata("design:type", Array)
], UpsertMaquinaDto.prototype, "componentesDesgaste", void 0);
//# sourceMappingURL=upsert-maquina.dto.js.map