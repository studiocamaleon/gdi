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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostosController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const costos_service_1 = require("./costos.service");
const upsert_area_costo_dto_1 = require("./dto/upsert-area-costo.dto");
const upsert_centro_costo_dto_1 = require("./dto/upsert-centro-costo.dto");
const upsert_planta_dto_1 = require("./dto/upsert-planta.dto");
const upsert_centro_configuracion_base_dto_1 = require("./dto/upsert-centro-configuracion-base.dto");
const replace_centro_recursos_dto_1 = require("./dto/replace-centro-recursos.dto");
const replace_centro_componentes_costo_dto_1 = require("./dto/replace-centro-componentes-costo.dto");
const upsert_centro_capacidad_dto_1 = require("./dto/upsert-centro-capacidad.dto");
const upsert_centro_recursos_maquinaria_dto_1 = require("./dto/upsert-centro-recursos-maquinaria.dto");
let CostosController = class CostosController {
    costosService;
    constructor(costosService) {
        this.costosService = costosService;
    }
    findPlantas(auth) {
        return this.costosService.findPlantas(auth);
    }
    createPlanta(auth, payload) {
        return this.costosService.createPlanta(auth, payload);
    }
    updatePlanta(auth, id, payload) {
        return this.costosService.updatePlanta(auth, id, payload);
    }
    togglePlanta(auth, id) {
        return this.costosService.togglePlanta(auth, id);
    }
    findAreas(auth) {
        return this.costosService.findAreas(auth);
    }
    createArea(auth, payload) {
        return this.costosService.createArea(auth, payload);
    }
    updateArea(auth, id, payload) {
        return this.costosService.updateArea(auth, id, payload);
    }
    toggleArea(auth, id) {
        return this.costosService.toggleArea(auth, id);
    }
    findCentros(auth) {
        return this.costosService.findCentros(auth);
    }
    createCentro(auth, payload) {
        return this.costosService.createCentro(auth, payload);
    }
    updateCentro(auth, id, payload) {
        return this.costosService.updateCentro(auth, id, payload);
    }
    toggleCentro(auth, id) {
        return this.costosService.toggleCentro(auth, id);
    }
    getCentroConfiguracion(auth, id, periodo) {
        return this.costosService.getCentroConfiguracion(auth, id, periodo);
    }
    updateCentroConfiguracionBase(auth, id, payload) {
        return this.costosService.updateCentroConfiguracionBase(auth, id, payload);
    }
    replaceCentroRecursos(auth, id, periodo, payload) {
        return this.costosService.replaceCentroRecursos(auth, id, periodo, payload);
    }
    replaceCentroComponentesCosto(auth, id, periodo, payload) {
        return this.costosService.replaceCentroComponentesCosto(auth, id, periodo, payload);
    }
    upsertCentroCapacidad(auth, id, periodo, payload) {
        return this.costosService.upsertCentroCapacidad(auth, id, periodo, payload);
    }
    getCentroRecursosMaquinaria(auth, id, periodo) {
        return this.costosService.getCentroRecursosMaquinaria(auth, id, periodo);
    }
    upsertCentroRecursosMaquinaria(auth, id, periodo, payload) {
        return this.costosService.upsertCentroRecursosMaquinaria(auth, id, periodo, payload);
    }
    calcularTarifaCentro(auth, id, periodo) {
        return this.costosService.calcularTarifaCentro(auth, id, periodo);
    }
    publicarTarifaCentro(auth, id, periodo) {
        return this.costosService.publicarTarifaCentro(auth, id, periodo);
    }
    getCentroTarifas(auth, id) {
        return this.costosService.getCentroTarifas(auth, id);
    }
};
exports.CostosController = CostosController;
__decorate([
    (0, common_1.Get)('plantas'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "findPlantas", null);
__decorate([
    (0, common_1.Post)('plantas'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_planta_dto_1.UpsertPlantaDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "createPlanta", null);
__decorate([
    (0, common_1.Put)('plantas/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_planta_dto_1.UpsertPlantaDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "updatePlanta", null);
__decorate([
    (0, common_1.Patch)('plantas/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "togglePlanta", null);
__decorate([
    (0, common_1.Get)('areas'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "findAreas", null);
__decorate([
    (0, common_1.Post)('areas'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_area_costo_dto_1.UpsertAreaCostoDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "createArea", null);
__decorate([
    (0, common_1.Put)('areas/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_area_costo_dto_1.UpsertAreaCostoDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "updateArea", null);
__decorate([
    (0, common_1.Patch)('areas/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "toggleArea", null);
__decorate([
    (0, common_1.Get)('centros-costo'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "findCentros", null);
__decorate([
    (0, common_1.Post)('centros-costo'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_centro_costo_dto_1.UpsertCentroCostoDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "createCentro", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_centro_costo_dto_1.UpsertCentroCostoDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "updateCentro", null);
__decorate([
    (0, common_1.Patch)('centros-costo/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "toggleCentro", null);
__decorate([
    (0, common_1.Get)('centros-costo/:id/configuracion'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "getCentroConfiguracion", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id/configuracion-base'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_centro_configuracion_base_dto_1.UpsertCentroConfiguracionBaseDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "updateCentroConfiguracionBase", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id/recursos'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, replace_centro_recursos_dto_1.ReplaceCentroRecursosDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "replaceCentroRecursos", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id/componentes-costo'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, replace_centro_componentes_costo_dto_1.ReplaceCentroComponentesCostoDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "replaceCentroComponentesCosto", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id/capacidad'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, upsert_centro_capacidad_dto_1.UpsertCentroCapacidadDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "upsertCentroCapacidad", null);
__decorate([
    (0, common_1.Get)('centros-costo/:id/recursos-maquinaria'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "getCentroRecursosMaquinaria", null);
__decorate([
    (0, common_1.Put)('centros-costo/:id/recursos-maquinaria'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, upsert_centro_recursos_maquinaria_dto_1.UpsertCentroRecursosMaquinariaDto]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "upsertCentroRecursosMaquinaria", null);
__decorate([
    (0, common_1.Post)('centros-costo/:id/calcular-tarifa'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "calcularTarifaCentro", null);
__decorate([
    (0, common_1.Post)('centros-costo/:id/publicar-tarifa'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "publicarTarifaCentro", null);
__decorate([
    (0, common_1.Get)('centros-costo/:id/tarifas'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CostosController.prototype, "getCentroTarifas", null);
exports.CostosController = CostosController = __decorate([
    (0, common_1.Controller)('costos'),
    __metadata("design:paramtypes", [costos_service_1.CostosService])
], CostosController);
//# sourceMappingURL=costos.controller.js.map