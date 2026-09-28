import { formatoArchivoInbox } from './medios';
it('normaliza el MIME M4A que usa macOS y conserva el límite oficial', () => {
  expect(formatoArchivoInbox('Tono.m4a', 'audio/x-m4a')).toMatchObject({
    mime: 'audio/mp4',
    tipo: 'audio',
    max: 16_000_000,
  });
});
it('no acepta un MIME que contradice la extensión ni formatos ajenos a Meta', () => {
  expect(formatoArchivoInbox('Foto.png', 'application/pdf')).toBeNull();
  expect(
    formatoArchivoInbox('arte.psd', 'application/octet-stream'),
  ).toBeNull();
});
