import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Umbrales de las alertas del Panel. Todos opcionales (upsert parcial). */
export class ActualizarUmbralesDto {
  @IsOptional() @IsInt() @Min(1) @Max(365)
  diasClienteDormido?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  deudaVencidaPctMax?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  concentracionPctMax?: number;

  @IsOptional() @IsInt() @Min(1) @Max(36)
  mesesTarifaVieja?: number;

  @IsOptional() @IsInt() @Min(100) @Max(500)
  razonTiemposPctMax?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  utilizacionPctMin?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  margenPctMin?: number;
}
