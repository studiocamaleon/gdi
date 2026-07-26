import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { DatosEmpresaModule } from './datos-empresa.module';

@Module({
  imports: [AuthModule, ArchivosModule, DatosEmpresaModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
