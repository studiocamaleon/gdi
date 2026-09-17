import { Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EditarPerfilDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  nombreCompleto: string;
}

export class FotoPerfilDto {
  @IsString()
  @MaxLength(700000)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  contenido: string;
}

export class ClavePerfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password: string;
}

export class ConfirmarMfaDto {
  @IsUUID()
  setupId: string;

  @IsString()
  @Matches(/^\d{6}$/)
  codigo: string;
}

export class GestionMfaDto extends ClavePerfilDto {
  @IsString()
  @Length(6, 32)
  codigo: string;
}

export class VerificarMfaDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  challengeToken: string;

  @IsString()
  @Length(6, 32)
  codigo: string;
}
