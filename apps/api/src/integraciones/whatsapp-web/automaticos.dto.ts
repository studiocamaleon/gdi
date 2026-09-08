import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class DispositivoWebDto {
  @IsUUID() tenantId!: string;
  @IsUUID() dispositivoId!: string;
  @Matches(/^[1-9]\d{7,14}$/) numero!: string;
}
export class ConfigurarWebDto extends DispositivoWebDto {
  @IsIn(['WHATSAPP_WEB', 'PAUSADO', 'WATI']) modo!:
    | 'WHATSAPP_WEB'
    | 'PAUSADO'
    | 'WATI';
}
export class ReservaWebDto extends DispositivoWebDto {
  @IsUUID() token!: string;
}
export class ResultadoWebDto extends ReservaWebDto {
  @IsIn(['enviada', 'incierta', 'no_enviada']) estado!:
    | 'enviada'
    | 'incierta'
    | 'no_enviada';
  @IsOptional() @IsString() @MaxLength(200) mensajeId?: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}
