# Multi-moneda y zona horaria por tenant — diseño

Estado: **IMPLEMENTADO** (2026-07-26, rama `feat/multi-moneda-zona-horaria`).
F0–F2 y F4 completos; F3 recortada por decisión (las plantillas de Meta
conservan su `$`). Pendientes conocidos al final de este doc (§7).

## 1. Por qué

Hay early adopters en Chile y Honduras. Hoy el sistema asume Argentina en tres capas
distintas que hay que separar porque tienen costos y riesgos muy diferentes:

1. **Moneda** — `"ARS"` y el símbolo `$` repartidos por ~35 formateadores y ~85 call
   sites del panel.
2. **Zona horaria** — `America/Argentina/Buenos_Aires` en 4 archivos, pero el
   problema real es lo que corre en "la zona del proceso" (motor de capacidad, corte
   de jornada, crons, reportes).
3. **Fiscal** — ARCA/CUIT/letras. Está bien contenido en Administración y NO se
   internacionaliza en este proyecto: se gatea por país.

Matriz mínima de arranque: **ARS, CLP, HNL, USD**. CLP es el caso raro (0 decimales)
y conviene probarlo primero.

## 2. Estado actual (resumen del relevamiento)

### 2.1 Dinero

- **Todos los montos son `Decimal(p,s)` en Postgres** (129 campos), nunca centavos
  enteros. El bug clásico de ×100 con CLP/PYG **no aplica acá**: el número guardado
  es el número, la moneda es sólo etiqueta + formato.
- La cadena principal de valor (`Cotizacion` → `OrdenTrabajo` → `Cobro`/
  `ComprobanteOrden`) **no tiene campo moneda en ningún eslabón**. Existen 7 campos
  `moneda` sueltos (`CuentaFondos`, `Cobro`, `Valor`, `Comprobante`,
  `MateriaPrimaVariante`, `MaterialPresetVariante`, `Plan`); de ellos `Cobro.moneda`
  y `Valor.moneda` **nunca se escriben** (quedan en el default `'ARS'`).
- El único tipo de cambio del sistema es `Comprobante.cotizacion` (factura E en USD
  vía ARCA). No hay tabla de cotizaciones ni conversión en ningún otro lado.
- **No hay helper central de formateo**: 8 definiciones en el API + ~27 en el front,
  de las cuales sólo 3 son compartidas (`src/lib/propuestas.ts` ×2,
  `src/lib/recibos.ts` ×1). El único formateador currency-aware del repo es
  `precio(monto, moneda)` de `suscripcion-view.tsx:150`.
- Redondeo sin política central: `r2` copiado 9 veces; el corazón del pricing es
  `redondear(n, decimales = 2)` en
  `apps/api/src/productos-servicios/precio/aplicar-precio.service.ts:474` (default 2
  cableado en la firma).
- El motor universal de costeo es **agnóstico de moneda** (no asume 2 decimales,
  calcula en float y delega el redondeo), pero suma `MateriaPrimaVariante.precioReferencia`
  **ignorando su campo `moneda`**: un material cargado en USD hoy se suma como ARS.
- Paddle/control plane (USD) está limpio y separado; la única fuga es visual:
  `kit.tsx mk()` renderiza MRR (USD) y GMV (ARS) con el mismo `$`.

### 2.2 Fechas y husos

- **No existe zona horaria por tenant** — decisión consciente documentada en
  `despacho.service.ts:29-34`. `America/Argentina/Buenos_Aires` aparece hardcodeada
  en exactamente 4 archivos: `src/lib/fecha.ts:19` y los 3 services de notificaciones.
- Todo lo demás corre en **la zona del proceso**: UTC en el server, la del navegador
  en el cliente. No hay `TZ` en ninguna config, ni librería de fechas (todo `Date` +
  `Intl`).
- **El motor de capacidad/ETA** (`apps/api/src/eta/motor/flujo-produccion.ts` +
  espejo `src/lib/flujo-produccion.ts` + `src/lib/eje-laboral.ts` +
  `apps/api/src/eta/snapshots.ts`) interpreta el calendario "hora de pared"
  (`"08:00"`) con métodos locales de `Date`: **hoy front y back ya dan resultados
  distintos** (navegador del taller vs. UTC de Render).
