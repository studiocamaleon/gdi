# Rollback Safety Net — Pre-implementación modelo universal

> **Creado**: 2026-04-24
> **Tag git**: `v1.4-pre-implementacion-modelo-universal`
> **DB dump**: `gdi_saas_pre_implementacion_modelo_universal_20260424_1645.sql`
> **Migración stable**: `20260415210000_remove_rol_es_opcional_from_plantilla`

## Cuándo usar este rollback

Si la implementación del modelo universal (Big Bang sobre rama `refactor/modelo-universal-v2`) **falla irrecuperablemente** y hay que volver al estado pre-implementación:

- Errores de schema masivos sin migración inversa.
- Pérdida de datos al rehacer la DB.
- El modelo conceptual revela en implementación gaps no anticipados.
- Cualquier estado donde "salir adelante" sea más costoso que "volver atrás".

## Procedimiento de restauración (15-30 min)

### Paso 1 — Restaurar el código

```bash
cd /Users/lucasgomez/gdi-saas
git fetch --tags
git checkout v1.4-pre-implementacion-modelo-universal
# Opcional: crear nueva rama desde el tag
git checkout -b refactor/modelo-universal-v3 v1.4-pre-implementacion-modelo-universal
```

### Paso 2 — Restaurar la base de datos

```bash
# Asegurar que postgres docker está corriendo
docker start gdi-saas-postgres

# Eliminar DB actual (CUIDADO: esto borra TODO)
docker exec gdi-saas-postgres psql -U postgres -c "DROP DATABASE IF EXISTS gdi_saas;"
docker exec gdi-saas-postgres psql -U postgres -c "CREATE DATABASE gdi_saas;"

# Restaurar dump
docker exec -i gdi-saas-postgres psql -U postgres -d gdi_saas < /Users/lucasgomez/gdi-saas/backups/gdi_saas_pre_implementacion_modelo_universal_20260424_1645.sql
```

### Paso 3 — Verificar Prisma

```bash
cd /Users/lucasgomez/gdi-saas/apps/api
npx prisma generate

# Verificar que la migración stable existe en _prisma_migrations
docker exec gdi-saas-postgres psql -U postgres -d gdi_saas -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;"
# Debería incluir: 20260415210000_remove_rol_es_opcional_from_plantilla
```

### Paso 4 — Smoke test

```bash
cd /Users/lucasgomez/gdi-saas/apps/api && npm run dev
# En otra terminal: probar login + cotizar tarjetas en localhost:3001
# Si responde correcto, rollback completo.
```

## Estado del repo en este punto

- **Branch**: `refactor/modelo-universal-v2`
- **HEAD**: commit `479ba610` (Fase E - validación con 4 productos reales)
- **Análisis cerrado**: Fase A-E completas (docs en `docs/motor-por-pasos-analisis/`).
- **Código**: 5 motores legacy intactos. Nesting + costing parcialmente extraídos.

## Tags safety net históricos (referencia)

| Tag | Punto en el tiempo |
|---|---|
| `v1.0-stable-pre-refactor` | Antes del refactor arquitectónico mayor |
| `v1.1-stable-pre-modelo-universal` | Antes del primer intento de modelo universal (que se rolled back) |
| `v1.2-pre-nesting-extract` | Antes de la extracción de nesting |
| `v1.3-pre-costing-extract` | Antes de la extracción de costing |
| **`v1.4-pre-implementacion-modelo-universal`** | **ESTE — antes del Big Bang de implementación** |

## DB dumps históricos (referencia)

| Archivo | Fecha | Contexto |
|---|---|---|
| `gdi_saas_pre_refactor_20260410_1348.sql` | 2026-04-10 | Pre-refactor mayor |
| `gdi_saas_pre_modelo_universal_20260417_2234.sql` | 2026-04-17 | Pre primer intento modelo universal |
| `gdi_saas_pre_rollback_2026-04-23.sql` | 2026-04-23 | Pre-rollback del intento anterior |
| **`gdi_saas_pre_implementacion_modelo_universal_20260424_1645.sql`** | **2026-04-24 16:45** | **ESTE — antes de Big Bang implementación** |
