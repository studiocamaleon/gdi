# Integración AFIP — verificación de delegación

La vista de la integración AFIP y el interruptor que habilita facturar desde el
sistema. Diseño de la UI: mockup "afip_configuracion_delegacion_tab".

## El modelo, en una frase

AFIP **no es "conectar con credenciales"**, es delegación. Un solo certificado
de Grafo representa a N CUITs; el CUIT del tenant viaja en `Auth.Cuit` en cada
request ([afip-sdk.provider.ts](../apps/api/src/administracion/invoicing/afip-sdk.provider.ts)).
El cliente no sube nada: entra a ARCA con su clave fiscal y le **delega** a
Grafo el webservice de facturación electrónica (`wsfe`). La vista, entonces, no
tiene formulario de certificado — tiene un **check de que esa delegación se
hizo** y un **interruptor** que enciende el botón Facturar.

## Verificar la delegación = una llamada real

No hay un endpoint de ARCA que diga "¿me delegaron?". La forma de saberlo es
**usar** la delegación: se pide `FECompUltimoAutorizado` con el CUIT del tenant
sobre uno de sus puntos de venta (el `ultimoNumero()` que ya existe en el
provider). Si ARCA responde un número —incluso 0, "autorizado, nada emitido
aún"—, la delegación funciona. Si el `/auth` o el wsfe rechazan, no está hecha,
y el error de ARCA se guarda en `ultimoErrorTexto` para mostrarlo en castellano.

Precondición: hace falta **CUIT del emisor + al menos un punto de venta** en
`ConfiguracionFiscal`. Sin eso no se llama a ARCA — se devuelve el motivo
("cargá el CUIT y un punto de venta primero"). Es la dependencia de orden que
el mockup dibuja: datos fiscales primero, verificar después.

## Dónde vive el estado

En `IntegracionTenant[AFIP]`, reusando el modelo genérico —el mismo de WATI—,
con una diferencia: `credencialesCifradas` queda **siempre null**. No hay
secreto del tenant que guardar.

| Campo | Qué guarda |
|---|---|
| `estado` | `DESCONECTADA` (apagada) · `CONECTADA` (verificada + activa) · `ERROR` (última verificación falló) |
| `metadataJson` | `{ ambiente, cuitVerificado, representanteCuit, puntoVentaProbado, ultimoNumeroVisto }` — todo no sensible |
| `ultimoChequeoEl` / `ultimoErrorTexto` | la última verificación |
| `conectadaEl` | cuándo se activó |

`CONECTADA` significa las dos cosas a la vez —verificada Y activa— igual que en
WATI (conectar = probar + activar en un acto). No se puede activar una
delegación rota: activar corre la verificación y sólo prende si pasa.

## Operaciones

- `verificarAfip(auth)` — check en seco. Corre la llamada a ARCA, actualiza
  `ultimoChequeo`/`error`/metadata, **no** cambia `estado`. Para poder verificar
  antes de encender. Devuelve `{ ok, cuit, puntoVenta, ultimoNumero?, motivo? }`.
- `activarAfip(auth)` — verifica; si pasa → `CONECTADA` + `conectadaEl`; si no →
  `ERROR` + motivo. Es el toggle-on, y lo que hace aparecer el botón Facturar.
- `desconectar('AFIP')` — el genérico que ya existe → `DESCONECTADA`. Toggle-off.
- `obtenerAfip(auth)` — el DTO enriquecido para la vista: estado + datos
  fiscales (de `ConfiguracionFiscal`) + ambiente + CUIT representante + última
  verificación.

## El representante (CUIT de Grafo)

Es el CUIT que el cliente delega en ARCA. Va por env
(`AFIP_REPRESENTANTE_CUIT`) porque es un dato de la plataforma, no del tenant:
la vista lo muestra para que el cliente sepa a quién habilitar. En homologación
el provider ya reemplaza el CUIT por el de demo de AFIP SDK, así que la
verificación en dev pasa siempre (el CUIT demo está "delegado").

## El gating del botón Facturar

Dos capas, porque una sola no alcanza:

- **Front**: el botón aparece si `orden.estado !== 'borrador'` **y** la
  facturación está habilitada. Endpoint liviano
  `GET /administracion/facturacion/estado` → `{ habilitada }`
  (= `IntegracionTenant[AFIP].estado === CONECTADA`). Con la integración
  apagada, en vez del botón se muestra un estado con link a la vista — no
  desaparece sin explicación.
- **Back**: al facturar, si AFIP no está `CONECTADA`, se rechaza con un mensaje
  claro. El botón que se filtre igual no emite. Es la red: el gate de UI se
  puede saltar, el del service no.

## Alcance de esta entrega

- Verificación + activación + vista de la integración (pestaña Configuración
  del mockup: datos fiscales + delegación + servicios habilitados + interruptor).
- Gating del botón Facturar (front + back).
- AFIP pasa a `disponible: true` en el catálogo.

**Fuera de alcance** (las otras pestañas del mockup, que no cambian con el
modelo de delegación y ya existen o son incrementales): Puntos de venta,
Comprobantes emitidos, Tipos habilitados, Padrón. Y el gancho del **plan de
pago** sobre el interruptor — se cuelga después, esta entrega deja el interruptor
listo para que el plan lo gobierne.
