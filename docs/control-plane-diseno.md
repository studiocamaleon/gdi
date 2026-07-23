# Control plane — el plano de la Plataforma

Grafo hoy tiene un solo plano: el de tenant. Todo usuario —incluida
Corporearte, que es de Grupo Idea— opera *dentro* de una empresa, con roles de
empresa (`RolSistema` en `Membership`) y el `tenant-guard` aislando sus datos.
No existe nada *por encima* de los tenants: ni métricas del SaaS, ni ciclo de
vida de empresas, ni forma de que Grupo Idea entre a asistir a un cliente.

Este documento diseña ese plano que falta: el **control plane**, la superficie
desde la que Grupo Idea opera *el SaaS en sí* — a través de todos los tenants.
Es el patrón estándar de la industria (el back-office/staff console de Stripe,
Shopify, Vercel): una superficie separada de la app del cliente, con identidad
y permisos propios.

## Los dos planos, en una tabla

|  | Tenant plane (existe) | Control plane (este diseño) |
|---|---|---|
| Quién | Usuarios de una imprenta | Staff de Grupo Idea |
| Identidad | `Membership` (rol POR empresa) | `User.rolPlataforma` (rol global, sin membership) |
| Alcance | UN tenant, aislado por el guard | Todos los tenants, sin contexto de tenant |
| Rutas | `/api/*` actuales | `/api/plataforma/*` + front `/plataforma` |
| Datos | Órdenes, cobros, clientes… | Tenants, planes, suscripciones, salud, auditoría |

## Principios (qué NO se hace)

1. **No se agrega SUPERADMIN a `RolSistema`.** Ese enum vive en `Membership`,
   que es por-tenant. Un admin de plataforma no es "admin de una empresa":
   está arriba de las empresas. Meterlo ahí obligaría a darle membership en
   cada tenant y contamina el modelo de aislamiento que ya funciona.
2. **No hay god-mode silencioso.** Entrar a un tenant es un acto explícito,
   con motivo, vencimiento y rastro (ver Impersonation). Nunca una llave que
   abre todo sin que quede registrado.
3. **No se reusan services de tenant desde el control plane "porque andan".**
   El tenant-guard NO filtra cuando no hay contexto (comportamiento
   deliberado, fijado en `aislamiento-tenants.spec.ts`): un service de negocio
   llamado sin contexto lee TODO. Eso es exactamente lo que el control plane
   necesita — y exactamente por lo que sus services son propios, chicos y en
   su módulo, no llamadas casuales a los existentes.
4. **Etapas con riesgo creciente.** Primero lectura (consola), después
   escritura acotada (ciclo de vida, planes), al final impersonation. Cada
   etapa es útil sola.

## Identidad de plataforma

Una columna en `User`, no una tabla aparte:

```prisma
enum RolPlataforma {
  /// Todo: ciclo de vida de tenants, planes, billing, impersonation.
  ADMIN
  /// Consola de sólo lectura + impersonation (cuando exista). Sin escrituras.
  SOPORTE
}

model User {
  // ...
  /// Rol en el CONTROL PLANE. Null = usuario común (la enorme mayoría).
  /// Ortogonal a Membership: se puede ser staff sin membership en ningún
  /// tenant, y tener memberships sin ser staff (Corporearte).
  rolPlataforma RolPlataforma?
}
```

Por qué columna y no tabla: el chequeo corre en cada request del namespace
`/plataforma` y el guard ya tiene el `User` resuelto — una tabla agregaría un
join para guardar metadata (quién lo otorgó, cuándo) que va mejor en el log de
auditoría (`PlataformaEvento`, abajo). Otorgar/revocar el rol ES un evento
auditado; el estado vigente es la columna.

Alta del primer admin: seed/script (no hay UI que lo otorgue hasta que exista
un admin que la use). Después, un ADMIN otorga roles desde la consola.

## Guard y rutas

- **API**: módulo `plataforma/` con controllers bajo `@Controller('plataforma')`
  y un `PlataformaGuard` que exige sesión válida + `rolPlataforma` (y para
  escrituras, `ADMIN`). Corre **sin `runWithTenant`**: sin contexto, el
  tenant-guard no filtra y las lecturas cross-tenant salen con Prisma normal
  (`groupBy` por `tenantId`) — mismo fundamento que los crons, sin
  `$queryRawUnsafe` salvo necesidad real.
- **Front**: grupo de rutas `/plataforma` con chrome propio y mínimo (no el
  sidebar de la app de tenant: que se SIENTA otra superficie). El link aparece
  sólo si la sesión trae `rolPlataforma`. El middleware actual ya exige sesión
  para todo lo no-público; la autorización fina la hace el API.
- La sesión es la misma (`AuthSession`): el staff es un `User` normal que
  además tiene el rol. No hay "login de plataforma" separado — hay
  *autorización* separada.

