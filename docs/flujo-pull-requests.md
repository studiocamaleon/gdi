# Ramas y pull requests en Grafo

Una **rama** es una línea de trabajo. Un **commit** guarda un paso. Un **pull request (PR)** reúne los cambios de una rama para revisarlos antes de incorporarlos a otra. **Merge** significa integrar esos cambios conservando su historial.

## El recorrido habitual

1. Definir una mejora concreta y cómo reconocer que funciona. Por ejemplo: filtrar conversaciones sin responder.
2. Partir de `origin/main` actualizado y crear una rama `codex/nombre-de-la-mejora`. Antes de cambiar de rama, comprobar cambios sin guardar y servidores que usan esa carpeta. Si está ocupada, trabajar en otra carpeta aislada.
3. Desarrollar y probar en local, con datos ficticios y tareas programadas desactivadas. Guardar avances en commits pequeños.
4. Abrir un PR en borrador hacia `main`. Explicar el problema, el resultado, las pruebas y lo pendiente. El borrador ya respalda y muestra el trabajo; no significa que esté aprobado.
5. Actualizar staging cuando haya un bloque coherente para probar. Registrar la versión exacta y el resultado en `deploy/staging/VALIDACION.md`. Estar en staging no equivale a estar integrado en `main`.
6. Corregir los problemas encontrados, comprobar permisos y migraciones cuando correspondan y revisar el diff. Pasar a **listo para revisión** cuando el alcance esté terminado y los checks pertinentes pasen.
7. Revisar el PR y sus comprobaciones. Si hay cambios nuevos o cambia su base, comprobar nuevamente lo afectado. Fusionar sólo dentro de la autorización del usuario; actualizar una descripción o desplegar staging no autoriza por sí solo el merge.
8. Completar el cierre de publicación indicado abajo: comprobar producción, registrar sus versiones y dejar fusionados o cerrados los PR incluidos. Si algo queda abierto, explicar el pendiente concreto.
9. Empezar la siguiente mejora desde el nuevo `main`. No reutilizar como contenedor de trabajo la rama de un PR ya integrado.

## Qué ocurre al integrar

| Acción | Resultado |
| --- | --- |
| Abrir o actualizar un PR | Cambia la propuesta de código; no despliega Fly. |
| Ejecutar CI | GitHub compila y comprueba con servicios y datos desechables. No usa la base de staging. |
| Fusionar a `main` | El código pasa a la base común del equipo. Vercel puede generar una versión de la web comercial desde esa rama. |
| Desplegar staging | Se publica una versión elegida de API, aplicación y workers siguiendo el procedimiento de staging. |
| Publicar producción de Grafo | Promueve las imágenes comprobadas en staging por su digest, con configuración y accesos propios. Registrar la revisión ejecutada y comprobar el resultado; un merge no sustituye este proceso. |

La web comercial en Vercel usa `apps/marketing` e incluye Grafo3D. La aplicación, API y workers se despliegan en Fly. Aunque sólo cambie la aplicación, antes de un merge se debe comprobar el impacto sobre la web comercial y su configuración de despliegue.

## Cuántos PR puede haber

Puede haber varios borradores si son trabajos distintos, cada uno con un objetivo, responsable y pendientes claros. Evitar que se acumulen cambios terminados o que un PR crezca con mejoras que deberían ser otro trabajo.

Si una mejora depende de otra aún sin integrar, su PR puede apuntar temporalmente a esa rama. Declarar la dependencia. Al integrar la base, ajustar el PR dependiente hacia `main` y revisar su diff. En una cadena existente, conservar los commits mediante merges evita duplicar cambios; no hacer squash, rebase ni force-push de la cadena sin revisar el efecto en sus dependientes.

La regularización de octubre de 2026 reúne la cadena histórica #8–#58, cuyo código se fue publicando sin completar su integración en `main`. Ver [el registro de regularización](regularizacion-prs-2026-10-10.md). No repetir esa cadena para nuevas mejoras.

## Cuando se sumen más personas

Cada persona trabaja en su propia rama o carpeta aislada. Antes de empezar, acuerden objetivo, responsable y archivos compartidos. Nadie debe cambiar la rama de una carpeta que otra persona o un servidor está usando. Otra persona revisa el PR cuando el equipo lo permita; si Lucas trabaja solo con un agente, igual se revisan el diff y las pruebas antes de integrar.

El control `http` del workflow **Comprobar permisos y separación de empresas** se ejecuta en todos los PR hacia `main`, incluso si sólo cambia un manual. Crea una base desechable, aplica las migraciones y comprueba accesos con empresas ficticias. No utiliza staging. Si falla, primero entender y corregir el resultado; no desactivarlo para integrar el cambio.

Los checks automáticos de contenedores se ejecutan en los PR hacia `main` que cambian código de la aplicación o del despliegue. Los PR que sólo modifican manuales en `docs/` o `AGENTS.md` no los activan. Por ese motivo, un check obligatorio para todos los PR debe correr sin filtros de archivos: de otro modo GitHub podría esperar indefinidamente un resultado que nunca se genera.

