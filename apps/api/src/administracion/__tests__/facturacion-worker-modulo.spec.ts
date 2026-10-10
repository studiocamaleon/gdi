import { Test } from '@nestjs/testing';
import { WorkerModule } from '../../workers/worker.module';
import { FacturacionWorkerModule } from '../facturacion-worker.module';
import { FacturacionLotesWorker } from '../facturacion-lotes.worker';

it.each([FacturacionWorkerModule, WorkerModule])(
  'construye %p sin servidor HTTP ni iniciar envíos',
  async (moduloWorker) => {
    const modulo = await Test.createTestingModule({
      imports: [moduloWorker],
    })
      .overrideProvider(FacturacionLotesWorker)
      .useValue({})
      .compile();
    await modulo.close();
  },
);
