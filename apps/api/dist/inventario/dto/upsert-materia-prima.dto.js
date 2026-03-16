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
exports.UpsertMateriaPrimaDto = exports.MateriaPrimaVarianteItemDto = exports.UnidadMateriaPrimaDto = exports.SubfamiliaMateriaPrimaDto = exports.FamiliaMateriaPrimaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var FamiliaMateriaPrimaDto;
(function (FamiliaMateriaPrimaDto) {
    FamiliaMateriaPrimaDto["sustrato"] = "sustrato";
    FamiliaMateriaPrimaDto["tinta_colorante"] = "tinta_colorante";
    FamiliaMateriaPrimaDto["transferencia_laminacion"] = "transferencia_laminacion";
    FamiliaMateriaPrimaDto["quimico_auxiliar"] = "quimico_auxiliar";
    FamiliaMateriaPrimaDto["aditiva_3d"] = "aditiva_3d";
    FamiliaMateriaPrimaDto["electronica_carteleria"] = "electronica_carteleria";
    FamiliaMateriaPrimaDto["neon_luminaria"] = "neon_luminaria";
    FamiliaMateriaPrimaDto["metal_estructura"] = "metal_estructura";
    FamiliaMateriaPrimaDto["pintura_recubrimiento"] = "pintura_recubrimiento";
    FamiliaMateriaPrimaDto["terminacion_editorial"] = "terminacion_editorial";
    FamiliaMateriaPrimaDto["magnetico_fijacion"] = "magnetico_fijacion";
    FamiliaMateriaPrimaDto["pop_exhibidor"] = "pop_exhibidor";
    FamiliaMateriaPrimaDto["herraje_accesorio"] = "herraje_accesorio";
    FamiliaMateriaPrimaDto["adhesivo_tecnico"] = "adhesivo_tecnico";
    FamiliaMateriaPrimaDto["packing_instalacion"] = "packing_instalacion";
})(FamiliaMateriaPrimaDto || (exports.FamiliaMateriaPrimaDto = FamiliaMateriaPrimaDto = {}));
var SubfamiliaMateriaPrimaDto;
(function (SubfamiliaMateriaPrimaDto) {
    SubfamiliaMateriaPrimaDto["sustrato_hoja"] = "sustrato_hoja";
    SubfamiliaMateriaPrimaDto["sustrato_rollo_flexible"] = "sustrato_rollo_flexible";
    SubfamiliaMateriaPrimaDto["sustrato_rigido"] = "sustrato_rigido";
    SubfamiliaMateriaPrimaDto["objeto_promocional_base"] = "objeto_promocional_base";
    SubfamiliaMateriaPrimaDto["tinta_impresion"] = "tinta_impresion";
    SubfamiliaMateriaPrimaDto["toner"] = "toner";
    SubfamiliaMateriaPrimaDto["film_transferencia"] = "film_transferencia";
    SubfamiliaMateriaPrimaDto["papel_transferencia"] = "papel_transferencia";
    SubfamiliaMateriaPrimaDto["laminado_film"] = "laminado_film";
    SubfamiliaMateriaPrimaDto["quimico_acabado"] = "quimico_acabado";
    SubfamiliaMateriaPrimaDto["auxiliar_proceso"] = "auxiliar_proceso";
    SubfamiliaMateriaPrimaDto["polvo_dtf"] = "polvo_dtf";
    SubfamiliaMateriaPrimaDto["filamento_3d"] = "filamento_3d";
    SubfamiliaMateriaPrimaDto["resina_3d"] = "resina_3d";
    SubfamiliaMateriaPrimaDto["modulo_led_carteleria"] = "modulo_led_carteleria";
    SubfamiliaMateriaPrimaDto["fuente_alimentacion_led"] = "fuente_alimentacion_led";
    SubfamiliaMateriaPrimaDto["cableado_conectica"] = "cableado_conectica";
    SubfamiliaMateriaPrimaDto["controlador_led"] = "controlador_led";
    SubfamiliaMateriaPrimaDto["neon_flex_led"] = "neon_flex_led";
    SubfamiliaMateriaPrimaDto["accesorio_neon_led"] = "accesorio_neon_led";
    SubfamiliaMateriaPrimaDto["chapa_metalica"] = "chapa_metalica";
    SubfamiliaMateriaPrimaDto["perfil_estructural"] = "perfil_estructural";
    SubfamiliaMateriaPrimaDto["pintura_carteleria"] = "pintura_carteleria";
    SubfamiliaMateriaPrimaDto["primer_sellador"] = "primer_sellador";
    SubfamiliaMateriaPrimaDto["anillado_encuadernacion"] = "anillado_encuadernacion";
    SubfamiliaMateriaPrimaDto["tapa_encuadernacion"] = "tapa_encuadernacion";
    SubfamiliaMateriaPrimaDto["iman_ceramico_flexible"] = "iman_ceramico_flexible";
    SubfamiliaMateriaPrimaDto["fijacion_auxiliar"] = "fijacion_auxiliar";
    SubfamiliaMateriaPrimaDto["accesorio_exhibidor_carton"] = "accesorio_exhibidor_carton";
    SubfamiliaMateriaPrimaDto["accesorio_montaje_pop"] = "accesorio_montaje_pop";
    SubfamiliaMateriaPrimaDto["semielaborado_pop"] = "semielaborado_pop";
    SubfamiliaMateriaPrimaDto["argolla_llavero_accesorio"] = "argolla_llavero_accesorio";
    SubfamiliaMateriaPrimaDto["ojal_ojalillo_remache"] = "ojal_ojalillo_remache";
    SubfamiliaMateriaPrimaDto["portabanner_estructura"] = "portabanner_estructura";
    SubfamiliaMateriaPrimaDto["sistema_colgado_montaje"] = "sistema_colgado_montaje";
    SubfamiliaMateriaPrimaDto["perfil_bastidor_textil"] = "perfil_bastidor_textil";
    SubfamiliaMateriaPrimaDto["cinta_doble_faz_tecnica"] = "cinta_doble_faz_tecnica";
    SubfamiliaMateriaPrimaDto["adhesivo_liquido_estructural"] = "adhesivo_liquido_estructural";
    SubfamiliaMateriaPrimaDto["velcro_cierre_tecnico"] = "velcro_cierre_tecnico";
    SubfamiliaMateriaPrimaDto["embalaje_proteccion"] = "embalaje_proteccion";
    SubfamiliaMateriaPrimaDto["etiquetado_identificacion"] = "etiquetado_identificacion";
    SubfamiliaMateriaPrimaDto["consumible_instalacion"] = "consumible_instalacion";
})(SubfamiliaMateriaPrimaDto || (exports.SubfamiliaMateriaPrimaDto = SubfamiliaMateriaPrimaDto = {}));
var UnidadMateriaPrimaDto;
(function (UnidadMateriaPrimaDto) {
    UnidadMateriaPrimaDto["unidad"] = "unidad";
    UnidadMateriaPrimaDto["pack"] = "pack";
    UnidadMateriaPrimaDto["caja"] = "caja";
    UnidadMateriaPrimaDto["kit"] = "kit";
    UnidadMateriaPrimaDto["hoja"] = "hoja";
    UnidadMateriaPrimaDto["pliego"] = "pliego";
    UnidadMateriaPrimaDto["resma"] = "resma";
    UnidadMateriaPrimaDto["rollo"] = "rollo";
    UnidadMateriaPrimaDto["metro_lineal"] = "metro_lineal";
    UnidadMateriaPrimaDto["m2"] = "m2";
    UnidadMateriaPrimaDto["m3"] = "m3";
    UnidadMateriaPrimaDto["mm"] = "mm";
    UnidadMateriaPrimaDto["cm"] = "cm";
    UnidadMateriaPrimaDto["litro"] = "litro";
    UnidadMateriaPrimaDto["ml"] = "ml";
    UnidadMateriaPrimaDto["kg"] = "kg";
    UnidadMateriaPrimaDto["gramo"] = "gramo";
    UnidadMateriaPrimaDto["pieza"] = "pieza";
    UnidadMateriaPrimaDto["par"] = "par";
})(UnidadMateriaPrimaDto || (exports.UnidadMateriaPrimaDto = UnidadMateriaPrimaDto = {}));
class MateriaPrimaVarianteItemDto {
    sku;
    nombreVariante;
    activo;
    atributosVariante;
    unidadStock;
    unidadCompra;
    precioReferencia;
    moneda;
    proveedorReferenciaId;
}
exports.MateriaPrimaVarianteItemDto = MateriaPrimaVarianteItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "nombreVariante", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MateriaPrimaVarianteItemDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], MateriaPrimaVarianteItemDto.prototype, "atributosVariante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadMateriaPrimaDto),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "unidadStock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(UnidadMateriaPrimaDto),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "unidadCompra", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value === 'string') {
            const normalized = value.replace(',', '.').trim();
            if (!normalized) {
                return undefined;
            }
            return Number(normalized);
        }
        return value;
    }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MateriaPrimaVarianteItemDto.prototype, "precioReferencia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "moneda", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MateriaPrimaVarianteItemDto.prototype, "proveedorReferenciaId", void 0);
class UpsertMateriaPrimaDto {
    codigo;
    nombre;
    descripcion;
    familia;
    subfamilia;
    tipoTecnico;
    templateId;
    unidadStock;
    unidadCompra;
    esConsumible;
    esRepuesto;
    activo;
    atributosTecnicos;
    variantes;
}
exports.UpsertMateriaPrimaDto = UpsertMateriaPrimaDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(FamiliaMateriaPrimaDto),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "familia", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(SubfamiliaMateriaPrimaDto),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "subfamilia", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "tipoTecnico", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadMateriaPrimaDto),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "unidadStock", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadMateriaPrimaDto),
    __metadata("design:type", String)
], UpsertMateriaPrimaDto.prototype, "unidadCompra", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMateriaPrimaDto.prototype, "esConsumible", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMateriaPrimaDto.prototype, "esRepuesto", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMateriaPrimaDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertMateriaPrimaDto.prototype, "atributosTecnicos", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MateriaPrimaVarianteItemDto),
    __metadata("design:type", Array)
], UpsertMateriaPrimaDto.prototype, "variantes", void 0);
//# sourceMappingURL=upsert-materia-prima.dto.js.map