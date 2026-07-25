# Usuarios, roles y permisos — diseño

**Fecha:** 2026-07-24
**Estado:** F1 IMPLEMENTADA. F2 y F3 pendientes (ver §6).

---

## 0. Por qué ahora (el hallazgo que apura todo)

El disparador no es que falte una pantalla de usuarios. Es que **hoy no hay
autorización real**, y ya hay operarios logueándose.

Lo que encontré revisando el estado actual:

| Capa | Estado |
|---|---|
| Roles | 3 fijos en un enum de Prisma: `ADMINISTRADOR`, `SUPERVISOR`, `OPERADOR` |
| Backend | 301 endpoints en 26 controllers. **23 declaran `@Roles`.** |
| `RolesGuard` | Sin `@Roles`, **permite a cualquier autenticado** (default abierto) |
| Frontend | **Cero gates por rol.** 8 módulos y ~35 pantallas visibles para todos |
| `usuariosMax` | Existe en `Plan.featuresJson` y **no se aplica en ningún lado** |

Traducido: el operario que entra a fichar en la mesa de trabajo tiene en el
sidebar Costos (márgenes de cada producto), Administración (tesorería, datos
fiscales) y Configuración (integraciones), y el API se los sirve. Nadie lo
notó porque nadie fue a mirar, pero es un agujero abierto, no una feature
faltante.

Eso cambia el orden de lo que hay que hacer: **primero cerrar, después
personalizar.** Un editor de roles hermoso sobre un backend que deja pasar todo
es decoración.

---

## 1. El modelo: rol y permiso son dos cosas

Decisión: **permisos como claves, roles como conjuntos de claves**, y el rol
pasa a ser una fila del tenant en vez de un valor de enum.

```
Rol (por tenant)
  id, tenantId, nombre, descripcion
  esDelSistema: Boolean   // los 5 predefinidos: no se borran ni se renombran
  permisos: String[]      // ["comercial.gestionar", "costos.ver", ...]

Membership
  rolId → Rol             // nuevo
  rol: RolSistema         // el enum, se mantiene durante la transición
```

**Por qué claves en un array y no una tabla `RolPermiso`.** El set de permisos
lo define Grafo en código (como el catálogo de plantillas de Wati), no el
tenant: no hay que consultarlo, filtrarlo ni joinearlo — se lee entero cada vez
que se evalúa uno. Una tabla de N filas por rol para eso es una junta más en
cada request sin nada a cambio. Si mañana un permiso deja de existir, la clave
huérfana en el array se ignora; con FKs habría que migrar.

**Por qué el enum se queda un rato.** `Membership.rol` viaja en el JWT, lo usan
23 endpoints y el front lo tiene en `tenantActual.rol`. Se mantiene como rol
base (y como fallback si `rolId` es null) hasta que todo esté migrado, y recién
después se retira. Cambiar las dos cosas a la vez es garantizar un fin de
semana de 403 inexplicables.

### 1.1 Granularidad: dos niveles, no cuatro

Los ~35 destinos del sidebar se agrupan en **8 módulos**, y cada uno tiene dos
permisos:

- `<modulo>.ver` — entra y lee.
- `<modulo>.gestionar` — crea, edita, borra. Implica `ver`.

Son 16 claves. La alternativa CRUD completa (ver/crear/editar/eliminar × 8) da
32 casillas y no la usa nadie: en una imprenta de 6 personas no existe el
"puede crear clientes pero no editarlos".

| Módulo | Cubre |
|---|---|
| `panel` | Panel general y sus métricas |
| `comercial` | Crear orden, presupuestos, órdenes de trabajo |
| `registros` | Clientes, proveedores, empleados |
| `costos` | Centros, maquinaria, gastos fijos, rutas, catálogo, cargos, impuestos, comisiones |
| `produccion` | Tablero, mesa de trabajo, simuladores, estaciones, ETA |
| `administracion` | Tesorería, comprobantes, facturación, deudores, métodos de pago, datos fiscales |
| `inventario` | Materiales, movimientos |
| `configuracion` | Integraciones, **usuarios y roles**, suscripción |

### 1.2 El permiso que de verdad importa: ver plata

Aparte de los 16, un permiso transversal:

- `finanzas.ver_margenes` — costos unitarios, contribución, márgenes, precios
  de compra.

Va aparte porque **la plata no vive en un módulo**. El margen se filtra en el
cotizador (Comercial), en el desglose de la OT (Producción), en el panel
(métricas) y en los reportes. Derivarlo de "acceso a Costos" no alcanza: el
vendedor necesita cotizar sin ver cuánto gana la imprenta en cada renglón, y
hoy lo ve todo.

Es, además, el permiso que una imprenta pide primero. Vale su propia clave.

Otros dos candidatos del mismo tipo, para F3 y no antes:
`comercial.aprobar_descuento` (por encima de un umbral) y
`administracion.anular` (anular un cobro o descartar un comprobante).

---

## 2. Los cinco roles predefinidos

