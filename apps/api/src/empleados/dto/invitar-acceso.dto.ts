import { IsEmail, IsEnum } from 'class-validator';
import { RolSistemaDto } from './upsert-empleado.dto';

export class InvitarAccesoDto {
  @IsEmail()
  email: string;

  @IsEnum(RolSistemaDto)
  rolSistema: RolSistemaDto;
}
