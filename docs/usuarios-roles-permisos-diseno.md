# Usuarios, roles y permisos — diseño

**Fecha:** 2026-07-24
**Estado:** F1, F2 y F3 IMPLEMENTADAS. Ver §6 y §7 para lo que quedó afuera.

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

- **Configuración → Usuarios** es el lugar canónico, en cuatro pestañas —cuatro
  preguntas distintas, y antes era un scroll largo con todo apilado:
  **Usuarios** (quién entra, con qué rol, en qué estado), **Roles y permisos**
  (el editor), **Seguridad** (por ahora, quién está conectado y cerrarle la
  sesión; después, vigencia, segundo factor y desde dónde se puede entrar) y
  **Registro de actividad** (la auditoría).
- Vincular a un empleado es un campo **opcional** del usuario (un select). Sirve
  para lo que ya usa `Empleado.userId`: fichar en la mesa, atribuir comisiones,
  medir desempeño.
- En la ficha del empleado, el formulario de invitación se reemplaza por una
  línea de estado: *"Tiene acceso al sistema como Operario"* con link a
  Usuarios, o *"Sin acceso — darle acceso"* que lleva al mismo lugar con el
  empleado preseleccionado. No se pierde el camino corto; deja de haber dos
  formularios que hacen lo mismo.

### 4.2 La contraseña (agregado después de F3)

Preguntado: *¿la clave no debería poder crearse desde Usuarios?* Mirando el
código apareció algo peor que la pregunta: **no había forma de cambiar una
contraseña**. Ni el propio usuario podía —no existía el endpoint— ni el admin
podía ayudarlo, y sin correo tampoco hay "olvidé mi clave". El link de
invitación no servía: `acceptInvitation` sólo fija la clave si el usuario
**no tiene** una. Al que se la olvidaba no lo sacaba nadie.

Cómo quedó, y por qué así:

- **Al dar de alta se elige cómo entra la primera vez.** *Le mando un link* —el
  de siempre: la persona elige su clave y nadie más la sabe nunca— o *le dicto
  una clave*, que genera la provisoria en el momento. Los dos casos existen en
  un taller: al que tiene mail se le manda el link, al que está parado al lado
  de la máquina se le dicta y listo. El link seguía siendo el único camino, y
  era el frágil: si se perdía, no entraba nadie.
- **El admin restablece, no elige.** Aprieta "Restablecer clave" y el sistema
  genera una provisoria —tres bloques de cuatro, sin caracteres que se confundan
  al dictarlos por teléfono— que se muestra **una sola vez**. No necesita saber
  la clave anterior: el caso es justamente que la persona la olvidó.
- **La provisoria muere en el primer ingreso.** `User.debeCambiarPassword`
  bloquea todo el sistema hasta que la persona elija una propia. Así el que
  administra puede devolver el acceso sin quedar sabiendo con qué clave trabaja
  su gente después — que es lo que volvería discutible la auditoría de §F3: si
  el admin conoce la clave de todos, "esa factura no la anulé yo" es una defensa
  válida.
- **Restablecer corta las sesiones abiertas** de esa persona. Si le cambiás la
  clave a alguien, lo que quedó abierto en otra máquina deja de valer.
- **"Pendiente" significa "todavía no eligió SU clave"**, tanto el que nunca
  entró como el que anda con una provisoria. Mirar sólo si tiene contraseña
  daría por activo a alguien cuya clave la sabe el administrador, que es medio
  activo nada más.
- **Cambiar la propia clave pide la actual**, aunque la sesión esté abierta: una
  sesión olvidada en una máquina prestada no puede alcanzar para quedarse con la
  cuenta. Y cierra las demás sesiones del usuario, porque cambiar la clave es lo
  que hace quien sospecha que se la sabe otro.

Quitar el acceso del todo —el empleado que se fue— ya estaba en F1: desactiva la
membership y revoca sus sesiones en el acto.

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

## 4.3 Restricción por IP (Seguridad)

Pedido: que una cuenta pueda atarse a una IP fija y que desde otra red no entre.
Está, con las decisiones que lo hacen seguro y no un cartel:

