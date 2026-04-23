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
exports.UpsertProcesoDto = exports.ProcesoOperacionItemDto = exports.BaseCalculoProductividadDto = exports.RolProcesoOperacionDto = exports.UnidadProcesoDto = exports.ModoProductividadProcesoDto = exports.TipoOperacionProcesoDto = exports.EstadoConfiguracionProcesoDto = exports.PlantillaMaquinariaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var PlantillaMaquinariaDto;
(function (PlantillaMaquinariaDto) {
    PlantillaMaquinariaDto["router_cnc"] = "router_cnc";
    PlantillaMaquinariaDto["corte_laser"] = "corte_laser";
    PlantillaMaquinariaDto["guillotina"] = "guillotina";
    PlantillaMaquinariaDto["laminadora_bopp_rollo"] = "laminadora_bopp_rollo";
    PlantillaMaquinariaDto["redondeadora_puntas"] = "redondeadora_puntas";
    PlantillaMaquinariaDto["perforadora"] = "perforadora";
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
var EstadoConfiguracionProcesoDto;
(function (EstadoConfiguracionProcesoDto) {
    EstadoConfiguracionProcesoDto["borrador"] = "borrador";
    EstadoConfiguracionProcesoDto["incompleta"] = "incompleta";
    EstadoConfiguracionProcesoDto["lista"] = "lista";
})(EstadoConfiguracionProcesoDto || (exports.EstadoConfiguracionProcesoDto = EstadoConfiguracionProcesoDto = {}));
var TipoOperacionProcesoDto;
(function (TipoOperacionProcesoDto) {
    TipoOperacionProcesoDto["preprensa"] = "preprensa";
    TipoOperacionProcesoDto["prensa"] = "prensa";
    TipoOperacionProcesoDto["postprensa"] = "postprensa";
    TipoOperacionProcesoDto["instalacion"] = "instalacion";
    TipoOperacionProcesoDto["entrega_despacho"] = "entrega_despacho";
    TipoOperacionProcesoDto["acabado"] = "acabado";
    TipoOperacionProcesoDto["servicio"] = "servicio";
})(TipoOperacionProcesoDto || (exports.TipoOperacionProcesoDto = TipoOperacionProcesoDto = {}));
var ModoProductividadProcesoDto;
(function (ModoProductividadProcesoDto) {
    ModoProductividadProcesoDto["tiempo_fijo"] = "tiempo_fijo";
    ModoProductividadProcesoDto["fija"] = "fija";
    ModoProductividadProcesoDto["variable"] = "variable";
    ModoProductividadProcesoDto["productividad_maquina"] = "productividad_maquina";
    ModoProductividadProcesoDto["formula"] = "formula";
})(ModoProductividadProcesoDto || (exports.ModoProductividadProcesoDto = ModoProductividadProcesoDto = {}));
var UnidadProcesoDto;
(function (UnidadProcesoDto) {
    UnidadProcesoDto["ninguna"] = "ninguna";
    UnidadProcesoDto["hora"] = "hora";
    UnidadProcesoDto["minuto"] = "minuto";
    UnidadProcesoDto["segundo"] = "segundo";
    UnidadProcesoDto["hoja"] = "hoja";
    UnidadProcesoDto["copia"] = "copia";
    UnidadProcesoDto["a4_equiv"] = "a4_equiv";
    UnidadProcesoDto["m2"] = "m2";
    UnidadProcesoDto["metro_lineal"] = "metro_lineal";
    UnidadProcesoDto["pieza"] = "pieza";
    UnidadProcesoDto["corte"] = "corte";
    UnidadProcesoDto["ciclo"] = "ciclo";
    UnidadProcesoDto["unidad"] = "unidad";
    UnidadProcesoDto["kg"] = "kg";
    UnidadProcesoDto["litro"] = "litro";
    UnidadProcesoDto["lote"] = "lote";
})(UnidadProcesoDto || (exports.UnidadProcesoDto = UnidadProcesoDto = {}));
var RolProcesoOperacionDto;
(function (RolProcesoOperacionDto) {
    RolProcesoOperacionDto["impresion"] = "impresion";
})(RolProcesoOperacionDto || (exports.RolProcesoOperacionDto = RolProcesoOperacionDto = {}));
var BaseCalculoProductividadDto;
(function (BaseCalculoProductividadDto) {
    BaseCalculoProductividadDto["cantidad"] = "cantidad";
    BaseCalculoProductividadDto["area_total_m2"] = "area_total_m2";
    BaseCalculoProductividadDto["metro_lineal_total"] = "metro_lineal_total";
    BaseCalculoProductividadDto["perimetro_total_ml"] = "perimetro_total_ml";
})(BaseCalculoProductividadDto || (exports.BaseCalculoProductividadDto = BaseCalculoProductividadDto = {}));
class ProcesoOperacionItemDto {
    codigo;
    nombre;
    tipoOperacion;
    centroCostoId;
    maquinaId;
    perfilOperativoId;
    plantillaOrigenId;
    orden;
    setupMin;
    runMin;
    cleanupMin;
    tiempoFijoMin;
    multiplicadorDobleFaz;
    modoProductividad;
    productividadBase;
    unidadEntrada;
    unidadSalida;
    unidadTiempo;
    mermaSetup;
    mermaRunPct;
    reglaVelocidad;
    reglaMerma;
    detalle;
    baseCalculoProductividad;
    rol;
    esOpcional;
    activo;
}
exports.ProcesoOperacionItemDto = ProcesoOperacionItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoOperacionProcesoDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "tipoOperacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "centroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "perfilOperativoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "plantillaOrigenId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "setupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "runMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "cleanupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "tiempoFijoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "multiplicadorDobleFaz", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ModoProductividadProcesoDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "modoProductividad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "productividadBase", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadProcesoDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "unidadEntrada", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadProcesoDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "unidadSalida", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadProcesoDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "unidadTiempo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "mermaSetup", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProcesoOperacionItemDto.prototype, "mermaRunPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ProcesoOperacionItemDto.prototype, "reglaVelocidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ProcesoOperacionItemDto.prototype, "reglaMerma", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ProcesoOperacionItemDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(BaseCalculoProductividadDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "baseCalculoProductividad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(RolProcesoOperacionDto),
    __metadata("design:type", String)
], ProcesoOperacionItemDto.prototype, "rol", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ProcesoOperacionItemDto.prototype, "esOpcional", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ProcesoOperacionItemDto.prototype, "activo", void 0);
class UpsertProcesoDto {
    codigo;
    nombre;
    descripcion;
    estadoConfiguracion;
    activo;
    observaciones;
    operaciones;
}
exports.UpsertProcesoDto = UpsertProcesoDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertProcesoDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertProcesoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProcesoDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(EstadoConfiguracionProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoDto.prototype, "estadoConfiguracion", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProcesoDto.prototype, "observaciones", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProcesoOperacionItemDto),
    __metadata("design:type", Array)
], UpsertProcesoDto.prototype, "operaciones", void 0);
//# sourceMappingURL=upsert-proceso.dto.js.map