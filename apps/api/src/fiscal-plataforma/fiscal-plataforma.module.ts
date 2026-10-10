import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecretosService } from '../integraciones/cripto/secretos.service';
import { CredencialesArcaService } from './credenciales-arca.service';

@Module({
  imports: [PrismaModule],
  providers: [SecretosService, CredencialesArcaService],
  exports: [CredencialesArcaService],
})
export class FiscalPlataformaModule {}