- **Se guarda por membership, no por usuario.** Es una política de la EMPRESA:
  la misma persona puede entrar sin restricción a una y sólo desde la oficina a
  otra.
- **Vacío significa "desde cualquier lado"**, no "desde ninguno". Al revés, la
  migración que agregó la columna habría dejado a todo el sistema sin poder
  entrar en el momento del deploy.
- **Se valida en el login Y en cada request.** Sólo en el login no significa
  nada: el que se lleva la notebook a su casa sigue trabajando con la sesión
  abierta. Es comparar strings contra un array que ya vino en el mismo query.
- **También contra el cache de sesión.** Sin eso, quien ya pasó una vez seguiría
  entrando desde cualquier lado durante los 30 s del TTL.
- **Nadie puede dejarse afuera a sí mismo.** Si te restringís a una IP que no es
  desde la que estás mirando, se rechaza con el número en pantalla. Sin ese
  cerrojo, un error de tipeo encierra al administrador fuera de su propio
  sistema y no queda nadie que pueda arreglarlo salvo entrando a la base.
- **El intento bloqueado se registra** en el log de actividad. Sin eso, el que
  no puede entrar llama por teléfono y del otro lado no hay nada que mirar.
- Se aceptan IPs exactas (v4 y v6) y **rangos CIDR v4** — una oficina se
  describe con `/24`, no IP por IP.
- **Se compara contra la IP PÚBLICA**, la que se ve en "cuál es mi IP". Y la
  pantalla avisa cuando lo que el servidor está viendo es una IP interna
  (`10.x`, `192.168.x`, `172.16–31.x`, loopback): eso significa que le falta
  `TRUST_PROXY` y le está viendo la cara al proxy, no al cliente. Guardar una
  interna en ese estado es peor que no restringir: no coincide con ningún
  cliente real, o —si el proxy queda del mismo lado— coincide con todos.

### El problema que había que resolver primero: de dónde sale la IP

No había `trust proxy` configurado. Detrás de un proxy —nginx, Cloudflare, el
router de la nube— eso hace que **toda** request parezca venir de la misma IP: la
del proxy. Dos cosas se rompen con eso, y ninguna avisa:

- El límite por IP del throttler pasa a ser un límite GLOBAL: los 100 pedidos
  por minuto se los reparten todos los usuarios juntos (bug que ya existía).
- Esta restricción o bloquea a todo el mundo o no protege a nadie.

Y confiar de más es peor: si se acepta el `X-Forwarded-For` de cualquiera, se
falsea con una línea de curl. Por eso `TRUST_PROXY` es **explícito y por
variable de entorno** —`1` para un proxy adelante, `2` para proxy + CDN, o una
lista de IPs de confianza— y sin la variable no se confía en nadie, que es lo
correcto en local. **Hay que setearla en producción antes de que esto sirva.**

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

**F2 — Personalizar (lo que pediste). HECHA, menos la invitación automática.**
Editor de roles: crear, editar, eliminar, matriz de tres niveles por módulo
(sin acceso / ver / editar) y los transversales aparte. Los módulos fuera del
plan se muestran atenuados **y se dejan configurar**: el permiso queda guardado
y el rol funciona el día que el tenant sube de plan, en vez de obligar a
reconfigurar después de pagar. `usuariosMax` ya se aplicaba desde F1.

Tres cerrojos, que son lo que hace que la pantalla se pueda dar a un cliente:

1. **Nadie puede dejar la empresa sin administradores.** Sacarle
   `configuracion.gestionar` al último rol que lo tiene se rechaza con un
   mensaje que dice qué hacer. Sin esto había que entrar por la base a
   arreglarlo.
2. **Los roles de fábrica no se renombran ni se borran** — se les ajustan los
   permisos. Son la referencia común entre imprentas: un "Vendedor" que en
   realidad es administrador vuelve inútil hablar de roles con nadie.
3. **Borrar un rol con gente adentro exige decir a dónde se mudan.** Dejarlos
   sin rol los tiraría al fallback del enum, que es un permiso distinto del que
   el admin cree estar sacando.

Además: al cambiarle los permisos a un rol se mueve el `RolSistema` de sus
miembros (el enum lo siguen leyendo los endpoints con `@Roles`, así que sin esto
el cambio arreglaba la mitad) y se invalidan las sesiones cacheadas del tenant,
para que se sienta en el acto.

