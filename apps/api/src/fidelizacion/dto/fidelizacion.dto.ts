import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ActualizarFidelizacionDto {
  @IsOptional() @IsBoolean() acumulacionActiva?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) porcentajeMargen?: number;
  @IsOptional() @IsNumber() @Min(0.01) montoBase?: number;
  @IsOptional() @IsInt() @Min(1) puntosBase?: number;
}

export class AjustarPuntosDto {
  @IsIn(['CREDITO', 'DEBITO']) tipo: 'CREDITO' | 'DEBITO';
  @IsInt() @Min(1) puntos: number;
  @IsString() @MinLength(3) @MaxLength(500) motivo: string;
}

export class SimularFidelizacionDto {
  @IsNumber() margen: number;
  @IsNumber() @Min(0) total: number;
  @IsOptional() @IsInt() @Min(0) canjePuntos?: number;
}
