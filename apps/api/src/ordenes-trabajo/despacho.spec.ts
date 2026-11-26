import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { DespachoOrdenDto } from './dto/crear-orden-trabajo.dto';
import { leerDespacho } from './despacho';

describe('destino de una orden', () => {
  it.each([{}, { direccion: '', transporte: '' }, { direccion: '  ' }])(
    'acepta sólo la localidad con campos opcionales %j',
    (opcionales) => {
      const dto = Object.assign(new DespachoOrdenDto(), {
        localidad: '  El Calafate  ',
        ...opcionales,
      });
      expect(validateSync(dto)).toHaveLength(0);
      expect(leerDespacho(dto)).toEqual({
        localidad: 'El Calafate',
        direccion: '',
        transporte: '',
      });
    },
  );

  it('conserva una OT anterior con dirección y transporte', () => {
    const destino = {
      localidad: 'Río Gallegos',
      direccion: 'Sucursal de prueba',
      transporte: 'Transporte de prueba',
    };
    expect(leerDespacho(destino)).toEqual(destino);
  });

  it.each([{ localidad: '   ' }, { localidad: 'Destino', direccion: 4 }])(
    'rechaza un destino inválido %j',
    (datos) => {
      expect(
        validateSync(Object.assign(new DespachoOrdenDto(), datos)).length,
      ).toBeGreaterThan(0);
      expect(leerDespacho(datos)).toBeNull();
    },
  );
});
