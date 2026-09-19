import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogoCadService } from './catalogo-cad.service';
@Module({
  imports: [PrismaModule],
  providers: [CatalogoCadService],
  exports: [CatalogoCadService],
})
export class CatalogoCadModule {}
