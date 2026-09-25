# Grafoprint
## Manual de trabajo seguro

Guía para desarrollar Grafo con ayuda de IA. Es un SaaS: un sistema que varias empresas usan por internet. Pensada para Lucas y futuros colaboradores.

**Edición 1 · 25 de septiembre de 2026 · 10 páginas**

> La IA puede escribir código. El trabajo está terminado cuando entendemos qué cambió, lo probamos y sabemos en qué entorno quedó publicado.

### Qué tenemos hoy

- **Web comercial pública:** grafoprint.com.ar, alojada en Vercel y publicada desde la rama `main`.
- **Aplicación de prueba privada:** staging.grafoprint.com.ar, con aplicación, API y procesos de fondo en Fly; datos en Neon, colas en Redis y archivos en R2.
- **Aplicación para clientes reales:** todavía no está desplegada en producción. Tener la web de venta publicada no significa que el SaaS ya esté abierto.

{{recorrido}}

### Cómo leer esta guía

| Si necesitás entender... | Página |
| --- | --- |
| Qué hace cada servicio y cómo se conectan | 2 |
| Qué cambia entre local, staging y producción | 3 |
| Ramas, commits y GitHub, sin jerga | 4 |
| Cómo pedir y desarrollar una funcionalidad | 5 |
| Pull requests, revisión y pruebas automáticas | 6 |
| Cómo se publica en staging y qué ocurre adentro | 7 |
| Cómo abriremos producción y publicaremos versiones | 8 |
| Cómo trabajarán varios vibecoders | 9 |
| Qué revisar, cómo recuperarnos y dónde consultar | 10 |

**Alcance:** describe lo comprobado hoy y propone un método de trabajo. Las mejoras futuras están marcadas como pendientes. No contiene contraseñas ni autoriza nuevas contrataciones.

---

# 01 · El mapa de Grafoprint

Pensalo como una imprenta: hay un mostrador, un responsable que valida los pedidos, operarios, un archivo de registros y un depósito de archivos.

{{arquitectura}}

| Pieza | Para qué sirve en Grafo |
| --- | --- |
| Donweb y DNS | El dominio está en Donweb. El DNS indica a qué servicio debe llegar cada dirección; no ejecuta Grafo. |
| Vercel | Atiende la web comercial: presentación, planes y páginas legales. Su código vive en `apps/marketing`. |
| Aplicación web en Fly | Son las pantallas donde trabaja cada empresa. Vive en `src/` y se comunica con la API. |
| API en Fly | Aplica reglas, permisos, planes y acceso a datos. Vive en `apps/api`. Ocultar un botón no reemplaza estas validaciones. |
| Neon / PostgreSQL | Guarda información organizada: empresas, usuarios, órdenes, materiales y referencias a archivos. |
| Redis | Organiza la espera y coordinación de trabajos. Permite que los cálculos pesados no dependan de mantener una pantalla abierta. |
| Workers en Fly | Dos procesos separados: uno ejecuta cálculos y otros trabajos; el otro procesa documentos PDF. |
| Gotenberg en Fly | Convierte documentos a PDF. Es un servicio interno, sin acceso público directo. |
| Cloudflare R2 | Conserva archivos como imágenes, diseños y documentos. El depósito es privado; Grafo habilita accesos temporales. |
| GitHub | Guarda código e historial, permite revisar cambios y ejecuta comprobaciones. No es la base de datos de los clientes. |

**Un pedido concreto:** la pantalla pide una acción a la API; ésta verifica empresa y permisos y guarda los datos en Neon. Si el trabajo requiere una cola, lo coordina mediante Redis y un worker. Los archivos pueden quedar en R2. No todas las acciones recorren todos los servicios.

**Tenant** significa empresa cliente. Varias empresas comparten infraestructura y se separan mediante sus identificadores y permisos. Algunos catálogos son globales. Crear otra empresa demo no crea otro servidor ni otro entorno.

