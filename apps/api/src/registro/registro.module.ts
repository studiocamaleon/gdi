import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProvisionamientoModule } from '../provisionamiento/provisionamiento.module';
import { CorreoTransaccionalModule } from './correo-transaccional.module';
import { RegistroController } from './registro.controller';
import { RegistroService } from './registro.service';

@Module({
  imports: [AuthModule, ProvisionamientoModule, CorreoTransaccionalModule],
  controllers: [RegistroController],
  providers: [RegistroService],
})
export class RegistroModule {}
