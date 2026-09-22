import { CapacidadesEmpresaModule } from '../suscripciones/capacidades-empresa.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentosPdfService } from './documentos-pdf.service';

@Module({
  imports: [CapacidadesEmpresaModule, PrismaModule],
  providers: [DocumentosPdfService],
  exports: [DocumentosPdfService],
})
export class DocumentosPdfModule {}
