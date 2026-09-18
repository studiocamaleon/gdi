import { errorOrientacionesDocumento } from './orientacion-pdf';

it('valida las orientaciones contra el original, sin invalidar documentos históricos', () => {
  const doc = { paginas: 2, paginasOriginales: 3 };
  expect(errorOrientacionesDocumento(doc)).toBeNull();
  expect(
    errorOrientacionesDocumento({
      ...doc,
      orientacionesPaginas: ['vertical', 'horizontal', 'vertical'],
    }),
  ).toBeNull();
  for (const orientacionesPaginas of [
    [],
    ['vertical', 'horizontal'],
    ['vertical', 'horizontal', 'diagonal'],
    'vertical',
  ]) {
    expect(
      errorOrientacionesDocumento({ ...doc, orientacionesPaginas }),
    ).toBeTruthy();
  }
});
