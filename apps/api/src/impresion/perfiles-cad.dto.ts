import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PerfilCadDto {
  @IsUUID() destinoId!: string;
  @IsInt() @Min(1) versionDestino!: number;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsUUID() rutaAlternativaId!: string;
  @IsUUID() materialVarianteId!: string;
  @IsInt() @Min(1) @Max(1000) gramaje!: number;
  @IsIn(['BN', 'COLOR']) color!: 'BN' | 'COLOR';
  @IsIn(['AUTOMATICO', 'PREPARACION']) modo!: string;
  @IsBoolean() activo!: boolean;
  @IsBoolean() probado!: boolean;
  @IsInt() @Min(1) @Max(99) prioridad!: number;
}

export class SimularPerfilCadDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(1) versionDestino!: number;
  @IsIn(['A1', 'PERSONALIZADO']) formato!: 'A1' | 'PERSONALIZADO';
}
