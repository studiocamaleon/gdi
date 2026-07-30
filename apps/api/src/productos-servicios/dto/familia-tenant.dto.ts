/**
 * DTOs del CRUD de familias tenant (pasos componibles, Etapa C).
 *
 * Acá sólo vive la validación de FORMATO que exige el ValidationPipe global
 * (whitelist). La validación SEMÁNTICA —vocabularios, coherencia entre
 * ejes— es de validarDefinicionFamiliaTenant, la única puerta de escritura.
 */
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';


/** E.1 — defaults declarados del paso (FamiliaPasoDefaults). null limpia. */
export class DefaultsFamiliaPasoDto {
  @IsOptional()
  @IsString()
  centroCostoId?: string | null;

  @IsOptional()
  @IsNumber()
  productividadHora?: number | null;

  @IsOptional()
  @IsNumber()
  tiempoFijoMin?: number | null;

  @IsOptional()
  @IsNumber()
  demasiaMm?: number | null;

  @IsOptional()
  @IsNumber()
  solapePanelMm?: number | null;

  /** E.2 — tercerización declarada; la grilla sigue por producto. */
  @IsOptional()
  @IsBoolean()
  tercerizado?: boolean | null;

  @IsOptional()
  @IsString()
  proveedorId?: string | null;

  @IsOptional()
  @IsString()
  fuenteCostoTercerizado?: string | null;

  @IsOptional()
  @IsNumber()
  plazoProveedorDias?: number | null;
}

export class SlotFamiliaTenantDto {
  @IsString()
  codigo!: string;

  @IsString()
  nombre!: string;

  @IsString()
  tipo!: string;

  @IsBoolean()
  requerido!: boolean;
}

export class CrearFamiliaTenantDto {
  @IsString()
  @MaxLength(80)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsString()
  categoria!: string;

  @IsArray()
  @IsString({ each: true })
  relacionMaquina!: string[];

  @IsArray()
  @IsString({ each: true })
  modosTiempo!: string[];

  @IsArray()
  @IsString({ each: true })
  mecanismosCantidad!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modosActivacion?: string[];

  @IsOptional()
  @IsString()
  modoActivacionDefault?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotFamiliaTenantDto)
  slots?: SlotFamiliaTenantDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  multiplicadores?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plantillasCompatibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tiposPerfilCompatibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inputsRequeridos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputsCanonicos?: string[];

  @IsOptional()
  @IsString()
  modoRegistro?: string;

  @IsOptional()
  @IsString()
  presetOrigen?: string;

  /** B.3.4 — superficie de acomodo; null = el paso no acomoda piezas. */
  @IsOptional()
  @IsObject()
  nestingConfig?: { superficie?: string | null } | null;


  /** E.1 — defaults declarados del paso; se upsertea junto con la familia. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultsFamiliaPasoDto)
  defaults?: DefaultsFamiliaPasoDto | null;
  /** Estación donde se hace el paso (§8.4). */
  @IsOptional()
  @IsString()
  estacionId?: string | null;
}

/** Preview de costeo del wizard (Etapa D): tiempo + tarifa real del centro. */
export class PreviewCosteoFamiliaDto {
  @IsNumber()
  cantidad!: number;

  @IsString()
  modoTiempo!: string;

  @IsOptional()
  @IsNumber()
  tiempoFijoMin?: number;

  @IsOptional()
  @IsNumber()
  productividadPorHora?: number;

  @IsOptional()
  @IsNumber()
  dotacion?: number;

  @IsString()
  centroCostoId!: string;
}

/** PATCH: mismo shape, todo opcional, más el toggle de inhabilitación. El
 *  service valida el MERGE contra la fila existente. */
export class ActualizarFamiliaTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relacionMaquina?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modosTiempo?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mecanismosCantidad?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modosActivacion?: string[];

  @IsOptional()
  @IsString()
  modoActivacionDefault?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotFamiliaTenantDto)
  slots?: SlotFamiliaTenantDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  multiplicadores?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plantillasCompatibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tiposPerfilCompatibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inputsRequeridos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputsCanonicos?: string[];

  @IsOptional()
  @IsString()
  modoRegistro?: string;

  @IsOptional()
  @IsString()
  presetOrigen?: string;

  /** B.3.4 — superficie de acomodo; null = el paso no acomoda piezas. */
  @IsOptional()
  @IsObject()
  nestingConfig?: { superficie?: string | null } | null;

  @IsOptional()
  @IsString()
  estacionId?: string | null;

  /** E.1 — defaults declarados del paso; se upsertea junto con la familia. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultsFamiliaPasoDto)
  defaults?: DefaultsFamiliaPasoDto | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
