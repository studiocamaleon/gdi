import { ClientesService } from '../clientes.service';
import type { UpsertClienteDto } from '../dto/upsert-cliente.dto';
import type { CurrentAuth } from '../../auth/auth.types';

describe('persistencia del teléfono de clientes', () => {
  const create = jest.fn(async ({ data }) => ({
    ...data,
    id: 'cliente',
    updatedAt: new Date(),
    contactos: [],
    direcciones: [],
    eventos: [],
  }));
  const service = new ClientesService(
    { cliente: { create } } as never,
    { exigir: jest.fn() } as never,
  );
  const auth = {
    tenantId: 'tenant',
    userId: 'user',
    email: 'qa@example.invalid',
  } as CurrentAuth;
  const payload = (): UpsertClienteDto => ({
    nombre: 'Cliente ficticio',
    email: '',
    pais: 'AR',
    telefonoCodigo: '54',
    telefonoNumero: '+54 9 341 555-1840',
    contactos: [],
    direcciones: [],
  });
  beforeEach(() => create.mockClear());
  it('guarda país y número una sola vez, aun con formato internacional pegado', async () => {
    await service.create(auth, payload());
    expect(create.mock.calls[0][0].data).toMatchObject({
      telefonoCodigo: '54',
      telefonoNumero: '93415551840',
    });
  });
  it('rechaza un número inválido antes de escribir en la base', async () => {
    await expect(
      service.create(auth, { ...payload(), telefonoNumero: '123' }),
    ).rejects.toThrow('Revisá el teléfono');
    expect(create).not.toHaveBeenCalled();
  });
  it('valida también los teléfonos de los contactos adicionales', async () => {
    await expect(
      service.create(auth, {
        ...payload(),
        contactos: [
          {
            nombre: 'Contacto ficticio',
            principal: true,
            telefonoCodigo: '54',
            telefonoNumero: '123',
          },
        ],
      }),
    ).rejects.toThrow('Teléfono del contacto');
    expect(create).not.toHaveBeenCalled();
  });
});
