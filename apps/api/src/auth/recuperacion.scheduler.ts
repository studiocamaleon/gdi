import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecuperacionService } from './recuperacion.service';
@Injectable()
export class RecuperacionScheduler {
  constructor(private readonly recuperacion: RecuperacionService) {}
  @Cron('*/30 * * * * *', { name: 'correos-recuperacion-acceso' })
  procesar() {
    return this.recuperacion.procesarPendientes();
  }
}
