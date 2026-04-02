import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class BulkAssignEstacionPlantillasDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsUUID()
  estacionId?: string | null;
}