## Etapa A — Consola de sólo lectura

La vista de "la Plataforma": lista de tenants + salud + métricas agregadas.
Todo con datos que ya existen; cero escrituras.

**Por tenant** (la tabla central de la consola):
- Identidad: nombre, slug, `activo`, `createdAt` (antigüedad).
- Gente: usuarios activos (memberships activas), último login (max
  `AuthSession.createdAt`).
- Actividad: OTs emitidas últimos 30d, cotizaciones 30d, cobros 30d — el
  pulso de si la imprenta USA el sistema (señal de churn).
- Storage: `bytesArchivos` / `cuotaBytesArchivos` (ya denormalizado).
- Integraciones: estado de WATI y AFIP (`IntegracionTenant.estado`).
- Salud: notificaciones WhatsApp fallidas/pendientes viejas, últimos
  `ultimoErrorTexto` de integraciones.

**Agregado** (cards de arriba): tenants activos, usuarios totales, OTs del mes
en toda la plataforma, storage total, tenants sin actividad en 14d (alerta).

MRR y métricas de negocio del SaaS quedan para la etapa B: sin planes no hay
precio que sumar.

## Etapa B — Planes, suscripciones y ciclo de vida

### Modelos

```prisma
/// Catálogo de planes del SaaS. Nivel plataforma (sin tenantId), como
/// MaterialPreset: mismos planes para todos.
model Plan {
  id           String  @id @default(uuid()) @db.Uuid
  codigo       String  @unique          // "inicial" | "pro" | "max"
  nombre       String
  precioMensual Decimal @db.Decimal(14, 2)
  /// Qué habilita: { afip: true, whatsapp: true, usuariosMax: 10,
  /// storageGb: 20 }. JSON a propósito: los features van a cambiar más
  /// rápido que el schema.
  featuresJson Json
  activo       Boolean @default(true)
  orden        Int     @default(0)
}

/// La suscripción del tenant. CON tenantId y SIN eximir del guard: el propio
/// tenant la lee (para saber qué features tiene) y el control plane la
/// escribe. Una por tenant.
model Suscripcion {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @unique @db.Uuid
  planId    String   @db.Uuid
  /// 'activa' | 'suspendida' | 'baja'
  estado    String   @default("activa")
  desde     DateTime
  hasta     DateTime?
  notas     String?
  // relaciones + índices
}
```

### El gate por plan

Acá se engancha lo que quedó listo en la integración AFIP: hoy el interruptor
de facturación depende sólo de la delegación verificada. Con suscripciones,
`AfipIntegracionService.activar` consulta además el feature del plan
(`featuresJson.afip`) y la vista muestra "tu plan no incluye facturación
electrónica" en vez del interruptor. Mismo patrón para futuros gates
(WhatsApp, límites de usuarios, storage — `cuotaBytesArchivos` pasa a salir
del plan).

**Regla de forma**: los services de tenant preguntan por un
`SuscripcionService.feature(tenantId, 'afip')` — nunca leen `featuresJson`
directo. Un solo lugar decide qué incluye un plan.

### Ciclo de vida

- **Crear tenant** desde la consola (hoy es a mano en la base): nombre, slug,
  plan, invitación al primer admin. Reusa `Invitation`.
- **Suspender**: `Tenant.activo = false`. El mecanismo de corte YA existe —
  el auth guard valida `currentTenant.activo` en cada request
  ([auth.guard.ts](../apps/api/src/auth/auth.guard.ts)) — sólo falta el botón
  y el motivo (a `PlataformaEvento`). Suspender NO borra nada.
- **Baja**: fuera de alcance de esta etapa (retención de datos, export,
  plazos legales — merece diseño propio).

### Billing de las suscripciones

**Decisión: se reusa el módulo fiscal existente, emitiendo desde el tenant de
Grupo Idea.** Grupo Idea ya es un tenant (Corporearte) con configuración
fiscal, punto de venta, provider AFIP con CUIT propio, PDF y CAE andando. La
factura de suscripción es un `Comprobante` común emitido EN ese tenant, con
receptor = datos fiscales del tenant cliente.

- El control plane orquesta: por cada `Suscripcion` activa genera el borrador
  mensual (concepto "Suscripción Grafo — plan X — período Y") en el tenant
  plataforma, que se emite con el flujo normal.
- **Punto de venta dedicado** para el SaaS (distinto del de la imprenta):
  numeración correlativa propia y el libro IVA de suscripciones separable del
  de trabajos gráficos. Es la mitigación al único costo real de esta decisión
  (mezclar dos negocios en un tenant); si mañana Grupo Idea y Corporearte se
  separan en CUITs distintos, se crea el tenant nuevo y se mueve el flag.
- Qué tenant es "el de la plataforma": `Tenant.esPlataforma Boolean` (uno
  solo, validado). Preferible a un env: es un dato del dominio, y la consola
  lo muestra.