- `corteJornadaDe()` (`ordenes-trabajo.service.ts:195`) usa `setHours` local: en el
  server UTC, el corte `"20:00"` cierra tramos a las 17:00 AR.
- **8 crons sin `timeZone`** (todas las horas declaradas son UTC en producción). El
  de reseñas (10:00 UTC = 07:00 AR) dispara *fuera* de la ventana de cortesía que él
  mismo evalúa en zona AR — se auto-reprograma, contradicción ya existente.
- Reportes: `date_trunc` **siempre sin `AT TIME ZONE`** (6 services) → buckets en
  UTC; pero los bordes del rango se calculan en hora local del proceso
  (`reportes/periodo.ts` / `panel-periodo.ts`). "Días trabajados" de equipo corta a
  las 21:00 AR.
- 9 campos `@db.Date` con convención "fecha local del taller", escritos con 3
  patrones distintos; el peor: `Comprobante.fecha` con fallback `new Date()` crudo
  (`comprobantes.service.ts:412`) — una factura emitida a las 22:00 AR queda fechada
  al día siguiente.
- `src/lib/fecha.ts` es el helper canónico correcto pero **sólo 6 componentes lo
  importan**; el resto del front usa `toLocaleDateString("es-AR")` sin `timeZone`.

### 2.3 Configuración y país

- Patrón establecido: tablas satélite 1-a-1 con `Tenant` (`DatosEmpresa`,
  `ConfiguracionFiscal`, `ConfiguracionProduccion`, `ConfiguracionPresupuestos`,
  `ConfiguracionInsights`, `ConfiguracionNotificaciones`).
- **El país del tenant ya existe**: `DatosEmpresa.paisCodigo VARCHAR(2)` (ISO
  alfa-2), alimentado por la lista única `src/lib/paises.ts` (19 países LATAM, con
  `phoneCode`). Hoy sólo se usa para normalizar el WhatsApp a E.164.
- Los documentos toman los datos de empresa vía
  `DatosEmpresaService.paraDocumentos(tenantId)` — punto único ya existente por
  donde puede viajar moneda/zona a los 4 PDFs y vistas públicas.
- No hay provider de tenant en el front (sólo permisos); `GET /tenants/current` trae
  id/nombre/slug/rol/permisos/suscripción.
- Lo fiscal AR está contenido en `apps/api/src/administracion/**` (invoicing, letra,
  config fiscal) + `common/cuit.ts` + campos `cuit`/`condicionFiscal` de
  Cliente/Proveedor. Cotización, OT, cobros, recibos y deuda comercial son
  **agnósticos de AFIP por diseño** (la deuda nace de la orden, el recibo no es
  fiscal).

### 2.4 Superficies

| Zona | Puntos a tocar | Nota |
|---|---|---|
| PDFs (4) | 8 helpers locales (4 money + 4 fecha) | Acotado. `factura-pdf` ya imprime "Moneda" pero formatea con `$` es-AR |
| Links públicos (4) | 1 helper compartido + 1 local | `/p` muestra 0 decimales y su PDF 2 — inconsistencia preexistente |
| WhatsApp | 6 plantillas Meta con `$` en el cuerpo + 6 helpers en 4 services | Cambiar el cuerpo = plantillas `_v3` + reaprobación Meta (24-48 h) |
| Cotizador | `lib/propuestas.ts` (2 funciones, 3 archivos) | La mejor zona |
| Paneles de costos | ~7 `Intl` inline | |
| Panel/Reportes | ~85 call sites `` `$${fmtK(v)}` `` en `panel-general.tsx` + 3 defaults de charts | La peor zona |
| Inputs de dinero | ~40 inputs en ~22 archivos, 3 patrones, 17 `replace(",", ".")` sin `/g` | No existe `MoneyInput` |
| Emails | 0 | No se manda ninguno |

## 3. Decisiones de diseño

**D1 — Una moneda por tenant, no por documento.** La imprenta chilena trabaja en
CLP; no se modela cotizar en una moneda y cobrar en otra. Las excepciones que ya
existen se conservan tal cual: `Comprobante` ARS/USD con `cotizacion` (factura E) y
`CuentaFondos.moneda` (caja en USD). No se agrega campo `moneda` a
`Cotizacion`/`OrdenTrabajo` en esta etapa: la moneda es un atributo del tenant y los
montos históricos se interpretan con ella.