Se siembran por tenant con `esDelSistema: true`. Son editables en permisos pero
no se borran ni se renombran — y sirven de plantilla: "duplicar" un
predefinido es el camino esperado para hacerse uno propio.

| Rol | Permisos |
|---|---|
| **Administrador** | Todo, incluida `configuracion.gestionar` y `finanzas.ver_margenes` |
| **Jefe de producción** | `produccion.gestionar`, `comercial.ver`, `registros.ver`, `inventario.gestionar`, `costos.ver`, `panel.ver`, márgenes |
| **Vendedor** | `comercial.gestionar`, `registros.gestionar`, `produccion.ver`, `panel.ver`. **Sin márgenes** |
| **Administrativo** | `administracion.gestionar`, `comercial.ver`, `registros.ver`, `panel.ver`, márgenes |
| **Operario** | `produccion.ver` y nada más. Es la mesa de trabajo y su propio desempeño |

El de Operario es el que cierra el agujero de §0.

---

## 3. Plan y permiso son ortogonales (y no hay que mezclarlos)

La idea de "que sólo pueda configurar permisos de los módulos del plan" es
correcta en la intención y peligrosa en la implementación literal.

**El plan decide qué módulos existen para la empresa. El rol decide quién los
usa.** Si el plan no incluye AFIP, el problema no es que el rol tenga permiso:
es que el módulo no tiene que estar para nadie, ni para el dueño.

Entonces:

- El gate real es **AND**: `plan.incluye(modulo) && rol.puede(permiso)`.
- El editor de roles muestra los módulos fuera del plan **atenuados**, con
  "Incluido en el plan Estudio". Es el mejor lugar del sistema para un upsell:
  el admin está mirando exactamente la capacidad que le falta.
- Los permisos guardados **no se borran** al bajar de plan. Si el tenant vuelve
  a subir, sus roles siguen configurados. Borrarlos convierte un cambio de plan
  reversible en una pérdida de configuración.

`usuariosMax` se aplica al invitar, no antes: el que ya entró no se queda
afuera porque el plan bajó. El listado avisa "6 de 6 usuarios" y el botón de
invitar explica qué plan lo levanta.

---

## 4. Usuario ≠ empleado (y por eso el submódulo va aparte)

Estoy de acuerdo con mover la invitación, y la razón es más de fondo que la
ubicación: **hoy están pegados y no son lo mismo**.

- Hay usuarios que no son empleados: el dueño, el contador externo, el socio.
- Hay empleados que nunca se loguean: la mayoría del taller.
- El legajo (sector, fecha de ingreso, comisiones, dirección) y la cuenta
  (email, rol, contraseña, sesiones) tienen ciclos de vida distintos. Se da de
  baja a un empleado y hay que cortarle el acceso *ya*; se le cambia el rol y
  el legajo no cambia.

Hoy `provisionEmployeeAccess` exige `empleadoId`, así que un usuario que no sea
empleado no se puede crear desde la UI. `Invitation.empleadoId` ya es opcional
en el modelo: el desacople no pide migración, pide pantalla.

**Propuesta:**

- **Configuración → Usuarios** es el lugar canónico: invitar, ver estado,
  cambiar rol, desactivar, reenviar invitación, cerrar sesiones.
- Vincular a un empleado es un campo **opcional** del usuario (un select). Sirve
  para lo que ya usa `Empleado.userId`: fichar en la mesa, atribuir comisiones,
  medir desempeño.
- En la ficha del empleado, el formulario de invitación se reemplaza por una
  línea de estado: *"Tiene acceso al sistema como Operario"* con link a
  Usuarios, o *"Sin acceso — darle acceso"* que lleva al mismo lugar con el
  empleado preseleccionado. No se pierde el camino corto; deja de haber dos
  formularios que hacen lo mismo.

### 4.1 Dos cosas del flujo actual que hay que arreglar de paso

1. **El acceso se otorga antes de aceptar.** `provisionEmployeeAccess` hace
   `membership.upsert({ activa: true })` en la misma transacción que la
   invitación: el usuario ya tiene acceso, la invitación sólo le sirve para
   fijar contraseña. Es defendible, pero entonces el listado tiene que decir la
   verdad ("acceso activo, contraseña pendiente"), no "invitación pendiente".
2. **La invitación no se manda.** Devuelve la URL y el front la copia al
   portapapeles; si el admin la pierde, hay que regenerar. Con Wati conectado y
   correo disponible, la invitación se manda sola — y el link copiable queda
   como respaldo, no como único canal.

---

## 5. Cómo se evalúa un permiso

**Backend.** Un decorador `@Permiso('costos.gestionar')` y su guard, en el mismo
lugar donde hoy está `RolesGuard`. Se anota **a nivel controller** —26 líneas
para cubrir 301 endpoints— y se baja a método sólo donde un módulo mezcla
lecturas de todos con escrituras de pocos (Administración y Configuración son
los casos claros).

El default sigue siendo "permitir" mientras se anota, y se invierte a **denegar
por defecto** en un commit propio, cuando los 26 controllers estén cubiertos.
Invertirlo antes rompe todo lo no anotado, y "todo" hoy son 278 endpoints.

