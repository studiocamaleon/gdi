# Plan de Rollback — Refactors mayores

Este documento describe cómo volver a un estado estable anterior si alguno de los refactors en curso se vuelve inviable o rompe algo crítico. Cubre **dos puntos de restauración históricos**, del más reciente al más antiguo.

---

## Puntos de restauración disponibles

| Tag | Fecha | Propósito | Dump de DB |
|---|---|---|---|
| `v1.1-stable-pre-modelo-universal` | 2026-04-17 | Antes de la migración al modelo universal de costeo | `backups/gdi_saas_pre_modelo_universal_20260417_2234.sql` (5.3 MB) |
| `v1.0-stable-pre-refactor` | 2026-04-10 | Antes del refactor arquitectónico mayor (módulos transversales) | `backups/gdi_saas_pre_refactor_20260410_1348.sql` (5.0 MB) |

Usar el más reciente por default. El más antiguo sólo si también se quiere revertir el refactor arquitectónico previo (que ya está mergeado a main al 2026-04-17).

---

## Cuándo ejecutar este rollback

**SOLO** cuando:

1. El trabajo en `refactor/modelo-universal` llegó a un estado inconsistente imposible de recuperar con commits normales.
2. Los datos en producción quedan corruptos por una migración mal aplicada.
3. El tiempo estimado para arreglar el estado actual supera al tiempo de volver al punto estable + rehacer el trabajo bueno.
4. El usuario decide descartar la migración y continuar con la arquitectura actual.

**NO** ejecutar por problemas menores. Usar primero:
- Feature flags (`ProductoServicio.motorPreferido = 'v1'`) — segundos.
- `git revert <commit>` — minutos.
- Abandonar sólo una etapa del plan (no mergear su branch) — cero costo.

---

## Plan A — Rollback al punto pre-modelo-universal (lo más común)

Revierte toda la migración al modelo universal, pero preserva el refactor arquitectónico previo (ya mergeado a main).

### Paso 1 — Verificar estado actual

```bash
cd /Users/lucasgomez/gdi-saas
git status
git branch --show-current
```

### Paso 2 — Stashear cambios sin commitear (opcional)

```bash
git stash push -m "rollback modelo-universal: cambios al $(date)"
```

### Paso 3 — Volver al tag estable

```bash
git checkout main
git reset --hard v1.1-stable-pre-modelo-universal
git push origin main --force-with-lease   # confirmar con el equipo antes
```

### Paso 4 — Borrar branch y tags del modelo universal

```bash
git branch -D refactor/modelo-universal
git push origin --delete refactor/modelo-universal
# (opcional) borrar el tag si no querés conservarlo
# git tag -d v1.1-stable-pre-modelo-universal
```

### Paso 5 — Restaurar DB desde el dump

**CUIDADO:** este paso **borra toda la DB actual** y la reemplaza por el snapshot del 2026-04-17.

```bash
docker exec gdi-saas-postgres psql -U postgres -c "DROP DATABASE IF EXISTS gdi_saas;"
docker exec gdi-saas-postgres psql -U postgres -c "CREATE DATABASE gdi_saas;"
docker exec -i gdi-saas-postgres psql -U postgres -d gdi_saas < backups/gdi_saas_pre_modelo_universal_20260417_2234.sql
```

### Paso 6 — Regenerar cliente Prisma y verificar

```bash
cd apps/api
npx prisma generate
npx prisma migrate status
```

Última migración esperada: `20260415210000_remove_rol_es_opcional_from_plantilla` (ver `backups/last_stable_migration.txt`).

### Paso 7 — Verificar arranque del sistema

```bash
# Terminal 1
cd /Users/lucasgomez/gdi-saas/apps/api && npm run start:dev
# Terminal 2
cd /Users/lucasgomez/gdi-saas && npm run dev
```

Validar manualmente:
- Login
- Listar productos
- Cotizar un producto existente (digital, rígido, vinilo, talonario)
- El endpoint `/cotizar-v2` retorna 404 o 501 (no existe en el punto de restauración)

---

## Plan B — Rollback profundo al punto pre-refactor arquitectónico

Revierte tanto la migración al modelo universal **como** el refactor arquitectónico previo. Sólo necesario si ambos esfuerzos fallan.

Mismos pasos que Plan A pero:
- Paso 3: `git reset --hard v1.0-stable-pre-refactor`
- Paso 5: restaurar desde `backups/gdi_saas_pre_refactor_20260410_1348.sql`
- Paso 6: última migración esperada `20260325160000_add_mutar_producto_base_to_checklist_regla_accion`

---

## Plan C — Rescate selectivo de commits

Si durante la migración hay commits aislados que son valiosos por sí solos (bug-fixes, mejoras a motores legacy que deberían preservarse), cherry-pick antes de ejecutar Plan A.

```bash
git log refactor/modelo-universal --oneline
git checkout main
git cherry-pick <sha>
# resolver conflictos si aparecen
```

Después ejecutar Plan A para descartar el resto.

---

## Rollback por etapa (sin reset total)

La mayoría de veces, el rollback que realmente se necesita es más granular. En orden de menor a mayor impacto:

### Nivel 1 — Feature flag por producto

Si un producto migrado a v2 tiene un bug detectado en producción:

```sql
UPDATE "ProductoServicio" SET "motorPreferido" = 'v1' WHERE id = '<producto-id>';
```

Segundos. Sin deploy. Sin rebuild.

### Nivel 2 — Revert de un commit problemático

```bash
git checkout refactor/modelo-universal
git revert <sha-malo>
git push
```

Si el commit ya se había mergeado a la rama de integración, revert del merge commit:

```bash
git revert -m 1 <sha-del-merge>
```

### Nivel 3 — Abandonar una etapa

Si una etapa del plan (ej. Etapa C intento vinyl-cut) no converge:

```bash
# No mergear feature/mu-etapa-C-vinyl a refactor/modelo-universal
git branch -D feature/mu-etapa-C-vinyl   # local
git push origin --delete feature/mu-etapa-C-vinyl   # remoto
```

Documentar razón en bitácora; pasar al siguiente producto/motor.

### Nivel 4 — Abortar la migración entera

Ejecutar Plan A.

---

## Archivos sensibles en main durante el refactor

Para que Plan A (rollback) sea limpio, **no modificar** los siguientes archivos en `main` mientras `refactor/modelo-universal` está activa:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/productos-servicios/productos-servicios.service.ts`
- `apps/api/src/productos-servicios/motors/*.ts`
- `apps/api/src/productos-servicios/pasos/*` (cuando se cree en Etapa A)
- `apps/api/src/productos-servicios/reglas-seleccion/*` (cuando se cree en Etapa A)
- `src/components/productos-servicios/motors/*.tsx`
- `src/lib/productos-servicios*.ts`
- `src/lib/propuestas.ts`
- `src/components/comercial/*.tsx`

Si hay un hotfix crítico en alguno de esos archivos, hacerlo en `main` con commit claro, y después `git merge main` en `refactor/modelo-universal` para sincronizar.

## Archivos safe para hotfixes en main durante el refactor

- Cualquier cosa en `src/app/(dashboard)/` que no sea `/costos/productos/*` ni `/comercial/*`
- Autenticación, tenants, permisos
- Módulo de materias primas base (catálogos)
- Editor de procesos y centros de costo
- Módulo de máquinas/perfiles operativos
- Dashboard, home, configuración

---

## Verificación post-rollback

Después de ejecutar Plan A:

- [ ] `git log --oneline -5` muestra `v1.1-stable-pre-modelo-universal` como HEAD (o un commit hijo si hay cherry-picks)
- [ ] `git tag -l | grep stable` muestra ambos tags (`v1.0-stable-pre-refactor` y `v1.1-stable-pre-modelo-universal`)
- [ ] `docker exec gdi-saas-postgres psql -U postgres -d gdi_saas -c "\dt" | wc -l` coincide con la cantidad esperada de tablas del punto de restauración
- [ ] `cd apps/api && npx prisma migrate status` reporta "database schema is up to date"
- [ ] `cat backups/last_stable_migration.txt` coincide con la última migración aplicada
- [ ] Frontend y backend levantan sin errores
- [ ] Login funciona
- [ ] Se pueden listar productos existentes
- [ ] Se puede cotizar un producto de cada motor activo
- [ ] `cd apps/api && npm test` pasa
- [ ] No queda referencia al endpoint `/cotizar-v2` (si existía)
- [ ] No queda `ProductoServicio.motorPreferido` en el schema (si había llegado a introducirse)

---

## Dry-run del rollback (recomendado al cerrar Etapa A)

Antes de que el refactor avance, validar que Plan A realmente funciona. Pasos para hacerlo sin afectar producción:

1. Crear DB local de prueba:
   ```bash
   docker run --rm -d --name gdi-rollback-test -p 5437:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gdi_saas postgres:16-alpine
   ```
2. Restaurar el dump en la DB de prueba:
   ```bash
   docker exec -i gdi-rollback-test psql -U postgres -d gdi_saas < backups/gdi_saas_pre_modelo_universal_20260417_2234.sql
   ```
3. Verificar:
   ```bash
   docker exec gdi-rollback-test psql -U postgres -d gdi_saas -c "SELECT COUNT(*) FROM \"ProductoServicio\";"
   ```
4. Limpiar:
   ```bash
   docker stop gdi-rollback-test
   ```

Si el restore no funciona (por tamaño del dump, permisos, schema mismatch, etc.), resolver antes de avanzar con la migración. Sin safety net probado, el refactor no es seguro.

---

## Contacto y soporte

Si durante un rollback aparecen errores inesperados:

1. Revisar logs del backend y frontend.
2. Verificar que el dump correcto esté en `backups/` (`ls -lh backups/`).
3. Verificar que los tags existen (`git tag -l`).
4. Último recurso: `git reflog` muestra estados previos al rollback para poder volver atrás del rollback si hiciera falta.

---

_Documento actualizado 2026-04-17 al iniciar la migración al modelo universal de costeo. La sección original (2026-04-10) del refactor arquitectónico previo se preservó reorganizada en este mismo documento._
