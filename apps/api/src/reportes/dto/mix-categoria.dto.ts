import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RangoReporteDto } from './rango-reporte.dto';

/** Drill del mix evolutivo: rango + la categoría comercial a abrir. */
export class MixCategoriaDto extends RangoReporteDto {
  @IsString()
  @IsNotEmpty({ message: '"categoria" es obligatoria.' })
  @MaxLength(120)
  categoria!: string;
}