Fuentes: configuración del repositorio; [Fly: despliegues](https://docs.fly.io/launch/deploy/); [Cloudflare R2](https://developers.cloudflare.com/r2/).

---

# 02 · Tres entornos, tres propósitos

Un entorno es una instalación con su código, configuración, datos y accesos. Cambiar de rama cambia archivos; no cambia por sí solo la base a la que se conecta la aplicación.

| Entorno | Quién lo usa y para qué | Datos y dirección |
| --- | --- | --- |
| Local | Vos o un colaborador: desarrollar y probar rápido en su computadora. | Datos ficticios locales. Aplicación normalmente en `localhost:3000`. |
| Staging · activo | El equipo: ensayar la versión candidata en servidores reales antes de ofrecerla a clientes. | Datos ficticios propios. `staging.grafoprint.com.ar`. |
| Producción · futura | Las empresas clientes: trabajar con información real. | Recursos y accesos independientes. Aplicación prevista en `app.grafoprint.com.ar`. |

### Local: el taller de desarrollo

La aplicación y la API se ejecutan en la Mac. Docker mantiene servicios de apoyo: PostgreSQL, Redis y el generador de PDF. Los workers se inician cuando la prueba los requiere. Los archivos pueden usar almacenamiento local, según la configuración de desarrollo.

**Al comenzar:** pedir al agente que revise rama, cambios pendientes, conexiones y puertos; luego que inicie sólo lo necesario y entregue la dirección local. Antes de escribir datos, debe confirmar que el destino es local.

**Detalle de esta Mac:** tiene 8 GB de memoria y Docker 4 GB compartidos. No reiniciar Docker ni aumentar recursos automáticamente. La compilación completa de la web se hace remotamente. Marketing y el PDF local usan el puerto 3002 por defecto: elegir un puerto libre para marketing. PostgreSQL local está publicado en 5436.

### Staging: lo contratado y activo

Fly tiene cinco máquinas en São Paulo, con esta memoria RAM: web (1 GB), API (2 GB), worker de cálculos (4 GB), worker PDF (1 GB) y Gotenberg (1 GB). Neon está en São Paulo, con capacidad fija de 0,25 CU (unidad de cómputo); Redis también está en São Paulo. R2 usa un depósito privado con jurisdicción Estados Unidos.

La previsión autorizada es de **USD 150/mes**, incluido Redis, sin Vercel ni impuestos. No es un tope automático. Un entorno de producción agregará consumo propio; más empresas no implican una máquina nueva por empresa.

> Hay tres accesos distintos: la clave de entrada a staging, tu usuario de empresa y tu usuario de administración de Plataforma. No son intercambiables. Las claves no se guardan en este manual.

Existe además un ensayo de contenedores en `deploy/staging/compose.yaml`: crea servicios y datos descartables, principalmente para GitHub. No es el staging real. La rama de Neon llamada `production` pertenece al proyecto de staging; ese nombre no significa que haya clientes reales allí.

---

# 03 · Git y ramas, con un ejemplo

Querés agregar recordatorios a las órdenes. La rama de esa tarea permite trabajar sin mezclarla con una mejora de stock que todavía no está lista.

| Palabra | Significado práctico |
| --- | --- |
| Repositorio | La carpeta del proyecto y su historial de cambios. Git lo registra; GitHub aloja una copia compartida. |
| Rama | Una línea de trabajo sobre el mismo proyecto. Ejemplo: `codex/recordatorios-ordenes`. No es un servidor. |
| Commit | Un punto registrado del código, con un mensaje y un identificador. Permite saber exactamente qué se cambió. |
| Push / pull | Push sube commits a GitHub. Pull incorpora cambios remotos a tu copia; el agente debe revisar antes los cambios locales. |
| Pull request o PR | Una propuesta para integrar una rama en otra, con explicación, diferencias, revisión y pruebas. |
| Merge | La integración de los cambios aprobados en la rama de destino. No equivale siempre a desplegar. |
| Despliegue o deploy | Poner una versión del programa a funcionar en un entorno. |
| Worktree | Otra carpeta de trabajo del mismo repositorio, útil para tareas simultáneas. No duplica bases ni servicios. |

{{ramas}}

### Reglas para usar ramas

**Una tarea coherente, una rama, un PR.** Usar nombres concretos como `codex/fix-cuentas-cobro` o `codex/recordatorios-ordenes`. Una corrección pequeña también merece un cambio identificable; no hace falta una rama por cada archivo.

Guardar commits al completar pasos comprensibles y subirlos a GitHub. No acumular semanas sólo en la Mac. Tras integrar el PR, se puede retirar la rama si no quedan tareas dependientes; el historial permanece.

**`main` es la base común que buscamos mantener estable.** La versión del SaaS que usa un cliente se identifica además por su publicación. Pueden diferir mientras una versión nueva se prueba en staging.

> Hoy seguimos en transición: el PR #2, de `codex/staging-infraestructura` hacia `main`, continúa abierto y en borrador. Hasta integrarlo, las tareas que dependan de esta infraestructura parten de esa base y lo indican. No hay que convertirla en una rama de trabajo eterna.

Referencia: [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow). El flujo y los nombres anteriores son la propuesta adaptada a Grafo.

---

# 04 · Desarrollar una funcionalidad

Este es el proceso de trabajo propuesto. Sirve tanto para una pantalla nueva como para corregir un error.

### 1. Definir el resultado antes del código

Escribir quién necesita la función, qué podrá hacer y cómo comprobaremos que funciona. Separar lo imprescindible de las mejoras que pueden esperar.

**Ejemplo real:** «Al crear una máquina en una empresa vacía, puedo crear una planta sin salir del formulario. Se selecciona automáticamente y se conserva lo que ya escribí. Un usuario sin permiso no puede crearla».

### 2. Darle una tarea acotada al agente

Pedir que lea `AGENTS.md`, revise lo existente y proponga qué partes debe tocar. Si implica cobros, datos, permisos o servicios nuevos, entender ese impacto antes de publicar. No pedir «rehacé todo el módulo» para resolver un error puntual.

### 3. Trabajar en una rama propia

Partir de la base acordada y revisar que no haya cambios ajenos. Para trabajo simultáneo, usar una carpeta de trabajo separada. Dividir las funcionalidades grandes en entregas pequeñas que puedan probarse.

### 4. Implementar y probar cerca del cambio

El agente modifica código y prepara cambios de base si hacen falta. Probar el caso normal, campos vacíos, errores y permisos. Si hay datos por empresa, verificar que una empresa no pueda ver ni cambiar los de otra. En una pantalla, mirar el resultado en navegador.

### 5. Registrar y revisar mediante un PR

Subir los commits y abrir un PR. Debe explicar el problema, la solución y la prueba. Corregir observaciones antes de integrar. Si hace falta probar conexiones reales, se puede reservar staging para el candidato antes de aprobarlo.

### 6. Integrar, ensayar y aceptar

Integrar el cambio aprobado en la base correcta y comprobar el resultado integrado, porque otro cambio puede haber llegado entretanto. Desplegar esa versión en staging cuando corresponda. Lucas o quien represente al usuario prueba el recorrido y registra qué versión aceptó.

### 7. Publicar cuando exista producción

El responsable de publicación decide qué versión probada se libera, cuándo y cómo volver atrás. Publicar, verificar el recorrido real y observar errores. Marcar la tarea terminada con su entorno y evidencia.

> Pedido que podés copiar: «Leé AGENTS.md. Necesito [resultado] para [usuario]. Se acepta cuando [tres casos concretos]. Revisá lo existente, trabajá en una rama propia y probá el cambio. Explicame qué afecta a datos o despliegue. Prepará el PR; la publicación en producción se decide por separado».

**Terminado** significa: comportamiento aceptado, pruebas pertinentes aprobadas, código identificado y situación de despliegue explícita. «El agente dice que está listo» no sustituye esa evidencia.

---

# 05 · Pull requests y revisión

El PR es la ficha del cambio. Reúne qué problema resuelve, qué archivos toca y qué comprobaciones se hicieron. Usarlo también trabajando solo ayuda a detectar cambios inesperados antes de integrarlos.

### Qué debe contar un PR de Grafo

- **Problema:** qué acción fallaba o qué necesitaba el usuario.
- **Resultado:** qué podrá hacer después del cambio.
- **Alcance:** pantallas, reglas y datos afectados; migración si existe.
- **Pruebas:** pasos reproducibles, resultado y captura si cambia la interfaz.
- **Publicación:** entorno, versión candidata y precaución para revertir si corresponde.

Un PR en **borrador** comunica que falta trabajo. Cuando está listo, se solicita revisión. Con colaboradores, otra persona debe revisar; con Lucas solo, conviene separar la implementación de la lectura crítica del cambio y hacer la prueba funcional. Una revisión de IA ayuda, pero no representa por sí sola una aprobación humana.

### Qué hace GitHub Actions hoy

GitHub Actions ejecuta la integración continua (CI): controles automáticos en una computadora temporal. En Grafo, compila API y web, crea una base ficticia, aplica migraciones y comprueba permisos y acceso. Al terminar, elimina los servicios de ese ensayo. **No recibe las claves cloud ni publica en Fly.**

**Límite actual:** corre por cambios relevantes en `codex/staging-infraestructura`. También declara ejecución manual, cuya disponibilidad hay que comprobar para la rama elegida. No está configurado para validar automáticamente todos los PR. Tampoco ejecuta por sí solo todas las pruebas del producto; las pruebas específicas del cambio se ejecutan aparte. El workflow actual se omite si el repositorio deja de ser público, hasta revisar ese presupuesto.

| Acción en GitHub | Qué sucede hoy en Grafo |
| --- | --- |
| Subir una rama o abrir un PR | Comparte código. Puede generar una vista previa de la web comercial en Vercel; esa vista previa no prueba el SaaS. |
| Tener una comprobación verde | Pasó el control que se ejecutó para esa revisión. No demuestra que se haya publicado ni probado toda la aplicación. |
| Integrar en `main` | Puede publicar la web comercial en Vercel. Hay que revisar su impacto antes de integrar. |
| Publicar la aplicación en Fly | Es una operación aparte, sobre una revisión elegida y un entorno concreto. |

> Pendiente de configurar: ampliar CI a los PR y a `main`, y proteger `main` con controles obligatorios. Al revisar este manual, GitHub marca `main` como no protegida. Escribir AGENTS.md no activa esos bloqueos.

Referencias: [PR de GitHub](https://docs.github.com/en/pull-requests/reference/pull-requests), [ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [ejecución manual de Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) y [entornos de Vercel](https://vercel.com/docs/deployments/environments).

---

# 06 · Publicar en staging

El agente puede ejecutar los comandos del procedimiento operativo. Vos necesitás saber qué versión publicará, qué datos cambiará y qué evidencia te entregará.

{{despliegue}}

### El orden correcto y lo que ocurre adentro

**1. Elegir y congelar el candidato.** Registrar el commit, revisar que la carpeta no tenga cambios sin registrar y coordinar el uso de staging. No publicar «lo último» sin identificarlo.

**2. Validar antes de tocar el servidor.** Ejecutar pruebas del cambio y el ensayo remoto del commit correcto. Para una rama nueva, confirmar cómo ejecutar ese control y comprobar que GitHub realmente lo haya iniciado. Si la base cambió al integrar, validar el resultado integrado.

**3. Construir los paquetes.** Un servidor temporal toma el código e instala sus dependencias. Compilar comprueba que las piezas encajen y prepara la versión ejecutable. Docker la empaqueta como una imagen. La imagen queda en el registro de Fly con un identificador exacto.

**4. Preparar los datos, si cambiaron.** Una migración es una instrucción versionada para modificar la estructura o agregar datos necesarios. Se ensaya primero en una base descartable y se aplica una sola vez a Neon staging. Usa un acceso especial, diferente del de la aplicación. No se ejecuta el seed de desarrollo, que borra datos.

**5. Actualizar los servicios afectados.** Primero las migraciones compatibles; luego API y workers; finalmente la web. API y workers pueden reutilizar la misma imagen backend. Gotenberg sólo se cambia si hace falta. Si una migración no convive con la versión anterior, planificar otro procedimiento antes de ejecutarla.

**6. Esperar arranque y salud.** Fly descarga la imagen, reemplaza el proceso y le entrega sus secretos guardados. Los datos permanecen en Neon y R2, fuera de la máquina reemplazada. Los workers deben cerrar o recuperar trabajos correctamente. Con una máquina por servicio puede haber una interrupción breve.

**7. Probar como usuario.** Abrir la dirección de staging, ingresar y completar el recorrido afectado. Revisar también errores y trabajos en cola si corresponden. Que el servidor responda «saludable» no garantiza que el formulario funcione.

**8. Registrar y limpiar.** Anotar commit, imágenes, migraciones, resultado y pendientes. Retirar sólo el servidor temporal de compilación identificado, sin eliminar los servicios de Grafo. Informar qué datos de prueba quedaron.

> Pedido de despliegue: «Publicá en staging el commit [identificador] después de validar. Confirmá destino y migraciones, conservá los tamaños acordados, avisá al iniciar el recambio y probá [recorrido]. Entregame versión publicada, resultado y pendientes».

Procedimiento técnico: `deploy/staging/README.md`. Evidencia: `deploy/staging/VALIDACION.md`. Conceptos: [despliegue en Fly](https://docs.fly.io/launch/deploy/).

---

# 07 · Cuando abramos producción

Producción será otra instalación de la aplicación, con clientes y datos reales. Staging seguirá existiendo para ensayar mejoras. No hay que convertir la base demo en la base de clientes.

{{produccion}}

### Antes de recibir al primer cliente

**A. Consolidar la base de código.** Revisar e integrar el PR #2 cuando se apruebe, comprobar su efecto en la web comercial y adoptar ramas cortas desde `main`. Generalizar las pruebas automáticas y configurar protecciones. Son tareas pendientes, no acciones realizadas al escribir esta guía.

**B. Crear recursos separados.** Apps de Fly, PostgreSQL en Neon, Redis, depósito R2 y secretos exclusivos para producción. Las direcciones previstas son `app.grafoprint.com.ar` y `api.grafoprint.com.ar`; deben configurarse y comprobarse. Las claves y datos de staging no se reutilizan.

**C. Preparar la operación.** Ensayar recuperación de datos, definir retención de respaldos, alertas de errores y uso de recursos, responsables y presupuesto. Probar carga y recuperación de trabajos. Una réplica de Redis no equivale a un respaldo recuperable, y el historial de Git tampoco respalda datos.

**D. Completar recorridos reales.** Alta de empresa, acceso, permisos, archivos, documentos y funciones incluidas en el lanzamiento. Configurar el correo transaccional. Integraciones de cobros o WhatsApp necesitan sus pruebas y habilitaciones propias; el deploy no las resuelve automáticamente.

**E. Abrir gradualmente.** Empezar con pocos clientes, observar errores y tiempos, y ampliar después. Activar los botones comerciales de acceso y contratación cuando el servicio y sus recorridos estén listos.

### Cómo publicar cada mejora después

1. Integrar sólo cambios revisados en `main` y elegir una versión candidata.
2. Probar esa versión integrada en staging y registrar la aceptación funcional.
3. Publicar en producción con autorización del responsable, recuperación prevista y cambios de base revisados.
4. Usar las mismas imágenes probadas cuando la configuración lo permita. Si hace falta otra compilación, validar ese paquete antes de abrirlo a clientes.
5. Comprobar acceso y función afectada, observar errores y registrar la versión publicada.

**El código viaja; los datos no.** Pasan los cambios aprobados y las migraciones necesarias. No se copian las órdenes, usuarios, saldos ni archivos ficticios de staging a producción.

La web comercial es una publicación independiente. Integrar en `main` puede actualizarla aunque la publicación del SaaS espere. Por eso la revisión de marketing ocurre antes de ese merge. Si más adelante se desea aprobación manual para esa web, habrá que configurar expresamente otro flujo.

---

# 08 · Trabajar con otros vibecoders

La metodología profesional es coordinar cambios pequeños y comprobables. Tener más agentes escribiendo a la vez no reemplaza repartir responsabilidades.

### Organización mínima

| Responsabilidad | Qué decide o entrega |
| --- | --- |
| Lucas / responsable de producto | Ordena prioridades y define cuándo una función resuelve la necesidad. |
| Autor de la tarea | Implementa con IA, entiende el cambio, lo prueba y explica su PR. |
| Revisor | Otra persona evalúa alcance, datos y evidencia; pide correcciones. |
| Responsable de publicación | Reserva staging, identifica la versión y publica la que fue aceptada. Al principio puede ser Lucas. |

### Acuerdo diario del equipo

**Una ficha por tarea.** Registrar objetivo, responsable, criterio de aceptación y dependencia. Tablero: Pendiente, En desarrollo, En revisión, En prueba y Terminado. Evitar tareas duplicadas.

**Una rama y una carpeta por tarea activa.** Usar computadoras o worktrees separados para evitar que dos agentes se pisen archivos. Elegir bases locales, puertos y colas que no se interfieran: el worktree no los separa.

**PR pequeños y revisión cruzada.** Integrar de a uno. Actualizar la base y volver a probar lo afectado después de resolver conflictos. Un conflicto indica cambios incompatibles sobre el mismo lugar; no elegir una versión a ciegas para que desaparezca el aviso.

**Un turno de publicación a staging.** Anotar versión, responsable y prueba en curso. Otro despliegue puede invalidar lo que alguien estaba probando. Usar empresas demo distintas para reducir choques de datos, sabiendo que siguen compartiendo el mismo código y servicios.

**Cambios compartidos, coordinados.** Acordar el alcance antes de modificar usuarios, permisos, planes, base o componentes comunes. Entregar las funciones grandes por partes compatibles; un interruptor de activación sólo ayuda si está implementado y probado.

### Incorporar a una persona, paso a paso

1. Cuenta individual y accesos mínimos en GitHub; leer este manual y AGENTS.md.
2. Preparar copia local y datos ficticios; compartir los secretos necesarios por un medio privado, nunca en un PR.
3. Resolver una tarea pequeña, abrir su PR y revisarlo juntos antes de ampliar permisos.
4. Acceso a staging cuando su trabajo lo requiera. Producción sólo para quien realmente la opere.
5. Al salir del equipo, retirar sus accesos y revisar las credenciales compartidas.

> AGENTS.md fija instrucciones para los agentes. Los PR registran la revisión. Las protecciones de GitHub y los permisos aplican límites reales. Son herramientas complementarias; ninguna por sí sola asegura un cambio correcto.

---

# 09 · Seguridad cotidiana y recuperación

### La lista corta antes de dar una tarea por terminada

- Sé qué problema resolvimos y qué quedó fuera.
- Conozco la rama, el PR y la versión que se probó.
- Se comprobaron el caso normal y los errores o permisos afectados.
- Si cambió la base, la migración fue ensayada y su destino confirmado.
- Vi funcionar el recorrido en el entorno que corresponde.
- No hay claves, conexiones privadas o datos de clientes en el código o las capturas.
- Quedó claro si está preparado, subido a GitHub, integrado o desplegado.
- Se registró cómo recuperar el servicio y quién decide una publicación.

### Si algo falla, actuar según el momento

| Qué pasó | Qué hacer |
| --- | --- |
| Falló una prueba o compilación | Corregir en la rama y repetir el control pertinente. No quitar la validación para publicar. |
| Falló la subida de la imagen | Verificar si llegó a publicarse. Reintentar la transferencia o reutilizar la compilación; no aplicar migraciones a ciegas. |
| La versión nueva falla al arrancar | Revisar estado y registros. Recuperar la imagen anterior si sigue siendo compatible con la base y los trabajos pendientes. |
| El error alteró datos | Detener la operación que los daña, evaluar alcance y recuperar de forma controlada. Volver al código anterior no restaura esos datos. |
| Aparece una clave en Git o en una captura | Revocar o rotar la clave afectada y revisar su exposición. Borrar sólo el texto visible no elimina copias ni historial. |

**Respaldos:** Neon conserva hoy un día de historial en staging, según la configuración registrada; el ensayo de restauración sigue pendiente. La recuperación de PostgreSQL no repone por sí sola los archivos de R2 ni la cola de Redis. Antes de producción debe existir un plan probado para cada parte.

### Tres preguntas útiles para tu agente

**Antes:** «¿Desde qué rama partimos, qué entorno y datos vas a usar, y cómo sabremos que funciona?»

**Durante:** «¿Qué cambió respecto del pedido y qué resultado comprobaste realmente?»

**Al terminar:** «¿Qué versión quedó en cada entorno, cómo la pruebo y cómo se recupera si falla?»

### Dónde está la información que se mantiene viva

**Reglas:** `AGENTS.md`. **Manual editable:** `docs/manual-desarrollo-grafoprint.md`. **Operación y evidencia:** `deploy/staging/README.md` y `VALIDACION.md`. **Pruebas automáticas:** `.github/workflows/staging-validation.yml`. **Historial y revisiones:** [repositorio y PR de Grafoprint](https://github.com/studiocamaleon/gdi/pulls).

Esta edición se contrastó con archivos, GitHub y las cinco máquinas de Fly el 25/09/2026. Los datos de Neon, Redis y R2 se tomaron de la configuración y los ensayos registrados ese día. Revisar el manual cuando cambien infraestructura o forma de publicación. Las referencias oficiales están enlazadas en sus apartados.
