import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @IsString()
  actual!: string;

  /**
   * Ocho es el mínimo del formulario de invitación: si acá pidiéramos más, la
   * clave que se elige al entrar no serviría para volver a entrar.
   */
  @IsString()
  @MinLength(8, {
    message: 'La clave nueva tiene que tener 8 o más caracteres.',
  })
  nueva!: string;
}
