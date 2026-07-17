# Seguimiento público de OT (cliente) — diseño

> Análisis 2026-07-17 (rama `feat/tablero-ordenes-reales`). Diseño de origen:
> claude.ai/design proyecto Grafoprint, `tracking/` (Order Tracking.html +
> tracking.css + tracking-mobile.jsx). Vista PÚBLICA, mobile-first, accesible
> por link privado sin login, co-branded (imprenta + "Powered by Grafoprint").

## 1. Qué es

Una página pública que el cliente abre desde un link privado para ver el
avance de su orden de trabajo en producción, en lenguaje claro. El staff
comparte el link desde el detalle de la OT.

Decisiones del usuario (2026-07-17):
- **D-N1 — Nivel ORDEN**, un solo link por OT. Si la OT tiene varios items,
  se muestra un **acordeón**: un panel expandible por item, todos en el mismo
  link.
- **D-N2 — Hero neutro**: se conserva la estética de la animación del diseño
  (flujo moderno) pero SIN datos concretos de máquina ni contador de pliegos
  (no existen, ver §3). La animación corre y nombra el **paso actual**; sirve
  para cualquier producto (offset, gran formato, vinilo, DTF…).
- **D-N3 — Token estable**: columna `publicToken` única y aleatoria en la OT,
  generada al emitir. Link permanente (sin vencimiento/revocación en fase 1).

## 2. Mapeo diseño → datos reales

### Mapea limpio ✅
| Diseño | Fuente real |
| --- | --- |
| Número, estado, progreso | `OrdenTrabajo.numero/estado/progresoPct` |
| Timeline de pasos por item | `OrdenTrabajoItemPaso` (indice, nombre, estado, iniciadoEl, completadoEl, duracionEstimadaMin) |
| Specs del producto | `OrdenTrabajoItem.specsJson` (etiqueta/valor) |
| Cliente (primer nombre, iniciales) | `Cliente.nombre` (derivado) |
| Vendedor + llamar/WhatsApp | `Empleado.nombreCompleto`, `telefonoCodigo+Numero`, `emailPrincipal` |
| Actividad reciente | `OrdenTrabajoEvento` (curado, ver §4) |
| Imprenta (nombre + iniciales) | `Tenant.nombre` (derivado) |
| Entrega estimada (fecha) | `OrdenTrabajo.fechaEntrega` (date-only) |

### No tiene fuente — se adapta/quita ⚠️
- **"Pliego 168 de 250" + barra viva del paso**: no hay avance parcial dentro
  de un paso. → se quita. El paso muestra estado + duración estimada.
- **Máquina concreta + "restan 38 min"**: el paso guarda centro de costo, no
  máquina; no hay minutos-restantes reales. → la animación es decorativa y
  nombra el paso; el detalle del paso actual muestra la **estación** (centro
  de costo, como en el tablero), sin minutos vivos.
- **Texto amigable por paso** ("Recibimos tu pedido y archivo"): sólo existe
  el `nombre` técnico. → diccionario `familiaCodigo → { simple, desc }` en el
  front (deriva copy amigable de la familia del paso); el `nombre` real queda
  como línea técnica.
- **Entrega: método + dirección + ventana horaria**: sólo hay `fechaEntrega`
  (sin hora). → se muestra la fecha; se omiten método/dirección/ventana.
- **Logo/colores de la imprenta**: el tenant no tiene branding. → marca
  monocroma con iniciales del nombre. Logo real = futuro.
- **"EN VIVO · act. hace 12s"**: no hay realtime. → "actualizado hace {t}"
  con la fecha real del último evento; la página revalida al cargar (polling
  opcional a futuro). El pill "En producción" se deriva del estado.
- **UrlBar del mock** (barra de navegador falsa): es chrome del mockup. → fuera.
- **Confetti**: se dispara cuando la OT llega a `finalizada`/`entregada`
  (no en cada paso; en el mock era un botón demo).

## 3. Estructura de la página (adaptada)

Orden vertical (mobile 390px, el CSS del diseño es self-contained con tokens
`--t-*`, se porta verbatim sin remap):

