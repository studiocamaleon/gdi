import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class WhatsappContextoDto {
  @IsString()
  @Length(8, 40)
  @Matches(/^\+[\d\s().-]+$/, {
    message: 'Ingresá un teléfono completo con + y código de país.',
  })
  telefono!: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
