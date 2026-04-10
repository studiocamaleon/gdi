# Plan de Rollback — Refactor Arquitectónico Mayor

Este documento describe cómo volver al sistema estable anterior al refactor de módulos transversales en caso de que el refactor se vuelva inviable o rompa algo crítico.

---

## Punto de restauración

- **Tag git:** `v1.0-stable-pre-refactor`
- **Commit:** `e8a3d1be` (merge de feature-troquelados en main)
- **Fecha:** 2026-04-10
- **Última migración estable:** `20260325160000_add_mutar_producto_base_to_checklist_regla_accion`
- **Dump de base de datos:** `backups/gdi_saas_pre_refactor_20260410_1348.sql` (5.0 MB, 68 tablas)

---

## Estado del sistema en el punto de restauración

- 5 motores funcionales:
  - `impresion_digital_laser` (con soporte completo de troquelado)
  - `gran_formato`
  - `vinilo_corte`
  - `talonario`
  - `rigidos_impresos`
- 40 migraciones Prisma aplicadas
- 4 archivos de tests jest
- Base de datos PostgreSQL con schema + datos

---

## Cuándo ejecutar este rollback

Ejecutar **SOLO** si se cumple alguna de estas condiciones:

1. El refactor ha llegado a un estado inconsistente imposible de recuperar por commits normales
2. Los datos están corruptos por una migración mal aplicada
3. El tiempo estimado para arreglar el estado actual supera al tiempo de volver al punto estable + rehacer el trabajo bueno
4. El usuario decide descartar el refactor y continuar con la arquitectura actual

**NO** ejecutar por problemas menores: usar `git revert <commit>` o fixes incrementales primero.

---

## Plan A — Descarte completo (rollback total)

### Paso 1: Verificar estado actual
```bash
cd /Users/lucasgomez/gdi-saas
git status
git branch --show-current
```

### Paso 2: Stashear cualquier cambio pendiente (si querés salvarlo)
```bash
git stash push -m "rollback: cambios sin commitear al momento del rollback $(date)"
```

### Paso 3: Volver al tag estable en main
```bash
git checkout main
git reset --hard v1.0-stable-pre-refactor
```

### Paso 4: Borrar la branch del refactor
```bash
git branch -D refactor/modulos-transversales
```

### Paso 5: Restaurar la base de datos desde el dump

**IMPORTANTE:** Este paso **BORRA TODA la base de datos actual** y la reemplaza por el snapshot del punto estable.

```bash
# Dropear la DB actual
docker exec gdi-saas-postgres psql -U postgres -c "DROP DATABASE IF EXISTS gdi_saas;"
docker exec gdi-saas-postgres psql -U postgres -c "CREATE DATABASE gdi_saas;"

# Restaurar desde el dump
docker exec -i gdi-saas-postgres psql -U postgres -d gdi_saas < backups/gdi_saas_pre_refactor_20260410_1348.sql
```

### Paso 6: Regenerar cliente Prisma y verificar
```bash
cd apps/api
npx prisma generate
npx prisma migrate status
```

El comando `migrate status` debería decir que la última migración aplicada es `20260325160000_add_mutar_producto_base_to_checklist_regla_accion` (la misma que está en `backups/last_stable_migration.txt`).

### Paso 7: Verificar que el sistema arranca
```bash
# Backend
cd /Users/lucasgomez/gdi-saas/apps/api
npm run start:dev

# Frontend (otra terminal)
cd /Users/lucasgomez/gdi-saas
npm run dev
```

Ambos deberían levantar sin errores. Probar manualmente:
- Login
- Listar productos
- Cotizar un producto existente
- Crear un producto con troquelado digital laser

---

## Plan B — Rescate selectivo de commits

Si durante el refactor se hicieron commits aislados que son estables por sí solos (por ejemplo: un fix de un bug en un motor existente), se pueden rescatar con cherry-pick.

### Paso 1: Identificar los commits a rescatar
```bash
git log refactor/modulos-transversales --oneline
```

### Paso 2: Cherry-pick uno por uno a main
```bash
git checkout main
git cherry-pick <commit-hash>
# Resolver conflictos si los hay
```

### Paso 3: Luego ejecutar Plan A para descartar el resto del refactor

---

## Archivos que NO deben modificarse en main durante el refactor

Para que el rollback sea limpio, **no hay que tocar los siguientes archivos en `main`** mientras el refactor está en curso en `refactor/modulos-transversales`:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/productos-servicios/productos-servicios.service.ts`
- `apps/api/src/productos-servicios/motors/*.ts`
- `src/components/productos-servicios/motors/*.tsx`
- `src/lib/productos-servicios*.ts`

Si hay que hacer un hotfix en estos archivos, hacerlo en `main` con un commit claro y luego hacer `merge main` en `refactor/modulos-transversales` para mantener sincronía.

---

## Archivos safe para hotfixes en main durante el refactor

- Cualquier cosa en `/src/app/(dashboard)/` que no sea productos/cotización
- Autenticación, tenants, permisos
- Módulo de materias primas base
- Editor de procesos y centros de costo
- Módulo de máquinas/perfiles operativos
- Dashboard, home, configuración
- Correcciones de bugs visuales en componentes compartidos

---

## Verificación post-rollback

Después de ejecutar Plan A, correr este checklist:

- [ ] `git log --oneline -5` muestra `v1.0-stable-pre-refactor` como HEAD
- [ ] `git tag -l | grep v1.0` muestra el tag
- [ ] `docker exec gdi-saas-postgres psql -U postgres -d gdi_saas -c "\dt"` lista 68 tablas
- [ ] `npx prisma migrate status` reporta "database is up to date"
- [ ] El sistema arranca (frontend + backend sin errores)
- [ ] Se puede loguear al sistema
- [ ] Se pueden listar productos existentes
- [ ] Se puede cotizar un producto con troquelado digital laser
- [ ] Los tests pasan: `cd apps/api && npm test`

---

## Contacto y soporte

Si durante el rollback aparecen errores inesperados:

1. Revisar los logs del backend y frontend
2. Verificar que el dump de DB es el correcto (`ls -lh backups/`)
3. Verificar que el tag existe (`git tag -l v1.0-stable-pre-refactor`)
4. Si todo falla, tenemos git reflog como última red: `git reflog` puede mostrar el estado previo al rollback para poder volver atrás del rollback

---

_Documento generado el 2026-04-10 como parte de la preparación del refactor de módulos transversales. Ver `docs/refactor-plan.md` para el plan completo del refactor._
