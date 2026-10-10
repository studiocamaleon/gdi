const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const api = createRequire(join(__dirname, '../apps/api/package.json'));

test('una subred IPv6 corta no permite falsificar la IP mediante X-Forwarded-For', () => {
  const proxyaddr = api('proxy-addr');
  const request = { socket: { remoteAddress: '203.0.113.8' }, headers: { 'x-forwarded-for': '192.0.2.9' } };
  assert.equal(proxyaddr(request, proxyaddr.compile('::ffff:10.0.0.0/8')), '203.0.113.8');
  assert.equal(proxyaddr(request, proxyaddr.compile('::/1')), '203.0.113.8');
  request.socket.remoteAddress = '10.0.0.8';
  assert.equal(proxyaddr(request, proxyaddr.compile('10.0.0.0/8')), '192.0.2.9');
});

test('un mapa de fuentes con offset enorme termina sin bloquear el proceso', () => {
  // El límite del subproceso protege el propio ensayo ante una regresión.
  const result = spawnSync(process.execPath, ['-e', `
    const {SourceMapConsumer, SourceNode} = require('source-map-js');
    require('node:assert/strict').throws(() => new SourceMapConsumer({version:3, sections:[{
      offset:{line:1000000000000,column:0},
      map:{version:3,sources:['ensayo.js'],names:[],mappings:'AAAA'}
    }]}), /Section offset line/);
    const map = new SourceMapConsumer({version:3,sources:['ensayo.js'],names:[],mappings:'AAAA'});
    require('node:assert/strict').equal(SourceNode.fromStringWithSourceMap('const ensayo = 1;',map).toString(),'const ensayo = 1;');
  `], { cwd: join(__dirname, '..'), timeout: 3000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('la compresión libera zlib cuando se cierra una respuesta incompleta', async () => {
  const http = require('node:http');
  const zlib = require('node:zlib');
  const descriptor = Object.getOwnPropertyDescriptor(zlib, 'createGzip');
  let stream;
  Object.defineProperty(zlib, 'createGzip', { ...descriptor, value: (...args) => (stream = descriptor.value(...args)) });
  const compression = api('compression')({ threshold: 0 });
  const server = http.createServer((req, res) => compression(req, res, () => {
    res.setHeader('content-type', 'text/plain');
    res.write('respuesta ficticia '.repeat(300));
    res.flush();
  }));
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await new Promise((resolve, reject) => {
      const req = http.get({ host:'127.0.0.1', port:server.address().port, headers:{'accept-encoding':'gzip'} }, res => {
        res.once('data', () => { res.destroy(); resolve(); });
      });
      req.once('error', reject);
    });
    for (let i=0;i<20 && !stream?.destroyed;i++) await new Promise(r=>setTimeout(r,10));
    assert.equal(stream?.destroyed, true);
  } finally {
    Object.defineProperty(zlib, 'createGzip', descriptor);
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('el cliente MCP rechaza credenciales guardadas para otro emisor OAuth', async () => {
  const { auth } = api('@modelcontextprotocol/sdk/client/auth.js');
  const calls = [];
  const provider = {
    clientMetadata:{},
    prepareTokenRequest:()=>new URLSearchParams({grant_type:"client_credentials"}),
    clientInformation:()=>({client_id:'cliente-ficticio',client_secret:'secreto-ficticio',issuer:'https://autorizacion.example.invalid'}),
    tokens:()=>({access_token:'token-ficticio',refresh_token:'refresh-ficticio',token_type:'Bearer',issuer:'https://autorizacion.example.invalid'}),
    discoveryState:()=>({authorizationServerUrl:'https://ajeno.example.invalid',resourceMetadata:{resource:'https://mcp.example.invalid'},authorizationServerMetadata:{issuer:'https://ajeno.example.invalid',authorization_endpoint:'https://ajeno.example.invalid/authorize',token_endpoint:'https://ajeno.example.invalid/token',response_types_supported:['code']}}),
  };
  await assert.rejects(auth(provider,{serverUrl:'https://mcp.example.invalid',fetchFn:async (...args)=>{calls.push(args);throw Error('No debe enviar credenciales');}}), /bound to authorization server/);
  assert.equal(calls.length, 0);
});