**D2 — La moneda es etiqueta + formato, nunca conversión.** No hay tipo de cambio
general ni tabla de cotizaciones. Cambiar la moneda del tenant NO reconvierte nada:
los números guardados quedan como están (se advierte en la UI; caso de uso real:
corregir la config inicial, no mudarse de país). Si algún día hace falta conversión,
es otro proyecto.

**D3 — Dónde vive la config: `DatosEmpresa`.** Se agregan `monedaCodigo VARCHAR(3)`
(default `'ARS'`) y `zonaHoraria VARCHAR(64)` (default
`'America/Argentina/Buenos_Aires'`). Razones: el país ya vive ahí, la pantalla
Empresa ya existe con el gate correcto (`configuracion.gestionar`), y
`paraDocumentos()` ya es el canal hacia los PDFs. Al elegir país, la UI **sugiere**
moneda y zona (editable — Ecuador/Panamá usan USD, Chile continental vs. Magallanes,
etc.).

**D4 — Catálogo de monedas en código, no en base.** `src/lib/monedas.ts` (front) +
espejo `apps/api/src/common/monedas.ts`, mismo patrón que `paises.ts`:

```ts
type Moneda = {
  codigo: string;      // ISO 4217: "ARS" | "CLP" | ...
  nombre: string;      // "Peso chileno"
  simbolo: string;     // lo que ve el usuario en pantalla: "$", "Bs", "R$", "S/", "₲", "L", "Q"…
  simboloDoc: string;  // desambiguado para documentos: "AR$", "CLP $", "US$", "L"…
  decimales: 0 | 2;    // CLP y PYG = 0
  locale: string;      // separadores: es-AR (1.234,56) vs es-HN/es-MX (1,234.56)
};
```

Se cargan las ~18 monedas de la tabla relevada (Sudamérica + Centroamérica + MX y
Caribe). Venezuela: se lista `VED` pero no se promociona (en la práctica allá se
presupuesta en USD). El catálogo de países (`paises.ts`) gana dos campos:
`monedaSugerida` y `zonasHorarias[]` (la primera es la sugerida).

**D5 — Decimales por moneda, redondeo por tenant.** Son dos cosas distintas:

- `decimales` (del catálogo) manda en **formateo, inputs y almacenamiento visible**:
  un tenant CLP nunca ve ni tipea centavos.
- `redondeoPrecio` (nuevo campo en `DatosEmpresa`, `'moneda' | 'entero'`, default
  `'moneda'`) manda en el **pricing**: ARS y COP con 2 decimales formales pero que
  en la calle redondean a la unidad ponen `'entero'` y
  `aplicar-precio.service.ts:redondear()` pasa a usar ese valor en vez del `2` de la
  firma. Para CLP `'moneda'` ya significa 0.

