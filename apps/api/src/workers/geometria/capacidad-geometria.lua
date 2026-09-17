-- Una única transacción reserva capacidad, turno y permiso. El tiempo procede
-- de Redis, no de relojes potencialmente distintos de las réplicas de Node.
local p, configRaw, op = KEYS[1], ARGV[1], ARGV[2]
local c, a = cjson.decode(configRaw), cjson.decode(ARGV[3])
local stored = redis.call('GET', p .. ':config')
if stored and stored ~= configRaw then
  return redis.error_reply('GRAFONEST_POOL_CONFIG_MISMATCH: las replicas deben compartir la configuracion del pool')
end
if not stored then redis.call('SET', p .. ':config', configRaw) end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local jobs, expires, leases, used = p .. ':jobs', p .. ':expires', p .. ':leases', p .. ':used'
local busy, served = p .. ':busy', p .. ':served'
local function tenantKey(m) return m.clase .. ':' .. m.tenant end
local function pendingKey(m) return p .. ':pending:' .. tenantKey(m) end
local function turns(clase) return p .. ':turns:' .. clase end
local function num(key, field) return tonumber(redis.call('HGET', key, field) or '0') end
local function meta(id)
  local raw = redis.call('HGET', jobs, id)
  return raw and cjson.decode(raw) or nil
end
local function refresh(m)
  local tk = tenantKey(m)
  if redis.call('ZCARD', pendingKey(m)) > 0 and redis.call('HEXISTS', busy, tk) == 0 then
    redis.call('ZADD', turns(m.clase), 'NX', num(served, tk), m.tenant)
  else
    redis.call('ZREM', turns(m.clase), m.tenant)
  end
end
local function dropPending(id, m)
  redis.call('ZREM', pendingKey(m), m.miembro)
  redis.call('ZREM', expires, id)
  redis.call('HDEL', jobs, id)
  refresh(m)
end
local function release(id, m, retry)
  local r = c[m.clase]
  redis.call('HINCRBY', used, 'cpu', -r.cpu)
  redis.call('HINCRBY', used, 'memoria', -r.memoriaMb)
  redis.call('HINCRBY', used, m.clase, -1)
  redis.call('HDEL', busy, tenantKey(m))
  redis.call('ZREM', leases, id)
  m.propietario = nil
  if retry then
    redis.call('HSET', jobs, id, cjson.encode(m))
    redis.call('ZADD', pendingKey(m), m.prioridad, m.miembro)
    redis.call('ZADD', expires, now + c.esperaMs, id)
  else
    redis.call('HDEL', jobs, id)
  end
  refresh(m)
end
-- Limpieza acotada: nunca recorrer todo el backlog en un intento de admisión.
for _, id in ipairs(redis.call('ZRANGEBYSCORE', leases, '-inf', now, 'LIMIT', 0, 100)) do
  local m = meta(id)
  if m and m.propietario then release(id, m, true) else redis.call('ZREM', leases, id) end
end
for _, id in ipairs(redis.call('ZRANGEBYSCORE', expires, '-inf', now, 'LIMIT', 0, 100)) do
  local m = meta(id)
  if m and not m.propietario then dropPending(id, m) else redis.call('ZREM', expires, id) end
end

if op == 'siguiente' then
  if not c[a.clase] then return redis.error_reply('Clase de capacidad invalida') end
  local tenant = redis.call('ZRANGE', turns(a.clase), 0, 0)[1]
  if not tenant then return false end
  local first = redis.call('ZRANGE', p .. ':pending:' .. a.clase .. ':' .. tenant, 0, 0)[1]
  -- Veinte dígitos de secuencia y un separador preceden al ID original.
  return first and string.sub(first, 22) or false
end
if op == 'estado' then
  return cjson.encode({ cpuReservada = num(used, 'cpu'), memoriaReservadaMb = num(used, 'memoria'),
    normalesActivos = num(used, 'normal'), intensivosActivos = num(used, 'intensiva'),
    trabajosPendientes = redis.call('ZCARD', expires), permisosActivos = redis.call('ZCARD', leases) })
