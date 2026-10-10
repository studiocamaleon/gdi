import { IsInt, IsObject, Max, Min } from 'class-validator';

export class GuardarPoliticaPreciosDto {
  /** Cero representa el estado inicial todavía no guardado. */
  @IsInt()
  @Min(0)
  @Max(2147483646)
  revision!: number;

  @IsObject()
  contenido!: object;
}