La alternativa —tablas de facturación propias del control plane— se descarta:
duplicaría numeración, CAE, PDF, libro IVA y AFIP para un solo emisor.

Cobro automático (MP) de las suscripciones: fuera de alcance; primero emitir.

## Etapa C — Impersonation ("entrar como")

La pieza delicada, al final y con requisitos duros. El patrón de la industria
no es un usuario con acceso permanente a todo: es una **sesión explícita,
con motivo, vencimiento y rastro visible**.

### Modelo

```prisma
/// Una entrada de staff a un tenant. Nivel plataforma.
model SesionImpersonacion {
  id          String    @id @default(uuid()) @db.Uuid
  staffUserId String    @db.Uuid
  tenantId    String    @db.Uuid
  /// Obligatorio y visible al tenant: "ticket #412, no le sale el PDF".
  motivo      String
  creadaEl    DateTime  @default(now())
  /// Corta sola: 60 min. Renovar = otra sesión (otro registro).
  expiraEl    DateTime
  cerradaEl   DateTime?
}
```

### Mecánica

- `AuthSession.currentMembershipId` pasa a **nullable** y se agrega
  `impersonacionId` nullable — es el único toque estructural al auth. Una
  sesión tiene membership (camino normal) o impersonación (staff), nunca
  ninguna de las dos.
- El guard resuelve `CurrentAuth` desde la impersonación con rol
  `ADMINISTRADOR` del tenant + flags nuevos: `impersonando: true`,
  `actorNombre`. Expirada o cerrada → la sesión vuelve al plano plataforma.
- **Toda mutación queda firmada "en nombre de"**: los eventos que ya registran
  `usuarioNombre` (OTs, cotizaciones, cobros) reciben "Soporte Grafo
  (Nombre)" — el rastro queda EN el timeline que el tenant ya ve, no en un
  log oculto.
- El tenant lo ve: banner en la consola del staff ("estás dentro de X") y
  registro consultable por el admin del tenant de quién entró, cuándo y por
  qué.
- `SOPORTE` puede impersonar; revocar sesiones ajenas es de `ADMIN`.

### Límites deliberados

Impersonando NO se puede: tocar integraciones (conectar/desconectar Wati,
activar AFIP), borrar archivos, ni administrar usuarios del tenant. Soporte
diagnostica y opera el negocio del cliente; no toma control de su cuenta.

## Auditoría transversal

```prisma
/// Todo lo que el staff hace en el control plane. Nivel plataforma,
/// append-only (sin update/delete desde la app).
model PlataformaEvento {
  id          String   @id @default(uuid()) @db.Uuid
  staffUserId String   @db.Uuid
  /// 'tenant_creado' | 'tenant_suspendido' | 'plan_cambiado' |
  /// 'rol_otorgado' | 'impersonacion_iniciada' | ...
  tipo        String
  tenantId    String?  @db.Uuid
  descripcion String
  datosJson   Json?
  createdAt   DateTime @default(now())
}
```

Desde la etapa A (los eventos de lectura no se auditan; toda escritura sí).

## Encaje con el test de aislamiento

`aislamiento-tenants.spec.ts` exige justificar todo modelo sin `tenantId`.
Los nuevos: `Plan`, `PlataformaEvento`, `SesionImpersonacion` → a
`SIN_TENANT_ID_JUSTIFICADOS` y `MODELOS_EXENTOS` (nivel plataforma, como
`Tenant` y `CronLock`). `Suscripcion` **no** se exime: tiene `tenantId` y el
guard la cubre — el tenant lee la suya, la plataforma (sin contexto) las lee
todas. Es la prueba de que el diseño respeta el modelo de aislamiento en vez
de agujerearlo.

## Orden de ejecución

| Etapa | Entrega | Riesgo |
|---|---|---|
| A | `rolPlataforma` + guard + consola read-only (tenants, salud, métricas) | Bajo: sólo lectura |
| B1 | Planes + suscripciones + gate por plan (AFIP primero) + crear/suspender tenant | Medio: escrituras acotadas |
| B2 | Billing mensual de suscripciones vía tenant plataforma + PV dedicado | Medio: emite comprobantes reales |
| C | Impersonation auditada | Alto: acceso a datos de terceros |

Cada etapa es mergeable sola; A no depende de nada y destraba la pregunta
original ("métricas de la plataforma, no de una empresa").

## Fuera de alcance (anotado, no olvidado)

- 2FA para staff (deseable antes de C en producción).
- Dominio/deploy separado para la consola (`admin.grafo.ar`); arranca como
  grupo de rutas.
- Self-serve signup de tenants (hoy el alta la hace Grupo Idea).
- Cobro automático de suscripciones (Mercado Pago) y dunning.
- Baja de tenant con retención/export de datos.
