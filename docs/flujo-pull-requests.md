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
8. Empezar la siguiente mejora desde el nuevo `main`. No reutilizar como contenedor de trabajo la rama de un PR ya integrado.

## Qué ocurre al integrar

| Acción | Resultado |
| --- | --- |
| Abrir o actualizar un PR | Cambia la propuesta de código; no despliega Fly. |
| Ejecutar CI | GitHub compila y comprueba con servicios y datos desechables. No usa la base de staging. |
| Fusionar a `main` | El código pasa a la base común del equipo. Vercel puede generar una versión de la web comercial desde esa rama. |
| Desplegar staging | Se publica una versión elegida de API, aplicación y workers siguiendo el procedimiento de staging. |
| Publicar la futura producción de Grafo | Requiere su propia configuración, base, secretos, migraciones y autorización. Un merge no sustituye este proceso. |

La web comercial en Vercel usa `apps/marketing` e incluye Grafo3D. La aplicación, API y workers se despliegan en Fly. Aunque sólo cambie la aplicación, antes de un merge se debe comprobar el impacto sobre la web comercial y su configuración de despliegue.

## Cuántos PR puede haber

Puede haber varios borradores si son trabajos distintos, cada uno con un objetivo, responsable y pendientes claros. Evitar que se acumulen cambios terminados o que un PR crezca con mejoras que deberían ser otro trabajo.

Si una mejora depende de otra aún sin integrar, su PR puede apuntar temporalmente a esa rama. Declarar la dependencia. Al integrar la base, ajustar el PR dependiente hacia `main` y revisar su diff. En una cadena existente, conservar los commits mediante merges evita duplicar cambios; no hacer squash, rebase ni force-push de la cadena sin revisar el efecto en sus dependientes.

Los PR históricos #2–#7 ya se integraron en `main`: reúnen infraestructura, correcciones, piloto e Inbox. La recuperación ante cortes se revisa por separado en #8. Llamadas, presencia real de operadores y reportes deben ser trabajos nuevos cuando la base necesaria esté lista.

## Cuando se sumen más personas

Cada persona trabaja en su propia rama o carpeta aislada. Antes de empezar, acuerden objetivo, responsable y archivos compartidos. Nadie debe cambiar la rama de una carpeta que otra persona o un servidor está usando. Otra persona revisa el PR cuando el equipo lo permita; si Lucas trabaja solo con un agente, igual se revisan el diff y las pruebas antes de integrar.

El control `http` del workflow **Comprobar permisos y separación de empresas** se ejecuta en todos los PR hacia `main`, incluso si sólo cambia un manual. Crea una base desechable, aplica las migraciones y comprueba accesos con empresas ficticias. No utiliza staging. Si falla, primero entender y corregir el resultado; no desactivarlo para integrar el cambio.

Los checks automáticos de contenedores se ejecutan en los PR hacia `main` que cambian código de la aplicación o del despliegue. Los PR que sólo modifican manuales en `docs/` o `AGENTS.md` no los activan. Por ese motivo, un check obligatorio para todos los PR debe correr sin filtros de archivos: de otro modo GitHub podría esperar indefinidamente un resultado que nunca se genera.

La protección de `main` se configura por separado en GitHub: exigir PR, el check `http` de GitHub Actions, la rama actualizada y las conversaciones resueltas; impedir borrado y sobrescritura del historial. Preparar un formulario no activa esa regla: comprobar que GitHub la haya guardado como activa. Si un PR antiguo todavía no contiene el workflow requerido, incorporar la base correspondiente y volver a comprobarlo, sin quitar la protección. Mientras Lucas sea el único revisor humano, no exigir una aprobación externa imposible de obtener; cuando se incorpore otra persona, acordar y activar esa revisión adicional.

**Comprobado el 30/09/2026:** esa protección ya está activa para `main`, sin excepciones de bypass. Una rama antigua que aún no tenga el control `http` debe incorporar el workflow vigente antes de poder integrarse. No desactivar la regla para resolverlo.

Las alertas de Dependabot avisan sobre dependencias vulnerables o maliciosas. CodeQL analiza patrones de riesgo en el código; un análisis que termina correctamente todavía puede tener hallazgos para revisar. Sus alertas sobre `main` pueden corresponder a versiones anteriores a un PR abierto: contrastar siempre la rama y la versión antes de dar algo por corregido. Ninguna de estas herramientas aprueba por sí sola un despliegue a producción.

Nunca incluir claves ni datos reales de clientes en Git. Nunca actualizar un entorno persistente ejecutando un seed o borrando su base. No eliminar ramas o carpetas sólo porque se integró un PR: antes comprobar que ningún trabajo o proceso las sigue usando.
