import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvisionamientoModule } from '../provisionamiento/provisionamiento.module';
import { CorreoTransaccionalService } from './correo-transaccional.service';
import { RegistroController } from './registro.controller';
import { RegistroService } from './registro.service';

@Module({
  imports: [AuthModule, ProvisionamientoModule],
  controllers: [RegistroController],
  providers: [RegistroService, CorreoTransaccionalService],
})
export class RegistroModule {}
