# Integración de Visual Ilusión en main — 17/09/2026

## Alcance

Consolidar `visual-ilusion/analisis` en `main` por decisión del usuario. Las fases
pendientes conservan su estado en el [plan maestro](visual-ilusion-plan-maestro.md)
y las nuevas mejoras parten de `main`.

Referencias previas a la integración:

- `main`: `205dcc19b8c6feb4126d62d5cdddd8ac8b50ec87`.
- `visual-ilusion/analisis`: `994b49d9e3d4cb7f5d45e8e25e9c923e91c95251`
  (86 commits por delante de `main`, antes del cierre de validación).
- `codex/grafo3d`: `2057c03919251f1b98033d9b4eae65f2e737e9ab`.
  Se conserva local y remotamente por pedido explícito del usuario; su trabajo
  independiente no se incluye en esta integración.

La limpieza de ramas sólo alcanza referencias cuyos commits estén incorporados
en `main`, después de publicar y verificar `origin/main`.

## Validación

- Web: `npm run build` completado con Turbopack y chequeo TypeScript.
- Frontend: 162 suites, 1.353 pruebas aprobadas en la validación del hito
  `994b49d9e`; el cierre de integración sólo modifica pruebas API y documentación.
- API: `tsc -p tsconfig.build.json --noEmit --incremental false` aprobado.
- Regresión API completa: `jest --runInBand`, 330 suites y 3.034 pruebas
  aprobadas, 10 snapshots aprobados; 4 suites / 12 pruebas omitidas.
  Incluye cotización, persistencia, emisión y ejecución de órdenes reales sobre
  PostgreSQL de prueba, además de cuentas corrientes, aging y facturación.
- Se actualizaron ocho suites de integración para declarar la unidad de los
  precios de sus materiales de prueba históricos. Los anillos y tapas de prueba
  declaran precio por unidad. Se mantiene la validación productiva que rechaza
  precios cuya unidad no está confirmada.
- Los fixtures compartidos restauran las unidades al finalizar; los recorridos
  transaccionales revierten sus cambios junto con la transacción. Todas las
  pruebas API usan la base aislada `gdi_saas_test`.

## Ensayo de migración desde el estado previo al plan

Se restauró el respaldo `visual-ilusion-pre-plan-20260829-181912--03/gdi_saas.dump`
en una base nueva y aislada: `gdi_saas_main_migraciones_20260917`.

El respaldo tenía las 202 migraciones del estado anterior de `main`. Se aplicaron
las 46 nuevas migraciones con `prisma migrate deploy`, hasta completar las 248.
Se fijaron tanto `DATABASE_URL` como `MIGRATE_DATABASE_URL` a la copia de QA.

Las comparaciones por cantidad y hash antes/después confirmaron la conservación
de:

- 36 órdenes y sus importes.
- 55 snapshots de ítems de cotización.
- 238 precios de variantes de materiales.

El respaldo no contiene saldos ni movimientos de stock; por lo tanto este ensayo
no demuestra conservación de stock con datos históricos. Las reglas de stock
se validan con la regresión automatizada.

La base de desarrollo y el respaldo original se conservaron. Este hito de Git
no implica haber desplegado ni migrado otro entorno.
