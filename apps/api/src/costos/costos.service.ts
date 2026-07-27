import { Injectable } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { UpsertCentroCostoDto } from './dto/upsert-centro-costo.dto';
import { UpsertPlantaDto } from './dto/upsert-planta.dto';
import { UpsertCentroConfiguracionBaseDto } from './dto/upsert-centro-configuracion-base.dto';
import { ReplaceCentroLineasDto } from './dto/replace-centro-lineas.dto';
import { UpsertCentroCapacidadDto } from './dto/upsert-centro-capacidad.dto';
import { CostosCatalogoService } from './costos-catalogo.service';
import { CostosConfiguracionPeriodoService } from './costos-configuracion-periodo.service';
import { CostosTarifasService } from './costos-tarifas.service';

@Injectable()
export class CostosService {
  constructor(
    private readonly catalogo: CostosCatalogoService,
    private readonly configuracion: CostosConfiguracionPeriodoService,
    private readonly tarifas: CostosTarifasService,
  ) {}

  findPlantas(auth: CurrentAuth) {
    return this.catalogo.findPlantas(auth);
  }

  createPlanta(auth: CurrentAuth, payload: UpsertPlantaDto) {
    return this.catalogo.createPlanta(auth, payload);
  }

  updatePlanta(auth: CurrentAuth, id: string, payload: UpsertPlantaDto) {
    return this.catalogo.updatePlanta(auth, id, payload);
  }

  togglePlanta(auth: CurrentAuth, id: string) {
    return this.catalogo.togglePlanta(auth, id);
  }





  findCentros(auth: CurrentAuth) {
    return this.catalogo.findCentros(auth);
  }

  createCentro(auth: CurrentAuth, payload: UpsertCentroCostoDto) {
    return this.catalogo.createCentro(auth, payload);
  }

  updateCentro(auth: CurrentAuth, id: string, payload: UpsertCentroCostoDto) {
    return this.catalogo.updateCentro(auth, id, payload);
  }

  toggleCentro(auth: CurrentAuth, id: string) {
    return this.catalogo.toggleCentro(auth, id);
  }

  eliminarCentro(auth: CurrentAuth, id: string) {
    return this.catalogo.eliminarCentro(auth, id);
  }

  getCentroConfiguracion(auth: CurrentAuth, id: string, periodo: string) {
    return this.configuracion.getCentroConfiguracion(auth, id, periodo);
  }

  updateCentroConfiguracionBase(
    auth: CurrentAuth,
    id: string,
    payload: UpsertCentroConfiguracionBaseDto,
  ) {
    return this.configuracion.updateCentroConfiguracionBase(auth, id, payload);
  }




  getResumenCentros(auth: CurrentAuth, periodo: string) {
    return this.configuracion.getResumenCentros(auth, periodo);
  }

  replaceCentroLineas(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: ReplaceCentroLineasDto,
  ) {
    return this.configuracion.replaceCentroLineas(auth, id, periodo, payload);
  }

  upsertCentroCapacidad(
    auth: CurrentAuth,
    id: string,
    periodo: string,
    payload: UpsertCentroCapacidadDto,
  ) {
    return this.configuracion.upsertCentroCapacidad(auth, id, periodo, payload);
  }



  calcularTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    return this.tarifas.calcularTarifaCentro(auth, id, periodo);
  }

  publicarTarifaCentro(auth: CurrentAuth, id: string, periodo: string) {
    return this.tarifas.publicarTarifaCentro(auth, id, periodo);
  }

  getCentroTarifas(auth: CurrentAuth, id: string) {
    return this.tarifas.getCentroTarifas(auth, id);
  }
}
