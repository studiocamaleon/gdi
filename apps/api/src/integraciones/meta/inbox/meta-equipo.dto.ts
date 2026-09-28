import {
  IsInt,
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