**Lo que NO entró: la invitación automática.** No es una parte más de F2 —el
proyecto no tiene NADA de email: ni librería, ni proveedor, ni variables de
entorno— así que es elegir e integrar un proveedor desde cero, con su propio
diseño. Por WhatsApp tampoco sale gratis: haría falta una plantilla nueva
aprobada por Meta, y el catálogo de Wati está pensado para clientes finales, no
para el personal. Mientras tanto el link se copia al portapapeles y se puede
regenerar desde el listado, que es lo que faltaba de verdad: antes, perder el
link significaba no poder hacer entrar a nadie.

**F3 — Afinar. HECHA.**

*Ver márgenes, de verdad.* La plata se poda **en el backend**, con un
interceptor que borra los campos sensibles de la respuesta cuando el usuario no
tiene el permiso. Se activa con `@OcultaMargenes()` en los endpoints donde el
costo viaja de arrastre —cotizador, orden de trabajo, presupuestos, reportes— y
NO en el módulo Costos, donde el costo es el contenido y `costos.ver` ya decide
quién entra: podarlo dejaría el módulo mostrando pantallas vacías.

La lista de campos es **explícita y no un prefijo**, y esa decisión tiene un
motivo concreto: el motor tiene `margenesNoImprimiblesMm`, `margenNoUsableMm` y
`margenNoImprimibleMm`, que son márgenes FÍSICOS en milímetros. Podarlos por
parecerse en el nombre rompería el nesting y el cálculo del pliego, en silencio
y sólo para algunos usuarios. Hay un test que los defiende.

Los campos se **borran**, no se ponen en cero: un cero es un dato, se suma, se
promedia y termina en un reporte diciendo que la imprenta trabaja sin costos.

En el front, un `PermisosProvider` en el layout deja preguntar `usePuede()`
desde cualquier componente sin cablear props por cinco niveles. Con eso se
esconden el tab **Finanzas** del panel, el tab **Costos** de la orden y el
bloque **Margen bruto** del cotizador.

*Permisos de excepción.* Dos, los que en una imprenta se piden y los autoriza
otro: `comercial.aprobar_descuento` (aprobar un presupuesto por debajo del
margen mínimo — cotizar no alcanza) y `administracion.anular` (descartar un
comprobante o anular un cobro). Van con backfill: los roles ya sembrados no
reciben permisos nuevos del catálogo por su cuenta —`sembrarPredefinidos` sólo
crea los que faltan, para no pisar lo que el tenant personalizó— así que sin
migración el administrador habría perdido la aprobación el día del deploy.

*Auditoría.* Tabla `EventoAcceso`, append-only, con quién invitó, cambió de rol,
quitó o devolvió acceso, y creó, editó o borró un rol. Los nombres van
CONGELADOS y no por FK: si mañana el actor se da de baja, la línea tiene que
seguir diciendo quién fue. Se muestra al pie de la pantalla de Usuarios.
Registrarla es best-effort: que falle no puede voltear el cambio que el admin
acaba de hacer, pero se loguea fuerte.

F1 es la que no es opcional. F2 es la que pediste y se apoya entera en F1.

---

## 7. Lo que queda abierto

- **Los tres lugares del front que esconden la plata son los que encontré.** El
  backend poda la respuesta, así que un cuarto lugar que la mostrara vería
  campos vacíos en vez de datos ajenos — se rompe feo, no filtra. Aun así, si
  aparece una pantalla nueva que muestra costos, va con su `usePuede`.
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
- **La invitación sigue entregándose por portapapeles.** Mandarla sola necesita
  un proveedor de email que el proyecto todavía no tiene (ver F2). El link se
  copia al crear el usuario y se puede regenerar desde el listado.
- **Un rol a medida con `configuracion.gestionar` puede darse cualquier
  permiso.** El cerrojo impide que el tenant se quede sin administradores, pero
  no impide que quien administra se agregue módulos. Es coherente con lo que
  significa administrar la empresa; si algún día hace falta separar "administra
  usuarios" de "administra todo", el permiso tiene que partirse.
