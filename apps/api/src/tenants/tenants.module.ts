import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AuthModule, ArchivosModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
