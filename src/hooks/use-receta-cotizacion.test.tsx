// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useRecetaCotizacion } from './use-receta-cotizacion';
import { apiRequest } from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }));

it('el cotizador obtiene los componentes mediante la consulta comercial, sin exigir editar catálogo', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(apiRequest).mockResolvedValue([{ rutaAlternativa: { id: 'ruta' }, revisionPublicada: {
    componentes: [{ id: 'pieza', codigo: 'cara', nombre: 'Cara frontal' }],
  } }]);
  const container = document.createElement('div');
  const root = createRoot(container);
  function Panel() {
    const revision = useRecetaCotizacion('producto', 'ruta');
    return <span>{revision?.componentes[0]?.nombre}</span>;
  }
  try {
    await act(async () => root.render(<Panel />));
    expect(apiRequest).toHaveBeenCalledWith('/productos-servicios/cotizacion-productos/producto/recetas');
    expect(container.textContent).toBe('Cara frontal');
  } finally { await act(async () => root.unmount()); }
});
