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

Candidato `bbc881d4d704189fd69b8d0a45f22fac669b07f5` comprobado y publicado en staging y producción con idénticos digests. Ver [staging](../deploy/staging/VALIDACION.md) y [producción](../deploy/produccion/VALIDACION.md). 627 pruebas locales enfocadas; CI HTTP, contenedores, dependencias y CodeQL correctos; preview comercial y Grafo3D comprobadas. No hubo migraciones nuevas, semillas ni resets.

La integración final y el recuento de PR abiertos se registran en [PR #59](https://github.com/studiocamaleon/gdi/pull/59), después del CI del commit documental final. No se desactivan las protecciones. El SHA del merge incluye documentación posterior; los procesos ejecutan la revisión indicada arriba.

La comparación previa al merge demuestra la inclusión de los 51 PR: 48 por historial completo y tres mediante equivalencia/adaptación. El procedimiento de cierre vuelve a comprobar `origin/main`, el head actual de cada PR y su inclusión antes de cerrar; se detiene si encuentra cambios concurrentes. Las ramas se conservan para no afectar otros chats o procesos.

| PR | Inclusión verificada |
| --- | --- |
| [#8](https://github.com/studiocamaleon/gdi/pull/8) | Adaptación de c196b644c |
| [#9](https://github.com/studiocamaleon/gdi/pull/9) | Cambios equivalentes incorporados |
| [#10](https://github.com/studiocamaleon/gdi/pull/10) | Historial conservado |
| [#11](https://github.com/studiocamaleon/gdi/pull/11) | Historial conservado |
| [#12](https://github.com/studiocamaleon/gdi/pull/12) | Historial conservado |
| [#13](https://github.com/studiocamaleon/gdi/pull/13) | Historial conservado |
| [#14](https://github.com/studiocamaleon/gdi/pull/14) | Historial conservado |
| [#15](https://github.com/studiocamaleon/gdi/pull/15) | Historial conservado |
| [#16](https://github.com/studiocamaleon/gdi/pull/16) | Historial conservado |
| [#17](https://github.com/studiocamaleon/gdi/pull/17) | Historial conservado |
| [#18](https://github.com/studiocamaleon/gdi/pull/18) | Historial conservado |
| [#19](https://github.com/studiocamaleon/gdi/pull/19) | Historial conservado |
| [#20](https://github.com/studiocamaleon/gdi/pull/20) | Historial conservado |
| [#21](https://github.com/studiocamaleon/gdi/pull/21) | Historial conservado |
| [#22](https://github.com/studiocamaleon/gdi/pull/22) | Historial conservado |
| [#23](https://github.com/studiocamaleon/gdi/pull/23) | Historial conservado |
| [#24](https://github.com/studiocamaleon/gdi/pull/24) | Historial conservado |
| [#25](https://github.com/studiocamaleon/gdi/pull/25) | Historial conservado |
| [#26](https://github.com/studiocamaleon/gdi/pull/26) | Historial conservado |
| [#27](https://github.com/studiocamaleon/gdi/pull/27) | Historial conservado |
| [#28](https://github.com/studiocamaleon/gdi/pull/28) | Historial conservado |
| [#29](https://github.com/studiocamaleon/gdi/pull/29) | Historial conservado |
| [#30](https://github.com/studiocamaleon/gdi/pull/30) | Historial conservado |
| [#31](https://github.com/studiocamaleon/gdi/pull/31) | Historial conservado |
| [#32](https://github.com/studiocamaleon/gdi/pull/32) | Historial conservado |
| [#33](https://github.com/studiocamaleon/gdi/pull/33) | Historial conservado |
| [#34](https://github.com/studiocamaleon/gdi/pull/34) | Historial conservado |
| [#35](https://github.com/studiocamaleon/gdi/pull/35) | Historial conservado |
| [#36](https://github.com/studiocamaleon/gdi/pull/36) | Historial conservado |
| [#37](https://github.com/studiocamaleon/gdi/pull/37) | Historial conservado |
| [#38](https://github.com/studiocamaleon/gdi/pull/38) | Historial conservado |
| [#39](https://github.com/studiocamaleon/gdi/pull/39) | Historial conservado |
| [#40](https://github.com/studiocamaleon/gdi/pull/40) | Historial conservado |
| [#41](https://github.com/studiocamaleon/gdi/pull/41) | Historial conservado |
| [#42](https://github.com/studiocamaleon/gdi/pull/42) | Historial conservado |
| [#43](https://github.com/studiocamaleon/gdi/pull/43) | Historial conservado |
| [#44](https://github.com/studiocamaleon/gdi/pull/44) | Historial conservado |
| [#45](https://github.com/studiocamaleon/gdi/pull/45) | Historial conservado |
| [#46](https://github.com/studiocamaleon/gdi/pull/46) | Historial conservado |
| [#47](https://github.com/studiocamaleon/gdi/pull/47) | Historial conservado |
| [#48](https://github.com/studiocamaleon/gdi/pull/48) | Historial conservado |
| [#49](https://github.com/studiocamaleon/gdi/pull/49) | Historial conservado |
| [#50](https://github.com/studiocamaleon/gdi/pull/50) | Historial conservado |
| [#51](https://github.com/studiocamaleon/gdi/pull/51) | Historial conservado |
| [#52](https://github.com/studiocamaleon/gdi/pull/52) | Historial conservado |
| [#53](https://github.com/studiocamaleon/gdi/pull/53) | Historial conservado |
| [#54](https://github.com/studiocamaleon/gdi/pull/54) | Historial conservado |
| [#55](https://github.com/studiocamaleon/gdi/pull/55) | Cambios equivalentes incorporados |
| [#56](https://github.com/studiocamaleon/gdi/pull/56) | Historial conservado |
| [#57](https://github.com/studiocamaleon/gdi/pull/57) | Historial conservado |
| [#58](https://github.com/studiocamaleon/gdi/pull/58) | Historial conservado |
