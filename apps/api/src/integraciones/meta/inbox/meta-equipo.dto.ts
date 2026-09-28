import {
  IsInt,
  IsIn,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
export class AccionEquipoInboxDto {
  @IsUUID('4') clave!: string;
  @IsString() @MinLength(1) @MaxLength(200) canalId!: string;
}
export class NotaInboxDto extends AccionEquipoInboxDto {
  @IsString() @MinLength(1) @MaxLength(4000) @Matches(/\S/) texto!: string;
}
export class AsignarInboxDto extends AccionEquipoInboxDto {
  @IsOptional() @IsUUID('4') responsableId!: string | null;
  @IsInt() @Min(0) version!: number;
}

export class EstadoInboxDto extends AccionEquipoInboxDto {
  @IsIn(['ACTIVA', 'RESUELTA']) estado!: 'ACTIVA' | 'RESUELTA';
  @IsInt() @Min(0) version!: number;
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
}
export class LecturaInboxDto {
  @IsString() @MinLength(1) @MaxLength(200) canalId!: string;
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
}