**De dónde salen los permisos en cada request.** De la base, con cache en
memoria por `rolId` invalidado al guardar el rol. **No van en el JWT**: un token
firmado con los permisos adentro no se puede cambiar sin re-loguear, y quitarle
un permiso a alguien tiene que surtir efecto en el momento — es lo primero que
hace un admin cuando alguien no debía haber visto algo.

**Frontend.** Los permisos efectivos viajan en `CurrentUser` (ya viaja
`tenantActual.rol`, así que la cañería existe) y filtran `NAV` en el sidebar y
en el buscador. Un módulo sin `ver` **no se muestra**, no se muestra
deshabilitado: la lista de lo que no podés ver es información que no hace falta
dar. Distinto del caso del plan, donde el atenuado ES el mensaje.

El filtro de UI es cortesía, no seguridad: la autorización real es la del API, y
cada pantalla la vuelve a pedir igual.

---

## 6. Fases

**F1 — Cerrar (lo que arregla el agujero). HECHA.**
Tabla `Rol` + `Membership.rolId`, seed de los 5 predefinidos por tenant,
backfill desde el enum, `@Permiso` en los 26 controllers, permisos en la sesión,
sidebar filtrado, y el submódulo Usuarios con listado / invitar / cambiar rol /
desactivar. Cierra con el flip a denegar-por-defecto.

Lo que quedó, con dos diferencias respecto de lo planeado:

- **El rol Operario lleva `produccion.gestionar`, no `produccion.ver`.** No mira
  la producción: la ejecuta —reclama pasos en la mesa, los inicia, los completa—
  y con `ver` no podía fichar. Lo que lo acota no es el permiso sino el tablero,
  que sólo le deja tocar el paso activo. Sigue sin ver Comercial, Costos,
  Administración, Registros, Inventario ni Configuración, que era el agujero.
- **`ordenes-trabajo` se anotó por acción y no por módulo.** Leer y ejecutar una
  orden es `produccion`; crearla, editarle ítems y cambiarle el estado es
  `comercial`. Es el único controller que mira a los dos lados.

Verificado contra el API real con sesiones firmadas de los dos roles: el
operario recibe 403 en `/usuarios`, `/costos/*`, `/clientes`, `/administracion/*`
y `/reportes/*`, y 200 en `/ordenes-trabajo/tablero`, `/auth/me` y
`/tenants/current`.

**F2 — Personalizar (lo que pediste).**
Editor de roles: crear, duplicar un predefinido, matriz de permisos por módulo,
módulos fuera del plan atenuados con su upsell. `usuariosMax` aplicado al
invitar. Invitación por email/WhatsApp automática.

**F3 — Afinar.**
`finanzas.ver_margenes` cableado en los cuatro lugares donde se filtra plata
(cotizador, desglose de OT, panel, reportes), permisos de excepción
(aprobar descuento, anular), auditoría de cambios de acceso — quién le dio qué
a quién y cuándo, que hoy no existe del lado del tenant (`PlataformaEvento` es
del control plane).

F1 es la que no es opcional. F2 es la que pediste y se apoya entera en F1.

---

## 7. Lo que queda abierto

- **`finanzas.ver_margenes` en F1 o F3.** Ponerlo en F1 es más honesto —es el
  permiso que más se pide— pero obliga a auditar cada lugar donde se muestra un
  costo, y son muchos. Ponerlo en F3 deja el vendedor viendo márgenes un tiempo
  más. Mi voto: la clave y el checkbox en F1 (para que el rol Vendedor ya lo
  tenga apagado), el cableado fino en F3.
- **Un usuario, varios roles?** No. Un rol por membership; si hace falta la
  suma, se duplica un rol y se le agregan permisos. Los roles múltiples suenan
  flexibles y terminan en "¿por qué este tipo ve esto?" sin respuesta.
- **Permisos por estación o por centro de costo** (el operario ve sólo su
  estación). Es un eje distinto —alcance de datos, no de módulos— y merece su
  propia decisión. No entra acá.
- **Quién puede tocar Usuarios.** Quedó en `configuracion.gestionar`, con un
  cerrojo: **nadie puede cambiarse a sí mismo el rol ni desactivarse**. Sin eso,
  el único administrador podía dejarse afuera y el tenant quedaba sin quien lo
  arreglara. Sigue abierta la pregunta de fondo: si un rol a medida con
  `configuracion.gestionar` debería poder editar roles, porque entonces puede
  darse a sí mismo cualquier permiso en dos clicks.
- **La invitación sigue entregándose por portapapeles.** El link se copia al
  crear el usuario; mandarlo por mail o WhatsApp es F2. Mientras tanto la
  pantalla lo muestra completo para poder pasarlo a mano.
- **Las pantallas todavía no verifican permisos por su cuenta.** El sidebar
  esconde lo que no corresponde y el API rechaza, pero entrar por URL directa a
  un módulo prohibido muestra la pantalla vacía con errores de carga en vez de
  un "no tenés acceso" prolijo. Es cosmético y va en F2.
