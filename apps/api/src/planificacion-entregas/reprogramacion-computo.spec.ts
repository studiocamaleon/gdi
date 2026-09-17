import {
  calcularReprogramacion,
  cerrarReprogramaciones,
} from './reprogramacion-computo';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';
import { proponerEntregasPiloto } from '../eta/planificacion/prototipo-entregas';
import { buscarReprogramaciones } from './reprogramacion-escenarios';

afterEach(cerrarReprogramaciones);

it('el hilo de cálculo conserva exactamente fechas, balances, reservas y alternativas', async () => {
  const piloto = exhibidorControlado();
  piloto.porEntrega = true;
  const resultado = proponerEntregasPiloto(piloto);
  const busqueda = await buscarReprogramaciones({
    taller: piloto.taller,
    margen: piloto.margenDiasHabiles,
    alternativa: resultado.alternativas[0],
    operaciones: piloto.operaciones,
    excluidas: [],
  });
  expect(
    await calcularReprogramacion({
      tenantId: 'paridad',
      piloto,
      excluidas: [],
    }),
  ).toEqual({ resultado, busqueda });
}, 30_000);

it('una empresa no puede retener dos plazas y vuelve a calcular después de liberar la primera', async () => {
  const entrada = {
    tenantId: 'cupo',
    piloto: { ...exhibidorControlado(), porEntrega: true },
    excluidas: [],
  };
  const primero = calcularReprogramacion(entrada);
  await expect(calcularReprogramacion(entrada)).rejects.toMatchObject({
    status: 503,
  });
  await primero;
  await expect(calcularReprogramacion(entrada)).resolves.toHaveProperty(
    'resultado',
  );
}, 30_000);
