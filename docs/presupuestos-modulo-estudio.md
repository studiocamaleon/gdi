# Presupuestos — estudio y diseño del módulo comercial

> 2026-07-18. Análisis SIN implementación. Cruza el relevamiento del
> código (qué es hoy `Cotizacion` y qué piezas ya existen) con la
> investigación de industria (Printavo, PrintVis, DocketManager,
> shopVOX, SAP/HubSpot CPQ) sobre ciclo de vida, aprobación interna,
> entrega al cliente y conversión. Es EL prerequisito que los estudios
> de métricas marcaron dos veces: sin ciclo de estados no hay win rate,
> funnel ni pipeline.

## 1. Para qué sirve el presupuesto (la función)

El presupuesto es **el compromiso comercial previo al compromiso
productivo**. Cumple cuatro funciones:

1. **Oferta formal**: fija precio, alcance y condiciones por un tiempo
   limitado (validez) — protege a la imprenta de cotizar hoy y producir
   a costos de mañana.
2. **Herramienta de venta**: es el documento que viaja al cliente (PDF,
   link, WhatsApp) y donde se gana o se pierde el trabajo. Su calidad y
   su velocidad de emisión mueven la conversión (la industria documenta
   que responder en horas vs. días multiplica el win rate).
3. **Control interno**: es el punto donde el negocio decide qué se
   promete (aprobación de un superior si el monto/descuento/margen se
   sale de lo normal — tu ejemplo del umbral).
4. **Registro comercial**: lo que se cotizó y NO se vendió (con motivo)
   es la materia prima del funnel, win rate, pipeline y de corregir
   precios. Hoy ese registro no existe: lo perdido se evapora.

**Información que debe llevar** (consolidado industria + nuestro PDF de
factura como referencia): datos del tenant y del cliente, número único,
fecha de emisión y **validez explícita**, items con cantidad/precio
(desc. opcional), subtotal/impuestos/total, **condiciones de pago**
(seña estándar de la industria: 50% para arrancar), qué NO incluye,
observaciones, vendedor, y el método de aceptación (link o firma).

## 2. Qué existe HOY (relevamiento verificado)

- `Cotizacion` + `CotizacionItem` existen pero son un **contenedor de
  snapshots**, no un presupuesto: `estado` sólo vale "borrador" en todo
  el código, `numero` nunca se asigna (no hay contador), `fechaValidez`
  nunca se escribe/lee, y no hay vendedor en la cotización.
- **El flujo real es un pipeline continuo**: la ficha comercial
  (`propuesta-ficha.tsx`) persiste snapshots vía `cotizarYGuardar` y
  crea la OT casi en el mismo acto. El toggle "Presupuesto/Orden" de la
  UI es cosmético. No hay una etapa donde el presupuesto viva solo
  esperando la decisión del cliente.
