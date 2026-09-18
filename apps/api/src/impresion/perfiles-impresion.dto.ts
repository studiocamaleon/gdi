import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class DestinoImpresionDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/)
  host!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  impresora!: string;
  @IsUUID() maquinaId!: string;
  @IsBoolean() activo!: boolean;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class BandejaImpresionDto {
  @IsString() @MinLength(1) @MaxLength(100) nombre!: string;
  // Identificador literal del controlador, sin comandos.
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\x00-\x1f\x7f]+$/)
  codigo!: string;
}
export class PerfilImpresionDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsUUID() bandejaId!: string;
  @IsUUID() papelMateriaPrimaId!: string;
  @IsInt() @Min(1) @Max(1000) gramaje!: number;
  @IsIn(['A4']) tamano!: string;
  @IsIn(['BN', 'COLOR']) color!: string;
  @IsIn([1, 2]) faz!: number;
  @IsIn(['AUTOMATICO', 'PREPARACION']) modo!: string;
  @IsBoolean() probado!: boolean;
  @IsBoolean() activo!: boolean;
  @IsInt() @Min(1) @Max(99) prioridad!: number;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class PreparacionBandejaDto {
  @IsOptional() @IsUUID() perfilId?: string;
  @IsInt() @Min(1) version!: number;
}

export class ConfiguracionCadDto {
  @IsInt() @Min(1) version!: number;
  @IsBoolean() habilitado!: boolean;
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(300)
  @Max(914.4)
  anchoRolloMm!: number;
  @IsString()
  @MaxLength(100)
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\x00-\x1f\x7f]*$/)
  origenPapel!: string;
  @IsBoolean() usarOrigenPredeterminado!: boolean;
}

export class PruebaCadDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(['A1', 'PERSONALIZADO']) formato!: 'A1' | 'PERSONALIZADO';
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['BN', 'COLOR'])
  color?: 'BN' | 'COLOR';
}