end
local m = meta(a.jobId)
local function confirm(id, item)
  if item and not item.propietario then
    item.confirmado = true
    local tk = tenantKey(item)
    if redis.call('HEXISTS', served, tk) == 0 then
      redis.call('HSET', served, tk, tonumber(redis.call('GET', p .. ':turn') or '0'))
    end
    redis.call('HSET', jobs, id, cjson.encode(item))
    redis.call('ZADD', pendingKey(item), item.prioridad, item.miembro)
    redis.call('ZADD', expires, now + c.esperaMs, id)
    refresh(item)
  end
end
if op == 'confirmar' then
  -- Si el worker terminó entre queue.add y esta confirmación, no resucitarlo.
  confirm(a.jobId, m)
  return 1
end
if op == 'cancelar' then
  -- Cancelar no libera un proceso activo: su worker debe detenerlo primero.
  if m and not m.propietario then dropPending(a.jobId, m) end
  return 1
end
if op == 'renovar' or op == 'liberar' then
  if not m or m.propietario ~= a.propietario then return 0 end
  if op == 'renovar' then redis.call('ZADD', leases, now + c.leaseMs, a.jobId)
  else release(a.jobId, m, a.reintentar == true) end
  return 1
end
if op ~= 'registrar' and op ~= 'adquirir' then return redis.error_reply('Operacion de capacidad desconocida') end
if not m then
  if not c[a.clase] or type(a.tenant) ~= 'string' or type(a.prioridad) ~= 'number' then
    return redis.error_reply('Registro de capacidad invalido')
  end
  local seq = redis.call('INCR', p .. ':sequence')
  m = { tenant = a.tenant, clase = a.clase, prioridad = a.prioridad, miembro = string.format('%020d', seq) .. ':' .. a.jobId }
  redis.call('HSET', jobs, a.jobId, cjson.encode(m))
  -- Una caída del API antes de queue.add no deja un turno fantasma.
  redis.call('ZADD', expires, now + 30000, a.jobId)
elseif m.tenant ~= a.tenant or m.clase ~= a.clase then
  return redis.error_reply('Identidad de capacidad incompatible')
end
if a.confirmado then confirm(a.jobId, m) end
if op == 'registrar' then return 1 end
if m.propietario then return m.propietario == a.propietario and 1 or 0 end
local head = redis.call('ZRANGE', turns(m.clase), 0, 0)[1]
local first = redis.call('ZRANGE', pendingKey(m), 0, 0)[1]
if head ~= m.tenant or first ~= m.miembro then return 0 end
local r = c[m.clase]
if num(used, m.clase) >= r.maximos then return 0 end
local cpu, memory = num(used, 'cpu') + r.cpu, num(used, 'memoria') + r.memoriaMb
if cpu > c.cpu or memory > c.memoriaMb then return 0 end
local other = m.clase == 'normal' and 'intensiva' or 'normal'
local canCoexist = c.normal.cpu + c.intensiva.cpu <= c.cpu and c.normal.memoriaMb + c.intensiva.memoriaMb <= c.memoriaMb
local otherWaiting = redis.call('ZCARD', turns(other)) > 0
if canCoexist then
  -- Siempre reservar una entrada interactiva. Reservar la intensiva cuando
  -- espera evita que una llegada continua de trabajos chicos la postergue.
  if num(used, other) == 0 and (m.clase == 'intensiva' or otherWaiting) then
    if cpu + c[other].cpu > c.cpu or memory + c[other].memoriaMb > c.memoriaMb then return 0 end
  end
elseif otherWaiting and redis.call('GET', p .. ':last-lane') == m.clase then
  return 0
end
m.propietario = a.propietario
redis.call('HSET', jobs, a.jobId, cjson.encode(m))
redis.call('ZREM', pendingKey(m), m.miembro)
redis.call('ZREM', expires, a.jobId)
redis.call('ZADD', leases, now + c.leaseMs, a.jobId)
redis.call('HSET', busy, tenantKey(m), a.jobId)
redis.call('ZREM', turns(m.clase), m.tenant)
redis.call('HINCRBY', used, 'cpu', r.cpu)
redis.call('HINCRBY', used, 'memoria', r.memoriaMb)
redis.call('HINCRBY', used, m.clase, 1)
redis.call('HSET', served, tenantKey(m), redis.call('INCR', p .. ':turn'))
redis.call('SET', p .. ':last-lane', m.clase)
return 1
