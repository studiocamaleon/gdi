# DolarAPI en la barra superior de Grafo

## Cobertura y decisión de producto

Investigación: 16 de septiembre de 2026. Se revisó la [documentación oficial](https://dolarapi.com/docs/) y se consultaron los endpoints reales, sin API key: los ocho países respondieron HTTP 200.

Grafo ofrece 19 países en `src/lib/paises.ts` y `apps/api/src/common/paises.ts`. Los **ocho países publicados por DolarAPI están habilitados** en Grafo:

| País | Moneda local | Indicador fijo | Endpoint consultado |
| --- | --- | --- | --- |
| Argentina | ARS | Oficial · venta, elegido por el usuario | `https://dolarapi.com/v1/dolares` |
| Bolivia | BOB | Oficial · venta | `https://bo.dolarapi.com/v1/dolares/oficial` |
| Brasil | BRL | Mercado · venta | `https://br.dolarapi.com/v1/cotacoes/usd` |
| Chile | CLP | Mercado · venta | `https://cl.dolarapi.com/v1/cotizaciones/usd` |
| Colombia | COP | TRM | `https://co.dolarapi.com/v1/trm` |
| México | MXN | FIX | `https://mx.dolarapi.com/v1/cotizaciones/usd` |
| Uruguay | UYU | BROU · venta | `https://uy.dolarapi.com/v1/cotizaciones/usd` |
| Venezuela | VES | Oficial · referencia | `https://ve.dolarapi.com/v1/dolares` |

Sin cobertura en esta API: Costa Rica, Cuba, República Dominicana, Ecuador, El Salvador, Guatemala, Honduras, Nicaragua, Panamá, Paraguay y Perú. El indicador informa “Sin cobertura”; no sustituye esos países por Argentina ni inventa paridades para economías dolarizadas.

El país se obtiene de `DatosEmpresa.paisCodigo` del tenant autenticado, con el mismo predeterminado AR que la configuración regional. La moneda de facturación del tenant no determina el par: una empresa venezolana que factura en USD sigue viendo USD/VES.

### Diferencias entre respuestas

- Argentina publica siete cotizaciones: Oficial, Blue, MEP (`bolsa`), CCL (`contadoconliqui`), Mayorista, Cripto y Tarjeta. Se muestran en el desplegable, con Oficial primero independientemente del orden de la API.
- Brasil usa `moeda`, `venda` y `dataAtualizacao`. Algunos ejemplos de documentación de Brasil/Chile describen arrays, mientras los endpoints reales devuelven objetos. El adaptador admite ambos.
- Colombia también ofrece compra/venta de mercado, pero elegimos la TRM oficial (`valor`, `unidad: COP`).
- México publica compra, venta y FIX; el indicador usa FIX y el detalle conserva los tres valores.
- Venezuela publica `fuente: oficial/paralelo` y `promedio`, con compra y venta nulas. Se muestra como referencia; nunca se etiqueta ese promedio como venta.
- Se validan moneda, números positivos finitos, fecha y existencia de la cotización principal. Un valor faltante no se transforma en cero. Un error de esquema no borra el último dato válido.

## Funcionamiento

`GET /api/cotizaciones/dolar` está protegido por la sesión y disponible para todos los roles autenticados. El navegador no pasa URLs ni el tenant: el backend resuelve país y endpoint permitido.

- Consulta diferida desde la barra compartida: no bloquea la carga de la página.
- Caché de **5 minutos por país y proceso**; consultas simultáneas comparten la misma petición. Sólo almacena información pública, sin datos de empresas.
- Timeout externo de 8 segundos. Ante un fallo, reintento después de 60 segundos y conservación del último valor recibido.
- El navegador respeta la próxima consulta indicada por el backend, pausa en pestañas ocultas y consulta al volver si ya venció el plazo. Cancela peticiones al desmontarse y tiene un timeout de 12 segundos.
- El precio permanece visible en el encabezado. En móvil ocupa una segunda fila para mantener visibles los controles de sesión y navegación.
- El desplegable muestra moneda local por 1 USD, compra/venta o referencia, fecha individual de cada cotización y enlace a DolarAPI. Fechas en la zona horaria de la empresa.
- `consultadoEn` y la fecha del proveedor se mantienen separados: releer la API no rejuvenece una cotización.
- Si falla la actualización, el precio conservado se acompaña de **“Sin actualizar”**. También se marca así una fecha del proveedor con más de 96 horas (umbral conservador para fines de semana y feriados cortos). Sin dato previo se muestra **“No disponible”**, con reintento automático.
- Las cotizaciones son informativas. Esta integración no convierte importes ni actualiza listas de precios o cotizaciones comerciales.

La frecuencia de cinco minutos es una decisión de Grafo, no una promesa de frecuencia del proveedor. La fecha publicada por cada fuente es la referencia de vigencia; DolarAPI no garantiza disponibilidad continua. No se encontró una cuota contractual que debamos asumir como ilimitada.

## Validación

- 37 pruebas unitarias sin DB ni red: contratos de los ocho países, precisión, valores nulos/inválidos, referencias, cobertura, selección por tenant, caché, concurrencia, recuperación, fallos HTTP/JSON/esquema/timeout y datos antiguos.
- Compilación de producción de la API y TypeScript del frontend.
- Verificación visual del indicador y el desplegable en la app local.

## Fuentes

- [Argentina](https://dolarapi.com/docs/argentina/operations/get-dolares)
- [Bolivia](https://dolarapi.com/docs/bolivia/operations/get-dolar-oficial)
- [Brasil](https://dolarapi.com/docs/brasil/operations/get-usd-brl)
- [Chile](https://dolarapi.com/docs/chile/operations/get-usd-clp)
- [Colombia: TRM](https://dolarapi.com/docs/colombia/operations/get-trm)
- [México](https://dolarapi.com/docs/mexico/operations/get-usd-mxn)
- [Uruguay](https://dolarapi.com/docs/uruguay/operations/get-usd-uyu)
- [Venezuela](https://dolarapi.com/docs/venezuela/operations/get-dolares)
- [Condiciones de DolarAPI](https://dolarapi.com/docs/legal)
