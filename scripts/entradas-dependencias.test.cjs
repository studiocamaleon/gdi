const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { PassThrough } = require('node:stream');
const { deflateSync } = require('node:zlib');
const web = createRequire(join(process.cwd(), 'package.json'));
const api = createRequire(join(process.cwd(), 'apps/api/package.json'));

test('Zod rechaza la lista por su límite antes de validar cada elemento', () => {
  const z = api('zod');
  let visitas = 0;
  const lista = z.array(z.string().superRefine(() => { visitas++; })).max(2);
  assert.equal(lista.safeParse(Array(12).fill('ficticio')).success, false);
  assert.equal(visitas, 0);
  assert.equal(lista.safeParse(['válido']).success, true);
});

test('el saneamiento quita una plantilla dividida entre nodos de un shadow root', () => {
  const { JSDOM } = web('jsdom');
  const ventana = new JSDOM('').window;
  try {
    const host = ventana.document.createElement('div');
    const sombra = host.attachShadow({ mode: 'open' });
    sombra.append('$', ventana.document.createElement('object'), '{prueba}');
    web('dompurify')(ventana).sanitize(host, { IN_PLACE: true, SAFE_FOR_TEMPLATES: true });
    assert.doesNotMatch(sombra.textContent, /\$\{prueba\}/);
  } finally { ventana.close(); }
});

test('el analizador JSON termina una entrada comprimida con bytes sobrantes y sigue atendiendo', { timeout: 5000 }, async () => {
  const json = api('express').json();
  const contenido = { empresa: 'ficticia' };
  const inicio = Buffer.concat([deflateSync(JSON.stringify(contenido)), Buffer.alloc(1)]);
  const sobrante = Buffer.alloc(128);
  let cliente, decoderAlFinalizar, procesabaSobrantes;
  const server = http.createServer((req, res) => {
    const pipe = req.pipe;
    req.pipe = function (destino, ...opciones) {
      decoderAlFinalizar = destino;
      return pipe.call(this, destino, ...opciones);
    };
    json(req, res, err => {
      if (err) { res.writeHead(400).end(); return; }
      procesabaSobrantes = !decoderAlFinalizar.destroyed;
      req.once('end', () => res.end(JSON.stringify(req.body)));
      cliente.end(sobrante);
    });
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    const dato = await new Promise((resolve, reject) => {
      cliente = http.request({ host: '127.0.0.1', port, method: 'POST', agent: false,
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'deflate',
          'Content-Length': inicio.length + sobrante.length } }, async res => {
        try { const trozos = []; for await (const t of res) trozos.push(t); resolve(JSON.parse(Buffer.concat(trozos))); }
        catch (error) { reject(error); }
      });
      cliente.once('error', reject);
      cliente.setTimeout(2000, () => cliente.destroy(new Error('La lectura no terminó.')));
      cliente.write(inicio);
    });
    assert.deepEqual(dato, contenido);
    assert.equal(procesabaSobrantes, false);
  } finally {
    cliente?.destroy();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Multer conserva el rechazo de un formulario truncado si otro filtro responde tarde', { timeout: 4000 }, async () => {
  const req = new PassThrough();
  const borde = 'GrafoPrueba';
  const cuerpo = ['uno', 'dos'].map(campo => [
    '--' + borde, 'Content-Disposition: form-data; name="' + campo + '"; filename="muestra.txt"',
    'Content-Type: text/plain', '', 'muestra',
  ].join('\r\n')).join('\r\n');
  req.headers = { 'content-type': 'multipart/form-data; boundary=' + borde, 'content-length': Buffer.byteLength(cuerpo) };
  const rechazo = new Error('Archivo ficticio rechazado.');
  let pendiente, parser;
  const middleware = api('multer')({ fileHwm: 1,
    streamHandler: (entrada, lector) => { parser = lector; entrada.pipe(lector); },
    fileFilter: (entrada, archivo, continuar) => {
      if (archivo.fieldname === 'uno') pendiente = continuar;
      else entrada.once('end', () => setImmediate(() => continuar(rechazo)));
    },
  }).any();
  await new Promise((resolve, reject) => {
    middleware(req, null, error => {
      if (error !== rechazo) { reject(error ?? new Error('Faltó el rechazo.')); return; }
      setImmediate(() => {
        parser.once('close', resolve);
        pendiente(null, true);
      });
    });
    req.end(cuerpo);
  });
  assert.deepEqual(req.files, []);
});
