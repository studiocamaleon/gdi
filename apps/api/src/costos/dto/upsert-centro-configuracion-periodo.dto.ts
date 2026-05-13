import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { UpsertCentroConfiguracionBaseDto } from './upsert-centro-configuracion-base.dto';
import { ReplaceCentroRecursosDto } from './replace-centro-recursos.dto';
import { UpsertCentroRecursosMaquinariaDto } from './upsert-centro-recursos-maquinaria.dto';
import { ReplaceCentroComponentesCostoDto } from './replace-centro-componentes-costo.dto';
import { UpsertCentroCapacidadDto } from './upsert-centro-capacidad.dto';

export class UpsertCentroConfiguracionPeriodoDto {
  @ValidateNested()
  @Type(() => UpsertCentroConfiguracionBaseDto)
  centro: UpsertCentroConfiguracionBaseDto;

  @ValidateNested()
  @Type(() => ReplaceCentroRecursosDto)
  recursos: ReplaceCentroRecursosDto;

  @ValidateNested()
  @Type(() => UpsertCentroRecursosMaquinariaDto)
  recursosMaquinaria: UpsertCentroRecursosMaquinariaDto;

  @ValidateNested()
  @Type(() => ReplaceCentroComponentesCostoDto)
  componentesCosto: ReplaceCentroComponentesCostoDto;

  @ValidateNested()
  @Type(() => UpsertCentroCapacidadDto)
  capacidad: UpsertCentroCapacidadDto;
}
