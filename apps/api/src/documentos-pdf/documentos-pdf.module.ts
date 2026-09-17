import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentosPdfService } from './documentos-pdf.service';

@Module({
  imports: [PrismaModule],
  providers: [DocumentosPdfService],
  exports: [DocumentosPdfService],
})
export class DocumentosPdfModule {}
