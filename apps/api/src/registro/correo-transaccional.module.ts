import { Module } from '@nestjs/common';
import { CorreoTransaccionalService } from './correo-transaccional.service';

@Module({
  providers: [CorreoTransaccionalService],
  exports: [CorreoTransaccionalService],
})
export class CorreoTransaccionalModule {}