1. **BrandBar** — marca de la imprenta (iniciales + nombre + "Tu pedido en
   producción") · "Powered by Grafoprint".
2. **LiveStrip** — "Sincronizado con planta · actualizado hace {t}".
3. **Hello** — "Hola {primerNombre}, tu pedido está {estadoNarrativo}." +
   sub con el paso global actual.
4. **DeliverStrip** — entrega estimada (fecha) + progreso global de la OT.
5. **Acordeón de items** — un panel por `OrdenTrabajoItem`:
   - Header: nombre del producto + mini-progreso + pill de estado.
   - Body (expandido): **hero-animación neutra** (sólo si el item está en
     producción, nombrando su paso actual) + **timeline** de sus pasos +
     **specs**.
   - Con 1 item (caso común) el panel arranca abierto → se ve como el diseño.
6. **Contact** — vendedor con botones llamar/WhatsApp (tel real).
7. **Activity** — feed curado de eventos de la orden.
8. **Share footer** — "link privado" + "Hecho con Grafoprint".

(Se omiten del diseño: ActionsBar "Necesito un cambio/Compartir" — el
"compartir" es del staff, no del cliente; se puede sumar un botón de contacto
por WhatsApp al vendedor que ya está en Contact.)

## 4. Contrato del endpoint público

`GET /ordenes-trabajo/track/:token` — **@Public()**, throttled. Resuelve la OT
por `publicToken`; como no hay sesión, el aislamiento multi-tenant de Prisma
está inactivo, así que el service **envuelve las queries en
`runWithTenant(orden.tenantId, ...)`** tras resolver el token, y devuelve sólo
una proyección mínima cliente-facing (nunca montos, costos ni datos internos):

```ts
type TrackingPublico = {
  numero: string;
  estado: string;                 // pendiente|produccion|finalizada|entregada
  creadaEl: string;               // ISO
  fechaEntrega: string | null;    // ISO date
  progresoPct: number;            // 0-100 (derivado de pasos)
  imprenta: { nombre: string; iniciales: string };
  cliente: { primerNombre: string; iniciales: string };
  vendedor: { nombre: string; iniciales: string; telefono: string | null } | null;
  items: Array<{
    id: string; nombre: string;
    specs: Array<{ etiqueta: string; valor: string }>;
    progresoPct: number;
    pasoActual: string | null;    // nombre del paso en curso/próximo
    estacionActual: string | null;
    pasos: Array<{
      indice: number;
      nombre: string;             // técnico
      familiaCodigo: string;      // para el copy amigable del front
      estado: string;             // pendiente|en_curso|hecho|bloqueado
      completadoEl: string | null;
      duracionEstimadaMin: number | null;
    }>;
  }>;
  actividad: Array<{ fecha: string; texto: string }>;  // curado
};
```

Sólo OTs emitidas (`pendiente|produccion|finalizada|entregada`); `borrador`
→ 404 (no tiene token). Token inexistente → 404 genérico (no filtra si existe).

Actividad curada: se toman eventos `origen='sistema'` o `tipo IN
('emision','estado','paso')`, se reescriben a copy cliente-facing y se limita
a los últimos ~8. Nunca eventos de edición comercial/montos.

El token también se expone en el **detalle interno** de la OT
(`GET /ordenes-trabajo/:id`) para que el staff copie/comparta el link.

## 5. Modelo

```prisma
model OrdenTrabajo {
  // ...
  /// Token aleatorio url-safe para el link público de seguimiento del
  /// cliente. Se genera al emitir (salir de borrador). null = no compartible.
  publicToken String? @unique
}
```

Generación: en `create()` cuando nace emitida y en `cambiarEstado()` al salir
de `borrador`; backfill perezoso para OTs ya emitidas sin token (al pedir el
detalle o el tablero). Token = `crypto.randomBytes(16)` base64url (~22 chars).

## 6. Frontend

- Ruta pública `src/app/track/[token]/page.tsx` (server component, fetch al
  API público; NO cuelga del layout `(dashboard)`). Agregar `/track` a
  `PUBLIC_PATHS` en `middleware.ts`.
- CSS: `tracking.css` del diseño portado verbatim a globals (tokens `--t-*`
  self-contained, sin colisión). Componentes adaptados a la proyección real +
  el acordeón por item + el diccionario de copy por familia.
- En el detalle interno de la OT: botón "Compartir seguimiento" que copia
  `{origin}/track/{publicToken}`.

## 7. Fases

- **Fase A (backend):** migración `publicToken` + generación/backfill +
  endpoint público `@Public()` con `runWithTenant` + proyección + token en el
  detalle interno. Tests del curado de actividad y del token.
- **Fase B (frontend):** ruta pública + CSS portado + página (brand, hello,
  entrega, acordeón de items con timeline/specs, contacto, actividad, footer)
  + diccionario de copy por familia + botón compartir en el detalle.
- **Futuro:** logo/branding real del tenant, ventana horaria y método de
  entrega, realtime/polling, revocación/vencimiento del link, sub-progreso de
  paso si algún día se trackea.