La tolerancia de coherencia de `ordenes-trabajo.service.ts:1456` ("$1 por
redondeos") pasa a ser `10^-decimales × 100` → sigue siendo ~1 unidad en cualquier
moneda.

**D6 — Nunca `$` a secas en documentos que cruzan fronteras.** Cinco países
comparten `$`. Regla: **en pantalla** (usuario logueado, sabe su moneda) va
`simbolo`; **en PDFs, links públicos y WhatsApp** va `simboloDoc` o el símbolo con
el código ISO junto al total ("Total: $ 1.234,56 ARS"). `factura-pdf` ya imprime el
campo Moneda; se alinea el resto.

**D7 — Un helper de moneda por lado, espejados.** Como no hay `packages/`
compartido, mismo patrón que `flujo-produccion`:

- Front: `src/lib/moneda.ts` — `formatearMoneda(n, moneda, opts?)`,
  `formatearMonedaDoc(n, moneda)`, `abreviarMoneda(n, moneda)` (unifica los dos
  `fmtK` divergentes), `parsearMonto(str, moneda)` (arregla de paso los 17
  `replace(",", ".")` sin `/g`).
- Back: `apps/api/src/common/moneda.ts` — mismas firmas (para PDFs, mensajes de
  timeline, alertas y payloads de WhatsApp).

Implementación con `Intl.NumberFormat(locale, { minimumFractionDigits: decimales,
maximumFractionDigits: decimales })` + símbolo del catálogo (no `style: "currency"`,
que decide símbolos por su cuenta y difiere entre ICUs).

**D8 — La config regional viaja en `/tenants/current` y en `paraDocumentos()`.**

- `GET /tenants/current` suma `{ monedaCodigo, zonaHoraria, redondeoPrecio }` →
  nuevo `ConfigRegionalProvider` en `src/app/(dashboard)/layout.tsx` (al lado de
  `PermisosProvider`) con hook `useConfigRegional()`. Las vistas públicas (sin
  sesión) lo reciben en el payload del endpoint público, como ya hacen con los datos
  de empresa.
- `EmpresaEnDocumentos` suma `moneda` y `zonaHoraria` → los 4 PDFs y los services de
  notificaciones dejan de hardcodear.

**D9 — Zona horaria: IANA por tenant, aritmética con helper espejado, sin librería
nueva.** El repo no tiene lib de fechas y el motor está espejado front/back; se crea
`src/lib/zona.ts` + espejo `apps/api/src/common/zona.ts` con las 4 primitivas que el
relevamiento mostró necesarias:

- `claveFechaEnZona(instante, zona)` → `"YYYY-MM-DD"` (feriados, snapshots, buckets)
- `diaSemanaEnZona(instante, zona)` → `"lun".."dom"` (calendario laboral)
- `instanteDe(fechaLocal, horaLocal, zona)` → `Date` (la inversa: construir "el
  lunes a las 08:00 del taller" como instante; técnica de doble formateo con `Intl`
  para resolver el offset, con test de DST — Chile tiene DST, Argentina no)
- `partesEnZona(instante, zona)` → `{ y, m, d, hh, mm }` (para `fecha.ts` y el eje)

La ventana de cortesía de WhatsApp (`despacho.service.ts:proximaVentana`) ya usa
exactamente esta técnica — se generaliza, no se inventa.

**D10 — El motor de capacidad recibe la zona como input.** `flujo-produccion.ts`
(los DOS espejos), `eje-laboral.ts` y `snapshots.ts` reemplazan
`getFullYear/getDay/setMinutes/new Date(y,m,d)` por las primitivas de D9, con
`zona` como campo nuevo del input del motor. Bonus: **esto arregla la divergencia
actual front/back** (hoy el mismo cálculo da distinto en el navegador y en Render).
El deadline de entrega (`snapshots.ts:206`) pasa a `instanteDe(fechaEntrega,
"23:59", zona)`.

**D11 — Crons: disparo en UTC, semántica por tenant.** No se usa la opción
`timeZone` de `@Cron` (una sola hora no sirve para N husos). Los barridos que
iteran tenants evalúan "el día/la hora" con la zona de cada uno:

- Reseñas: el cron pasa a correr **cada hora**; por tenant, dispara sólo si la hora
  local del tenant está en la ventana de cortesía (que ya es config por tenant —
  sólo le falta la zona). Elimina de paso la contradicción actual.
- Snapshot ETA diario: corre a las 09:00 UTC (madrugada en todo el continente,
  03:00–06:00) y la `fecha` del snapshot se calcula con `claveFechaEnZona(ahora,
  zonaDelTenant)` — resuelve la decisión D8 pendiente de
  `eta-metricas-historicas-diseno.md`.
- Acreditaciones/trial/higienes: comparan instantes, no días — quedan como están.

**D12 — Reportes: bucket y borde en la misma zona.** Los `date_trunc` de los 6
services pasan a `date_trunc('day', col AT TIME ZONE ${zona})` (las queries ya son
por tenant); `reportes/periodo.ts` y `panel-periodo.ts` calculan los bordes del
rango con la zona del tenant en vez de la del proceso. Es el fix del sesgo "el día
corta a las 21:00".

**D13 — `@db.Date` = "fecha local del taller", una sola convención de escritura.**
Se normaliza todo a `new Date(\`${yyyy_mm_dd}T00:00:00.000Z\`)` (el patrón de
`DiaNoLaborable`, ya correcto) y lectura `toISOString().slice(0,10)`. Se corrige el
bug de `Comprobante.fecha` (fallback `new Date()` crudo → `claveFechaEnZona(ahora,
zona)`).

**D14 — Fiscal por país: se gatea, no se internacionaliza.** Si `paisCodigo !==
'AR'`: Datos fiscales, Comprobantes/facturación e integración AFIP se ocultan del
menú y sus endpoints devuelven 409 con mensaje claro. El circuito no-AR completo ya
funciona sin eso: presupuesto → OT → deuda comercial → cobro → **recibo** (no
fiscal) → estado de cuenta. La facturación legal chilena (SII) u hondureña (SAR) es
un proyecto aparte, si algún día lo pide el mercado. `Cliente.cuit` se re-rotula
"Identificación fiscal" (RUT/RTN) sin validación módulo 11 fuera de AR.

## 4. Fases de ejecución

### F0 — Cimientos (chico)
- Catálogos `monedas.ts` (×2) + campos nuevos en `paises.ts`.
- Migración: `DatosEmpresa.monedaCodigo`, `zonaHoraria`, `redondeoPrecio` (defaults
  AR — cero impacto en tenants existentes).
- UI en Configuración › Empresa: bloque "Regional" (país ya está; se suman moneda,
  zona horaria y redondeo, con sugerencia al cambiar país y advertencia D2).
- `/tenants/current` + `ConfigRegionalProvider` + `useConfigRegional()`.
- `paraDocumentos()` suma moneda y zona.

### F1 — Moneda visible (mediano-grande, mecánico)
- Helpers D7 (×2) con tests (casos: CLP 0 dec, HNL separadores en-US, ARS).
- Migrar las ~35 definiciones de formateo a los helpers, por zona: PDFs (8 puntos) →
  links públicos → cotizador/costos → administración → **panel** (~85 call sites +
  3 defaults de charts + prop `currency` de `Kpi`).
- Componente `MoneyInput` (símbolo, decimales de la moneda, `parsearMonto`) y
  migración de los ~40 inputs; arreglar los `replace(",", ".")`.
- `aplicar-precio.redondear()` + tolerancia de OT usan D5.
- **Probar con un tenant CLP de punta a punta** (cotizar → OT → cobrar → recibo →
  panel): es el caso 0-decimales.

### F2 — Zona horaria (mediano, delicado)
- Helpers D9 (×2) con tests de DST (Chile 2026: cambia abril/septiembre).
- `fecha.ts`: `ZONA` deja de ser constante; `crearFormateadores(zona)` + el provider
  los expone; migrar gradualmente los `toLocaleDateString` sueltos (deuda ya
  existente).
- Motor D10 (los dos espejos + eje + snapshots), `corteJornadaDe`, despacho/ventana,
  services de notificaciones.
- Crons D11 y reportes D12. Convención D13.

### F3 — WhatsApp (recortada por decisión 2026-07-26)
- **Las plantillas aprobadas NO se tocan**: el `$` en el cuerpo se queda — dentro
  de LATAM se lee como "la moneda local" y evita el ciclo de reaprobación de Meta.
  Límite conocido: un tenant HNL vería `$` donde su símbolo es `L`; se revisita si
  llega a doler.
- Sólo se verifica que ningún texto interpolado o fijo diga "pesos argentinos"
  hardcodeado (p. ej. `importeEnLetras` con moneda ≠ ARS).
- Los `money()` de los 4 services pasan al helper común (número según locale de la
  moneda, sin símbolo — el símbolo ya vive en la plantilla).

### F4 — Bordes (chico)
- Gate fiscal D14.
- Transferencias entre cuentas de distinta moneda: **bug real hoy** (mueven el
  número sin convertir y la UI dice que "se registra el TC del día", falso) →
  pedir `tipoCambio` en el formulario y guardarlo en el movimiento, o bloquear la
  transferencia cruzada.
- `Cobro.moneda`/`Valor.moneda`: escribirlos con la moneda del tenant (hoy quedan
  en el default).
- Control plane: GMV cross-tenant agrupado por moneda (hoy sumaría CLP + ARS como
  si nada); MRR sigue USD-only por Paddle.
- Motor: al leer `MateriaPrimaVariante.precioReferencia`, si `moneda` difiere de la
  del tenant, advertir en el desglose (no convertir — D2).

## 5. Casos borde anotados

- **CLP/PYG 0 decimales**: formateo, `MoneyInput`, `redondear()`, tolerancia OT,
  `importeEnLetras` (hoy dice "pesos" si ARS y el código crudo si no — F3 le agrega
  nombre por moneda del catálogo), y el `numero-en-letras` de centavos ("con
  00/100") que en CLP no existe.
- **Separadores**: es-AR/es-CL usan `1.234,56`; es-HN/es-MX/es-DO usan `1,234.56`.
  El `locale` del catálogo lo resuelve; los inputs deben parsear según el mismo
  locale (hoy el parseo asume coma decimal).
- **DST**: Argentina no tiene, Chile y Paraguay sí. Los tests de `instanteDe` deben
  cubrir el día del cambio (una hora que no existe / que existe dos veces).
- **Cambio de moneda con historia**: permitido con advertencia (D2); los montos no
  se tocan. Los PDFs ya emitidos son fotos en R2 y no se reescriben (consistente con
  la decisión ya tomada para datos de empresa).
- **Plantillas WhatsApp `_v2` vivas durante F1–F2**: un tenant CLP que active
  notificaciones antes de F3 mandaría "`$185.400`" con símbolo ambiguo pero número
  bien formateado. Aceptable como transitorio; F3 lo cierra.
- **`Comprobante` ARS/USD**: no cambia — es un circuito AR (D14) y su par
  moneda+cotización ya funciona.

## 7. Pendientes conocidos post-implementación

Segunda pasada del 2026-07-26 — RESUELTOS:

- ~~`toLocaleDateString` sueltos del front~~ → migrados a `useFecha()` /
  `fecha.ts` (dashboard); el control plane usa el default AR explícito con
  comentario, y las etiquetas de bucket de la consola se parten como string
  (sin `Date`/ICU, sin corrimiento de día).
- ~~`MoneyInput`~~ → `src/components/ui/money-input.tsx` (controlado por
  string, normaliza en blur con los decimales de la moneda, `aria-invalid`)
  + migrados cobro, gastos fijos (fix: los centavos eran imposibles de
  tipear), remuneraciones (fix: mostraba es-AR pero exigía en-US) y el precio
  de referencia de materia prima.
- ~~Transferencias entre monedas~~ → `MovimientoFondos.tipoCambio` (migración
  formal); entre monedas distintas el formulario pide "cuánto llegó a
  destino" (el extracto dice un monto, no una tasa), el TC implícito se
  muestra en vivo y se registra en los dos movimientos.
- ~~GMV cross-tenant~~ → `negocio.porMoneda` (GMV por moneda del tenant) y la
  consola avisa cuando hay mezcla; los KPIs siguen sumando crudo porque no
  hay TC en el sistema (D2), pero ya no lo hacen en silencio.

Quedan (menores, sin fecha):

- **Vistas públicas** (tracking, presupuesto/recibo/comprobante): formatean
  fechas en el navegador del cliente final. Decisión pendiente de si eso es
  correcto (el cliente lee en SU hora) o deben fijarse a la zona del taller.
- **`etiquetaEta` del tablero**: zona del navegador del operario = la del
  taller en la práctica; anotado por si aparece el caso remoto.
- **Inputs de pricing de productos-servicios**: siguen con `type="number"`
  (valores técnicos con punto decimal); funcionan, pero no usan `MoneyInput`.
- **Snapshot ETA histórico**: los viejos quedaron con día UTC-del-proceso;
  para AR coinciden con la convención nueva, no hay migración que hacer.
- **Prueba E2E con tenant CLP real** (cotizar → OT → cobrar → recibo) antes
  de habilitar al early adopter chileno.

## 6. Preguntas abiertas (no bloquean F0–F1)

- **P1**: ¿el tenant CLP quiere ver "CLP $" o "$" en pantalla? (D6 aplica a
  documentos; en pantalla propongo símbolo pelado — validar con el early adopter.)
- **P2**: ¿`redondeoPrecio = 'entero'` debería redondear también el **total** o sólo
  los unitarios? (Propuesta: sólo la salida de `aplicar-precio`, que ya es el único
  punto de redondeo del pricing.)
- **P3**: gate fiscal D14 — ¿ocultar del menú alcanza, o algún tenant no-AR va a
  querer cargar comprobantes "manuales" para su propio control? (El provider
  `manual` ya existe; sería aflojar el gate, no construir nada.)
