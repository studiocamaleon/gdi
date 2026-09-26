import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  Equals,
  IsOptional,
} from 'class-validator';
export class EnviarTextoInboxDto {
  @IsUUID('4') clave!: string;
  @IsString()
  @Matches(
    /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i,
  )
  canalId!: string;
  @IsString() @MaxLength(4096) @Matches(/\S/u) texto!: string;
}

export class CatalogoPlantillasInboxDto {
  @IsString() @MaxLength(80) canalId!: string;
  @IsOptional() @IsString() @MaxLength(2048) despues?: string;
}
export class EnviarPlantillaInboxDto {
  @IsUUID('4') clave!: string;
  @IsString() @MaxLength(80) canalId!: string;
  @IsString() @Matches(/^\d{1,40}$/) plantillaId!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) version!: string;
  @IsOptional() @IsString() @MaxLength(2048) pagina?: string | null;
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  valores!: string[];
  @IsBoolean() @Equals(true) consentimientoConfirmado!: boolean;
}
