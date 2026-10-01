/** Presupuesto de datos serializados; no equivale a toda la RAM de Redis/Node.
 * Es caché prescindible: nunca usar para entradas de trabajos aceptados. */
export const PRESUPUESTO_CACHE_VECTORIAL = {
  entradaBytes: 2 * 1024 * 1024,
  localBytes: 16 * 1024 * 1024,
  localEmpresaBytes: 4 * 1024 * 1024,
  localEntradas: 100,
  empresaEntradas: 32,
  compartidoBytes: 32 * 1024 * 1024,
  compartidoEmpresaBytes: 8 * 1024 * 1024,
  compartidoEntradas: 128,
} as const;

// Tres claves fijas: no se crean índices por cada empresa. El hash tag conserva
// el mismo slot si en el futuro se usa un Redis particionado.
export const CLAVES_CACHE_VECTORIAL = [
  'grafo:geometry:analysis:{v4}:datos',
  'grafo:geometry:analysis:{v4}:uso',
  'grafo:geometry:analysis:{v4}:vencimiento',
] as const;

/** Cuenta antes de serializar cada valor; evita construir un JSON enorme para
 * descubrir después que no entra. La cuenta es conservadora (incluye separadores).
 * No compacta referencias: el JSON leído tampoco puede expandirse como un DAG. */
export function serializarEntradaCache(valor: unknown): string | null {
  let restante: number = PRESUPUESTO_CACHE_VECTORIAL.entradaBytes;
  const limite = new Error('Entrada demasiado grande para caché.');
  try {
    return JSON.stringify(valor, (clave, dato: unknown) => {
      restante -= clave.length * 6 + 4;
      if (typeof dato === 'string') {
        if (dato.length > restante) throw limite;
        restante -= Buffer.byteLength(JSON.stringify(dato), 'utf8');
      } else if (dato === null || typeof dato !== 'object') {
        restante -= 24;
      } else restante -= 2;
      if (restante < 0) throw limite;
      return dato;
    });
  } catch (error) {
    if (error === limite) return null;
    throw error;
  }
}

/** Todo el cupo se aplica dentro de una única operación, entre réplicas.
 * Se miden los valores reales del hash (HSTRLEN); no hay contadores que puedan
 * perder una actualización. Sólo recorre hasta 128 entradas de esta caché. */
export const OPERAR_CACHE_VECTORIAL = `
local datos, uso, vencimiento = KEYS[1], KEYS[2], KEYS[3]
local reloj = redis.call('TIME')
local ahora = tonumber(reloj[1]) * 1000 + tonumber(reloj[2]) / 1000
local campo = ARGV[2]
local function borrar(k)
  redis.call('HDEL', datos, k)
  redis.call('ZREM', uso, k)
  redis.call('ZREM', vencimiento, k)
end
if ARGV[1] == 'get' then
  local fin = tonumber(redis.call('ZSCORE', vencimiento, campo)) or 0
  if fin <= ahora then borrar(campo); return false end
  local valor = redis.call('HGET', datos, campo)
  if valor then redis.call('ZADD', uso, ahora, campo) end
  return valor
end
local contenido, fin, ttl = ARGV[3], tonumber(ARGV[4]), tonumber(ARGV[5])
if #contenido > ${PRESUPUESTO_CACHE_VECTORIAL.entradaBytes} or fin <= ahora then return 0 end
fin = math.min(fin, ahora + ttl)
-- Limpiar vencidos, y restos de un error de Redis entre comandos del script.
for _, k in ipairs(redis.call('HKEYS', datos)) do
  local exp = tonumber(redis.call('ZSCORE', vencimiento, k)) or 0
  if exp <= ahora or not redis.call('ZSCORE', uso, k) then borrar(k) end
end
for _, indice in ipairs({uso, vencimiento}) do
  for _, k in ipairs(redis.call('ZRANGE', indice, 0, -1)) do
    if redis.call('HEXISTS', datos, k) == 0 then redis.call('ZREM', indice, k) end
  end
end
borrar(campo)
local empresa = string.sub(campo, 1, 65)
local totalBytes, total, empresaBytes, cantidadEmpresa = 0, 0, 0, 0
local campos = redis.call('ZRANGE', uso, 0, -1)
for _, k in ipairs(campos) do
  local n = redis.call('HSTRLEN', datos, k)
  totalBytes = totalBytes + n; total = total + 1
  if string.sub(k, 1, 65) == empresa then
    empresaBytes = empresaBytes + n; cantidadEmpresa = cantidadEmpresa + 1
  end
end
local retirados = {}
local function retirar(k)
  local n = redis.call('HSTRLEN', datos, k)
  totalBytes = totalBytes - n; total = total - 1
  if string.sub(k, 1, 65) == empresa then
    empresaBytes = empresaBytes - n; cantidadEmpresa = cantidadEmpresa - 1
  end
  retirados[k] = true; borrar(k)
end
-- Una empresa que agota su cupo desplaza primero sus propias entradas.
for _, k in ipairs(campos) do
  if cantidadEmpresa < ${PRESUPUESTO_CACHE_VECTORIAL.empresaEntradas}
    and empresaBytes + #contenido <= ${PRESUPUESTO_CACHE_VECTORIAL.compartidoEmpresaBytes} then break end
  if string.sub(k, 1, 65) == empresa then retirar(k) end
end
for _, k in ipairs(campos) do
  if total < ${PRESUPUESTO_CACHE_VECTORIAL.compartidoEntradas}
    and totalBytes + #contenido <= ${PRESUPUESTO_CACHE_VECTORIAL.compartidoBytes} then break end
  if not retirados[k] then retirar(k) end
end
-- Si Redis rechaza un comando, puede quedar una entrada sin índice, pero la
-- siguiente escritura la retira. No se liberan reservas ni se tocan colas.
redis.call('HSET', datos, campo, contenido)
redis.call('ZADD', uso, ahora, campo)
redis.call('ZADD', vencimiento, fin, campo)
for _, k in ipairs(KEYS) do redis.call('PEXPIRE', k, ttl) end
return 1
`;
