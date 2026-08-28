import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PAISES_LATAM } from '../../common/paises';

export class IniciarRegistroDto {
  @IsString()
  @Length(2, 100)
  nombreCompleto!: string;

  @IsString()
  @Length(2, 120)
  empresaNombre!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsIn(['taller', 'estudio'])
  planCodigo!: string;

  @IsString()
  @IsIn(PAISES_LATAM as unknown as string[], {
    message: 'El país seleccionado no está soportado.',
  })
  paisCodigo!: string;

  @IsString()
  @MaxLength(64)
  zonaHoraria!: string;

  @IsBoolean()
  aceptaTerminos!: boolean;

  @IsOptional()
  @IsBoolean()
  aceptaMarketing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  origen?: string;

  @IsOptional()
  @IsObject()
  atribucion?: Record<string, string>;
}
