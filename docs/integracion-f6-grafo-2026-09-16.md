# Integración de F6 y renovación de Grafo

Origen: `codex/f6-entregas-planificacion`. Destino: `visual-ilusion/analisis`.

Se integra todo el avance acumulado de la rama, incluidos los cambios locales
de reportes, Administración y cuenta corriente. Se conservan los commits previos
de planificación, entregas, producción, web y rediseño de los módulos. Esta
integración no amplía ni declara cerrados los alcances futuros de F6.

## Correcciones encontradas durante la revisión

- La planificación redondeaba hacia arriba cada fase por separado. En la
  cotización del exhibidor de 150 unidades, dos milisegundos adicionales
  desplazaban el fin del viernes al lunes. Ahora se cuantizan los límites
  acumulados, conservando el total a resolución de milisegundos. App y API usan
  la misma regla; no se cambian la cotización ni los calendarios.
- Se agrega regresión de cierre del viernes con atención personal, tanto para
  el motor de navegador como para el de API. La prueba original del exhibidor
  conserva su fecha esperada y vuelve a pasar.
- La prueba de permisos de Pagos distingue carga de consulta terminada. Durante
  la carga no muestra importes ficticios ni ofrece registrar un cobro.
- Las pruebas de ejecución actualizan el mensaje de asignación y declaran tiempo
  o confirman su ausencia al completar instantáneamente. Se mantiene el rechazo
  de trabajos ajenos y los controles de tiempos reales del producto.
- La prueba del ciclo de un cheque ordena explícitamente sus eventos por fecha
  de creación; PostgreSQL no garantiza el orden de una consulta sin `orderBy`.

## Verificación

- Interfaz: 158 suites, **1.311 pruebas aprobadas**.
- API: corrida completa contra `gdi_saas_test`, con 2.883 aprobadas y ocho fallos
  de fixtures/expectativas en cinco suites. Tras corregirlos, se ejecutaron esas
  cinco suites y la del motor de flujo: **55 pruebas aprobadas**, ningún fallo.
  Quedan 12 pruebas optativas omitidas en la corrida general. Diez snapshots
  aprobados. No se ejecutaron tests contra la base de desarrollo.
- TypeScript de producción API aprobado.
- Build de producción de Next.js y su validación TypeScript aprobados.
- ESLint de los 91 archivos de interfaz nuevos/modificados: sin errores. Conserva
  una advertencia de compatibilidad de React Compiler con TanStack Table en
  Cuentas por cobrar; esa optimización se omite para el componente.
- CSS Guard aprobado, sin nuevas clases globales. Revisión de whitespace aprobada.

Los scripts de datos demo y reconciliación quedan versionados; integrarlos no
los ejecuta ni cambia los datos de la app. Los respaldos, bases y archivos locales
ignorados permanecen en disco, fuera del commit.
