# Regularización de PR — 10/10/2026

## Alcance autorizado

El titular autorizó ordenar y resolver todos los PR pendientes, actualizar `main`, cerrar los PR incluidos y documentar el ciclo. También aprobó la prueba de staging del PR #58 y su promoción a producción.

## Diagnóstico

Había 51 PR abiertos (#8–#58): 40 borradores y 11 listos. `main` permanecía en `7e58b0735`, mientras producción ejecutaba `15014c464`: 270 commits posteriores. Los despliegues de Fly se habían realizado desde ramas dependientes sin completar su integración. Una actualización de Fly no cierra PR ni actualiza `main`.

48 propuestas ya estaban incorporadas o tenían una versión equivalente/adaptada en producción. Los pendientes funcionales eran #21 (recuperación de sesión), #57 (500 MB) y #58 (Planificación compacta y ampliada, aprobada en staging).

## Integración

La rama `codex/regularizar-main-prs` parte de la última rama probada, como excepción explícita para recuperar el historial completo; su PR apunta a `main`. Conserva los commits anteriores e integra #21 y #57 mediante merge. Incorpora también el registro histórico de #19 sin reemplazar los estados operativos actuales por los de octubre 3. Los conflictos son documentales.

El PR #8 se incorporó adaptado en `c196b644c` (origen `ce4e06fca`); no se reaplica la versión antigua sobre los controles de sesión actuales. #9 y #55 tienen cambios equivalentes incorporados. Los PR cuyo head sea ancestro del merge quedan incluidos por historial; los absorbidos se cierran con referencia a esta integración, sin presentarlos como merges individuales.

Los fallos históricos de #32 (matriz de permisos) y #46 (fixture sin vendedor) se contrastan con sus versiones posteriores. El fallo de #54 corresponde a dos pruebas de tiempo de operación; no se atribuye a infraestructura sin evidencia. El último CI del lote es el que habilita la integración. Se conservan las protecciones de `main`.

## Verificación y cierre

Pendiente de completar con la evidencia de esta publicación. No interpretar este documento como confirmación de un despliegue o merge todavía no efectuado.