- **No hay**: listado de cotizaciones (Comercial sólo tiene "Crear
  propuesta"), envío por email/WhatsApp (cero infra), items fuera de
  catálogo en cotización (`productoId` obligatorio), aprobaciones por
  rol aplicadas a ventas.
- **Sí hay piezas reusables de primera**:
  - PDF server-side (jsPDF, `factura-pdf.service.ts`) diseñado
    explícitamente para "salir por mail" — clonable.
  - Link público tokenizado del tracking (`publicToken` + ruta
    `@Public()` + página fuera del dashboard) — patrón directo para
    "ver presupuesto online".
  - Contadores por tenant (`OrdenTrabajoContador`) — patrón para
    `CotizacionContador`.
  - `RolesGuard` + `@Roles()` funcionando (sin aplicar a ventas) — la
    base del flujo de aprobación.
  - Snapshots inmutables por item (precio/impuestos/comisiones) — el
    congelamiento que la conversión necesita ya está resuelto.
  - `recotizarItem` (sólo borrador) — la base de la revalidación.
- El diseño de OT (2026-07-15) ya declaró la arquitectura:
  "`Cotizacion` es el presupuesto: se versiona, vence, se gana o se
  pierde. El snapshot viaja de una a otra al aprobar."

## 3. Lo que hace la industria (síntesis de investigación)

- **Estados** (convergen todos): `borrador → (aprobación interna) →
  enviado → visto → aprobado | rechazado | vencido → convertido`.
  "Visto" como señal de primera clase (e-quoting) y **motivo de pérdida
  como picklist obligatoria** al rechazar (texto libre no se puede
  agrupar — lección Salesforce; Printavo lo modela como estados).
- **Vencimiento**: al llegar la validez pasa a vencido automáticamente
  y deja de ser aceptable; aceptar después exige revalidar (revisión con
  reprecio), nunca revivir en silencio. Validez típica imprenta: 15
  días, con recordatorios.
- **Aprobación interna**: reglas por monto total, % de descuento y
  margen mínimo; la aprobación **bloquea el envío** (no es una alerta).
  Nuestro diferencial: el motor de costeo da el margen real por item —
  "margen < X%" y "tiene líneas sin costear" son disparadores que los
  CPQ genéricos no pueden ofrecer.
- **Entrega**: el patrón estrella es el **link público con token**
  (página limpia, botones Aprobar/Rechazar, la aprobación queda
  registrada con timestamp = firma virtual, y al aprobar se pide la
  seña). El tracking de "visto" sale gratis del mismo token. WhatsApp:
  **ningún MIS de imprenta lo integra nativo** — en LATAM es EL canal;
  nivel 1 (`wa.me` con el link) cuesta casi nada y es diferencial;
  nivel 2 (API de Meta por template) queda para después.
- **Conversión**: precio pactado congelado (el snapshot), conversión
  **parcial por items** (checklist de qué aprobó el cliente),
  referencia cruzada presupuesto↔OT, y el presupuesto nunca se borra.
- **Versionado**: número base + revisión (`PRES-0042-R1`); la revisión
  es copia completa, UNA sola activa/enviable, re-aprobación interna en
  cada revisión; nada se borra (histórico para auditoría).

## 4. Decisiones de diseño propuestas

### Naming
- **"Presupuestos"** en la UI y de cara al cliente (la palabra argentina
  natural; "propuesta" ya nombra la ficha; "cotización" queda como
  término técnico del motor). La entidad Prisma sigue siendo
  `Cotizacion` (renombrarla es migración sin valor).

### Máquina de estados (enum de aplicación sobre el `estado` string)
```
borrador → pendiente_aprobacion → enviado → aprobado → convertido
              (condicional)         │           │
                                    ├→ rechazado (motivo picklist)
                                    └→ vencido  (auto por fechaValidez)
```
- "Visto" NO es estado: es `primeraVistaEl` (timestamp del link
  público) mostrado como badge sobre "enviado" — evita explosión de
  estados.
- Motivos de pérdida (picklist v1): `precio`, `plazo`,
  `sin_respuesta`, `competencia`, `otro` (+detalle).
- `aprobado` y `convertido` separados a propósito: el cliente aprueba
  hoy y la OT se emite cuando corresponde (seña, fecha). Conversión
  parcial: los items elegidos van a la OT; el presupuesto guarda qué
  se convirtió.
- Vencido: job diario o chequeo lazy al leer/aceptar; para aceptar un
  vencido → revisión con recotización (existe `recotizarItem`).

### Modelo de datos (cambios Prisma)
- `Cotizacion` +: `numero` real (vía `CotizacionContador`, formato
  `PRES-AAAA-NNNN`), `vendedorEmpleadoId` (hoy falta), `fechaEnvio`,
  `fechaResuelto`, `motivoPerdida`, `motivoPerdidaDetalle`,
  `publicToken @unique`, `primeraVistaEl`, `numeroRevision Int
  @default(0)` + `revisionDeId` (self-ref; una sola activa),
  `aprobacionInterna` (null | pendiente | aprobada + `aprobadaPorId/El`),
  `senaSugeridaPct`, `condicionesJson/observaciones` para el PDF.
- `CotizacionEvento`: timeline tipo `OrdenTrabajoEvento` (creado,
  enviado, visto, aprobado por el cliente con IP/timestamp = firma
  virtual, rechazado, vencido, convertido, revisión creada). Es el
  "History" que la industria usa como respaldo.
- `CotizacionItem.productoId` → **nullable** + campos de item libre:
  `descripcionLibre`, `precioUnitarioManual`, `costoManual?` — ver §5.
- `ConfiguracionPresupuestos` (tenant, patrón ConfiguracionProduccion):
  `validezDiasDefault` (15), `senaSugeridaPctDefault` (50),
  `aprobacionMontoMax` (umbral de tu ejemplo), `aprobacionMargenMin`,
  `aprobacionDescuentoMaxPct`, `requiereAprobacionItemsSinCosteo`,
  `condicionesTexto` (T&C del PDF).

### Aprobación interna (tu caso del umbral)
- Reglas evaluadas al pasar a "enviar": monto total > umbral, margen
  del snapshot < mínimo, % descuento vs. precio de lista > máximo, o
  items sin costear. Si dispara → `pendiente_aprobacion`, **bloquea**
  el envío y el link público; SUPERVISOR/ADMINISTRADOR aprueba o
  devuelve (mecanismo `@Roles` existente). Todo queda en el timeline.
- OPERADOR dentro del umbral envía solo (no burocratizar lo chico).

### Entrega al cliente
1. **PDF** (`presupuesto-pdf.service.ts`, clon del de factura): con la
   info de §1 y las condiciones de `ConfiguracionPresupuestos`.
2. **Link público** `/presupuesto/[token]` (patrón tracking):
   co-branded, muestra items/total/validez, botones **Aprobar** /
   **Rechazar (con comentario)**; registra `primeraVistaEl` y la
   aprobación con timestamp. Un presupuesto vencido muestra "vencido —
   pedí una actualización".
3. **WhatsApp nivel 1** desde el día 1: botón "compartir" que arma
   `wa.me/<tel>?text=<saludo + link público>` — gratis, sin API.
4. **Email**: requiere elegir proveedor (no hay infra SMTP hoy) — F3,
   decisión de producto/costo aparte.
5. El envío marca `enviado` + `fechaEnvio`; "marcar como enviado"
   manual también existe (para el que lo imprime y lo lleva).

### Conversión a OT
- Acción "Convertir en orden": selecciona items (checklist), crea la OT
  con los `cotizacionItemId` congelados (el mecanismo actual intacto),
  estado del presupuesto → `convertido`, referencia cruzada visible en
  ambos. La venta directa de mostrador (ficha → OT en el acto) sigue
  existiendo tal cual: el presupuesto es un camino NUEVO, no reemplaza
  al rápido.

### Items fuera de catálogo (tu pregunta: sí)
- Línea libre: descripción + cantidad + precio manual (+ costo manual
  opcional). Marcada **"sin costeo"**: excluida del margen (declarado,
  como `itemsSinCosto` del Panel) y disparador de aprobación interna si
  la config lo pide. La OT ya soporta items sin snapshot
  (`cotizacionItemId` null) — el camino de datos existe; falta UI y
  relajar el `productoId`.

### Vista en Comercial
- **"Presupuestos"** en el nav de Comercial: listado server-driven
  (patrón del listado de OTs) con chips por estado, filtros
  (cliente/vendedor/rango), totales por estado (pipeline en $), y
  acciones por fila (abrir, PDF, compartir, convertir, revisar).
- La ficha actual se reusa: el toggle "Presupuesto" pasa a ser REAL
  (guarda presupuesto en vez de OT). Detalle del presupuesto = ficha
  rehidratada (misma decisión que OT) + timeline + panel de estado.

### Métricas que se destraban (ya diseñadas, esperando esto)
Win rate por vendedor/categoría/monto · pipeline en $ por estado y
antigüedad · tiempo de respuesta (creado→enviado) y de decisión
(enviado→resuelto) · motivos de pérdida · funnel completo del tab
Comercial (los "RETIRADO del diseño" del plan del Panel vuelven todos).

## 5. Journeys (casos de uso)

1. **Mostrador rápido** (sin cambios): ficha → emitir OT. El cliente
   está adelante y compra ya.
2. **Presupuesto formal** (nuevo): ficha en modo Presupuesto → guardar
   → [umbral → aprobación del supervisor] → enviar (PDF/link/WhatsApp)
   → cliente lo ve (badge visto) → aprueba online o el vendedor marca
   la decisión → [seña] → convertir (total o parcial) en OT →
   producción. Rechazo → motivo → alimenta métricas.
3. **Vencimiento**: pasa solo a vencido; "revisar" crea `-R1`
   recotizada (una activa), re-pasa por aprobación si corresponde.
4. **Fuera de catálogo**: línea libre "sin costeo" convive con items
   calculados; si la config lo exige, pasa por aprobación.

## 6. Fases propuestas

- **F1 — el ciclo** (el 80% del valor): estados + numeración +
  vendedor + validez con vencimiento + motivos de pérdida + listado
  Presupuestos en Comercial + ficha guardando presupuesto real +
  convertir (total/parcial) + PDF + link público con
  aprobar/rechazar/visto + compartir por `wa.me` + timeline
  (CotizacionEvento). Sin aprobación interna todavía.
- **F2 — control y flexibilidad**: aprobación interna por umbrales
  (`ConfiguracionPresupuestos` + UI de config), items fuera de
  catálogo, revisiones `-R1` formales.
- **F3 — canales y cobro**: email (elegir proveedor), seña online
  (Mercado Pago) al aprobar, WhatsApp Business API (templates),
  recordatorios de vencimiento automáticos.

## 7. Decisiones abiertas (para confirmar antes de F1)

1. Naming "Presupuestos" en UI (recomendado) — ¿ok?
2. Validez default 15 días (estándar industria) — ¿ok?
3. ¿La ficha con toggle real, o "Presupuesto" como flujo separado de
   la ficha? (Recomendado: mismo workspace, toggle real — una sola
   herramienta comercial.)
4. Umbrales de aprobación: definir defaults (ej. monto > $X, margen <
   25% — el mismo margenPctMin de insights, items sin costeo) — F2,
   pero la config nace en F1 para no migrar después.
5. Picklist de motivos de pérdida: ¿los 5 propuestos alcanzan?

## 8. Estado

Estudio completo, sin implementación. Fuentes: relevamiento propio del
repo + Printavo (quote pipeline, approvals, automations), PrintVis
(case management, versiones), DocketManager (requote/convert), shopVOX
(conversión parcial, seña), SAP CPQ (revisiones, expiración), HubSpot
(quote approvals), DealHub/PandaDoc/Proposify (visto, links), Treinta
(cotizaciones por WhatsApp en LATAM), Meta (pricing API WhatsApp).
URLs en el informe de investigación de la sesión 2026-07-18.
