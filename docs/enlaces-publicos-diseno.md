# Enlaces públicos — diseño

Los links que el sistema le manda al cliente final: seguimiento de la OT,
presupuesto para aprobar, y a futuro factura, remito, cobro y encuesta.

## El problema

El link de seguimiento medía 46 caracteres:

```
grafoprint.com.ar/track/r-nVTujBWiWXnk-P72wnAg
└──── 17 ────────┘└─ 7 ┘└──────── 22 ─────────┘
```

Dos tercios eran dominio y prefijo. Y cada tipo de link nuevo costaba una
columna `publicToken` con su índice único, una migración, una ruta de Next, un
controller `@Public` y su propia función de generación duplicada.

## Qué se hizo

**Un token de 12 chars.** `randomBytes(9).toString('base64url')` — 9 bytes dan
exactamente 12 caracteres en base64url, sin padding, 72 bits de entropía.

La cuenta que decide el largo es la enumeración. Con el throttler de 100
req/min por IP que ya estaba puesto y ~100k tokens vivos:

| Bytes | Chars | Bits | Prob. de acertar uno en un año de fuerza bruta |
|-------|-------|------|-----------------------------------------------|
| 6     | 8     | 48   | ~2% — no                                      |
| **9** | **12**| **72** | **~1 en mil millones**                      |
| 16 (anterior) | 22 | 128 | ~0                                       |
| 
Bajar a 8 chars ahorraba 4 caracteres más y costaba 24 bits: para un link que
muestra precios y datos del cliente, no. 12 es donde la curva se aplana.

**Un prefijo de una letra**, con el mapa completo decidido de entrada — asignar
letras de a una lleva a quedarse pintado en un rincón:

| Letra | Tipo             | Estado   |
|-------|------------------|----------|
| `/t/` | seguimiento OT   | vivo     |
| `/p/` | presupuesto      | vivo     |
| `/f/` | factura          | reservado|
| `/r/` | remito           | reservado|
| `/c/` | cobro (link de pago) | reservado |
| `/e/` | encuesta         | reservado|

Pago y presupuesto se pelean la `p`; por eso cobro se lleva la `c`. **Una letra
no se repinta**: cambiarla invalida links que ya viajaron por WhatsApp.

Resultado: **32 caracteres contra 46**.

```
grafoprint.com.ar/t/sv-jB-ZXqda8
```

**Una tabla, `EnlacePublico`**, en vez de una columna por entidad. Token único
global, `tipo`, `entidadId`, `tenantId`, más caducidad, revocación y métrica de
apertura que todos los tipos heredan gratis. Un tipo de link nuevo es una fila,
no una migración.

## Cómo funciona

`EnlacesPublicosService` tiene dos métodos:

- `emitir(tx, {tenantId, tipo, entidadId, token})` — idempotente por
  `[tipo, entidadId]`: re-emitir pisa el token anterior en vez de dejar dos
  links vivos. Se llama **dentro de la misma transacción** que la entidad, así
  no queda una OT emitida sin su link ni al revés.
- `resolver(token, tipo, {contarVisita})` — traduce el token de la URL a
  `{entidadId, tenantId}`, o `null`. Valida que el tipo guardado coincida con
  el esperado (un token de presupuesto pegado en `/t/` no abre el seguimiento
  de nadie), que no esté revocado y que no esté vencido.

Toda ruta pública entra por `resolver` y recién con el `entidadId` va a buscar
la entidad. Sin sesión no hay contexto de tenant, así que el `tenant-guard` no
filtra: está bien, el token es único global y el `tenantId` sale de la fila.

`OrdenTrabajo.publicToken` y `Cotizacion.publicToken` **siguen existiendo**,
como puntero denormalizado para la UI (el botón "compartir seguimiento" lo lee
del detalle) — mismo patrón que `OrdenTrabajo.facturadoTotal`. Se mantienen en
la misma transacción que la fila de `EnlacePublico`. La resolución pública, en
cambio, pasa siempre por la tabla.

## Compatibilidad

Los links ya enviados no se pueden editar: siguen valiendo, para siempre.

- **Tokens viejos de 22 chars**: la migración los copia a `EnlacePublico`
  (32 filas en dev, 0 huérfanos). El lookup es por igualdad exacta, no por
  largo, así que resuelven igual. Sólo los nuevos nacen cortos.
- **Rutas viejas**: `/track/<token>` y `/presupuesto/<token>` quedan como
  redirect permanente (308) a `/t/` y `/p/`. No se borran nunca.

## El middleware

`OPEN_PATH_RE` matchea con una regex **anclada**, no con `startsWith`:

```ts
/^\/(?:[tpfrce]|track|presupuesto)\/[A-Za-z0-9_-]+\/?$/
```

Con `startsWith("/p")` quedarían abiertas `/panel`, `/produccion` y
`/presupuestos` del dashboard. La ruta pública es exactamente prefijo + token,
dos segmentos, nada más.

## Lo que queda pendiente

- **`Referrer-Policy: no-referrer` y `noindex`** en las páginas públicas. Sin
  el primero, si la página linkea a algo externo el token viaja entero en el
  header `Referer`. Sin el segundo, Google puede indexar un presupuesto.
- **No loguear el token completo** en los request logs ni en los payloads que
  van a Wati.
- **Caducidad**: la columna `expiraEl` existe y `resolver` la respeta, pero hoy
  nadie la setea. Candidatos: presupuesto vencido, tracking a los 90 días de
  entregado.
- **Revocación**: `revocadoEl` se respeta al resolver, pero falta la acción de
  UI que la dispare.
- Los tipos `f`, `r`, `c`, `e` están reservados en el enum y en los dos mapas
  de prefijos, sin ruta todavía.
