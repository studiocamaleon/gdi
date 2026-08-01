/**
 * Verifica que el grafo de DI del CentroCopiadoModule resuelve (controller +
 * service + sus dependencias del motor y prisma). Compila el módulo sin levantar
 * HTTP ni el scheduler: prueba el wiring, no la ejecución.
 */
import { Test } from '@nestjs/testing';
import { CentroCopiadoModule } from '../centro-copiado.module';
import { CentroCopiadoController } from '../centro-copiado.controller';
import { CentroCopiadoService } from '../centro-copiado.service';

it('el módulo resuelve controller y service', async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [CentroCopiadoModule],
  }).compile();

  expect(moduleRef.get(CentroCopiadoController)).toBeInstanceOf(
    CentroCopiadoController,
  );
  expect(moduleRef.get(CentroCopiadoService)).toBeInstanceOf(
    CentroCopiadoService,
  );

  await moduleRef.close();
});