La protección de `main` se configura por separado en GitHub: exigir PR, el check `http` de GitHub Actions, la rama actualizada y las conversaciones resueltas; impedir borrado y sobrescritura del historial. Preparar un formulario no activa esa regla: comprobar que GitHub la haya guardado como activa. Si un PR antiguo todavía no contiene el workflow requerido, incorporar la base correspondiente y volver a comprobarlo, sin quitar la protección. Mientras Lucas sea el único revisor humano, no exigir una aprobación externa imposible de obtener; cuando se incorpore otra persona, acordar y activar esa revisión adicional.

**Comprobado el 30/09/2026:** esa protección ya está activa para `main`, sin excepciones de bypass. Una rama antigua que aún no tenga el control `http` debe incorporar el workflow vigente antes de poder integrarse. No desactivar la regla para resolverlo.

Las alertas de Dependabot avisan sobre dependencias vulnerables o maliciosas. CodeQL analiza patrones de riesgo en el código; un análisis que termina correctamente todavía puede tener hallazgos para revisar. Sus alertas sobre `main` pueden corresponder a versiones anteriores a un PR abierto: contrastar siempre la rama y la versión antes de dar algo por corregido. Ninguna de estas herramientas aprueba por sí sola un despliegue a producción.

Nunca incluir claves ni datos reales de clientes en Git. Nunca actualizar un entorno persistente ejecutando un seed o borrando su base. No eliminar ramas o carpetas sólo porque se integró un PR: antes comprobar que ningún trabajo o proceso las sigue usando.


## Cerrar una publicación, de principio a fin

Un despliegue exitoso no termina el trabajo si su código sigue fuera de `main`. Para un pedido que autorice publicar e integrar, completar este recorrido en la misma tarea:

1. **Delimitar el lote.** Enumerar PR y dependencias; comparar sus commits con `main` y con las revisiones realmente desplegadas. Un check verde antiguo o un PR abierto no demuestra qué está en producción.
2. **Validar el candidato.** Revisar código y conflictos, ejecutar pruebas locales pertinentes y CI sobre el último commit. Mantener `http` obligatorio, la rama actualizada y los hilos resueltos. Comprobar también la preview de Vercel si el merge afecta marketing o Grafo3D.
3. **Probar staging.** Compilar en remoto y fijar revisión y digest. Publicar el lote coherente, comprobar el recorrido modificado, accesos, salud, migraciones y workers afectados. Si el usuario va a probarlo, esperar su resultado antes de promoverlo.
4. **Integrar y promover con autorización vigente.** Usar merge que conserve commits cuando haya dependencias. Promover a producción exactamente las imágenes verificadas; no reconstruirlas entre entornos. Se puede registrar la publicación antes del merge final para incluir la evidencia en ese mismo PR, pero completar ambos pasos antes de declarar terminado el lote. No quitar protecciones ni forzar `main`.
5. **Comprobar producción y respaldo.** Verificar revisión ejecutada por servicio, salud y recorrido de lectura pertinente. Mantener recursos y configuración salvo cambio autorizado. Actualizar fuentes cifradas e inventario del copiador y verificar el comprobante posterior. Distinguir esa verificación de una restauración completa.
6. **Cerrar los PR incluidos.** El PR integrado debe quedar `MERGED`. Si un PR fue absorbido por otro o aplicado mediante cherry-pick/adaptación, comprobar que no quedan cambios necesarios y cerrarlo con referencia al PR integrador y a la evidencia de equivalencia. No afirmar que se fusionó si sólo se cerró. No cerrar propuestas independientes por antigüedad.
7. **Verificar el estado final.** Volver a consultar los PR abiertos y `origin/main`. Ningún PR del lote puede quedar abierto sin pendiente explícito. Registrar la revisión del merge y su relación con la revisión ejecutada; pueden diferir por commits documentales. Sólo después iniciar el siguiente trabajo desde `origin/main` actualizado.

La autorización para staging no autoriza producción. La autorización para revisar PR no autoriza fusionarlos. Cuando el usuario autoriza explícitamente integrar, publicar y cerrar el lote, no pedir una confirmación por cada paso o PR. Si falta autorización, preparar el resultado concreto y dejar indicado qué paso espera la decisión; no marcar el lote como terminado.

### Evidencia mínima en cada publicación

- PR incluidos y autorización del alcance; en el PR, resultado y pruebas con enlaces a CI.
- En `deploy/staging/VALIDACION.md` y `deploy/produccion/VALIDACION.md`: fecha, revisión ejecutada, digests, migraciones, recursos, recorrido comprobado, limitaciones y reversión.
- En los README operativos: estado vigente, sin dejar una versión antigua como actual.
- En el cierre del PR: referencia a la integración y al registro de publicación. Si se cierra por absorción, explicar dónde quedó su trabajo.
- Consulta final de PR pendientes. No borrar ramas ni carpetas antes de comprobar que ningún chat, worktree o proceso las usa.

Las correcciones y el registro operativo de un mismo lote pueden ir en varios commits del mismo PR. Evitar abrir otro PR por cada ajuste durante la validación. Después del merge, cualquier mejora nueva comienza en una rama nueva desde la base actualizada.
